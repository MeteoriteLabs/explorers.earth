import type { AccountDto, MediaDto, RevisionInput, UpdateAccountInput } from "../../../tunes/shared/explorersContract";
import useAuthStore from "../store/store";
import { ownerCollectionPageSchema, ownerRecommendationPageSchema, ownerCollectionDtoSchema, ownerRecommendationDtoSchema,
  ownerCollectionsRequestSchema, ownerRecommendationsRequestSchema, ownerMembershipPageSchema, ownerSnapshotSchema,
  type OwnerSnapshot, type OwnerMembershipDto,
  type OwnerCollectionsRequest, type OwnerRecommendationsRequest, type OwnerCollectionDto, type OwnerRecommendationDto } from '../../../tunes/shared/explorersOwnerContentContract';
import { z } from 'zod/v3';

export type CompleteOwnerContent<T> = Readonly<{complete:true;items:readonly T[];snapshot:string;accountId:string;generation:number}>;
const completedSets=new WeakSet<object>();
/** Individual resource completeness only. Category-wide writers require assertCompleteMyCategoryContent instead. */
export function assertCompleteOwnerContent<T>(value:CompleteOwnerContent<T>):void {
  const current=useAuthStore.getState();
  if(!value||!completedSets.has(value)||!value.complete||!current.isAuthenticated||current.generation!==value.generation||current.accountId!==value.accountId)
    throw new ExplorersApiError(409,'CONFLICT','Reload the complete owner content before saving');
}
async function ownerRead<T>(path:string,query:Record<string,unknown>,schema:z.ZodType<T>,signal?:AbortSignal):Promise<T> {
  const initial=useAuthStore.getState(),controller=new AbortController();
  const isCurrent=()=>{const now=useAuthStore.getState();return now.isAuthenticated&&now.generation===initial.generation&&now.accountId===initial.accountId;};
  if(!initial.isAuthenticated||!initial.accountId) throw new ExplorersApiError(401,'UNAUTHENTICATED','Sign in is required');
  const stop=()=>controller.abort();
  const unsubscribe=useAuthStore.subscribe(()=>{if(!isCurrent()) stop();});
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted) stop();
  try {
    const params=new URLSearchParams();for(const [key,value] of Object.entries(query)) if(value!==undefined) params.set(key,String(value));
    const response=await fetch(`/api/explorers/v1${path}?${params}`,{credentials:'include',cache:'no-store',signal:controller.signal});
    const body=await responseBody<unknown>(response,initial.generation);
    if(controller.signal.aborted||!isCurrent()) throw new DOMException('Owner changed','AbortError');
    return schema.parse(body);
  } finally {unsubscribe();signal?.removeEventListener('abort',stop);}
}
type OwnerPage<T>={items:T[];snapshot:string;nextCursor:string|null};
async function allOwnerContent<T extends {id:string;accountId:string}>(input:Record<string,unknown>,read:(input:Record<string,unknown>,signal?:AbortSignal)=>Promise<OwnerPage<T>>,signal?:AbortSignal):Promise<CompleteOwnerContent<T>> {
  const initial=useAuthStore.getState(),items:T[]=[],ids=new Set<string>(),cursors=new Set<string>();let cursor:string|undefined,snapshot:string|undefined;
  for(let n=0;n<1000;n++) {
    if(signal?.aborted||useAuthStore.getState().generation!==initial.generation||useAuthStore.getState().accountId!==initial.accountId) throw new DOMException('Owner changed','AbortError');
    const page=await read({...input,cursor},signal);
    if(snapshot&&page.snapshot!==snapshot) throw new ExplorersApiError(409,'CONFLICT','Content changed; restart pagination');snapshot=page.snapshot;
    for(const item of page.items) {
      if(item.accountId!==initial.accountId||ids.has(item.id)) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content page');
      ids.add(item.id);items.push(item);
    }
    if(page.nextCursor===null) {
      const completed=Object.freeze({complete:true as const,items:Object.freeze(items),snapshot,accountId:initial.accountId!,generation:initial.generation});
      completedSets.add(completed);assertCompleteOwnerContent(completed);return completed;
    }
    if(page.items.length===0||cursors.has(page.nextCursor)) throw new ExplorersApiError(409,'CONFLICT','Invalid continuation');
    cursors.add(page.nextCursor);cursor=page.nextCursor;
  }
  throw new ExplorersApiError(409,'CONFLICT','Owner content exceeds the complete-set read bound');
}

