import { z } from 'zod/v3';
export const publicContentRequestSchema=z.object({
  username:z.string().regex(/^[a-z][a-z0-9-]{2,29}$/),
  category:z.enum(['places','guides','movies','books','games','apps','products','people']),
  slug:z.string().max(200).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
  limit:z.string().regex(/^(?:[1-9]|1[0-9]|2[0-4])$/).default('12').transform(Number),
  cursor:z.string().min(40).max(2048).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
export type PublicContentRequest=z.infer<typeof publicContentRequestSchema>;
export type PublicCollectionSummary={id:string;title:string;slug:string;description:string|null;heading:string|null};
export type PublicRecommendationSummary={id:string;title:string;kind:'place'|'movie'|'book'|'game'|'app'|'product'|'person';userRating:number|null};
export type PublicContentPage<T>={version:'explorers-public-content/v1';items:T[];nextCursor:string|null};
