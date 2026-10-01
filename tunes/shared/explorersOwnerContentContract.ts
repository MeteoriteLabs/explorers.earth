import { z } from 'zod/v3';
import { collectionCoreDtoSchema, recommendationCoreDtoSchema, contentCategorySchema, contentIdSchema } from './explorersContract';
const status=z.enum(['active','archived']).default('active');
const limit=z.union([z.number().int().min(1).max(100),z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(100))]).default(24);
export const ownerCollectionsRequestSchema=z.object({category:contentCategorySchema,status,limit,cursor:z.string().min(1).max(4096).optional()}).strict();
export const ownerRecommendationsRequestSchema=ownerCollectionsRequestSchema.extend({collectionId:contentIdSchema.optional()}).strict();
export const ownerDetailRequestSchema=z.object({status}).strict();
export const ownerCollectionDtoSchema=collectionCoreDtoSchema.extend({archived:z.boolean(),displayOrder:z.number().int().nonnegative()}).strict();
export const ownerRecommendationDtoSchema=recommendationCoreDtoSchema.extend({archived:z.boolean(),pin:z.object({collectionId:contentIdSchema,position:z.number().int().nonnegative(),revision:z.number().int().positive().safe()}).strict().nullable(),memberships:z.array(z.object({collectionId:contentIdSchema,
  collectionRevision:z.number().int().positive().safe(),displayOrder:z.number().int().nonnegative(),archived:z.boolean()}).strict())}).strict();
export const ownerCollectionPageSchema=z.object({version:z.literal('explorers-owner-content/v1'),snapshot:z.string().regex(/^[a-f0-9]{64}$/),items:z.array(ownerCollectionDtoSchema).max(100),nextCursor:z.string().max(4096).nullable()}).strict();
export const ownerRecommendationPageSchema=ownerCollectionPageSchema.extend({items:z.array(ownerRecommendationDtoSchema).max(100)}).strict();
export type OwnerCollectionsRequest=z.input<typeof ownerCollectionsRequestSchema>;
export type OwnerRecommendationsRequest=z.input<typeof ownerRecommendationsRequestSchema>;
export type OwnerCollectionDto=z.infer<typeof ownerCollectionDtoSchema>;
export type OwnerRecommendationDto=z.infer<typeof ownerRecommendationDtoSchema>;
export type OwnerCollectionPage=z.infer<typeof ownerCollectionPageSchema>;
export type OwnerRecommendationPage=z.infer<typeof ownerRecommendationPageSchema>;