export class ExplorersApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] : T extends object ? {readonly [K in keyof T]:DeepReadonly<T[K]>} : T;
export type CompleteMyCategoryContent = DeepReadonly<{
  complete:true;category:OwnerCollectionDto['category'];status:'active'|'archived'|'all';
  accountId:string;generation:number;revision:string;snapshotToken:string;expiresAt:number;pinRevision:number|null;
  collections:OwnerCollectionDto[];recommendations:OwnerRecommendationDto[];memberships:OwnerMembershipDto[];
}>;
const completedCategories=new WeakSet<object>();
/** Call immediately before staging/saving. The server writer must also check expected category revision under its write lock. */
export function assertCompleteMyCategoryContent(value:CompleteMyCategoryContent):void {
  const current=useAuthStore.getState();
  if(!value||!completedCategories.has(value)||!current.isAuthenticated||current.accountId!==value.accountId||current.generation!==value.generation||Date.now()>=value.expiresAt)
    throw new ExplorersApiError(409,'CONFLICT','Reload the complete category before saving');
}
/** Mutable staging data is a copy; only the observed result carries completion authority. */
export function copyMyCategoryContentForStaging(value:CompleteMyCategoryContent):{collections:OwnerCollectionDto[];recommendations:OwnerRecommendationDto[];memberships:OwnerMembershipDto[]} {
  assertCompleteMyCategoryContent(value);
  return {collections:value.collections.map(item=>({...item})),recommendations:value.recommendations.map(item=>({...item,mediaIds:[...item.mediaIds],pin:item.pin?{...item.pin}:null})),memberships:value.memberships.map(item=>({...item}))};
}
function deepFreeze<T>(value:T):DeepReadonly<T> {
  if(value!==null&&typeof value==='object') {for(const child of Object.values(value)) deepFreeze(child);Object.freeze(value);}
  return value as DeepReadonly<T>;
}

