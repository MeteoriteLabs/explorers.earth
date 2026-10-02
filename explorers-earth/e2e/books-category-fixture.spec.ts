import { test, expect } from '@playwright/test';
import { fixtureState, openFixture, closeFixture } from './setup/category-navigation';
import { bookFixtureId, createBooksOwnerFixture } from './setup/books-owner-content';

test('Books canonical fixture reads exact snapshots, private membership, pinned details and revisions', async ({ browser, baseURL }) => {
  const state = fixtureState();
  state.lists.bookLists[0].recommended_books = [{ documentId: 'book', title: 'Pinned Book', is_pinned: true, authors: ['Author'] }];
  state.lists.bookLists.push({ ...structuredClone(state.lists.bookLists[0]), documentId: 'private', List_Name: 'Private list', slug: 'private', visibility: false, recommended_books: [] });
  const fixture = await openFixture(browser, baseURL!, state, { owner: true });
  try {
    await fixture.page.goto('/logo.svg');
    const snapshot = await fixture.page.evaluate(async () => (await fetch('/api/explorers/v1/categories/books/content-snapshot')).json());
    expect(snapshot.version).toBe('explorers-owner-content/v2');
    const result = await fixture.page.evaluate(async token => {
      const get = async (path:string) => (await fetch('/api/explorers/v1'+path)).json();
      return Promise.all([
        get('/collections?category=books&status=all&limit=24&snapshotToken='+token),
        get('/recommendations?category=books&status=active&limit=24&snapshotToken='+token),
        get('/categories/books/memberships?collectionStatus=all&recommendationStatus=active&limit=24&snapshotToken='+token),
        get('/categories/books/top-picks?limit=24&snapshotToken='+token),
      ]);
    }, snapshot.snapshotToken);
    expect(result[0].items.map((item:any) => item.visibility)).toEqual(['public','private']);
    expect(result[1].items[0].accountId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result[2].items[0].collectionRevision).toBe(result[0].items[0].revision);
    expect(result[3].items[0].recommendationId).toBe(result[1].items[0].id);
    const detail = await fixture.page.evaluate(async id => (await fetch('/api/explorers/v1/recommendations/'+id+'/editable?status=active')).json(), bookFixtureId('recommendation','book'));
    expect(detail.recommendation.displayTitle).toBe('Pinned Book');
    expect(detail.recommendation.categoryRevision).toBe(snapshot.revision);
    state.lists.bookLists = [];
    const stale = await fixture.page.evaluate(async token => (await fetch('/api/explorers/v1/categories/books/content-snapshot/validate?snapshotToken='+token)).status, snapshot.snapshotToken);
    expect(stale).toBe(409);
    const empty = await fixture.page.evaluate(async () => {
      const snapshot = await (await fetch('/api/explorers/v1/categories/books/content-snapshot')).json();
      return (await fetch('/api/explorers/v1/collections?category=books&status=all&snapshotToken='+snapshot.snapshotToken)).json();
    });
    expect(empty.items).toEqual([]);
  } finally { await closeFixture(fixture); }
});

test('Books canonical fixture rejects anonymous sessions and preserves exact request denial', async ({browser,baseURL}) => {
  const fixture = await openFixture(browser,baseURL!,fixtureState());
  try {
    await fixture.page.goto('/logo.svg');
    expect(await fixture.page.evaluate(async () => (await fetch('/api/explorers/v1/categories/books/content-snapshot')).status)).toBe(401);
  } finally { await closeFixture(fixture); }
  const handler = createBooksOwnerFixture(() => []);
  for (const path of ['/categories/movies/content-snapshot','/categories/books/content-snapshot?accountId=other','/collections?category=movies','/categories/books/content-snapshot?unexpected=1']) {
    expect(handler(new URL('/api/explorers/v1'+path,baseURL))).toBeUndefined();
  }
  const foreign = fixtureState(); foreign.lists.bookLists[0].account.documentId = 'another-owner';
  expect(createBooksOwnerFixture(() => foreign.lists.bookLists)(new URL('/api/explorers/v1/categories/books/content-snapshot',baseURL))?.status).toBe(403);
});

