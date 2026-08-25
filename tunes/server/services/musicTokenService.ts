import { createHmac, randomBytes as secureRandomBytes, timingSafeEqual } from "node:crypto";
import type { MusicIdentityProjection } from "../repositories/musicIdentityRepository";

export const MUSIC_TOKEN_ISSUER = "explorers-tunes" as const;
export const MUSIC_TOKEN_AUDIENCE = "music-api" as const;

export interface MusicTokenKey {
  kid: string;
  secret: string;
}

export interface MusicTokenPreviousKey extends MusicTokenKey {
  acceptUntil: number;
}

export interface MusicTokenConfiguration {
  current: MusicTokenKey;
  previous?: MusicTokenPreviousKey;
  tokenLifetimeSeconds: number;
  clockSkewSeconds: number;
}

export interface MusicTokenClaims {
  iss: typeof MUSIC_TOKEN_ISSUER;
  aud: typeof MUSIC_TOKEN_AUDIENCE;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  sessionVersion: number;
}

export interface MintedMusicToken {
  token: string;
  expiresAt: number;
}

export class MusicTokenError extends Error {
  constructor(readonly code: "TOKEN_INVALID" | "TOKEN_EXPIRED", message: string) {
    super(message);
    this.name = "MusicTokenError";
  }
}

interface MusicTokenDependencies {
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
}

const HEADER_KEYS = ["alg", "kid"] as const;
const CLAIM_KEYS = ["aud", "exp", "iat", "iss", "jti", "sessionVersion", "sub"] as const;
const KID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SUBJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/;
const JTI_PATTERN = /^[a-f0-9]{32}$/;

export class MusicTokenService {
  private readonly now: () => number;
  private readonly randomBytes: (size: number) => Buffer;

  constructor(
    private readonly configuration: MusicTokenConfiguration,
    dependencies: MusicTokenDependencies = {},
  ) {
    this.now = dependencies.now ?? Date.now;
    this.randomBytes = dependencies.randomBytes ?? secureRandomBytes;
    validateMusicTokenConfiguration(configuration, this.now());
  }

  mint(identity: MusicIdentityProjection): MintedMusicToken {
    if (identity.identityStatus !== "active"
        || !SUBJECT_PATTERN.test(identity.strapiUserDocumentId)
        || !Number.isSafeInteger(identity.sessionVersion)
        || identity.sessionVersion < 1) {
      throw new MusicTokenError("TOKEN_INVALID", "Music credential cannot be minted for this identity.");
    }
    const iat = Math.floor(this.now() / 1_000);
    const exp = iat + this.configuration.tokenLifetimeSeconds;
    const header = { alg: "HS256", kid: this.configuration.current.kid };
    const claims: MusicTokenClaims = {
      iss: MUSIC_TOKEN_ISSUER,
      aud: MUSIC_TOKEN_AUDIENCE,
      sub: identity.strapiUserDocumentId,
      jti: this.randomBytes(16).toString("hex"),
      iat,
      exp,
      sessionVersion: identity.sessionVersion,
    };
    const unsigned = `${encodeJson(header)}.${encodeJson(claims)}`;
    return {
      token: `${unsigned}.${signature(unsigned, this.configuration.current.secret)}`,
      expiresAt: exp * 1_000,
    };
  }

  verify(token: string): MusicTokenClaims {
    try {
      if (typeof token !== "string" || token.length < 64 || token.length > 4_096) return invalid();
      const segments = token.split(".");
      if (segments.length !== 3 || segments.some((segment) => !segment)) return invalid();
      const [headerPart, payloadPart, signaturePart] = segments;
      const header = decodeStrictObject(headerPart, HEADER_KEYS) as { alg?: unknown; kid?: unknown };
      if (header.alg !== "HS256" || typeof header.kid !== "string" || !KID_PATTERN.test(header.kid)) return invalid();
      const now = this.now();
      const key = this.verificationKey(header.kid, now);
      if (!key) return invalid();
      const unsigned = `${headerPart}.${payloadPart}`;
      const expected = Buffer.from(signature(unsigned, key.secret));
      const provided = Buffer.from(signaturePart);
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return invalid();
      const claims = decodeStrictObject(payloadPart, CLAIM_KEYS) as Partial<MusicTokenClaims>;
      validateClaims(claims, this.configuration, now);
      return claims as MusicTokenClaims;
    } catch (error) {
      if (error instanceof MusicTokenError) throw error;
      return invalid();
    }
  }