// Transport safeguards only: exceeding one rejects the entire read, never truncates domain data.
const JOINT_PAGE_BYTES=4*1024*1024,JOINT_TOTAL_BYTES=64*1024*1024,JOINT_REQUESTS=1000,JOINT_STREAM_ROWS=100000;
async function completeCategory(input:Pick<OwnerCollectionsRequest,'category'|'status'>,signal?:AbortSignal):Promise<CompleteMyCategoryContent> {
  const query=ownerCollectionsRequestSchema.pick({category:true,status:true}).parse(input),initial=useAuthStore.getState();
  if(!initial.isAuthenticated||!initial.accountId) throw new ExplorersApiError(401,'UNAUTHENTICATED','Sign in is required');
  const controller=new AbortController(),stop=()=>controller.abort();
  const isCurrent=()=>{const now=useAuthStore.getState();return now.isAuthenticated&&now.accountId===initial.accountId&&now.generation===initial.generation;};
  const unsubscribe=useAuthStore.subscribe(()=>{if(!isCurrent()) stop();});
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted) stop();
  let requests=0,bytes=0,snapshot:OwnerSnapshot|undefined;
  const fail=(code:string,message:string,status=409):never=>{throw new ExplorersApiError(status,code,message);};
  const check=()=>{
    if(controller.signal.aborted||!isCurrent()) {const error=new ExplorersApiError(409,'ABORTED','Category read cancelled');error.name='AbortError';throw error;}
    if(snapshot&&Date.now()>=snapshot.expiresAt) fail('SNAPSHOT_EXPIRED','Category snapshot expired',422);
  };
  const invalid=()=>fail('INVALID_OWNER_CONTENT','Invalid category content response',422);
  const read=async<T>(path:string,params:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>=>{
    check();if(++requests>JOINT_REQUESTS) fail('READ_BUDGET_EXCEEDED','Category read exceeds the request budget',413);
    const search=new URLSearchParams();for(const [key,value] of Object.entries(params)) if(value!==undefined) search.set(key,String(value));
    const response=await fetch(`/api/explorers/v1${path}?${search}`,{credentials:'include',cache:'no-store',signal:controller.signal});
    if(response.status===401) {check();handleExpiredSession(response,initial.generation);await response.body?.cancel().catch(()=>{});fail('UNAUTHENTICATED','Sign in is required',401);}
    const declared=Number(response.headers.get('Content-Length'));
    if(Number.isFinite(declared)&&(declared>JOINT_PAGE_BYTES||bytes+declared>JOINT_TOTAL_BYTES)) {await response.body?.cancel();fail('READ_BUDGET_EXCEEDED','Category response exceeds the byte budget',413);}
    const reader=response.body?.getReader();if(!reader) return invalid();
    const chunks:Uint8Array[]= [];let length=0;
    try {
      for(;;) {
        check();const chunk=await reader.read();check();if(chunk.done) break;
        length+=chunk.value.byteLength;bytes+=chunk.value.byteLength;
        if(length>JOINT_PAGE_BYTES||bytes>JOINT_TOTAL_BYTES) fail('READ_BUDGET_EXCEEDED','Category response exceeds the byte budget',413);
        chunks.push(chunk.value);
      }
    } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
    const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks) {raw.set(chunk,offset);offset+=chunk.byteLength;}
    let body:any;try {body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));} catch {return invalid();}
    if(!response.ok) {handleExpiredSession(response,initial.generation);fail(typeof body?.error?.code==='string'?body.error.code:'UNAVAILABLE',typeof body?.error?.message==='string'?body.error.message:'Request failed',response.status);}
    const parsed=schema.safeParse(body);if(!parsed.success) return invalid();check();return parsed.data;
  };
  try {
    snapshot=await read(`/categories/${query.category}/content-snapshot`,{},ownerSnapshotSchema);check();
    const cursors=new Set<string>();
    const collect=async<T>(path:string,params:Record<string,unknown>,schema:z.ZodType<{items:T[];snapshot:string;snapshotToken:string;expiresAt:number;nextCursor:string|null}>):Promise<T[]>=>{
      const items:T[]=[];let cursor:string|undefined;
      for(;;) {
        const page=await read(path,{...params,limit:24,cursor,snapshotToken:snapshot!.snapshotToken},schema);
        if(page.items.length>24||page.snapshot!==snapshot!.revision||page.snapshotToken!==snapshot!.snapshotToken||page.expiresAt!==snapshot!.expiresAt) return invalid();
        if(items.length+page.items.length>JOINT_STREAM_ROWS) fail('READ_BUDGET_EXCEEDED','Category stream exceeds the row budget',413);
        items.push(...page.items);
        if(page.nextCursor===null) return items;
        if(!page.items.length||cursors.has(page.nextCursor)) return invalid();
        cursors.add(page.nextCursor);cursor=page.nextCursor;
      }
    };
    // All parents are needed even when recommendation status is narrower.
    const collections=await collect('/collections',{category:query.category,status:'all'},ownerCollectionPageSchema);
    const recommendations=await collect('/recommendations',{category:query.category,status:query.status},ownerRecommendationPageSchema);
    const memberships=await collect(`/categories/${query.category}/memberships`,{collectionStatus:'all',recommendationStatus:query.status},ownerMembershipPageSchema);
    const parents=new Map<string,OwnerCollectionDto>(),children=new Map<string,OwnerRecommendationDto>();
    for(const item of collections) {if(item.accountId!==initial.accountId||item.category!==query.category||parents.has(item.id)) return invalid();parents.set(item.id,item);}
    for(const item of recommendations) {
      if(item.accountId!==initial.accountId||item.category!==query.category||children.has(item.id)||(query.status!=='all'&&item.archived!==(query.status==='archived'))) return invalid();children.set(item.id,item);
    }
    const tuples=new Set<string>();
    for(const item of memberships) {
      const parent=parents.get(item.collectionId),child=children.get(item.recommendationId),key=`${item.recommendationId}:${item.collectionId}`;
      if(!parent||!child||tuples.has(key)||parent.revision!==item.collectionRevision||parent.archived!==item.collectionArchived||child.archived!==item.recommendationArchived) return invalid();tuples.add(key);
    }
    const positions=new Set<number>();
    for(const child of recommendations) if(child.pin) {
      const parent=parents.get(child.pin.collectionId);
      if(child.archived||!parent||parent.archived||!tuples.has(`${child.id}:${parent.id}`)||child.pin.revision!==snapshot.pinRevision||positions.has(child.pin.position)) return invalid();positions.add(child.pin.position);
    }
    const validated=await read(`/categories/${query.category}/content-snapshot/validate`,{snapshotToken:snapshot.snapshotToken},ownerSnapshotSchema);
    if(validated.snapshotToken!==snapshot.snapshotToken||validated.revision!==snapshot.revision||validated.expiresAt!==snapshot.expiresAt||validated.pinRevision!==snapshot.pinRevision) return invalid();check();
    const complete=deepFreeze({complete:true as const,category:query.category,status:query.status,accountId:initial.accountId,generation:initial.generation,...snapshot,collections,recommendations,memberships});
    completedCategories.add(complete);assertCompleteMyCategoryContent(complete);return complete;
  } catch(error) {
    if(error instanceof ExplorersApiError) throw error;
    check();throw new ExplorersApiError(503,'UNAVAILABLE','Unable to read complete category content');
  } finally {unsubscribe();signal?.removeEventListener('abort',stop);}
}

