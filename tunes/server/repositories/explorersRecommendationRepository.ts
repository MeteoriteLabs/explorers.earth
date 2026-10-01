import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { CollectionCoreDto, RecommendationCoreDto } from '../../shared/explorersContract';

export type CatalogKind = 'place'|'movie'|'book'|'game'|'app'|'product'|'person';
export type ContentCategory = 'places'|'guides'|'movies'|'books'|'games'|'apps'|'products'|'people';
export type CollectionRecord = CollectionCoreDto;
export type RecommendationRecord = RecommendationCoreDto;
export class RecommendationFailure extends Error {
  constructor(readonly status:404|409|422, message:string) {super(message);}
}
const hash=(value:string)=>createHash('sha256').update(value).digest();
// Hash normalized domain inputs, independent of transport JSON object insertion order.
function canonical(value:unknown):string {
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
const collectionDto=(r:any):CollectionRecord=>({id:r.id,accountId:r.account_id,category:r.category,title:r.title,slug:r.slug,
  visibility:r.visibility,publicationState:r.publication_state,revision:Number(r.revision),description:r.description,heading:r.heading,coverMediaId:r.cover_media_id??null});
const recommendationDto=(r:any):RecommendationRecord=>({id:r.id,accountId:r.account_id,entityId:r.entity_id,category:r.category,userRating:r.user_rating,publicationState:r.publication_state,revision:Number(r.revision),mediaIds:r.media_ids??[]});

/** Internal persistence seam: application authorization and typed transport validation precede calls. */
export class ExplorersRecommendationRepository {
  constructor(private readonly pool:Pool) {}
  private async collectionRecord(db:Pick<Pool,'query'>,row:any):Promise<CollectionRecord> {
    const cover=await db.query("SELECT media_id FROM collection_media WHERE collection_id=$1 AND slot='cover'",[row.id]);
    return collectionDto({...row,cover_media_id:cover.rows[0]?.media_id??null});
  }
  private async recommendationRecord(db:Pick<Pool,'query'>,row:any):Promise<RecommendationRecord> {
    const media=await db.query('SELECT media_id FROM recommendation_media WHERE recommendation_id=$1 ORDER BY display_order',[row.id]);
    return recommendationDto({...row,media_ids:media.rows.map(r=>r.media_id)});
  }
  private async replaceCover(db:PoolClient,accountId:string,id:string,mediaId:string|null) {
    await db.query('DELETE FROM collection_media WHERE collection_id=$1',[id]);
    if(mediaId!==null) await db.query("INSERT INTO collection_media(collection_id,account_id,slot,media_id) VALUES($1,$2,'cover',$3)",[id,accountId,mediaId]);
  }
  private async replaceMedia(db:PoolClient,accountId:string,id:string,mediaIds:string[]) {
    await db.query('DELETE FROM recommendation_media WHERE recommendation_id=$1',[id]);
    for(let position=0;position<mediaIds.length;position++) await db.query('INSERT INTO recommendation_media(recommendation_id,account_id,media_id,display_order) VALUES($1,$2,$3,$4)',[id,accountId,mediaIds[position],position]);
  }
  private async transaction<T>(work:(db:PoolClient)=>Promise<T>):Promise<T> {
    const db=await this.pool.connect();
    try {await db.query('BEGIN');const result=await work(db);await db.query('COMMIT');return result;}
    catch(e) {await db.query('ROLLBACK');throw e;} finally {db.release();}
  }
  private async command<T>(accountId:string,operation:string,input:unknown,key:string,work:(db:PoolClient)=>Promise<T>):Promise<T> {
    if(!/^[A-Za-z0-9._~-]{8,200}$/.test(key)) throw new RecommendationFailure(422,'Idempotency key required');
    return this.transaction(async db=>{
      // Matches lifecycle lock order; a suspended/deleted account cannot start content writes.
      const account=await db.query('SELECT status FROM creator_accounts WHERE id=$1 FOR UPDATE',[accountId]);
      if(account.rows[0]?.status!=='active') throw new RecommendationFailure(404,'Account unavailable');
      const keyHash=hash(key),requestHash=hash(canonical(input));
      const prior=await db.query(`SELECT request_hash,response,status,replay_until>clock_timestamp() AS replayable
        FROM application_command_receipts WHERE account_id=$1 AND operation=$2 AND idempotency_key_hash=$3 FOR UPDATE`,[accountId,operation,keyHash]);
      if(prior.rows[0]) {
        const row=prior.rows[0];
        if(!row.request_hash.equals(requestHash)||row.status!=='completed'||!row.replayable) throw new RecommendationFailure(409,'Idempotency conflict');
        return row.response as T;
      }
      const result=await work(db);
      await db.query(`INSERT INTO application_command_receipts(account_id,operation,idempotency_key_hash,request_hash,response)
        VALUES($1,$2,$3,$4,$5)`,[accountId,operation,keyHash,requestHash,JSON.stringify(result)]);
      return result;
    });
  }
  /** Provider facts are server-validated upstream; this method never fetches or accepts caller authority. */
  async resolveProviderEntity(input:{kind:CatalogKind;title:string;provider:'tmdb'|'google_books'|'igdb'|'google_places';externalKind:string;externalId:string}) {
    return this.transaction(async db=>{
      const identity=canonical([input.provider,input.externalKind,input.externalId]);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[identity]);
      const existing=await db.query(`SELECT e.id,e.kind,e.title FROM entity_identifiers i JOIN entities e ON e.id=i.entity_id
        WHERE i.provider=$1 AND i.external_kind=$2 AND i.external_id=$3`,[input.provider,input.externalKind,input.externalId]);
      if(existing.rows[0]) {
        if(existing.rows[0].kind!==input.kind) throw new RecommendationFailure(409,'Provider identity kind conflict');
        return existing.rows[0] as {id:string;kind:CatalogKind;title:string};
      }
      const inserted=await db.query(`INSERT INTO entities(kind,title,origin,search_document)
        VALUES($1,$2,'provider',to_tsvector('simple',$2)) RETURNING id,kind,title`,[input.kind,input.title]);
      await db.query(`INSERT INTO entity_identifiers(entity_id,provider,external_kind,external_id) VALUES($1,$2,$3,$4)`,
        [inserted.rows[0].id,input.provider,input.externalKind,input.externalId]);
      return inserted.rows[0] as {id:string;kind:CatalogKind;title:string};
    });
  }
  async createCollection(accountId:string,input:{category:ContentCategory;title:string;slug:string;visibility?:'public'|'private';publicationState?:'draft'|'published';description?:string|null;heading?:string|null;coverMediaId?:string|null},key:string):Promise<CollectionRecord> {
    const normalized={...input,visibility:input.visibility??'private',publicationState:input.publicationState??'draft'};
    return this.command(accountId,'createCollection',normalized,key,async db=>{
      const result=await db.query(`INSERT INTO collections(account_id,category,title,slug,visibility,publication_state,display_order)
        SELECT $1,$2,$3,$4,$5,$6,coalesce(max(display_order)+1,0) FROM collections WHERE account_id=$1 AND category=$2 RETURNING *`,
        [accountId,input.category,input.title,input.slug,normalized.visibility,normalized.publicationState]);
      await db.query('UPDATE collections SET description=$2,heading=$3 WHERE id=$1',[result.rows[0].id,input.description??null,input.heading??null]);
      await this.replaceCover(db,accountId,result.rows[0].id,input.coverMediaId??null);
      return this.collectionRecord(db,{...result.rows[0],description:input.description??null,heading:input.heading??null});
    });
  }
  private async lockCollection(db:PoolClient,accountId:string,id:string,revision:number) {
    if(!Number.isSafeInteger(revision)||revision<1) throw new RecommendationFailure(422,'Invalid revision');
    const result=await db.query('SELECT * FROM collections WHERE id=$1 AND account_id=$2 AND archived_at IS NULL FOR UPDATE',[id,accountId]);
    if(!result.rows[0]) throw new RecommendationFailure(404,'Collection unavailable');
    if(Number(result.rows[0].revision)!==revision) throw new RecommendationFailure(409,'Stale collection revision');
    return result.rows[0];
  }
  async createRecommendation(accountId:string,input:{category:Exclude<ContentCategory,'guides'>;entityId:string;collectionId:string;expectedCollectionRevision:number;userRating?:number|null;publicationState?:'draft'|'published';mediaIds?:string[]},key:string):Promise<RecommendationRecord> {
    return this.command(accountId,'createRecommendation',input,key,async db=>{
      const list=await this.lockCollection(db,accountId,input.collectionId,input.expectedCollectionRevision);
      if(list.category!==input.category) throw new RecommendationFailure(422,'Collection category mismatch');
      const result=await db.query(`INSERT INTO recommendations(account_id,entity_id,category,user_rating,publication_state)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[accountId,input.entityId,input.category,input.userRating??null,input.publicationState??'draft']);
      await db.query(`INSERT INTO collection_items(collection_id,recommendation_id,account_id,category,display_order)
        SELECT $1,$2,$3,$4,coalesce(max(display_order)+1,0) FROM collection_items WHERE collection_id=$1`,
        [input.collectionId,result.rows[0].id,accountId,input.category]);
      await db.query('UPDATE collections SET revision=revision+1,updated_at=now() WHERE id=$1',[input.collectionId]);
      await this.replaceMedia(db,accountId,result.rows[0].id,input.mediaIds??[]);
      return this.recommendationRecord(db,result.rows[0]);
    });
  }
  async reorderCollection(accountId:string,id:string,expectedRevision:number,ids:string[],key:string):Promise<CollectionRecord> {
    return this.command(accountId,'reorderCollection',{id,expectedRevision,ids},key,async db=>{
      await this.lockCollection(db,accountId,id,expectedRevision);
      const current=await db.query(`SELECT ci.recommendation_id,r.archived_at FROM collection_items ci
        JOIN recommendations r ON r.id=ci.recommendation_id WHERE ci.collection_id=$1`,[id]);
      const active=current.rows.filter(r=>!r.archived_at).map(r=>r.recommendation_id);
      if(ids.length!==active.length||new Set(ids).size!==ids.length||ids.some(value=>!active.includes(value)))
        throw new RecommendationFailure(422,'Order requires exact active member set');
      // Archived recommendations lose membership in the archive operation, avoiding rank collisions.
      for(let position=0;position<ids.length;position++) await db.query('UPDATE collection_items SET display_order=$3 WHERE collection_id=$1 AND recommendation_id=$2',[id,ids[position],position]);
      const result=await db.query('UPDATE collections SET revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *',[id]);
      return this.collectionRecord(db,result.rows[0]);
    });
  }
  async archiveCollection(accountId:string,id:string,expectedRevision:number,key:string):Promise<{id:string;archived:true}> {
    return this.command(accountId,'archiveCollection',{id,expectedRevision},key,async db=>{
      await this.lockCollection(db,accountId,id,expectedRevision);
      const removed=await db.query('DELETE FROM category_recommendation_pins WHERE collection_id=$1 RETURNING account_id,category',[id]);
      if(removed.rowCount) await db.query('UPDATE account_category_pin_state SET revision=revision+1 WHERE account_id=$1 AND category=(SELECT category FROM collections WHERE id=$2)',[accountId,id]);
      await db.query('UPDATE collections SET archived_at=now(),revision=revision+1,updated_at=now() WHERE id=$1',[id]);
      return {id,archived:true};
    });
  }
  async getPublicCollection(id:string):Promise<CollectionRecord|null> {
    const result=await this.pool.query(`SELECT c.* FROM collections c JOIN creator_accounts a ON a.id=c.account_id
      JOIN account_category_settings s ON s.account_id=c.account_id AND s.category=c.category
      WHERE c.id=$1 AND c.archived_at IS NULL AND c.visibility='public' AND c.publication_state='published'
        AND a.status='active' AND a.onboarding_status='complete' AND a.public_profile AND s.is_public`,[id]);
    return result.rows[0]?this.collectionRecord(this.pool,result.rows[0]):null;
  }
  private async lockRecommendation(db:PoolClient,accountId:string,id:string,revision:number) {
    if(!Number.isSafeInteger(revision)||revision<1) throw new RecommendationFailure(422,'Invalid revision');
    const result=await db.query('SELECT * FROM recommendations WHERE id=$1 AND account_id=$2 AND archived_at IS NULL FOR UPDATE',[id,accountId]);
    if(!result.rows[0]) throw new RecommendationFailure(404,'Recommendation unavailable');
    if(Number(result.rows[0].revision)!==revision) throw new RecommendationFailure(409,'Stale recommendation revision');
    return result.rows[0];
  }
  async updateCollection(accountId:string,id:string,expectedRevision:number,input:{title?:string;visibility?:'public'|'private';publicationState?:'draft'|'published';description?:string|null;heading?:string|null;coverMediaId?:string|null},key:string):Promise<CollectionRecord> {
    return this.command(accountId,'updateCollection',{id,expectedRevision,input},key,async db=>{
      await this.lockCollection(db,accountId,id,expectedRevision);
      const result=await db.query(`UPDATE collections SET title=coalesce($2,title),visibility=coalesce($3,visibility),
        publication_state=coalesce($4,publication_state),revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`,[id,input.title??null,input.visibility??null,input.publicationState??null]);
      if(input.description!==undefined) await db.query('UPDATE collections SET description=$2 WHERE id=$1',[id,input.description]);
      if(input.heading!==undefined) await db.query('UPDATE collections SET heading=$2 WHERE id=$1',[id,input.heading]);
      if(input.coverMediaId!==undefined) await this.replaceCover(db,accountId,id,input.coverMediaId);
      return this.collectionRecord(db,{...result.rows[0],description:input.description===undefined?result.rows[0].description:input.description,heading:input.heading===undefined?result.rows[0].heading:input.heading});
    });
  }
  async updateRecommendation(accountId:string,id:string,expectedRevision:number,input:{userRating?:number|null;publicationState?:'draft'|'published';mediaIds?:string[]},key:string):Promise<RecommendationRecord> {
    if(input.userRating!==undefined&&input.userRating!==null&&(!Number.isInteger(input.userRating)||input.userRating<1||input.userRating>10))
      throw new RecommendationFailure(422,'Invalid rating');
    return this.command(accountId,'updateRecommendation',{id,expectedRevision,input},key,async db=>{
      await this.lockRecommendation(db,accountId,id,expectedRevision);
      const result=await db.query(`UPDATE recommendations SET user_rating=CASE WHEN $2 THEN $3 ELSE user_rating END,
        publication_state=coalesce($4,publication_state),revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`,[id,input.userRating!==undefined,input.userRating??null,input.publicationState??null]);
      if(input.mediaIds!==undefined) await this.replaceMedia(db,accountId,id,input.mediaIds);
      return this.recommendationRecord(db,result.rows[0]);
    });
  }
  async archiveRecommendation(accountId:string,id:string,expectedRevision:number,key:string):Promise<{id:string;archived:true}> {
    return this.command(accountId,'archiveRecommendation',{id,expectedRevision},key,async db=>{
      const recommendation=await this.lockRecommendation(db,accountId,id,expectedRevision);
      const parents=await db.query(`SELECT c.id FROM collections c JOIN collection_items ci ON ci.collection_id=c.id
        WHERE ci.recommendation_id=$1 ORDER BY c.id FOR UPDATE OF c`,[id]);
      const pins=await db.query('DELETE FROM category_recommendation_pins WHERE recommendation_id=$1 RETURNING recommendation_id',[id]);
      if(pins.rowCount) await db.query('UPDATE account_category_pin_state SET revision=revision+1 WHERE account_id=$1 AND category=$2',[accountId,recommendation.category]);
      await db.query('DELETE FROM collection_items WHERE recommendation_id=$1',[id]);
      for(const parent of parents.rows) await db.query('UPDATE collections SET revision=revision+1,updated_at=now() WHERE id=$1',[parent.id]);
      await db.query('UPDATE recommendations SET archived_at=now(),revision=revision+1,updated_at=now() WHERE id=$1',[id]);
      return {id,archived:true};
    });
  }
}
