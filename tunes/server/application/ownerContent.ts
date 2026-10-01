import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v3';
import type { Actor } from './actor';
import { authorizeOperation } from './authorization';
import { parseContent } from './recommendations';
import { RecommendationFailure } from '../repositories/explorersRecommendationRepository';
import { contentIdSchema } from '../../shared/explorersContract';
import * as wire from '../../shared/explorersOwnerContentContract';

export const OWNER_PAGE_BYTES=4*1024*1024;
const VERSION='explorers-owner-content/v2' as const;
const snapshotSchema=z.object({v:z.literal(2),account:z.string().uuid(),category:z.string(),revision:z.string(),issued:z.number().int(),expires:z.number().int()}).strict();
const cursorSchema=z.object({v:z.literal(2),binding:z.string(),snapshotToken:z.string().max(4096),order:z.number().int().nonnegative(),id:z.string().uuid(),secondary:z.string().uuid().optional()}).strict();
type Snapshot=z.infer<typeof snapshotSchema>;
type Cursor=z.infer<typeof cursorSchema>;
// Compute the exact emitted JSON scalar bytes inside SQL, returning only a
// numeric indicator before any unbounded text crosses the database connection.
const collectionFields={id:'c.id',accountId:'c.account_id',category:'c.category',title:'c.title',slug:'c.slug',visibility:'c.visibility',publicationState:'c.publication_state',revision:'c.revision',description:'c.description',heading:'c.heading',coverMediaId:'m.media_id',archived:'(c.archived_at IS NOT NULL)',displayOrder:'c.display_order'};
const collectionBytes=`octet_length(convert_to('{'||${Object.entries(collectionFields).map(([key,column],n)=>`'${n?',':''}"${key}":'||coalesce(to_json(${column})::text,'null')`).join('||')}||'}','UTF8'))`;
const collectionProjection='c.id,c.account_id,c.category,c.title,c.slug,c.visibility,c.publication_state,c.revision,c.archived_at,c.display_order,c.description,c.heading,m.media_id AS cover_media_id';
const collectionJoin="FROM collections c LEFT JOIN collection_media m ON m.collection_id=c.id AND m.account_id=c.account_id AND m.slot='cover'";
const recommendationProjection='r.id,r.account_id,r.category,r.entity_id,r.user_rating,r.publication_state,r.revision,r.archived_at';
const statusPredicate=(alias:string,status:string)=>status==='all'?'TRUE':`${alias}.archived_at IS ${status==='active'?'':'NOT '}NULL`;