  private verificationKey(kid: string, now: number): MusicTokenKey | undefined {
    if (kid === this.configuration.current.kid) return this.configuration.current;
    const previous = this.configuration.previous;
    return previous && kid === previous.kid && now < previous.acceptUntil ? previous : undefined;
  }
}

export function validateMusicTokenConfiguration(configuration: MusicTokenConfiguration, now: number): void {
  if (configuration.tokenLifetimeSeconds !== 600) {
    throw new Error("MUSIC_TOKEN_LIFETIME_SECONDS must be exactly 600");
  }
  if (!Number.isSafeInteger(configuration.clockSkewSeconds)
      || configuration.clockSkewSeconds < 0
      || configuration.clockSkewSeconds > 30) {
    throw new Error("MUSIC_TOKEN_CLOCK_SKEW_SECONDS must be between 0 and 30");
  }
  validateKey(configuration.current, "current");
  if (configuration.previous) {
    validateKey(configuration.previous, "previous");
    if (configuration.previous.kid === configuration.current.kid) throw new Error("Music token key IDs must differ");
    if (!Number.isSafeInteger(configuration.previous.acceptUntil)
        || configuration.previous.acceptUntil > now + (configuration.tokenLifetimeSeconds + configuration.clockSkewSeconds) * 1_000) {
      throw new Error("Music token previous-key overlap is invalid or unbounded");
    }
  }
}

function validateKey(key: MusicTokenKey, label: string): void {
  if (!KID_PATTERN.test(key.kid)) throw new Error(`Music token ${label} kid is invalid`);
  if (!/^[A-Za-z0-9_-]+$/.test(key.secret)) throw new Error(`Music token ${label} secret must be canonical base64url`);
  const decoded = Buffer.from(key.secret, "base64url");
  if (decoded.length < 32 || decoded.toString("base64url") !== key.secret) {
    throw new Error(`Music token ${label} secret must contain at least 32 decoded bytes`);
  }
}

function validateClaims(
  claims: Partial<MusicTokenClaims>,
  configuration: MusicTokenConfiguration,
  nowMilliseconds: number,
): void {
  if (claims.iss !== MUSIC_TOKEN_ISSUER
      || claims.aud !== MUSIC_TOKEN_AUDIENCE
      || typeof claims.sub !== "string"
      || !SUBJECT_PATTERN.test(claims.sub)
      || typeof claims.jti !== "string"
      || !JTI_PATTERN.test(claims.jti)
      || !Number.isSafeInteger(claims.iat)
      || !Number.isSafeInteger(claims.exp)
      || !Number.isSafeInteger(claims.sessionVersion)
      || (claims.sessionVersion ?? 0) < 1) return invalid();
  const iat = claims.iat as number;
  const exp = claims.exp as number;
  const lifetime = exp - iat;
  if (lifetime !== configuration.tokenLifetimeSeconds) return invalid();
  const now = Math.floor(nowMilliseconds / 1_000);
  if (iat > now + configuration.clockSkewSeconds) return invalid();
  if (now >= exp + configuration.clockSkewSeconds) {
    throw new MusicTokenError("TOKEN_EXPIRED", "The Music credential has expired.");
  }
}

function decodeStrictObject(segment: string, expectedKeys: readonly string[]): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return invalid();
  const bytes = Buffer.from(segment, "base64url");
  if (bytes.toString("base64url") !== segment) return invalid();
  const raw = bytes.toString("utf8");
  if (raw.includes("\\")) return invalid();
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return invalid();
  const keys = Array.from(raw.matchAll(/"([A-Za-z][A-Za-z0-9]*)"\s*:/g), (match) => match[1]);
  if (new Set(keys).size !== keys.length) return invalid();
  const actualKeys = Object.keys(parsed as object).sort();
  if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== [...expectedKeys].sort()[index])) return invalid();
  return parsed as Record<string, unknown>;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(unsigned: string, secret: string): string {
  return createHmac("sha256", Buffer.from(secret, "base64url")).update(unsigned).digest("base64url");
}

function invalid(): never {
  throw new MusicTokenError("TOKEN_INVALID", "The Music credential is invalid.");
}
