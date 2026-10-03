import {describe,it,expect} from 'vitest';
import {emptyMovieDetails} from '../../../../../../tunes/shared/explorersMovieContract';
import {movieViewModel,collectionViewModel} from '../moviesViewModel';
describe('retained canonical Movies presentation',()=>{
 it('keeps zero and null facts, original first10 cast positions, copied precedence and uploaded snapshots separate',()=>{
  const facts={...emptyMovieDetails(),runtimeMinutes:0,providerRating:0,cast:Array.from({length:11},(_,i)=>({personId:1,creditId:'same',name:'Actor',character:'',profileUrl:i===0?null:'https://image.tmdb.org/t/p/w185/actor.jpg',order:i}))};
  const d={id:'rec',entityId:'entity',entity:{provenance:null},displayTitle:null,effectiveMovieDetails:facts,movieContext:{region:'US',selectedProviderIds:null},movieTerms:[],providerMedia:{poster:{url:'/owned/poster'},backdrop:null,cast:[{slot:{kind:'cast',ordinal:1,personId:1,creditId:'same'},media:{url:'/owned/cast'}}]},note:{html:'<p>Note</p>'},userRating:0,mediaIds:['snapshot']};
  const movie=movieViewModel(d as never,{collectionId:'list',recommendationId:'rec',displayOrder:3} as never);
  expect(movie.tmdb_id).toBe('');expect(movie.title).toBe('Untitled movie');expect(movie.runtime).toBe(0);expect(movie.tmdb_rating).toBe(0);expect(movie.user_rating).toBe(0);expect(movie.poster_path).toBe('/owned/poster');expect(movie.cast_details).toHaveLength(10);expect(movie.cast_details?.[0].profile_url).toBeNull();expect(movie.cast_details?.[1].profile_url).toBe('/owned/cast');expect(movie.Media).toEqual([{documentId:'snapshot',url:'/api/explorers/v1/media/snapshot/content'}]);
 });
 it('keeps first provider occurrence before stable priority sorting and selected order',()=>{
  const p=(providerId:number,name:string,priority:number)=>({providerId,name,priority,logoUrl:null});
  const facts={...emptyMovieDetails(),watchProviders:{US:{flatrate:[p(1,'First',2),p(1,'Later',0),p(2,'Tie',2)],rent:[p(3,'Earlier',1)],buy:[]}}};
  const d={id:'r',entityId:'e',entity:{provenance:null},effectiveMovieDetails:facts,movieContext:{region:'US',selectedProviderIds:null},movieTerms:[],mediaIds:[]};
  expect(movieViewModel(d as never,{} as never).watch_providers.map(p=>p.provider_name)).toEqual(['Earlier','First','Tie']);
  expect(movieViewModel({...d,movieContext:{region:'US',selectedProviderIds:[2,1]}} as never,{} as never).watch_providers.map(p=>p.provider_name)).toEqual(['Tie','First']);
 });
 it('requires published and public collection state',()=>{
  const c={id:'l',title:'List',slug:'list',displayOrder:0,visibility:'public',publicationState:'draft'};
  expect(collectionViewModel(c as never,[]).Visibility).toBe(false);expect(collectionViewModel({...c,publicationState:'published'} as never,[]).Visibility).toBe(true);
 });
});
