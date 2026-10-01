import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createCanonicalApp } from '../auth/canonicalApp';
import { resolveExplorersAuthConfig } from '../auth/betterAuth';

const config=resolveExplorersAuthConfig({EXPLORERS_PUBLIC_ORIGIN:'http://127.0.0.1:51474',EXPLORERS_AUTH_SECRET:'integration-secret-'.repeat(4),GOOGLE_CLIENT_ID:'fixture-google-id',GOOGLE_CLIENT_SECRET:'fixture-google-secret'});
let pool:pg.Pool, composed:ReturnType<typeof createCanonicalApp>;
beforeAll(()=>{pool=new pg.Pool({connectionString:process.env.DATABASE_URL_TEST,max:4});composed=createCanonicalApp(pool,config);});
afterAll(async()=>{await pool.end();});
async function persona() {
  const userId=`recommendation-${randomUUID()}`;
  await pool.query("INSERT INTO auth_user(id,name,email) VALUES($1,'Owner',$2)",[userId,`${userId}@example.invalid`]);
  await pool.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,updated_at) VALUES($1,$2,'google',$3,now())",[randomUUID(),`google-${userId}`,userId]);
  const context=await composed.auth.$context, session=await context.internalAdapter.createSession(userId,false);
  const cookie=`${context.authCookies.sessionToken.name}=${session.token}.${createHmac('sha256',config.secret).update(session.token).digest('base64')}`;
  const me=await request(composed.app).get('/api/explorers/v1/me').set('cookie',cookie); expect(me.status).toBe(200);
  return {userId,accountId:me.body.account.id as string,cookie,sessionId:session.id};
}
function command(owner:{cookie:string},method:'post'|'patch'|'delete',path:string,body:object,key:string=randomUUID()) {
  return request(composed.app)[method](`/api/explorers/v1${path}`).set('cookie',owner.cookie).set('origin',config.baseURL).set('Idempotency-Key',key).send(body);
}
async function list(owner:{cookie:string},category='books') {
  const result=await command(owner,'post','/collections',{category,title:'Reading',slug:`reading-${randomUUID()}`,visibility:'private',publicationState:'draft'});expect(result.status).toBe(201);return result.body.collection;
}
async function entity(kind='book') {return (await pool.query("INSERT INTO entities(kind,title,origin) VALUES($1,'Shared title','manual') RETURNING id",[kind])).rows[0].id;}
async function recommendation(owner:{cookie:string},collection:any,entityId:string,revision=1) {
  const result=await command(owner,'post','/recommendations',{category:collection.category,entityId,collectionId:collection.id,expectedCollectionRevision:revision,userRating:8,publicationState:'draft'});expect(result.status).toBe(201);return result.body.recommendation;
}
it('creates independent owner recommendations without changing shared catalog facts',async()=>{
  const a=await persona(),b=await persona(),shared=await entity(),la=await list(a),lb=await list(b);
  const ra=await recommendation(a,la,shared),rb=await recommendation(b,lb,shared);
  const changed=await command(a,'patch',`/recommendations/${ra.id}`,{expectedRevision:1,userRating:3});expect(changed.status).toBe(200);expect(changed.body.recommendation).toMatchObject({userRating:3,revision:2});
  expect((await pool.query('SELECT user_rating FROM recommendations WHERE id=$1',[rb.id])).rows[0].user_rating).toBe(8);
  expect((await pool.query('SELECT title FROM entities WHERE id=$1',[shared])).rows[0].title).toBe('Shared title');
  expect((await command(b,'patch',`/recommendations/${ra.id}`,{expectedRevision:2,userRating:4})).status).toBe(404);
  expect((await command(b,'delete',`/collections/${la.id}`,{expectedRevision:2})).status).toBe(404);
});
it('denies anonymous, inactive, stale sessions and ambiguous account credentials',async()=>{
  const a=await persona(),body={category:'books',title:'Test',slug:'test'};
  expect((await request(composed.app).post('/api/explorers/v1/collections').set('origin',config.baseURL).send(body)).status).toBe(401);
  expect((await command(a,'post','/collections',body).set('x-account-id',a.accountId)).status).toBe(401);
  await pool.query("UPDATE creator_accounts SET status='suspended',suspended_at=now() WHERE id=$1",[a.accountId]);expect((await command(a,'post','/collections',body)).status).toBe(403);
  await pool.query("UPDATE creator_accounts SET status='active',suspended_at=NULL WHERE id=$1",[a.accountId]);
  await pool.query('UPDATE user_security_state SET session_version=session_version+1 WHERE user_id=$1',[a.userId]);expect((await command(a,'post','/collections',body)).status).toBe(401);
});
it('validates exact boundary keys, category, revision, path and origin',async()=>{
  const a=await persona(),base={category:'books',title:'Test',slug:'test'};
  for(const body of [{...base,accountId:a.accountId},{...base,category:'music'},{...base,title:' '},{...base,slug:'A B'},{...base,descriptionRich:{}},{...base,visibility:'hidden'}]) expect((await command(a,'post','/collections',body)).status).toBe(422);
  expect((await command(a,'post','/collections?accountId='+a.accountId,base)).status).toBe(422);
  expect((await command(a,'patch','/collections/not-a-uuid',{expectedRevision:1,title:'Updated'})).status).toBe(422);
  expect((await command(a,'post','/collections',base).set('origin','https://foreign.invalid')).status).toBe(403);
  expect((await command(a,'post','/collections',base,'bad')).status).toBe(422);
  const c=await list(a);
  for(const expectedRevision of [0,1.5,'1',9007199254740992]) expect((await command(a,'patch',`/collections/${c.id}`,{expectedRevision,title:'Changed'})).status).toBe(422);
  expect((await request(composed.app).put(`/api/explorers/v1/collections/${c.id}`).send({})).status).toBe(405);
  expect((await command(a,'post','/Collections',base)).status).toBe(404);
  expect((await command(a,'post','/collections/',base)).status).toBe(404);
  expect((await command(a,'patch','/recommendations/search',{expectedRevision:1,userRating:5})).status).toBe(405);
});
it('replays creates, rejects changed hashes and expired keys, and keeps stale commands conflicting',async()=>{
  const a=await persona(),key=randomUUID(),input={category:'books',title:'Read',slug:'read'};
  const first=await command(a,'post','/collections',input,key),replay=await command(a,'post','/collections',input,key);expect(first.status).toBe(201);expect(replay.body).toEqual(first.body);
  expect((await command(a,'post','/collections',{...input,title:'Changed'},key)).status).toBe(409);
  const c=first.body.collection;
  expect((await command(a,'patch',`/collections/${c.id}`,{expectedRevision:1,title:'New'})).status).toBe(200);
  expect((await command(a,'patch',`/collections/${c.id}`,{expectedRevision:1,title:'Old'})).status).toBe(409);
  await pool.query("UPDATE application_command_receipts SET replay_until=now()-interval '1 second' WHERE account_id=$1",[a.accountId]);expect((await command(a,'post','/collections',input,key)).status).toBe(409);
  expect((await pool.query('SELECT count(*)::int AS n FROM collections WHERE account_id=$1',[a.accountId])).rows[0].n).toBe(1);
});
it('rejects wrong-category and foreign parents without receipt or revision side effects',async()=>{
  const a=await persona(),b=await persona(),ca=await list(a),cb=await list(b),key=randomUUID();
  const input={category:'books',entityId:await entity('person'),collectionId:ca.id,expectedCollectionRevision:1};
  expect((await command(a,'post','/recommendations',input,key)).status).toBe(422);
  expect((await command(a,'post','/recommendations',{...input,entityId:await entity(),collectionId:cb.id})).status).toBe(404);
  expect((await pool.query('SELECT revision::int FROM collections WHERE id=$1',[ca.id])).rows[0].revision).toBe(1);
  expect((await pool.query("SELECT count(*)::int AS n FROM application_command_receipts WHERE account_id=$1 AND operation='createRecommendation'",[a.accountId])).rows[0].n).toBe(0);
  expect((await command(a,'post','/recommendations',{...input,entityId:await entity()},key)).status).toBe(201);
});
it('checks exact reorder membership and archives replay before archived revision evaluation',async()=>{
  const a=await persona(),c=await list(a),shared=await entity(),one=await recommendation(a,c,shared),two=await recommendation(a,c,shared,2);
  for(const ids of [[one.id],[one.id,one.id],[one.id,randomUUID()]]) expect((await command(a,'patch',`/collections/${c.id}/order`,{expectedRevision:3,orderedRecommendationIds:ids})).status).toBe(422);
  const result=await command(a,'patch',`/collections/${c.id}/order`,{expectedRevision:3,orderedRecommendationIds:[two.id,one.id]});expect(result.status).toBe(200);expect(result.body.collection.revision).toBe(4);
  const key=randomUUID(),body={expectedRevision:4};expect((await command(a,'delete',`/collections/${c.id}`,body,key)).status).toBe(200);expect((await command(a,'delete',`/collections/${c.id}`,body,key)).status).toBe(200);
  expect((await pool.query('SELECT count(*)::int AS n FROM recommendations WHERE account_id=$1',[a.accountId])).rows[0].n).toBe(2);
  const guide=await list(a,'guides');expect((await command(a,'delete',`/collections/${guide.id}`,{expectedRevision:1})).status).toBe(200);
});
it('writes purpose-compatible owned media and rolls invalid replacement back atomically',async()=>{
  const a=await persona(),b=await persona();
  const media=async(accountId:string,purpose:string,status='ready')=>(await pool.query(`INSERT INTO media_assets(account_id,purpose,status,mime_type,byte_size,ready_at,content_sha256)
    VALUES($1,$2,$3,'image/png',10,CASE WHEN $3='ready' THEN now() ELSE NULL END,decode(repeat('00',32),'hex')) RETURNING id`,[accountId,purpose,status])).rows[0].id;
  const cover=await media(a.accountId,'collection'),image=await media(a.accountId,'recommendation'),foreign=await media(b.accountId,'recommendation');
  const created=await command(a,'post','/collections',{category:'books',title:'Read',slug:'media',description:'A plain description',heading:'Top reads',coverMediaId:cover});expect(created.status).toBe(201);expect(created.body.collection).toMatchObject({coverMediaId:cover,description:'A plain description',heading:'Top reads'});
  const c=created.body.collection;
  const added=await command(a,'post','/recommendations',{category:'books',entityId:await entity(),collectionId:c.id,expectedCollectionRevision:1,mediaIds:[image]});expect(added.status).toBe(201);expect(added.body.recommendation.mediaIds).toEqual([image]);
  const id=added.body.recommendation.id,key=randomUUID();
  for(const mediaIds of [[foreign],[cover],[await media(a.accountId,'recommendation','uploading')],[image,image]]) expect((await command(a,'patch',`/recommendations/${id}`,{expectedRevision:1,userRating:2,mediaIds},key)).status).toBe(422);
  expect((await pool.query('SELECT revision::int,user_rating FROM recommendations WHERE id=$1',[id])).rows[0]).toEqual({revision:1,user_rating:null});
  expect((await pool.query('SELECT media_id FROM recommendation_media WHERE recommendation_id=$1',[id])).rows.map(r=>r.media_id)).toEqual([image]);
  expect((await pool.query("SELECT count(*)::int AS n FROM application_command_receipts WHERE account_id=$1 AND operation='updateRecommendation'",[a.accountId])).rows[0].n).toBe(0);
  const detached=await command(a,'patch',`/recommendations/${id}`,{expectedRevision:1,mediaIds:[]},key);expect(detached.status).toBe(200);expect(detached.body.recommendation.mediaIds).toEqual([]);
  expect((await command(a,'patch',`/collections/${c.id}`,{expectedRevision:2,coverMediaId:null,description:null,heading:null})).status).toBe(200);
});
it.each([['places','place'],['places','person'],['books','book'],['movies','movie'],['games','game'],['apps','app'],['products','product'],['people','person']])('validates %s core against entity kind %s',async(category,kind)=>{
  const a=await persona(),c=await list(a,category),entityId=await entity(kind);
  const created=await recommendation(a,c,entityId);expect(created).toMatchObject({category,entityId,userRating:8,publicationState:'draft',mediaIds:[]});
  for(const body of [{expectedRevision:1,userRating:0},{expectedRevision:1,userRating:11},{expectedRevision:1,userRating:1.5},{expectedRevision:1,userRating:'5'},{expectedRevision:1,note:{version:1,arbitrary:true}},{expectedRevision:1,entityId:randomUUID()},{expectedRevision:1,category:'books'},{expectedRevision:1}]) expect((await command(a,'patch',`/recommendations/${created.id}`,body)).status).toBe(422);
  const published=await command(a,'patch',`/recommendations/${created.id}`,{expectedRevision:1,publicationState:'published',userRating:null});expect(published.status).toBe(200);expect(published.body.recommendation).toMatchObject({publicationState:'published',userRating:null,revision:2});
});
it('archives one recommendation with replay and leaves another owner and catalog intact',async()=>{
  const a=await persona(),b=await persona(),shared=await entity(),c=await list(a),other=await list(b),r=await recommendation(a,c,shared),rb=await recommendation(b,other,shared),key=randomUUID();
  expect((await command(a,'delete',`/recommendations/${r.id}`,{expectedRevision:1},key)).status).toBe(200);
  expect((await command(a,'delete',`/recommendations/${r.id}`,{expectedRevision:1},key)).status).toBe(200);
  expect((await pool.query('SELECT revision::int FROM collections WHERE id=$1',[c.id])).rows[0].revision).toBe(3);
  expect((await pool.query('SELECT id FROM recommendations WHERE id=$1 AND archived_at IS NULL',[rb.id])).rowCount).toBe(1);
  expect((await pool.query('SELECT id FROM entities WHERE id=$1',[shared])).rowCount).toBe(1);
});
it('resolves only eligible existing entities without accepting provider facts or private foreign context',async()=>{
  const a=await persona(),b=await persona(),shared=await entity(),c=await list(a);
  const rec=await recommendation(a,c,shared);
  const input={entityId:shared,category:'books'};
  const resolved=await command(a,'post','/entities/resolve',input);expect(resolved.status).toBe(200);expect(resolved.body.entity).toEqual({id:shared,kind:'book',title:'Shared title'});
  expect((await command(b,'post','/entities/resolve',input)).status).toBe(404);
  expect((await command(a,'post','/entities/resolve',{...input,title:'Overwrite',provider:'google_books',externalId:'forged'})).status).toBe(422);
  expect((await command(a,'post','/entities/resolve',{...input,category:'movies'})).status).toBe(422);
  expect((await command(a,'post','/entities/resolve',{...input,entityId:randomUUID()})).status).toBe(404);
  await command(a,'delete',`/recommendations/${rec.id}`,{expectedRevision:1});expect((await command(a,'post','/entities/resolve',input)).status).toBe(404);
});
it('rechecks stale and inactive actors at the application boundary, including limited OAuth scopes',async()=>{
  const {RecommendationService}=await import('../application/recommendations');
  const a=await persona(),service=new RecommendationService(pool),actor={userId:a.userId,accountId:a.accountId,role:'owner' as const,credential:{kind:'web-session' as const,sessionId:a.sessionId,sessionVersion:1}};
  const input={category:'books',title:'Direct',slug:'direct'},context={requestId:randomUUID(),idempotencyKey:randomUUID()};
  const created=await service.createCollection(actor,input,context);expect(created.accountId).toBe(a.accountId);
  await expect(service.createCollection({...actor,credential:{kind:'oauth',grantId:randomUUID(),scopes:['profile:read']}},input,context)).rejects.toMatchObject({status:403});
  await pool.query('UPDATE user_security_state SET session_version=session_version+1 WHERE user_id=$1',[a.userId]);await expect(service.createCollection(actor,input,context)).rejects.toMatchObject({status:401});
  await pool.query("UPDATE creator_accounts SET status='suspended',suspended_at=now() WHERE id=$1",[a.accountId]);await expect(service.archiveCollection(actor,created.id,{expectedRevision:1},context)).rejects.toMatchObject({status:403});
});