function handleExpiredSession(response: Response, generation: number) {
  if (response.status !== 401) return;
  const current = useAuthStore.getState();
  if (current.generation === generation && current.isAuthenticated) current.logout();
}

async function responseBody<T>(response: Response, generation: number): Promise<T> {
  handleExpiredSession(response, generation);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ExplorersApiError(response.status, body?.error?.code ?? "UNAVAILABLE",
    body?.error?.message ?? "Request failed");
  return body as T;
}

export const explorersApiClient = {
  getCompleteMyCategoryContent:completeCategory,
  async getMyCollections(input:OwnerCollectionsRequest,signal?:AbortSignal) {
    const query=ownerCollectionsRequestSchema.parse(input),page=await ownerRead('/collections',query,ownerCollectionPageSchema,signal);
    if(page.items.length>query.limit||page.items.some(x=>x.accountId!==useAuthStore.getState().accountId||x.category!==query.category||(query.status!=='all'&&x.archived!==(query.status==='archived')))) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content page');return page;
  },
  async getMyRecommendations(input:OwnerRecommendationsRequest,signal?:AbortSignal) {
    const query=ownerRecommendationsRequestSchema.parse(input),page=await ownerRead('/recommendations',query,ownerRecommendationPageSchema,signal);
    if(page.items.length>query.limit||page.items.some(x=>x.accountId!==useAuthStore.getState().accountId||x.category!==query.category||(query.status!=='all'&&x.archived!==(query.status==='archived')))) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content page');return page;
  },
  async getAllMyCollections(input:Omit<OwnerCollectionsRequest,'cursor'>,signal?:AbortSignal):Promise<CompleteOwnerContent<OwnerCollectionDto>> {
    return allOwnerContent(ownerCollectionsRequestSchema.omit({cursor:true}).parse(input),(q,s)=>explorersApiClient.getMyCollections(q as OwnerCollectionsRequest,s),signal);
  },
  async getAllMyRecommendations(input:Omit<OwnerRecommendationsRequest,'cursor'>,signal?:AbortSignal):Promise<CompleteOwnerContent<OwnerRecommendationDto>> {
    return allOwnerContent(ownerRecommendationsRequestSchema.omit({cursor:true}).parse(input),(q,s)=>explorersApiClient.getMyRecommendations(q as OwnerRecommendationsRequest,s),signal);
  },
  async getMyCollection(id:string,status:'active'|'archived'='active',signal?:AbortSignal) {
    const result=await ownerRead(`/collections/${encodeURIComponent(id)}`,{status},z.object({collection:ownerCollectionDtoSchema}).strict(),signal);
    if(result.collection.accountId!==useAuthStore.getState().accountId||result.collection.id!==id||result.collection.archived!==(status==='archived')) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content detail');
    return result.collection;
  },
  async getMyRecommendation(id:string,status:'active'|'archived'='active',signal?:AbortSignal) {
    const result=await ownerRead(`/recommendations/${encodeURIComponent(id)}`,{status},z.object({recommendation:ownerRecommendationDtoSchema}).strict(),signal);
    if(result.recommendation.accountId!==useAuthStore.getState().accountId||result.recommendation.id!==id||result.recommendation.archived!==(status==='archived')) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content detail');
    return result.recommendation;
  },
  async getMyProfile(signal?: AbortSignal): Promise<AccountDto> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch("/api/explorers/v1/me", { credentials: "include", cache: "no-store", signal });
    return (await responseBody<{ account: AccountDto }>(response, generation)).account;
  },
  async updateAccount(input: UpdateAccountInput & RevisionInput, signal?: AbortSignal): Promise<AccountDto> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch("/api/explorers/v1/account", { method: "PATCH", credentials: "include", signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return (await responseBody<{ account: AccountDto }>(response, generation)).account;
  },
  async createMedia(file: File, purpose: "profile" | "background" | "feed", signal?: AbortSignal): Promise<MediaDto> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch("/api/explorers/v1/media", { method: "POST", credentials: "include", signal,
      headers: { "Content-Type": file.type, "X-Media-Purpose": purpose, "X-File-Name": file.name }, body: file });
    return (await responseBody<{ media: MediaDto }>(response, generation)).media;
  },
  async deleteMedia(id: string, signal?: AbortSignal): Promise<void> {
    const generation = useAuthStore.getState().generation;
    const response = await fetch(`/api/explorers/v1/media/${encodeURIComponent(id)}`, {
      method: "DELETE", credentials: "include", signal,
    });
    if (!response.ok) await responseBody<never>(response, generation);
  },
};
