import { z } from "zod";

export const MUSIC_ERROR_VERSION = "music-error/v1" as const;
export const MUSIC_IDENTITY_VERSION = "music-identity/v1" as const;

export const musicIdentityStatusSchema = z.literal("active");
/** The ensure operation has no JSON request entity. */
export const musicEnsureRequestSchema = z.undefined();

export const musicEnsureResponseSchema = z.object({
  version: z.literal(MUSIC_IDENTITY_VERSION),
  identity: z.object({
    musicUserId: z.number().int().positive(),
    status: musicIdentityStatusSchema,
  }).strict(),
}).strict();

export const musicErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "REQUEST_INVALID",
  "IDENTITY_INELIGIBLE",
  "ONBOARDING_INCOMPLETE",
  "ACCOUNT_AMBIGUOUS",
  "ACCOUNT_SWITCH_CONFLICT",
  "IDENTITY_CONFLICT",
  "IDENTITY_TOMBSTONED",
  "IDENTITY_PENDING_DELETION",
  "IDENTITY_SUSPENDED",
  "UPSTREAM_MALFORMED",
  "UPSTREAM_UNAVAILABLE",
  "DATABASE_UNAVAILABLE",
  "RATE_LIMITED",
  "ENTRY_DISABLED",
  "INTERNAL_ERROR",
]);

export const musicErrorEnvelopeSchema = z.object({
  version: z.literal(MUSIC_ERROR_VERSION),
  error: z.object({
    code: musicErrorCodeSchema,
    message: z.string().min(1).max(160),
    action: z.enum(["authenticate", "complete_onboarding", "contact_support", "retry", "none"]),
    retryable: z.boolean(),
    requestId: z.string().min(1).max(64),
  }).strict(),
}).strict();

export type MusicEnsureResponse = z.infer<typeof musicEnsureResponseSchema>;
export type MusicErrorEnvelope = z.infer<typeof musicErrorEnvelopeSchema>;
export type MusicErrorCode = z.infer<typeof musicErrorCodeSchema>;
export type MusicErrorAction = MusicErrorEnvelope["error"]["action"];

export class MusicIdentityError extends Error {
  constructor(
    readonly code: MusicErrorCode,
    readonly status: number,
    message: string,
    readonly action: MusicErrorAction,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
    readonly safeConflictCategory?: string,
  ) {
    super(message);
    this.name = "MusicIdentityError";
  }
}

export function musicErrorEnvelope(error: MusicIdentityError, requestId: string): MusicErrorEnvelope {
  return {
    version: MUSIC_ERROR_VERSION,
    error: {
      code: error.code,
      message: error.message,
      action: error.action,
      retryable: error.retryable,
      requestId,
    },
  };
}

export const musicEnsureResponseOpenApiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "identity"],
  properties: {
    version: { type: "string", enum: [MUSIC_IDENTITY_VERSION] },
    identity: {
      type: "object",
      additionalProperties: false,
      required: ["musicUserId", "status"],
      properties: {
        musicUserId: { type: "integer", minimum: 1 },
        status: { type: "string", enum: ["active"] },
      },
    },
  },
} as const;

export const musicErrorOpenApiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "error"],
  properties: {
    version: { type: "string", enum: [MUSIC_ERROR_VERSION] },
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "action", "retryable", "requestId"],
      properties: {
        code: { type: "string", enum: musicErrorCodeSchema.options },
        message: { type: "string", maxLength: 160 },
        action: { type: "string", enum: ["authenticate", "complete_onboarding", "contact_support", "retry", "none"] },
        retryable: { type: "boolean" },
        requestId: { type: "string", maxLength: 64 },
      },
    },
  },
} as const;

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/MusicErrorEnvelope" } } },
});

export const musicIdentityOpenApi = {
  path: "/api/music/identity/ensure",
  operation: {
    post: {
      tags: ["Music Identity"],
      summary: "Ensure the authenticated Explorer Music identity",
      security: [{ strapiBearer: [] }],
      responses: {
        "200": {
          description: "Stable Music identity projection",
          content: { "application/json": { schema: { $ref: "#/components/schemas/MusicIdentityEnsureResponse" } } },
        },
        "400": errorResponse("Invalid bodyless request"),
        "401": errorResponse("Missing or invalid Strapi proof"),
        "403": errorResponse("Explorer is not eligible"),
        "409": errorResponse("Immutable identity or lifecycle conflict"),
        "429": errorResponse("Bounded rate limit"),
        "500": errorResponse("Safe internal failure"),
        "502": errorResponse("Malformed authoritative response"),
        "503": errorResponse("Temporary upstream or database failure"),
      },
    },
  },
} as const;