test('Books exact fault injection recovers without writes and pages complete collections', async ({browser,baseURL}) => {
  const state = fixtureState();
  state.lists.bookLists = Array.from({length:25},(_,n)=>({...structuredClone(state.lists.bookLists[0]),documentId:`list-${n}`,List_Name:`List ${n}`,slug:`list-${n}`}));
  state.faults.set('/api/explorers/v1/categories/books/content-snapshot',[{kind:'error',status:503}]);
  const fixture = await openFixture(browser,baseURL!,state,{owner:true});
  try {
    await fixture.page.goto('/logo.svg');
    expect(await fixture.page.evaluate(async()=> (await fetch('/api/explorers/v1/categories/books/content-snapshot')).status)).toBe(503);
    const pages = await fixture.page.evaluate(async()=> {
      const get=async(path:string)=>(await fetch('/api/explorers/v1'+path)).json();
      const snapshot=await get('/categories/books/content-snapshot');
      const first=await get('/collections?category=books&status=all&limit=24&snapshotToken='+snapshot.snapshotToken);
      const second=await get('/collections?category=books&status=all&limit=24&snapshotToken='+snapshot.snapshotToken+'&cursor='+first.nextCursor);
      return [first,second];
    });
    expect(pages[0].items).toHaveLength(24);expect(pages[1].items).toHaveLength(1);expect(pages[1].nextCursor).toBeNull();
    expect(state.writes).toEqual([]);
  }finally{await closeFixture(fixture);}
});

test('Books collection commands enforce observed revision and replay lost acknowledgement without duplicate writes', async({browser,baseURL})=>{
  const state=fixtureState(), id=bookFixtureId('collection','books-list'), path='/api/explorers/v1/collections/'+id;
  state.faults.set(path,[{kind:'lost'}]);
  const fixture=await openFixture(browser,baseURL!,state,{owner:true});
  try{
    await fixture.page.goto('/logo.svg');
    const command=async(revision:number,key:string,method='PATCH')=>fixture.page.evaluate(async({path,revision,key,method})=>{
      const response=await fetch(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({expectedRevision:revision,...(method==='PATCH'?{visibility:'private',publicationState:'draft'}:{})})});
      return {status:response.status,body:await response.json()};
    },{path,revision,key,method});
    expect((await command(1,'lost-key-0001')).status).toBe(503);
    const replay=await command(1,'lost-key-0001');expect(replay.status).toBe(200);expect(replay.body.collection.revision).toBe(2);
    expect(state.writes).toHaveLength(1);
    expect((await command(1,'fresh-key-0002')).status).toBe(409);
    expect((await command(2,'delete-key-0003','DELETE')).status).toBe(200);
    expect(state.writes).toHaveLength(2);expect(state.lists.bookLists).toEqual([]);
    expect(state.account.public_books).toBe('Yes');expect(state.account.pinned_nav_tabs).toContain('public_books');
  }finally{await closeFixture(fixture);}
});

test('Books category account uses current canonical revision and preserves unrelated categories',async({browser,baseURL})=>{
  const state=fixtureState({pinned_nav_tabs:['public_profile','public_books','public_games']});
  const fixture=await openFixture(browser,baseURL!,state,{owner:true});
  try{
    await fixture.page.goto('/logo.svg');
    const result=await fixture.page.evaluate(async()=>{
      const before=(await(await fetch('/api/explorers/v1/me')).json()).account;
      const save=async(body:unknown)=>{const response=await fetch('/api/explorers/v1/account',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
      const categories=before.categories.map((c:any)=>c.category==='books'?{...c,isPublic:false,pinnedOrder:null}:c);
      const saved=await save({expectedRevision:before.revision,categories});
      const stale=await save({expectedRevision:before.revision,categories});
      return {before,saved,stale};
    });
    expect(result.saved.status).toBe(200);expect(result.saved.body.account.revision).toBe(result.before.revision+1);
    expect(result.saved.body.account.id).toBe(result.before.id);expect(result.stale.status).toBe(409);
    expect(state.account.pinned_nav_tabs).toEqual(['public_profile','public_games']);expect(state.account.public_games).toBe('Yes');
  }finally{await closeFixture(fixture);}
});
