import { Router, type Express, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Pool } from 'pg';
import { PublicContentFailure, PublicContentService } from '../application/publicContent';
export function setupExplorersPublicContentRoutes(app:Express,pool:Pool,secret:string):void {
  const router=Router({caseSensitive:true,strict:true}),service=new PublicContentService(pool,secret);
  router.use('/api/explorers/v1/public/profiles',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();},rateLimit({windowMs:60_000,limit:120,standardHeaders:'draft-7',legacyHeaders:false}));
  const read=async(req:Request,res:Response)=>{
    try {
      if(Object.keys(req.query).some(key=>key!=='limit'&&key!=='cursor')) throw new PublicContentFailure(400);
      // Raw query keys are retained so unknown keys/arrays cannot be discarded before validation.
      const value=await service.page({...req.query,username:req.params.username,category:req.params.category,...(req.params.slug?{slug:req.params.slug}:{})});
      return value?res.json(value):res.status(404).json({version:'explorers-public-error/v1',error:{code:'NOT_FOUND'}});
    } catch(error) {
      if(error instanceof PublicContentFailure) return res.status(error.status).json({version:'explorers-public-error/v1',error:{code:error.status===409?'PAGE_CHANGED':'BAD_REQUEST',...(error.status===409?{restart:true}:{})}});
      return res.status(503).json({version:'explorers-public-error/v1',error:{code:'UNAVAILABLE',retryable:true}});
    }
  };
  router.get('/api/explorers/v1/public/profiles/:username/collections/:category',read);
  router.get('/api/explorers/v1/public/profiles/:username/collections/:category/:slug/recommendations',read);
  app.use(router);
}
