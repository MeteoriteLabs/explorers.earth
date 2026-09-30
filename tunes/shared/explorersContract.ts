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

export const accountDtoSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().nullable(),
  displayName: z.string().nullable(),
  accountType: z.enum(["Personal", "Creator", "Business"]).nullable(),
  onboardingStatus: z.enum(["incomplete", "complete"]),
  status: z.enum(["active", "suspended", "pending_deletion", "deleted"]),
  revision: z.number().int().positive().safe(),
}).strict();
export type AccountDto = z.infer<typeof accountDtoSchema>;

export const mediaDtoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().startsWith("/api/explorers/v1/media/"),
  mimeType: z.string(),
  size: z.number().int().nonnegative().safe(),
  alternativeText: z.string().nullable(),
  caption: z.string().nullable(),
}).strict();
export type MediaDto = z.infer<typeof mediaDtoSchema>;

export type Page<T> = { items: T[]; nextCursor: string | null };
export type RevisionInput = { expectedRevision: number };
export type RequestContext = { requestId: string; idempotencyKey?: string };
