import { z } from "zod";

export const categoryKeys = [
  "places", "guides", "music", "movies", "books", "games", "apps", "products", "people",
] as const;
export const categoryKeySchema = z.enum(categoryKeys);
export type CategoryKey = z.infer<typeof categoryKeySchema>;

export const apiErrorCodes = ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "INVALID_INPUT", "RATE_LIMITED"] as const;
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string(),
    requestId: z.string(),
  }).strict(),
}).strict();
export type ApiError = z.infer<typeof apiErrorSchema>;

export const mediaDtoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().startsWith("/api/explorers/v1/media/"),
  mimeType: z.string(),
  size: z.number().int().nonnegative().safe(),
  alternativeText: z.string().nullable(),
  caption: z.string().nullable(),
}).strict();
export type MediaDto = z.infer<typeof mediaDtoSchema>;

export const profileFeedItemSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid().nullable(),
  url: z.string().url().or(z.string().startsWith("/api/explorers/v1/media/")),
  source: z.enum(["manual", "google", "instagram"]),
  type: z.enum(["image", "video"]),
  caption: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
}).strict();
export type ProfileFeedItem = z.infer<typeof profileFeedItemSchema>;
export const profileFeedInputSchema = profileFeedItemSchema.omit({ id: true, url: true }).extend({
  externalUrl: z.string().url().startsWith("https://").nullable(),
}).strict();

export const accountDtoSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().nullable(),
  displayName: z.string().nullable(),
  accountType: z.enum(["Personal", "Creator", "Business"]).nullable(),
  onboardingStatus: z.enum(["incomplete", "complete"]),
  status: z.enum(["active", "suspended", "pending_deletion", "deleted"]),
  revision: z.number().int().positive().safe(),
  publicProfile: z.boolean(),
  autoPinning: z.boolean(),
  locale: z.string(),
  mobileNumber: z.string().nullable(),
  mobileNumberVisible: z.boolean(),
  bioPlain: z.string().nullable(),
  bioRich: z.unknown().nullable(),
  primaryAddress: z.unknown().nullable(),
  additionalAddresses: z.array(z.unknown()),
  publicAddress: z.unknown().nullable(),
  profilePlaceDetails: z.unknown().nullable(),
  categories: z.array(z.object({ category: categoryKeySchema, isPublic: z.boolean(), displayOrder: z.number().int().nonnegative(), pinnedOrder: z.number().int().nonnegative().nullable() }).strict()),
  themeSettings: z.record(z.string(), z.unknown()),
  socialLinks: z.array(z.unknown()),
  businessDetails: z.record(z.string(), z.unknown()),
  profileImage: mediaDtoSchema.optional(),
  backgroundImage: mediaDtoSchema.optional(),
  feedItems: z.array(profileFeedItemSchema),
}).strict();
export type AccountDto = z.infer<typeof accountDtoSchema>;

const nullableText = z.string().trim().max(5000).nullable();
export const updateAccountInputSchema = z.object({
  handle: z.string().trim().min(3).max(30).nullable().optional(),
  displayName: z.string().trim().min(1).max(200).nullable().optional(),
  accountType: z.enum(["Personal", "Creator", "Business"]).nullable().optional(),
  onboardingStatus: z.enum(["complete"]).optional(),
  publicProfile: z.boolean().optional(),
  autoPinning: z.boolean().optional(),
  locale: z.enum(["en", "hi"]).optional(),
  mobileNumber: nullableText.optional(),
  mobileNumberVisible: z.boolean().optional(),
  bioPlain: nullableText.optional(),
  bioRich: z.unknown().nullable().optional(),
  primaryAddress: z.unknown().nullable().optional(),
  additionalAddresses: z.array(z.unknown()).optional(),
  publicAddress: z.unknown().nullable().optional(),
  profilePlaceDetails: z.unknown().nullable().optional(),
  categories: z.array(z.object({ category: categoryKeySchema, isPublic: z.boolean(), displayOrder: z.number().int().nonnegative(), pinnedOrder: z.number().int().nonnegative().nullable() }).strict()).optional(),
  themeSettings: z.record(z.string(), z.unknown()).optional(),
  socialLinks: z.array(z.unknown()).optional(),
  businessDetails: z.record(z.string(), z.unknown()).optional(),
  profileImageId: z.string().uuid().nullable().optional(),
  backgroundImageId: z.string().uuid().nullable().optional(),
  feedItems: z.array(profileFeedInputSchema).max(100).optional(),
}).strict();
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
export const updateAccountRequestSchema = updateAccountInputSchema.extend({ expectedRevision: z.number().int().positive().safe() }).strict();

export type Page<T> = { items: T[]; nextCursor: string | null };
export type RevisionInput = { expectedRevision: number };
export type RequestContext = { requestId: string; idempotencyKey?: string };
