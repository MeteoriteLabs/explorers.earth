import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v3';
import type { Actor } from './actor';
import { authorizeOperation } from './authorization';
import { parseContent } from './recommendations';
import { RecommendationFailure } from '../repositories/explorersRecommendationRepository';
import { contentIdSchema } from '../../shared/explorersContract';
import { ownerCollectionsRequestSchema, ownerRecommendationsRequestSchema, ownerDetailRequestSchema,
  ownerCollectionDtoSchema, ownerRecommendationDtoSchema, ownerCollectionPageSchema, ownerRecommendationPageSchema } from '../../shared/explorersOwnerContentContract';
const cursorSchema=z.object({v:z.literal(1),binding:z.string(),snapshot:z.string(),order:z.number().int().nonnegative(),id:z.string().uuid(),expires:z.number().int()}).strict();
type Cursor=z.infer<typeof cursorSchema>;
/** Explicit owner-only core reads; never used by public adapters. */
export class OwnerContentService {
  private readonly key:Buffer;
  constructor(private readonly pool:Pool,secret:string) {this.key=createHash('sha256').update('explorers-owner-content-cursor/v1\0').update(secret).digest();}
  private decode(value:string|undefined,binding:string):Cursor|undefined {
    if(!value) return undefined;
    try {
      const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value||bytes.length<29) throw new Error();
      const cipher=createDecipheriv('aes-256-gcm',this.key,bytes.subarray(0,12));cipher.setAAD(Buffer.from('explorers-owner-content/v1'));cipher.setAuthTag(bytes.subarray(12,28));
      const cursor=cursorSchema.parse(JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8')));
      if(cursor.binding!==binding||cursor.expires<Date.now()) throw new Error();return cursor;
    } catch {throw new RecommendationFailure(422,'Invalid continuation');}
  }
  private token(cursor:Cursor) {
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);cipher.setAAD(Buffer.from('explorers-owner-content/v1'));
    const data=Buffer.concat([cipher.update(JSON.stringify(cursor),'utf8'),cipher.final()]);return Buffer.concat([nonce,cipher.getAuthTag(),data]).toString('base64url');
  }
  private async read<T>(actor:Actor,operation:string,work:(db:PoolClient)=>Promise<T>) {
    // Validate authority before parsing any resource or opening its snapshot.
    await authorizeOperation(this.pool,actor,operation,actor?.accountId);
    const db=await this.pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await authorizeOperation(db,actor,operation,actor.accountId);
      const result=await work(db);await db.query('COMMIT');
      // Do not deliver a snapshot if authority expired during the read.
      await authorizeOperation(db,actor,operation,actor.accountId);return result;
    } catch(error) {await db.query('ROLLBACK');throw error;} finally {db.release();}
  }
  private async snapshot(db:PoolClient,accountId:string,category:string) {
    // Conservative category-wide fingerprint catches revisions AND membership/media
    // changes, even direct maintenance changes without an aggregate revision bump.
    const result=await db.query(`SELECT encode(sha256(convert_to(row_to_json(state)::text,'UTF8')),'hex') AS snapshot FROM (SELECT
      (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id)::text,'[]') FROM collections c WHERE account_id=$1 AND category=$2) AS collections,
      (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id)::text,'[]') FROM recommendations r WHERE account_id=$1 AND category=$2) AS recommendations,
      (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.collection_id,i.recommendation_id)::text,'[]') FROM collection_items i WHERE account_id=$1 AND category=$2) AS memberships,
      (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.collection_id,m.slot)::text,'[]') FROM collection_media m JOIN collections c ON c.id=m.collection_id WHERE c.account_id=$1 AND c.category=$2) AS covers,
      (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.recommendation_id,m.display_order)::text,'[]') FROM recommendation_media m JOIN recommendations r ON r.id=m.recommendation_id WHERE r.account_id=$1 AND r.category=$2) AS media,
      (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.recommendation_id)::text,'[]') FROM category_recommendation_pins p WHERE p.account_id=$1 AND p.category=$2) AS pins,
      (SELECT revision::text FROM account_category_pin_state WHERE account_id=$1 AND category=$2) AS pin_revision) state`,[accountId,category]);
    return result.rows[0].snapshot as string;
  }
  private collection(row:any) {return ownerCollectionDtoSchema.parse({id:row.id,accountId:row.account_id,category:row.category,title:row.title,slug:row.slug,
    visibility:row.visibility,publicationState:row.publication_state,revision:Number(row.revision),description:row.description,heading:row.heading,
    coverMediaId:row.cover_media_id??null,archived:row.archived_at!==null,displayOrder:row.display_order});}
  private async recommendation(db:PoolClient,row:any) {
    const pin=(await db.query(`SELECT p.collection_id,p.position,s.revision FROM category_recommendation_pins p JOIN account_category_pin_state s ON s.account_id=p.account_id AND s.category=p.category
      WHERE p.recommendation_id=$1 AND p.account_id=$2 AND p.category=$3`,[row.id,row.account_id,row.category])).rows[0];
    const media=await db.query('SELECT media_id FROM recommendation_media WHERE recommendation_id=$1 AND account_id=$2 ORDER BY display_order',[row.id,row.account_id]);
    const memberships=await db.query(`SELECT c.id,c.revision,c.archived_at,i.display_order FROM collection_items i JOIN collections c ON c.id=i.collection_id AND c.account_id=i.account_id AND c.category=i.category
      WHERE i.recommendation_id=$1 AND i.account_id=$2 ORDER BY c.id`,[row.id,row.account_id]);
    return ownerRecommendationDtoSchema.parse({id:row.id,accountId:row.account_id,entityId:row.entity_id,category:row.category,userRating:row.user_rating,
      publicationState:row.publication_state,revision:Number(row.revision),mediaIds:media.rows.map(x=>x.media_id),archived:row.archived_at!==null,
      pin:pin?{collectionId:pin.collection_id,position:pin.position,revision:Number(pin.revision)}:null,
      memberships:memberships.rows.map(x=>({collectionId:x.id,collectionRevision:Number(x.revision),displayOrder:x.display_order,archived:x.archived_at!==null}))});
  }
  async listCollections(actor:Actor,raw:unknown) {
    return this.read(actor,'collections:read',async db=>{
      const input=parseContent(ownerCollectionsRequestSchema,raw),binding=JSON.stringify([actor.accountId,'collections',input.category,input.status,input.limit,'display_order,id/v1']);
      const cursor=this.decode(input.cursor,binding),snapshot=await this.snapshot(db,actor.accountId,input.category);
      if(cursor&&cursor.snapshot!==snapshot) throw new RecommendationFailure(409,'Content changed; restart pagination');
      const rows=(await db.query(`SELECT c.*,m.media_id AS cover_media_id FROM collections c LEFT JOIN collection_media m ON m.collection_id=c.id AND m.account_id=c.account_id AND m.slot='cover'
        WHERE c.account_id=$1 AND c.category=$2 AND (c.archived_at IS NOT NULL)=$3
        AND ($4::integer IS NULL OR (c.display_order,c.id)>($4,$5::uuid)) ORDER BY c.display_order,c.id LIMIT $6`,[actor.accountId,input.category,input.status==='archived',cursor?.order??null,cursor?.id??null,input.limit+1])).rows;
      const page=rows.slice(0,input.limit),last=page.at(-1);
      return ownerCollectionPageSchema.parse({version:'explorers-owner-content/v1',snapshot,items:page.map(x=>this.collection(x)),nextCursor:rows.length>input.limit?this.token({v:1,binding,snapshot,order:last.display_order,id:last.id,expires:cursor?.expires??Date.now()+600000}):null});
    });
  }
  async listRecommendations(actor:Actor,raw:unknown) {
    return this.read(actor,'recommendations:read',async db=>{
      const input=parseContent(ownerRecommendationsRequestSchema,raw),binding=JSON.stringify([actor.accountId,'recommendations',input.category,input.status,input.collectionId??null,input.limit,'display_order,id/v1']);
      const cursor=this.decode(input.cursor,binding),snapshot=await this.snapshot(db,actor.accountId,input.category);
      if(input.collectionId) {
        const parent=await db.query('SELECT id FROM collections WHERE id=$1 AND account_id=$2 AND category=$3 AND archived_at IS NULL',[input.collectionId,actor.accountId,input.category]);
        if(!parent.rows[0]) throw new RecommendationFailure(404,'Resource unavailable');
      }
      if(cursor&&cursor.snapshot!==snapshot) throw new RecommendationFailure(409,'Content changed; restart pagination');
      const rows=(await db.query(`SELECT r.*,coalesce(i.display_order,0) AS page_order FROM recommendations r
        LEFT JOIN collection_items i ON i.recommendation_id=r.id AND i.account_id=r.account_id AND i.category=r.category AND i.collection_id=$4
        WHERE r.account_id=$1 AND r.category=$2 AND (r.archived_at IS NOT NULL)=$3 AND ($4::uuid IS NULL OR i.collection_id=$4)
        AND ($5::integer IS NULL OR (coalesce(i.display_order,0),r.id)>($5,$6::uuid)) ORDER BY coalesce(i.display_order,0),r.id LIMIT $7`,[actor.accountId,input.category,input.status==='archived',input.collectionId??null,cursor?.order??null,cursor?.id??null,input.limit+1])).rows;
      const page=rows.slice(0,input.limit),last=page.at(-1),items=[];
      for(const row of page) items.push(await this.recommendation(db,row));
      return ownerRecommendationPageSchema.parse({version:'explorers-owner-content/v1',snapshot,items,nextCursor:rows.length>input.limit?this.token({v:1,binding,snapshot,order:last.page_order,id:last.id,expires:cursor?.expires??Date.now()+600000}):null});
    });
  }
  async getCollection(actor:Actor,id:string,raw:unknown={}) {
    return this.read(actor,'collections:read',async db=>{
      parseContent(contentIdSchema,id);const input=parseContent(ownerDetailRequestSchema,raw);
      const row=(await db.query(`SELECT c.*,m.media_id AS cover_media_id FROM collections c LEFT JOIN collection_media m ON m.collection_id=c.id AND m.account_id=c.account_id AND m.slot='cover'
        WHERE c.id=$1 AND c.account_id=$2 AND (c.archived_at IS NOT NULL)=$3`,[id,actor.accountId,input.status==='archived'])).rows[0];
      if(!row) throw new RecommendationFailure(404,'Resource unavailable');return this.collection(row);
    });
  }
  async getRecommendation(actor:Actor,id:string,raw:unknown={}) {
    return this.read(actor,'recommendations:read',async db=>{
      parseContent(contentIdSchema,id);const input=parseContent(ownerDetailRequestSchema,raw);
      const row=(await db.query('SELECT * FROM recommendations WHERE id=$1 AND account_id=$2 AND (archived_at IS NOT NULL)=$3',[id,actor.accountId,input.status==='archived'])).rows[0];
      if(!row) throw new RecommendationFailure(404,'Resource unavailable');return this.recommendation(db,row);
    });
  }
}
