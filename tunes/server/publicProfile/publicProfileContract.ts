import { z } from "zod";
import { PUBLIC_RECOMMENDATION_CATEGORIES, type PublicCategory } from "./publicProfilePolicy";

const requestSchema = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/),
  category: z.enum(PUBLIC_RECOMMENDATION_CATEGORIES),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  cursor: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
}).strict();

const usernameSchema = z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/);

export type PublicProfileRequest = { username: string; category: PublicCategory; limit: number; cursor?: string };

export function parsePublicProfileRequest(value: unknown): PublicProfileRequest {
  return requestSchema.parse(value);
}

export function parsePublicProfileUsername(value: unknown): string {
  return usernameSchema.parse(value);
}
