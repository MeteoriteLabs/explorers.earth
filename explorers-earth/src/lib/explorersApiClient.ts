import type { AccountDto, MediaDto, RevisionInput, UpdateAccountInput } from "../../../tunes/shared/explorersContract";
import useAuthStore from "../store/store";
import { ownerCollectionPageSchema, ownerRecommendationPageSchema, ownerCollectionDtoSchema, ownerRecommendationDtoSchema,
  ownerCollectionsRequestSchema, ownerRecommendationsRequestSchema,
  type OwnerCollectionsRequest, type OwnerRecommendationsRequest, type OwnerCollectionDto, type OwnerRecommendationDto } from '../../../tunes/shared/explorersOwnerContentContract';
import { z } from 'zod/v3';

export type CompleteOwnerContent<T> = Readonly<{complete:true;items:readonly T[];snapshot:string;accountId:string;generation:number}>;
const completedSets=new WeakSet<object>();
/** Complete-set writers must call this immediately before using aggregate IDs. */
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
  async getMyCollections(input:OwnerCollectionsRequest,signal?:AbortSignal) {
    const query=ownerCollectionsRequestSchema.parse(input),page=await ownerRead('/collections',query,ownerCollectionPageSchema,signal);
    if(page.items.length>query.limit||page.items.some(x=>x.accountId!==useAuthStore.getState().accountId||x.category!==query.category||x.archived!==(query.status==='archived'))) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content page');return page;
  },
  async getMyRecommendations(input:OwnerRecommendationsRequest,signal?:AbortSignal) {
    const query=ownerRecommendationsRequestSchema.parse(input),page=await ownerRead('/recommendations',query,ownerRecommendationPageSchema,signal);
    if(page.items.length>query.limit||page.items.some(x=>x.accountId!==useAuthStore.getState().accountId||x.category!==query.category||x.archived!==(query.status==='archived')||(query.collectionId&&!x.memberships.some(m=>m.collectionId===query.collectionId&&!m.archived)))) throw new ExplorersApiError(409,'CONFLICT','Invalid owner content page');return page;
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
