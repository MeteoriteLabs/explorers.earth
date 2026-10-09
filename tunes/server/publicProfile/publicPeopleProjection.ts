import type {Pool,PoolClient} from 'pg';
import {readPersonEntity,effectivePersonDetails} from '../repositories/personCatalogRepository';
import {displayOverridesReadSchema} from '../../shared/explorersContract';
import {normalizeRichNote} from '../application/richNote';
import {publicProfileCursorStart} from './publicProfileContract';

/**
 * Ticket 4.5. Before this, the public People read fell through to an empty page and
 * answered 200 with no items - the same defect Apps and Products had.
 *
 * Shaped to what the existing consumer reads: personLists / recommended_people, with
 * top_people_heading on the list, and the compatibility aliases the ticket requires kept
 * at this edge: full_name for the name, profile_url for the primary link, platform for
 * the stored primary_platform with twitter presented as x.
 *
 * Suppressed people are omitted here, in SQL, not filtered afterwards: a person who has
 * asked not to be listed must not appear in a page count, a cursor position or a byte
 * budget, and a later refactor that drops a post-filter would silently expose them.
 *
 * follower_count is presentation text. No Explorers follower relationship exists, which
 * is why it is never parsed or compared.
 */
const gate=`a.status='active' AND a.onboarding_status='complete' AND a.public_profile AND s.is_public`;
const listGate=`c.archived_at IS NULL AND c.visibility='public' AND c.publication_state='published'`;
const recommendationGate=`r.archived_at IS NULL AND r.publication_state='published'`;
// The suppression gate. Joined, so it bounds the page rather than trimming it.
const suppressionGate=`NOT EXISTS(SELECT 1 FROM person_entity_details pd WHERE pd.entity_id=r.entity_id AND pd.suppressed_at IS NOT NULL)`;
const membershipJoin=`FROM collection_items ci JOIN collections c ON c.id=ci.collection_id AND c.account_id=ci.account_id AND c.category=ci.category
 JOIN recommendations r ON r.id=ci.recommendation_id AND r.account_id=ci.account_id AND r.category=ci.category
 JOIN creator_accounts a ON a.id=c.account_id JOIN account_category_settings s ON s.account_id=a.id AND s.category=c.category`;

async function scope(db:Pick<Pool,'query'>,username:string){return (await db.query(`SELECT a.id,a.handle,a.revision::text AS account_revision,coalesce(cs.revision::text,'0') AS content_revision
 FROM creator_accounts a JOIN account_category_settings s ON s.account_id=a.id AND s.category='people'
 LEFT JOIN account_category_content_state cs ON cs.account_id=a.id AND cs.category='people'
 WHERE a.handle_key=lower($1) AND ${gate}`,[username])).rows[0];}
const sameScope=(a:any,b:any)=>!!a&&!!b&&a.id===b.id&&a.account_revision===b.account_revision&&a.content_revision===b.content_revision;

/** twitter is stored; the frontend has always presented x. */
const presentedPlatform=(stored:string|null)=>stored===null?null:stored==='twitter'?'x':stored;

async function richPerson(db:PoolClient,row:any){
 if(Number(row.note_bytes)>8192||Number(row.override_bytes)>8192)throw new Error('Public Person exceeds read bound');
 const entity=await readPersonEntity(db,row.entity_id);
 const overrides=displayOverridesReadSchema.parse(row.display_values??{}),facts=effectivePersonDetails(entity.details,overrides);
 const name=(Object.hasOwn(overrides,'title')?overrides.title:entity.title)??'Unnamed person';
 const primary=facts.socialUrls.primary??(facts.primaryPlatform?facts.socialUrls[facts.primaryPlatform]:undefined)??null;
 return {documentId:row.id,
 // Canonical plus the compatibility aliases the consuming components still read.
 title:name,full_name:name,
 username_handle:facts.usernameHandle,headline:facts.headline,location_text:facts.locationText,
 avatar_url:facts.avatarUrl,
 platform:presentedPlatform(facts.primaryPlatform),primary_platform:facts.primaryPlatform,
 profile_url:primary,social_urls:Object.keys(facts.socialUrls).length?facts.socialUrls:null,
 skills_tags:facts.skillsTags.length?facts.skillsTags:null,
 follower_count:facts.externalFollowerCountText,
 user_recommendation_note:normalizeRichNote(row.note)?.html??'',user_rating:row.user_rating,
 is_pinned:row.pin_order!==null,pin_order:row.pin_order,display_order:row.display_order,
 person_list:{documentId:row.collection_id,List_Name:row.collection_title,slug:row.collection_slug},
 // Sector taxonomy is out of 4.5's scope and has no seeded vocabulary.
 person_category:null};
}
async function projectRows(db:PoolClient,rows:any[]){const people=[];for(const row of rows)people.push(await richPerson(db,row));return people;}

