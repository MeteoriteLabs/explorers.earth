import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { Router } from 'express';
import type { Pool } from 'pg';
import type { ExplorersAuth, ExplorersAuthConfig } from '../auth/betterAuth';
import type { Actor } from '../application/actor';
import { RecommendationService } from '../application/recommendations';
import { CatalogService } from '../application/catalog';
import { OwnerContentService } from '../application/ownerContent';
import { RecommendationFailure } from '../repositories/explorersRecommendationRepository';
import { requireActor, sendActorError } from '../middleware/explorersPrincipal';
import type { RequestContext } from '../../shared/explorersContract';

export function setupExplorersRecommendationRoutes(app:Express,pool:Pool,auth:ExplorersAuth,config:ExplorersAuthConfig) {
  const service=new RecommendationService(pool),catalog=new CatalogService(pool);
  const ownerContent=new OwnerContentService(pool,config.secret);
  const routes=Router({caseSensitive:true,strict:true});
  const unsupported=(_request:Request,response:Response)=>response.set('Cache-Control','no-store').status(405).json({error:{code:'INVALID_INPUT',message:'Method is not supported',requestId:randomUUID()}});
  const mutation=(work:(actor:Actor,id:string,body:unknown,context:RequestContext)=>Promise<unknown>,name:string,status=200)=>async(request:Request,response:Response)=>{
    response.set('Cache-Control','no-store');
    const requestId=randomUUID();
    if(request.get('origin')!==config.baseURL) return response.status(403).json({error:{code:'FORBIDDEN',message:'Origin is not trusted',requestId}});
    try {
      const actor=await requireActor(request,auth,pool);
      if(Object.keys(request.query).length) throw new RecommendationFailure(422,'Query parameters are not accepted');
      const result=await work(actor,String(request.params.id??''),request.body,{requestId,idempotencyKey:request.get('Idempotency-Key')});
      return response.status(status).json({[name]:result});
    } catch(error) {
      if(error instanceof RecommendationFailure) return response.status(error.status).json({error:{code:error.status===404?'NOT_FOUND':error.status===409?'CONFLICT':'INVALID_INPUT',message:error.message,requestId}});
      sendActorError(request,response,error);
    }
  };
  const read=(work:(actor:Actor,id:string,query:unknown)=>Promise<unknown>,name?:string)=>async(request:Request,response:Response)=>{
    response.set('Cache-Control','no-store');const requestId=randomUUID();
    try {
      const actor=await requireActor(request,auth,pool),result=await work(actor,String(request.params.id??''),request.query);
      return response.json(name?{[name]:result}:result);
    } catch(error) {
      if(error instanceof RecommendationFailure) return response.status(error.status).json({error:{code:error.status===404?'NOT_FOUND':error.status===409?'CONFLICT':'INVALID_INPUT',message:error.message,requestId}});
      sendActorError(request,response,error);
    }
  };
  routes.get('/api/explorers/v1/collections',read((a,_id,q)=>ownerContent.listCollections(a,q)));
  routes.get('/api/explorers/v1/collections/:id',read((a,id,q)=>ownerContent.getCollection(a,id,q),'collection'));
  routes.get('/api/explorers/v1/recommendations',read((a,_id,q)=>ownerContent.listRecommendations(a,q)));
  // Literal registrations also make each executable boundary visible to the
  // official AST inventory; interpolated templates and loop paths are not parsed.
  routes.post('/api/explorers/v1/entities/resolve',mutation((a,_id,b)=>catalog.resolveEntity(a,b),'entity'));
  routes.post('/api/explorers/v1/collections',mutation((a,_id,b,c)=>service.createCollection(a,b,c),'collection',201));
  routes.patch('/api/explorers/v1/collections/:id',mutation((a,id,b,c)=>service.updateCollection(a,id,b,c),'collection'));
  routes.patch('/api/explorers/v1/collections/:id/order',mutation((a,id,b,c)=>service.reorderCollection(a,id,b,c),'collection'));
  routes.delete('/api/explorers/v1/collections/:id',mutation((a,id,b,c)=>service.archiveCollection(a,id,b,c),'collection'));
  // Reserve static search before /:id; pagination/search is a subsequent slice.
  routes.all('/api/explorers/v1/recommendations/search',unsupported);
  routes.get('/api/explorers/v1/recommendations/:id',read((a,id,q)=>ownerContent.getRecommendation(a,id,q),'recommendation'));
  routes.post('/api/explorers/v1/recommendations',mutation((a,_id,b,c)=>service.createRecommendation(a,b,c),'recommendation',201));
  routes.patch('/api/explorers/v1/recommendations/:id',mutation((a,id,b,c)=>service.updateRecommendation(a,id,b,c),'recommendation'));
  routes.delete('/api/explorers/v1/recommendations/:id',mutation((a,id,b,c)=>service.archiveRecommendation(a,id,b,c),'recommendation'));
  routes.all('/api/explorers/v1/entities/resolve',unsupported);
  routes.all('/api/explorers/v1/collections',unsupported);
  routes.all('/api/explorers/v1/collections/:id',unsupported);
  routes.all('/api/explorers/v1/collections/:id/order',unsupported);
  routes.all('/api/explorers/v1/recommendations',unsupported);
  routes.all('/api/explorers/v1/recommendations/:id',unsupported);
  app.use(routes);
}