/** Short Actor-scoped reads. Tokens describe data and never grant authority. */
export class OwnerContentService {
 private readonly key:Buffer;
 constructor(private readonly pool:Pool,secret:string) {this.key=createHash('sha256').update('explorers-owner-content/v2\0').update(secret).digest();}
 private decode<T>(value:string,domain:string,schema:z.ZodType<T>):T {
  try {
   if(value.length>4096) throw new Error();
   const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value||bytes.length<29) throw new Error();
   const cipher=createDecipheriv('aes-256-gcm',this.key,bytes.subarray(0,12));cipher.setAAD(Buffer.from(`${VERSION}/${domain}`));cipher.setAuthTag(bytes.subarray(12,28));
   return schema.parse(JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8')));
  } catch {throw new RecommendationFailure(422,'Invalid snapshot or continuation');}
 }
 private token(value:unknown,domain:string) {
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);cipher.setAAD(Buffer.from(`${VERSION}/${domain}`));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const token=Buffer.concat([nonce,cipher.getAuthTag(),data]).toString('base64url');
  if(token.length>4096) throw new RecommendationFailure(422,'Invalid continuation');return token;
 }
 private async read<T>(actor:Actor,operations:string[],work:(db:PoolClient)=>Promise<T>) {
  for(const op of operations) await authorizeOperation(this.pool,actor,op,actor?.accountId);
  const db=await this.pool.connect();
  try {
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   for(const op of operations) await authorizeOperation(db,actor,op,actor.accountId);
   const result=await work(db);await db.query('COMMIT');
   for(const op of operations) await authorizeOperation(db,actor,op,actor.accountId);return result;
  } catch(error) {await db.query('ROLLBACK');throw error;} finally {db.release();}
 }
 private async snapshot(db:PoolClient,actor:Actor,category:string,token?:string) {
  const row=(await db.query(`SELECT coalesce((SELECT revision::text FROM account_category_content_state WHERE account_id=$1 AND category=$2),'0') AS revision,
   (SELECT revision FROM account_category_pin_state WHERE account_id=$1 AND category=$2) AS pin_revision`,[actor.accountId,category])).rows[0];
  const now=Date.now(),state:Snapshot=token?this.decode(token,'snapshot',snapshotSchema):{v:2,account:actor.accountId,category,revision:row.revision,issued:now,expires:now+600000};
  if(state.account!==actor.accountId||state.category!==category||state.expires<=now||state.issued>now||state.expires-state.issued!==600000) throw new RecommendationFailure(422,'Invalid snapshot or continuation');
  if(state.revision!==row.revision) throw new RecommendationFailure(409,'Content changed; restart pagination');
  return {state,token:token??this.token(state,'snapshot'),pinRevision:row.pin_revision==null?null:Number(row.pin_revision)};
 }
 private async context(db:PoolClient,actor:Actor,input:{category:string;cursor?:string;snapshotToken?:string},binding:string) {
  const cursor=input.cursor?this.decode(input.cursor,'cursor',cursorSchema):undefined;
  if(cursor&&(cursor.binding!==binding||input.snapshotToken&&input.snapshotToken!==cursor.snapshotToken)) throw new RecommendationFailure(422,'Invalid continuation');
  return {cursor,...await this.snapshot(db,actor,input.category,input.snapshotToken??cursor?.snapshotToken)};
 }
 private collection(row:any) {
  return wire.ownerCollectionDtoSchema.parse({id:row.id,accountId:row.account_id,category:row.category,title:row.title,slug:row.slug,visibility:row.visibility,publicationState:row.publication_state,revision:Number(row.revision),description:row.description,heading:row.heading,coverMediaId:row.cover_media_id??null,archived:row.archived_at!==null,displayOrder:row.display_order});
 }
 private async recommendations(db:PoolClient,rows:any[]) {
  if(!rows.length) return [];
  const ids=rows.map(r=>r.id),account=rows[0].account_id;
  // Lateral indexed lookups emit at most 21 rows per parent, including overflow.
  const media=(await db.query(`SELECT parent.id,m.media_id FROM unnest($1::uuid[]) AS parent(id) CROSS JOIN LATERAL
   (SELECT media_id FROM recommendation_media WHERE recommendation_id=parent.id AND account_id=$2 ORDER BY display_order LIMIT 21) m`,[ids,account])).rows;
  const pins=(await db.query(`SELECT p.recommendation_id,p.collection_id,p.position,s.revision FROM category_recommendation_pins p JOIN account_category_pin_state s ON s.account_id=p.account_id AND s.category=p.category WHERE p.account_id=$2 AND p.recommendation_id=ANY($1::uuid[])`,[ids,account])).rows;
  return rows.map(row=>{
   const mediaIds=media.filter(m=>m.id===row.id).map(m=>m.media_id),pin=pins.find(p=>p.recommendation_id===row.id);
   if(mediaIds.length>20) throw new RecommendationFailure(413,'Owner resource exceeds the media response bound');
   return wire.ownerRecommendationDtoSchema.parse({id:row.id,accountId:row.account_id,entityId:row.entity_id,category:row.category,userRating:row.user_rating,publicationState:row.publication_state,revision:Number(row.revision),mediaIds,archived:row.archived_at!==null,pin:pin?{collectionId:pin.collection_id,position:pin.position,revision:Number(pin.revision)}:null});
  });
 }
 private page<T>(rows:any[],items:T[],context:{state:Snapshot;token:string},binding:string,key:(row:any)=>Pick<Cursor,'order'|'id'|'secondary'>) {
  const base={version:VERSION,snapshot:context.state.revision,snapshotToken:context.token,expiresAt:context.state.expires};
  let result:{version:typeof VERSION;snapshot:string;snapshotToken:string;expiresAt:number;items:T[];nextCursor:string|null}={...base,items:[],nextCursor:null};
  for(let n=0;n<items.length;n++) {
   const nextCursor=rows.length>n+1?this.token({v:2,binding,snapshotToken:context.token,...key(rows[n])},'cursor'):null;
   const candidate={...base,items:[...result.items,items[n]],nextCursor};
   if(Buffer.byteLength(JSON.stringify(candidate),'utf8')>OWNER_PAGE_BYTES) {
    if(!result.items.length) throw new RecommendationFailure(413,'Owner resource exceeds the response byte budget');return result;
   }
   result=candidate;
  }
  return result;
 }
 async getSnapshot(actor:Actor,raw:unknown) {
  return this.read(actor,['collections:read','recommendations:read'],async db=>{
   const input=parseContent(wire.ownerSnapshotRequestSchema,raw),s=await this.snapshot(db,actor,input.category,input.snapshotToken);
   return wire.ownerSnapshotSchema.parse({version:VERSION,snapshotToken:s.token,revision:s.state.revision,expiresAt:s.state.expires,pinRevision:s.pinRevision});
  });
 }
 async validateSnapshot(actor:Actor,raw:unknown) {
  // Parse only after authority, just like every other owner resource boundary.
  return this.read(actor,['collections:read','recommendations:read'],async db=>{
   const input=parseContent(wire.ownerSnapshotValidationRequestSchema,raw),s=await this.snapshot(db,actor,input.category,input.snapshotToken);
   return wire.ownerSnapshotSchema.parse({version:VERSION,snapshotToken:s.token,revision:s.state.revision,expiresAt:s.state.expires,pinRevision:s.pinRevision});
  });
 }
 async listCollections(actor:Actor,raw:unknown) {
  return this.read(actor,['collections:read'],async db=>{
   const input=parseContent(wire.ownerCollectionsRequestSchema,raw),binding=JSON.stringify([actor.accountId,'collections',input.category,input.status,input.limit,'display_order,id/v2']);
   const ctx=await this.context(db,actor,input,binding),cursor=ctx.cursor;
   const rows=(await db.query(`SELECT c.id,c.display_order,${collectionBytes} AS item_bytes ${collectionJoin} WHERE c.account_id=$1 AND c.category=$2 AND ${statusPredicate('c',input.status)} ${cursor?'AND (c.display_order,c.id)>($3,$4::uuid)':''} ORDER BY c.display_order,c.id LIMIT $${cursor?5:3}`,
    cursor?[actor.accountId,input.category,cursor.order,cursor.id,input.limit+1]:[actor.accountId,input.category,input.limit+1])).rows;
   let bytes=0;const selected:any[]=[];
   for(const row of rows.slice(0,input.limit)) {
    const nextCursor=rows.length>selected.length+1?this.token({v:2,binding,snapshotToken:ctx.token,order:row.display_order,id:row.id},'cursor'):null;
    const envelope=Buffer.byteLength(JSON.stringify({version:VERSION,snapshot:ctx.state.revision,snapshotToken:ctx.token,expiresAt:ctx.state.expires,items:[],nextCursor}),'utf8');
    const candidateBytes=envelope+bytes+Number(row.item_bytes)+selected.length;
    if(candidateBytes>OWNER_PAGE_BYTES) {if(!selected.length) throw new RecommendationFailure(413,'Owner resource exceeds the response byte budget');break;}
    bytes+=Number(row.item_bytes);selected.push(row);
   }
   const data=selected.length?(await db.query(`SELECT ${collectionProjection} ${collectionJoin} WHERE c.account_id=$1 AND c.id=ANY($2::uuid[]) ORDER BY c.display_order,c.id`,[actor.accountId,selected.map(r=>r.id)])).rows:[];
   return wire.ownerCollectionPageSchema.parse(this.page(rows,data.map(r=>this.collection(r)),ctx,binding,r=>({order:r.display_order,id:r.id})));
  });
 }
 async listRecommendations(actor:Actor,raw:unknown) {
  return this.read(actor,['recommendations:read'],async db=>{
   const input=parseContent(wire.ownerRecommendationsRequestSchema,raw),binding=JSON.stringify([actor.accountId,'recommendations',input.category,input.status,input.collectionId??null,input.limit,'display_order,id/v2']);
   const ctx=await this.context(db,actor,input,binding),cursor=ctx.cursor,values:any[]=[actor.accountId,input.category];let join='',order='r.id',pageOrder='0',where='';
   if(input.collectionId) {
    const parent=await db.query('SELECT id FROM collections WHERE id=$1 AND account_id=$2 AND category=$3',[input.collectionId,actor.accountId,input.category]);
    if(!parent.rows[0]) throw new RecommendationFailure(404,'Resource unavailable');
    values.push(input.collectionId);join='JOIN collection_items i ON i.recommendation_id=r.id AND i.account_id=r.account_id AND i.category=r.category AND i.collection_id=$3';order='i.display_order,r.id';pageOrder='i.display_order';
   }
   if(cursor) {values.push(...(input.collectionId?[cursor.order,cursor.id]:[cursor.id]));where=input.collectionId?`AND (i.display_order,r.id)>($${values.length-1},$${values.length}::uuid)`:`AND r.id>$${values.length}::uuid`;}
   values.push(input.limit+1);
   const rows=(await db.query(`SELECT ${recommendationProjection},${pageOrder} AS page_order FROM recommendations r ${join} WHERE r.account_id=$1 AND r.category=$2 AND ${statusPredicate('r',input.status)} ${where} ORDER BY ${order} LIMIT $${values.length}`,values)).rows;
   return wire.ownerRecommendationPageSchema.parse(this.page(rows,await this.recommendations(db,rows.slice(0,input.limit)),ctx,binding,r=>({order:r.page_order,id:r.id})));
  });
 }
 async listMemberships(actor:Actor,raw:unknown) {
  return this.read(actor,['collections:read','recommendations:read'],async db=>{
   const input=parseContent(wire.ownerMembershipsRequestSchema,raw),binding=JSON.stringify([actor.accountId,'memberships',input.category,input.collectionStatus,input.recommendationStatus,input.recommendationId??null,input.limit,'recommendation_id,collection_id/v2']);
   const ctx=await this.context(db,actor,input,binding),cursor=ctx.cursor,values:any[]=[actor.accountId,input.category];let where='';
   if(input.recommendationId) {
    const found=await db.query(`SELECT id FROM recommendations r WHERE id=$1 AND account_id=$2 AND category=$3 AND ${statusPredicate('r',input.recommendationStatus)}`,[input.recommendationId,actor.accountId,input.category]);
    if(!found.rows[0]) throw new RecommendationFailure(404,'Resource unavailable');values.push(input.recommendationId);where+=` AND i.recommendation_id=$${values.length}`;
   }
   if(cursor) {if(!cursor.secondary) throw new RecommendationFailure(422,'Invalid continuation');values.push(cursor.id,cursor.secondary);where+=` AND (i.recommendation_id,i.collection_id)>($${values.length-1}::uuid,$${values.length}::uuid)`;}
   values.push(input.limit+1);
   const rows=(await db.query(`SELECT i.recommendation_id,i.collection_id,c.revision AS collection_revision,i.display_order,c.archived_at IS NOT NULL AS collection_archived,r.archived_at IS NOT NULL AS recommendation_archived FROM collection_items i JOIN collections c ON c.id=i.collection_id AND c.account_id=i.account_id AND c.category=i.category JOIN recommendations r ON r.id=i.recommendation_id AND r.account_id=i.account_id AND r.category=i.category WHERE i.account_id=$1 AND i.category=$2 AND ${statusPredicate('c',input.collectionStatus)} AND ${statusPredicate('r',input.recommendationStatus)} ${where} ORDER BY i.recommendation_id,i.collection_id LIMIT $${values.length}`,values)).rows;
   const items=rows.slice(0,input.limit).map(r=>wire.ownerMembershipDtoSchema.parse({recommendationId:r.recommendation_id,collectionId:r.collection_id,collectionRevision:Number(r.collection_revision),displayOrder:r.display_order,collectionArchived:r.collection_archived,recommendationArchived:r.recommendation_archived}));
   return wire.ownerMembershipPageSchema.parse(this.page(rows,items,ctx,binding,r=>({order:0,id:r.recommendation_id,secondary:r.collection_id})));
  });
 }
 async getCollection(actor:Actor,id:string,raw:unknown={}) {
  return this.read(actor,['collections:read'],async db=>{
   parseContent(contentIdSchema,id);const input=parseContent(wire.ownerDetailRequestSchema,raw);
   const locator=(await db.query(`SELECT c.id,${collectionBytes} AS item_bytes ${collectionJoin} WHERE c.id=$1 AND c.account_id=$2 AND ${statusPredicate('c',input.status)}`,[id,actor.accountId])).rows[0];
   if(!locator) throw new RecommendationFailure(404,'Resource unavailable');
   if(Number(locator.item_bytes)+Buffer.byteLength('{"collection":}','utf8')>OWNER_PAGE_BYTES) throw new RecommendationFailure(413,'Owner resource exceeds the response byte budget');
   const row=(await db.query(`SELECT ${collectionProjection} ${collectionJoin} WHERE c.id=$1 AND c.account_id=$2`,[id,actor.accountId])).rows[0],collection=this.collection(row);
   if(Buffer.byteLength(JSON.stringify({collection}),'utf8')>OWNER_PAGE_BYTES) throw new RecommendationFailure(413,'Owner resource exceeds the response byte budget');return collection;
  });
 }
 async getRecommendation(actor:Actor,id:string,raw:unknown={}) {
  return this.read(actor,['recommendations:read'],async db=>{
   parseContent(contentIdSchema,id);const input=parseContent(wire.ownerDetailRequestSchema,raw);
   const row=(await db.query(`SELECT ${recommendationProjection} FROM recommendations r WHERE r.id=$1 AND r.account_id=$2 AND ${statusPredicate('r',input.status)}`,[id,actor.accountId])).rows[0];
   if(!row) throw new RecommendationFailure(404,'Resource unavailable');return (await this.recommendations(db,[row]))[0];
  });
 }
}
