import { explorersApiClient, assertCompleteMyCategoryContent, ExplorersApiError, type CompleteMyCategoryContent, type RecommendationObservation } from '../../../lib/explorersApiClient';
import { movieViewModel, collectionViewModel } from './moviesViewModel';
import type { MovieList } from '../types';
import useAuthStore from '../../../store/store';

export type MoviesOwnerContent={observation:CompleteMyCategoryContent;lists:MovieList[];details:ReadonlyMap<string,RecommendationObservation>};
export const moviesCommandKey=()=>crypto.randomUUID();
export async function readMoviesOwnerContent(signal?:AbortSignal):Promise<MoviesOwnerContent> {
 const controller=new AbortController();let terminal=false,firstError:unknown;
 const forwardAbort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',forwardAbort,{once:true});if(signal?.aborted)forwardAbort();
 const fail=(error:unknown):never=>{if(!terminal){terminal=true;firstError=error;controller.abort(error);}throw firstError;};
 const checkTerminal=()=>{if(terminal)throw firstError;if(controller.signal.aborted)throw new DOMException('Owner read cancelled','AbortError');};
 try{checkTerminal();

  const initial=useAuthStore.getState(),username=initial.user?.username??'';
  const assertCurrent=()=>{const current=useAuthStore.getState();if(signal?.aborted||current.generation!==initial.generation||current.accountId!==initial.accountId)throw new ExplorersApiError(409,'CONFLICT','Movie owner changed while loading. Refresh to try again.');};

  const observation=await explorersApiClient.getCompleteMyCategoryTopPicks({category:'movies',status:'active'},controller.signal);
  assertCurrent();
  checkTerminal();const details=new Map<string,RecommendationObservation>();let index=0,detailBytes=0;
  // Bounded detail fanout; fail the entire observation on any missing resource.
  await Promise.all(Array.from({length:Math.min(4,observation.recommendations.length)},async()=>{try{
    while(index<observation.recommendations.length){
      checkTerminal();
      assertCurrent();const item=observation.recommendations[index++];
      const observed=await explorersApiClient.getMyEditableRecommendation(item.id,controller.signal);
      checkTerminal();
      assertCurrent();if(observed.detail.revision!==item.revision||observed.detail.categoryRevision!==observation.revision)
        throw new ExplorersApiError(409,'CONFLICT','Movies changed while loading. Refresh to try again.');
      detailBytes+=new TextEncoder().encode(JSON.stringify(observed.detail)).length;
      if(detailBytes>64*1024*1024)throw new ExplorersApiError(422,'READ_LIMIT','Movies exceed the complete editable read limit.');
      details.set(item.id,observed);
    }
  }catch(error){fail(error);}}));
  checkTerminal();const final=await explorersApiClient.getCompleteMyCategoryTopPicks({category:'movies',status:'active'},controller.signal);
  checkTerminal();assertCurrent();if(final.revision!==observation.revision||final.pinRevision!==observation.pinRevision)
    throw new ExplorersApiError(409,'CONFLICT','Movies changed while loading. Refresh to try again.');
  assertCompleteMyCategoryContent(final);
  const lists=final.collections.map(collection=>collectionViewModel(collection,final.memberships
    .filter(member=>member.collectionId===collection.id&&!member.collectionArchived&&!member.recommendationArchived)
    .sort((a,b)=>a.displayOrder-b.displayOrder||a.recommendationId.localeCompare(b.recommendationId))
    .map(member=>{
      const detail=details.get(member.recommendationId);
      if(!detail)throw new ExplorersApiError(409,'CONFLICT','Missing editable Movie detail');
      return movieViewModel(detail.detail,member,final.topPicks?.find(pin=>pin.recommendationId===member.recommendationId));
    }),username));
  return {observation:final,lists,details};
 }catch(error){return fail(error);}finally{signal?.removeEventListener('abort',forwardAbort);}
}
export async function updateMovieList(id:string,patch:{title?:string;description?:string|null;heading?:string|null;slug?:string;visibility?:boolean},signal?:AbortSignal) {
  const observed=await explorersApiClient.getMyEditableCollection(id,signal);
  const {visibility,...fields}=patch;
  return explorersApiClient.updateMyCollection(observed,{...fields,...(visibility===undefined?{}:{visibility:visibility?'public':'private',publicationState:visibility?'published':'draft'})},moviesCommandKey(),signal);
}