async function children(db:PoolClient,account:string,collectionId:string,limit:number,offset:number){
 const rows=(await db.query(`SELECT r.id,r.account_id,r.entity_id,r.user_rating,CASE WHEN octet_length(r.note::text)<=8192 THEN r.note END AS note,octet_length(r.note::text) AS note_bytes,CASE WHEN octet_length(o.display_values::text)<=8192 THEN o.display_values END AS display_values,octet_length(o.display_values::text) AS override_bytes,
 ci.display_order,c.id AS collection_id,c.title AS collection_title,c.slug AS collection_slug,
 CASE WHEN tp.collection_id=c.id THEN tp.position END AS pin_order ${membershipJoin}
 LEFT JOIN recommendation_display_overrides o ON o.recommendation_id=r.id AND o.account_id=r.account_id
 LEFT JOIN category_recommendation_pins tp ON tp.recommendation_id=r.id AND tp.account_id=r.account_id AND tp.category=r.category
 WHERE a.id=$1 AND c.id=$2 AND c.category='people' AND ${gate} AND ${listGate} AND ${recommendationGate} AND ${suppressionGate}
 ORDER BY ci.display_order,r.id LIMIT $3 OFFSET $4`,[account,collectionId,limit+1,offset])).rows;
 const hasMore=rows.length>limit;return {people:await projectRows(db,rows.slice(0,limit)),nextCursor:hasMore?`o${offset+limit}`:null};
}

/**
 * Ticket 5.2. The People lists linked to one location, for the location's public page.
 *
 * The gates are this projection's own, applied again rather than copied: the account must
 * be publicly eligible, the People category must be public, and the child list itself
 * must be public and published. So a private child under a public location is absent, and
 * unpublishing the People category removes every linked child from every location page
 * without touching the links.
 */
export async function publicLinkedPeopleLists(db:PoolClient,accountId:string,locationCollectionId:string,limit=12){
 const rows=(await db.query(`SELECT c.id,c.title,c.description,c.slug,c.heading,c.display_order,cm.media_id AS cover_media_id
  FROM collection_location_links l
  JOIN collections c ON c.id=l.child_collection_id AND c.account_id=l.account_id AND c.category=l.child_category
  JOIN creator_accounts a ON a.id=c.account_id JOIN account_category_settings s ON s.account_id=a.id AND s.category=c.category
  LEFT JOIN collection_media cm ON cm.collection_id=c.id AND cm.account_id=c.account_id AND cm.slot='cover'
  WHERE l.account_id=$1 AND l.location_collection_id=$2 AND l.child_category='people'
   AND ${gate} AND ${listGate}
  ORDER BY c.display_order,c.id LIMIT $3`,[accountId,locationCollectionId,limit])).rows;
 const lists=[];
 for(const row of rows){
  const page=await children(db,accountId,row.id,12,0);
  lists.push({documentId:row.id,List_Name:row.title,list_description:row.description,slug:row.slug,Visibility:true,display_order:row.display_order,
   cover_image:row.cover_media_id?{url:`/api/explorers/v1/media/${row.cover_media_id}/content`,alternativeText:null}:null,
   recommended_people:page.people,recommended_people_next_cursor:page.nextCursor});
 }
 return lists;
}

/** Live bounded offset compatibility for the existing public People routes. */
export async function publicPeopleProjection(pool:Pool,username:string,limit:number,cursor?:string,slug?:string){
 const offset=publicProfileCursorStart(cursor);if(!Number.isInteger(limit)||limit<1||limit>24)throw new Error('Invalid People page size');
 const db=await pool.connect();let observed:any,result:any;
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='2000ms'");
  observed=await scope(db,username);if(!observed){await db.query('COMMIT');return undefined;}
  const rows=(await db.query(`SELECT c.id,c.title,c.description,c.slug,c.heading,c.display_order,cm.media_id AS cover_media_id FROM collections c
   JOIN creator_accounts a ON a.id=c.account_id JOIN account_category_settings s ON s.account_id=a.id AND s.category=c.category
   LEFT JOIN collection_media cm ON cm.collection_id=c.id AND cm.account_id=c.account_id AND cm.slot='cover'
   WHERE a.id=$1 AND c.category='people' AND ${gate} AND ${listGate} AND ($2::text IS NULL OR c.slug=$2)
   ORDER BY c.display_order,c.id LIMIT $3 OFFSET $4`,[observed.id,slug??null,slug?1:limit+1,slug?0:offset])).rows;
  if(slug&&!rows.length){await db.query('COMMIT');return undefined;}
  const lists=[];
  for(const row of rows.slice(0,slug?1:limit)){
   if(Buffer.byteLength(JSON.stringify(row),'utf8')>32768)throw new Error('Public list exceeds read bound');
   const page=await children(db,observed.id,row.id,slug?limit:12,slug?offset:0);
   lists.push({documentId:row.id,List_Name:row.title,list_description:row.description,slug:row.slug,Visibility:true,display_order:row.display_order,top_picks_heading:row.heading,top_people_heading:row.heading,
    cover_image:row.cover_media_id?{url:`/api/explorers/v1/media/${row.cover_media_id}/content`,alternativeText:null}:null,
    account:{documentId:observed.id,username:observed.handle},recommended_people:page.people,recommended_people_next_cursor:page.nextCursor});
  }
  result={personLists:lists};
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>4*1024*1024)throw new Error('Public People page exceeds read bound');
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 return sameScope(observed,await scope(pool,username))?result:undefined;
}
