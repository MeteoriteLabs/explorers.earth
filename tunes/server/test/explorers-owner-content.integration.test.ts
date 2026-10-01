import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createCanonicalApp } from '../auth/canonicalApp';
import { resolveExplorersAuthConfig } from '../auth/betterAuth';
import { OwnerContentService } from '../application/ownerContent';
import type { Actor } from '../application/actor';
const config=resolveExplorersAuthConfig({EXPLORERS_PUBLIC_ORIGIN:'http://127.0.0.1:51474',EXPLORERS_AUTH_SECRET:'owner-read-secret-'.repeat(4),GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:'fixture'});
let pool:pg.Pool, composed:ReturnType<typeof createCanonicalApp>;
beforeAll(()=>{pool=new pg.Pool({connectionString:process.env.DATABASE_URL_TEST,max:4});composed=createCanonicalApp(pool,config);});
afterAll(async()=>{await pool.end();});
async function fixture(lists=27,children=53) {
  const userId=`owner-read-${randomUUID()}`;
  await pool.query("INSERT INTO auth_user(id,name,email) VALUES($1,'Owner',$2)",[userId,`${userId}@example.invalid`]);
  await pool.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,updated_at) VALUES($1,$2,'google',$3,now())",[randomUUID(),userId,userId]);
  const context=await composed.auth.$context,session=await context.internalAdapter.createSession(userId,false);
  const cookie=`${context.authCookies.sessionToken.name}=${session.token}.${createHmac('sha256',config.secret).update(session.token).digest('base64')}`;
  const me=await request(composed.app).get('/api/explorers/v1/me').set('cookie',cookie);expect(me.status).toBe(200);
  const accountId=me.body.account.id,ids:string[]=[],recommendations:string[]=[];
  for(let n=0;n<lists;n++) ids.push((await pool.query("INSERT INTO collections(account_id,category,title,slug,display_order) VALUES($1,'books',$2,$3,$4) RETURNING id",[accountId,`List ${n}`,`list-${n}`,n])).rows[0].id);
  const entity=(await pool.query("INSERT INTO entities(kind,title,origin) VALUES('book','Shared','manual') RETURNING id")).rows[0].id;
  for(let n=0;n<children;n++) {
    const id=(await pool.query("INSERT INTO recommendations(account_id,category,entity_id,note) VALUES($1,'books',$2,'{\"private\":\"not-core\"}') RETURNING id",[accountId,entity])).rows[0].id;
    await pool.query("INSERT INTO collection_items(collection_id,recommendation_id,account_id,category,display_order) VALUES($1,$2,$3,'books',$4)",[ids.at(-1),id,accountId,n]);recommendations.push(id);
  }
  return {userId,accountId,cookie,ids,recommendations,sessionId:session.id};
}
const get=(f:{cookie:string},path:string,query:object={})=>request(composed.app).get(`/api/explorers/v1${path}`).set('cookie',f.cookie).query(query);
it('reads all 27 private lists and 53 ordered children with complete memberships beyond the first page',async()=>{
  const f=await fixture();let cursor:string|null=null;const lists:any[]=[];
  await pool.query("INSERT INTO account_category_pin_state(account_id,category) VALUES($1,'books') ON CONFLICT DO NOTHING",[f.accountId]);
  await pool.query("INSERT INTO category_recommendation_pins(account_id,category,recommendation_id,collection_id,position) VALUES($1,'books',$2,$3,0)",[f.accountId,f.recommendations[52],f.ids[26]]);
  do {const page=await get(f,'/collections',{category:'books',limit:24,...(cursor?{cursor}:{})});expect(page.status).toBe(200);expect(page.headers['cache-control']).toBe('no-store');lists.push(...page.body.items);cursor=page.body.nextCursor;} while(cursor);
  expect(lists.map(x=>x.id)).toEqual(f.ids);expect(lists[26]).toMatchObject({archived:false,displayOrder:26,visibility:'private'});
  cursor=null;const children:any[]=[];
  do {const page=await get(f,'/recommendations',{category:'books',collectionId:f.ids[26],limit:24,...(cursor?{cursor}:{})});expect(page.status).toBe(200);children.push(...page.body.items);cursor=page.body.nextCursor;} while(cursor);
  expect(children.map(x=>x.id)).toEqual(f.recommendations);
  expect(children[52].memberships).toEqual([{collectionId:f.ids[26],collectionRevision:1,displayOrder:52,archived:false}]);
  expect(children[52].pin).toEqual({collectionId:f.ids[26],position:0,revision:1});
  expect(JSON.stringify(children)).not.toContain('not-core');expect(JSON.stringify(children)).not.toContain('request_hash');
});
it('binds opaque cursors to owner, operation, category, archive status, collection, and limit',async()=>{
  const a=await fixture(3,3),b=await fixture(3,0),first=await get(a,'/collections',{category:'books',limit:2});expect(first.status).toBe(200);
  const cursor=first.body.nextCursor;expect(cursor).toEqual(expect.any(String));expect(cursor).not.toContain(a.accountId);
  for(const [owner,path,query] of [[b,'/collections',{category:'books',limit:2,cursor}],[a,'/recommendations',{category:'books',limit:2,cursor}],[a,'/collections',{category:'movies',limit:2,cursor}],[a,'/collections',{category:'books',status:'archived',limit:2,cursor}],[a,'/collections',{category:'books',limit:3,cursor}],[a,'/collections',{category:'books',limit:2,cursor:cursor+'a'}]] as const) expect((await get(owner,path,query)).status).toBe(422);
  const children=await get(a,'/recommendations',{category:'books',collectionId:a.ids[2],limit:2});expect(children.status).toBe(200);
  expect((await get(a,'/recommendations',{category:'books',collectionId:a.ids[1],limit:2,cursor:children.body.nextCursor})).status).toBe(422);
  for(const query of [{accountId:b.accountId},{userId:b.userId},{limit:101},{limit:'01'},{status:'all'},{category:'music'},{order:'title'}]) expect((await get(a,'/collections',{category:'books',...query})).status).toBe(422);
});
it('foreign and missing details have indistinguishable responses and archived lists require explicit selection',async()=>{
  const a=await fixture(1,1),b=await fixture(1,1);
  for(const path of [`/collections/${b.ids[0]}`,`/recommendations/${b.recommendations[0]}`]) {const foreign=await get(a,path),missing=await get(a,path.replace(path.split('/').at(-1)!,randomUUID()));expect(foreign.status).toBe(404);expect(foreign.body.error.message).toBe(missing.body.error.message);}
  await pool.query('UPDATE collections SET archived_at=now(),revision=revision+1 WHERE id=$1',[a.ids[0]]);
  expect((await get(a,`/collections/${a.ids[0]}`)).status).toBe(404);
  expect((await get(a,`/collections/${a.ids[0]}`,{status:'archived'})).body.collection).toMatchObject({archived:true,revision:2});
  expect((await get(a,'/collections',{category:'books'})).body.items).toEqual([]);
  expect((await get(a,'/collections',{category:'books',status:'archived'})).body.items.map((x:any)=>x.id)).toEqual(a.ids);
  expect((await get(a,`/recommendations/${a.recommendations[0]}`)).body.recommendation.memberships[0]).toMatchObject({archived:true,collectionRevision:2});
});
it('rejects continuation after membership or content revision changes with restart conflict',async()=>{
  const f=await fixture(3,3),query={category:'books',limit:2};
  const first=await get(f,'/collections',query);expect(first.status).toBe(200);
  await pool.query('UPDATE collections SET revision=revision+1,title=$2 WHERE id=$1',[f.ids[2],'Changed']);
  expect((await get(f,'/collections',{...query,cursor:first.body.nextCursor})).status).toBe(409);
  const childQuery={...query,collectionId:f.ids[2]},children=await get(f,'/recommendations',childQuery);expect(children.status).toBe(200);
  await pool.query('DELETE FROM collection_items WHERE recommendation_id=$1',[f.recommendations[2]]);
  expect((await get(f,'/recommendations',{...childQuery,cursor:children.body.nextCursor})).status).toBe(409);
});
it('rechecks session expiry, generation, membership and account lifecycle on every page',async()=>{
  const f=await fixture(3,0),query={category:'books',limit:2},first=await get(f,'/collections',query);expect(first.status).toBe(200);
  expect((await request(composed.app).get('/api/explorers/v1/collections').query(query)).status).toBe(401);
  expect((await get(f,'/collections',query).set('x-account-id',f.accountId)).status).toBe(401);
  await pool.query("UPDATE creator_accounts SET status='suspended',suspended_at=now() WHERE id=$1",[f.accountId]);const failedSecond=await get(f,'/collections',{...query,cursor:first.body.nextCursor});expect(failedSecond.status).toBe(403);expect(failedSecond.body.items).toBeUndefined();
  await pool.query("UPDATE creator_accounts SET status='active',suspended_at=NULL WHERE id=$1",[f.accountId]);
  await pool.query("UPDATE auth_session SET expires_at=now()-interval '1 second' WHERE id=$1",[f.sessionId]);expect((await get(f,'/collections',{...query,cursor:first.body.nextCursor})).status).toBe(401);
  const g=await fixture(1,0);await pool.query('UPDATE user_security_state SET session_version=session_version+1 WHERE user_id=$1',[g.userId]);expect((await get(g,'/collections',query)).status).toBe(401);
  const h=await fixture(1,0);await pool.query('DELETE FROM initial_account_bindings WHERE user_id=$1',[h.userId]);await pool.query('DELETE FROM account_memberships WHERE account_id=$1 AND user_id=$2',[h.accountId,h.userId]);expect((await get(h,'/collections',query)).status).toBe(401);
});
it('enforces named read scopes and current non-initial membership through the shared application boundary',async()=>{
  const owner=await fixture(1,1),member=await fixture(1,0),service=new OwnerContentService(pool,config.secret);
  const actor:Actor={userId:member.userId,accountId:owner.accountId,role:'owner',credential:{kind:'oauth',grantId:'trusted-adapter-fixture',scopes:['collections:read']}};
  await expect(service.listCollections(actor,{category:'books'})).rejects.toMatchObject({status:404});
  await pool.query('INSERT INTO account_memberships(account_id,user_id) VALUES($1,$2)',[owner.accountId,member.userId]);
  expect((await service.listCollections(actor,{category:'books'})).items.map(x=>x.id)).toEqual(owner.ids);
  await expect(service.listRecommendations(actor,{category:'books'})).rejects.toMatchObject({status:403});
  await expect(service.getRecommendation(actor,owner.recommendations[0])).rejects.toMatchObject({status:403});
  actor.credential={kind:'oauth',grantId:'trusted-adapter-fixture',scopes:['recommendations:read']};
  expect((await service.listRecommendations(actor,{category:'books'})).items.map(x=>x.id)).toEqual(owner.recommendations);
  await expect(service.getCollection(actor,owner.ids[0])).rejects.toMatchObject({status:403});
  await pool.query('DELETE FROM account_memberships WHERE account_id=$1 AND user_id=$2',[owner.accountId,member.userId]);
  await expect(service.listRecommendations(actor,{category:'books'})).rejects.toMatchObject({status:404});
});
it('requires a restart after cursor expiry and ties a complete membership write to its observed revision',async()=>{
  const f=await fixture(3,3),query={category:'books',limit:2},first=await get(f,'/collections',query);expect(first.status).toBe(200);
  const now=Date.now(),spy=vi.spyOn(Date,'now').mockReturnValue(now+600001);
  try {expect((await get(f,'/collections',{...query,cursor:first.body.nextCursor})).status).toBe(422);} finally {spy.mockRestore();}
  const detail=await get(f,`/collections/${f.ids[2]}`);expect(detail.status).toBe(200);
  await pool.query('UPDATE collections SET revision=revision+1 WHERE id=$1',[f.ids[2]]);
  const write=await request(composed.app).patch(`/api/explorers/v1/collections/${f.ids[2]}/order`).set('cookie',f.cookie).set('origin',config.baseURL).set('Idempotency-Key',randomUUID()).send({expectedRevision:detail.body.collection.revision,orderedRecommendationIds:f.recommendations});
  expect(write.status).toBe(409);
  expect((await pool.query('SELECT recommendation_id FROM collection_items WHERE collection_id=$1 ORDER BY display_order',[f.ids[2]])).rows.map(x=>x.recommendation_id)).toEqual(f.recommendations);
});
it('returns every owned membership and explicit recommendation archive state without public ancestor requirements',async()=>{
  const f=await fixture(2,1);
  await pool.query("INSERT INTO collection_items(collection_id,recommendation_id,account_id,category,display_order) VALUES($1,$2,$3,'books',7)",[f.ids[0],f.recommendations[0],f.accountId]);
  const detail=await get(f,`/recommendations/${f.recommendations[0]}`);expect(detail.status).toBe(200);
  expect(detail.body.recommendation.memberships.map((x:any)=>x.collectionId).sort()).toEqual([...f.ids].sort());
  await pool.query('DELETE FROM collection_items WHERE recommendation_id=$1',[f.recommendations[0]]);
  await pool.query('UPDATE recommendations SET archived_at=now(),revision=revision+1 WHERE id=$1',[f.recommendations[0]]);
  expect((await get(f,`/recommendations/${f.recommendations[0]}`)).status).toBe(404);
  expect((await get(f,`/recommendations/${f.recommendations[0]}`,{status:'archived'})).body.recommendation).toMatchObject({archived:true,revision:2,memberships:[],pin:null});
  expect((await get(f,'/recommendations',{category:'books'})).body.items).toEqual([]);
  expect((await get(f,'/recommendations',{category:'books',status:'archived'})).body.items.map((x:any)=>x.id)).toEqual(f.recommendations);
  expect((await get(f,'/recommendations',{category:'books',collectionId:randomUUID()})).status).toBe(404);
});
it('uses a stable ID tie-breaker for equal collection order and category-wide recommendation pages',async()=>{
  const f=await fixture(3,3);await pool.query('UPDATE collections SET display_order=0 WHERE account_id=$1',[f.accountId]);
  for(const [path,expected] of [['/collections',[...f.ids].sort()],['/recommendations',[...f.recommendations].sort()]] as const) {
    const seen:string[]=[];let cursor:string|null=null;
    do {const page=await get(f,path,{category:'books',limit:1,...(cursor?{cursor}:{})});expect(page.status).toBe(200);seen.push(...page.body.items.map((x:any)=>x.id));cursor=page.body.nextCursor;} while(cursor);
    expect(seen).toEqual(expected);
  }
});
it('executes the read service with the actual runtime role and leaves command receipts unchanged',async()=>{
  const f=await fixture(1,1),runtime=new pg.Pool({connectionString:process.env.DATABASE_URL_TEST,max:2,options:'-c role=music_runtime'});
  try {
    expect((await runtime.query('SELECT current_user')).rows[0].current_user).toBe('music_runtime');
    const service=new OwnerContentService(runtime,config.secret),actor:Actor={userId:f.userId,accountId:f.accountId,role:'owner',credential:{kind:'web-session',sessionId:f.sessionId,sessionVersion:1}};
    expect((await service.listCollections(actor,{category:'books'})).items.map(x=>x.id)).toEqual(f.ids);
    expect((await service.listRecommendations(actor,{category:'books'})).items.map(x=>x.id)).toEqual(f.recommendations);
    expect((await runtime.query('SELECT count(*)::int AS n FROM application_command_receipts WHERE account_id=$1',[f.accountId])).rows[0].n).toBe(0);
  } finally {await runtime.end();}
});
