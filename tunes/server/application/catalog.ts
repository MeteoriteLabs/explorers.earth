import type { Pool } from 'pg';
import { entityCoreDtoSchema, resolveEntitySchema,commandKeySchema,type RequestContext } from '../../shared/explorersContract';
import type { Actor } from './actor';
import { authorizeOperation } from './authorization';
import { parseContent } from './recommendations';
import { RecommendationFailure,ExplorersRecommendationRepository } from '../repositories/explorersRecommendationRepository';
import {BookCatalog} from '../services/bookCatalog';
import {bookEntityDtoSchema} from '../../shared/explorersBookContract';

/** Existing owned catalog context only. Provider ingestion/fetch is a separate
 * trusted server adapter; HTTP callers cannot supply or overwrite shared facts. */
export class CatalogService {
  constructor(private readonly db:Pool,private readonly books=new BookCatalog()) {}
  async searchBooks(actor:Actor,input:unknown){await authorizeOperation(this.db,actor,'entities:resolve',actor?.accountId);return this.books.search(actor.accountId,input);}
  async resolveEntity(actor:Actor,input:unknown,context?:RequestContext) {
    await authorizeOperation(this.db,actor,'entities:resolve',actor?.accountId);
    const parsed=parseContent(resolveEntitySchema,input);
    if('kind' in parsed) {
      const key=parseContent(commandKeySchema,context?.idempotencyKey),repository=new ExplorersRecommendationRepository(this.db);
      if(parsed.kind==='provider'||parsed.category==='books'&&Object.keys(parsed.details).some(k=>k!=='title'))return bookEntityDtoSchema.parse(await repository.resolveBookEntity(actor.accountId,parsed as any,key,()=>this.books.resolve(actor.accountId,(parsed as any).externalId)));
      return entityCoreDtoSchema.parse(await repository.resolveManualEntity(actor.accountId,parsed as any,key));
    }
    const result=await this.db.query(`SELECT e.id,e.kind,e.title FROM entities e
      WHERE e.id=$1 AND EXISTS(SELECT 1 FROM recommendations r
        JOIN collection_items ci ON ci.recommendation_id=r.id
        JOIN collections c ON c.id=ci.collection_id
        WHERE r.entity_id=e.id AND r.account_id=$2 AND r.archived_at IS NULL AND c.archived_at IS NULL)`,[parsed.entityId,actor.accountId]);
    if(!result.rows[0]) throw new RecommendationFailure(404,'Entity unavailable');
    const entity=entityCoreDtoSchema.parse(result.rows[0]);
    const expected={places:['place','person'],movies:['movie'],books:['book'],games:['game'],apps:['app'],products:['product'],people:['person']};
    if(!expected[parsed.category].includes(entity.kind)) throw new RecommendationFailure(422,'Entity category mismatch');
    return entity;
  }
}
