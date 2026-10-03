import {moviePageCursor,mergeMoviePage} from '../../Movies/api/publicMoviesContinuation';
import { useEffect,useRef } from "react";
import { publicProfileGatewayClient, type PublicCategory } from "./publicProfileGatewayClient";
import { subscribePublicProfileInvalidation } from "./publicProfileInvalidation";
import { mergePublicPage, PUBLIC_PROFILE_PAGE_SIZE, readPublicPageRows, type PublicProfilePageSize } from "./publicProfilePagination";
import { usePublicPagedResource, type PublicPagedState } from "./usePublicPagedResource";

export function usePublicProfileDetail(username: string | undefined, category: PublicCategory, slug: string | undefined, options: { pageSize?: PublicProfilePageSize; enabled?: boolean } = {}): PublicPagedState {
  const pageSize = options.pageSize ?? PUBLIC_PROFILE_PAGE_SIZE;
  const normalizedUsername = username?.trim().toLowerCase();
  const scope = normalizedUsername && slug ? `${normalizedUsername}\u0000${category}\u0000${slug}` : undefined;
  const movieCursors=useRef(new Map<number,string|null>());
  const moviePage=async(value:Promise<unknown>,offset:number,signal:AbortSignal)=>{const data=await value;if(category==='movies'){const rows=readPublicPageRows(data as any,category,true,pageSize),cursor=moviePageCursor(data,true);if(cursor!==null&&rows.length!==pageSize)throw Error('PUBLIC_PROFILE_INVALID_RESPONSE');if(!signal.aborted){if(movieCursors.current.size>=1000)throw Error('PUBLIC_PROFILE_PAGINATION_LIMIT');movieCursors.current.set(offset+rows.length,cursor);}}return data;};
  const state = usePublicPagedResource({
    scope, pageSize, enabled: Boolean(scope) && (options.enabled ?? true), showLoadingOnRevalidation: false,
    readFirst: (signal,bypass)=>{movieCursors.current.clear();return moviePage(pageSize===24?publicProfileGatewayClient.detailPage(username!,category,slug!,{limit:24},signal,bypass):publicProfileGatewayClient.detail(username!,category,slug!,signal,bypass),0,signal);},
    readNext: (offset,signal,bypass)=>{const cursor=category==='movies'?movieCursors.current.get(offset):`o${offset}`;if(!cursor)throw Error('PUBLIC_PROFILE_PAGINATION_LIMIT');return moviePage(publicProfileGatewayClient.detailPage(username!,category,slug!,{limit:pageSize,cursor},signal,bypass),offset,signal);},
    readRows: (data) => readPublicPageRows(data, category, true, pageSize),
    merge: (previous, next) => category==='movies'?mergeMoviePage(previous,next,true,pageSize):mergePublicPage(previous, next, category, true, pageSize),
  });
  useEffect(() => {
    if (!scope) return;
    const eventCategory = {
      places: "public_recommendations", movies: "public_movie", books: "public_books", games: "public_games",
      guides: "public_guides", apps: "public_apps", products: "public_products", people: "public_people",
    }[category];
    return subscribePublicProfileInvalidation((event) => {
      if (event.username.trim().toLowerCase() === normalizedUsername && event.category === eventCategory) void state.refetch();
    });
  }, [category, normalizedUsername, scope, state.refetch]);
  if(category!=='movies')return state;const hasMore=Boolean(state.data)&&moviePageCursor(state.data,true)!==null;return {...state,hasMore,loadMore:()=>hasMore?state.loadMore():Promise.resolve()};
}
