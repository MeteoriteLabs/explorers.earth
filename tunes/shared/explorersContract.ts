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

const shortText = z.string().trim().max(500);
const addressSchema = z.object({
  address: shortText.optional(), streetNumber: shortText.optional(), streetName: shortText.optional(),
  postalCode: shortText.optional(), state: shortText.optional(), city: shortText.optional(),
  country: shortText.optional(), title: shortText.optional(), businessTitle: shortText.optional(),
  businessAddress: shortText.optional(), contact: shortText.optional(), businessContact: shortText.optional(),
  website: z.string().url().startsWith("https://").max(2048).optional(),
  businessWebsite: z.string().url().startsWith("https://").max(2048).optional(),
  about: z.string().max(5000).optional(), businessDescription: z.string().max(5000).optional(),
}).strict();
const publicAddressSchema = addressSchema.extend({
  placeId: shortText.optional(),
  places: z.null().optional(),
}).strict();
const placeDetailsSchema = z.object({ placeId: shortText.optional(), name: shortText.optional(),
  formattedAddress: shortText.optional(), lat: z.number().finite().optional(), lng: z.number().finite().optional() }).strict();
const richTextSchema = z.object({ blocks: z.array(z.object({ text: z.string().max(5000) }).strict()).max(100) }).strict();
const themeSettingsSchema = z.object({
  preset: z.enum(["cinematic-dark", "glassmorphism", "sunset-glow", "minimal-light", "emerald-nature", "neon-cyber"]).optional(),
  wallpaperMode: z.enum(["banner-top", "full-wallpaper-image", "ambient-gradient", "solid-color"]).optional(),
  wallpaperUrl: z.string().regex(/^\/api\/explorers\/v1\/media\/[0-9a-f-]{36}\/content$/i).optional(),
  accentColor: z.string().regex(/^#[0-9a-f]{3,8}$/i).optional(),
  customTextColor: z.string().regex(/^#[0-9a-f]{3,8}$/i).optional(),
  landingTab: z.enum(["all-recommendations", "places", "movies", "books", "games", "guides", "apps", "products", "people", "gallery", "business", "music"]).optional(),
  visibleTabs: z.object({ recommendations: z.boolean().optional(), gallery: z.boolean().optional(), business: z.boolean().optional() }).strict().optional(),
  footerBranding: z.enum(["enabled", "minimal", "disabled"]).optional(),
  recommendations: z.object({ layout: z.enum(["shelves", "grid", "featured"]).optional(),
    categoryOrder: z.array(categoryKeySchema).max(9).optional() }).strict().optional(),
}).strict();
const socialLinkSchema = z.object({ platform: z.enum(["instagram", "youtube", "whatsapp", "website", "facebook",
  "linkedin", "snapchat", "tiktok", "email", "gmail", "X", "spotify", "youtubeMusic", "appleMusic", "localTunes"]),
  url: z.string().max(2048), visible: z.boolean() }).strict();
const businessDetailsSchema = z.object({ category: shortText.optional(), description: z.string().max(5000).optional() }).strict();
const feedDetailsSchema = z.object({ fileName: shortText.optional(), aspectRatio: z.enum(["1:1", "4:5", "1.91:1", "9:16"]).optional(),
  width: z.number().int().positive().max(20000).optional(), height: z.number().int().positive().max(20000).optional() }).strict();

export const profileFeedItemSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid().nullable(),
  url: z.string().url().or(z.string().startsWith("/api/explorers/v1/media/")),
  source: z.enum(["manual", "google", "instagram"]),
  type: z.enum(["image", "video"]),
  caption: z.string().nullable(),
  details: feedDetailsSchema,
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
  bioRich: richTextSchema.nullable(),
  primaryAddress: addressSchema.nullable(),
  additionalAddresses: z.array(addressSchema).max(20),
  publicAddress: publicAddressSchema.nullable(),
  profilePlaceDetails: placeDetailsSchema.nullable(),
  categories: z.array(z.object({ category: categoryKeySchema, isPublic: z.boolean(), displayOrder: z.number().int().nonnegative(), pinnedOrder: z.number().int().nonnegative().nullable() }).strict()),
  themeSettings: themeSettingsSchema,
  socialLinks: z.array(socialLinkSchema).max(20),
  businessDetails: businessDetailsSchema,
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
  bioRich: richTextSchema.nullable().optional(),
  primaryAddress: addressSchema.nullable().optional(),
  additionalAddresses: z.array(addressSchema).max(20).optional(),
  publicAddress: publicAddressSchema.nullable().optional(),
  profilePlaceDetails: placeDetailsSchema.nullable().optional(),
  categories: z.array(z.object({ category: categoryKeySchema, isPublic: z.boolean(), displayOrder: z.number().int().nonnegative(), pinnedOrder: z.number().int().nonnegative().nullable() }).strict()).optional(),
  themeSettings: themeSettingsSchema.optional(),
  socialLinks: z.array(socialLinkSchema).max(20).optional(),
  businessDetails: businessDetailsSchema.optional(),
  profileImageId: z.string().uuid().nullable().optional(),
  backgroundImageId: z.string().uuid().nullable().optional(),
  feedItems: z.array(profileFeedInputSchema).max(100).optional(),
}).strict();
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
export const updateAccountRequestSchema = updateAccountInputSchema.extend({ expectedRevision: z.number().int().positive().safe() }).strict();

export type Page<T> = { items: T[]; nextCursor: string | null };
export type RevisionInput = { expectedRevision: number };
export type RequestContext = { requestId: string; idempotencyKey?: string };
