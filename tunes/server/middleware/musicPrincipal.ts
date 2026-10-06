import type { CanonicalMusicVenue, MusicIdentityProjection } from "../repositories/musicIdentityRepository";
import { CANONICAL_SUBJECT_KIND, MusicTokenError, type MusicTokenService } from "../services/musicTokenService";
import type { Request, RequestHandler } from "express";

export interface MusicPrincipal {
  musicUserId: number;
  subject: string;
  accountDocumentId: string;
  sessionVersion: number;
  /**
   * Ticket 6.3. Carried forward from the verified claim so a socket ticket can be
   * minted for the same subject. ADR-008 decision 2 forbids deciding what a subject
   * means from its shape, so the kind travels with the principal rather than being
   * re-derived; absent means a legacy Strapi subject.
   */
  subjectKind?: typeof CANONICAL_SUBJECT_KIND;
}

export interface MusicCredentialSubjectState {
  identity?: MusicIdentityProjection;
  tombstoned: boolean;
}

export interface CanonicalMusicCredentialSubjectState {
  venue?: CanonicalMusicVenue;
  tombstoned: boolean;
}

export interface MusicCredentialSubjectRepository {
  resolveCredentialSubject(subject: string): Promise<MusicCredentialSubjectState>;
  /** ADR-008. Resolves a canonical account subject through account_music_identity. */
  resolveCanonicalCredentialSubject(accountId: string): Promise<CanonicalMusicCredentialSubjectState>;
}

export type MusicPrincipalErrorCode =
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "IDENTITY_SUSPENDED"
  | "IDENTITY_PENDING_DELETION"
  | "RESOURCE_FORBIDDEN";

export class MusicPrincipalError extends Error {
  constructor(
    readonly code: MusicPrincipalErrorCode,
    readonly status: 401 | 403 | 409,
    message: string,
  ) {
    super(message);
    this.name = "MusicPrincipalError";
  }
}

export class MusicPrincipalService {
  constructor(
    private readonly tokens: Pick<MusicTokenService, "verify">,
    private readonly repository: MusicCredentialSubjectRepository,
  ) {}

  async resolve(token: string): Promise<MusicPrincipal> {
    let claims;
    try {
      claims = this.tokens.verify(token);
    } catch (error) {
      if (error instanceof MusicTokenError) {
        throw new MusicPrincipalError(error.code, 401, error.message);
      }
      throw new MusicPrincipalError("TOKEN_INVALID", 401, "The Music credential is invalid.");
    }
    if (claims.subjectKind === CANONICAL_SUBJECT_KIND) return this.resolveCanonical(claims.sub, claims.sessionVersion);
    const state = await this.repository.resolveCredentialSubject(claims.sub);
    const identity = state.identity;
    if (!identity || state.tombstoned || identity.strapiUserDocumentId !== claims.sub) {
      throw new MusicPrincipalError("TOKEN_REVOKED", 401, "The Music credential has been revoked.");
    }
    if (identity.identityStatus === "suspended") {
      throw new MusicPrincipalError("IDENTITY_SUSPENDED", 403, "This Music identity is suspended.");
    }
    if (identity.identityStatus === "pending_deletion") {
      throw new MusicPrincipalError("IDENTITY_PENDING_DELETION", 409, "This Music identity is pending deletion.");
    }
    if (identity.sessionVersion !== claims.sessionVersion) {
      throw new MusicPrincipalError("TOKEN_REVOKED", 401, "The Music credential has been revoked.");
    }
    return {
      musicUserId: identity.id,
      subject: identity.strapiUserDocumentId,
      accountDocumentId: identity.strapiAccountDocumentId,
      sessionVersion: identity.sessionVersion,
    };
  }

  /**
   * ADR-008. A canonical credential is accepted only when account_music_identity maps
   * that exact account to a venue row. It never falls back to the legacy subject
   * resolution, so a canonical claim cannot be satisfied by a Strapi-keyed row.
   *
   * sessionVersion is the venue's users.session_version, not the canonical web
   * session's, because that is the counter Music credential revocation bumps.
   */
  private async resolveCanonical(accountId: string, claimedSessionVersion: number): Promise<MusicPrincipal> {
    const state = await this.repository.resolveCanonicalCredentialSubject(accountId);
    const venue = state.venue;
    if (!venue || state.tombstoned) {
      throw new MusicPrincipalError("TOKEN_REVOKED", 401, "The Music credential has been revoked.");
    }
    if (venue.identityStatus === "suspended") {
      throw new MusicPrincipalError("IDENTITY_SUSPENDED", 403, "This Music identity is suspended.");
    }
    if (venue.identityStatus === "pending_deletion") {
      throw new MusicPrincipalError("IDENTITY_PENDING_DELETION", 409, "This Music identity is pending deletion.");
    }
    if (venue.sessionVersion !== claimedSessionVersion) {
      throw new MusicPrincipalError("TOKEN_REVOKED", 401, "The Music credential has been revoked.");
    }
    return {
      subjectKind: CANONICAL_SUBJECT_KIND,
      musicUserId: venue.musicUserId,
      subject: accountId,
      // Opaque stable per-account identifier, used for feature allowlists and cohort
      // hashing. The canonical account id is the right value; note it buckets
      // differently from a legacy Strapi subject, so percentage rollouts re-bucket an
      // owner on migration.
      accountDocumentId: accountId,
      sessionVersion: venue.sessionVersion,
    };
  }
}

const MUSIC_BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

export function createMusicPrincipalMiddleware(
  resolvePrincipal: (token: string) => Promise<MusicPrincipal>,
): RequestHandler {
  return async (req, _res, next) => {
    try {
      req.musicPrincipal = await resolveMusicPrincipalRequest(req, resolvePrincipal);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function resolveMusicPrincipalRequest(
  req: Pick<Request, "rawHeaders">,
  resolvePrincipal: (token: string) => Promise<MusicPrincipal>,
): Promise<MusicPrincipal> {
  const authorizationFields: string[] = [];
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    if (req.rawHeaders[index]?.toLowerCase() === "authorization") {
      authorizationFields.push(req.rawHeaders[index + 1] ?? "");
    }
  }
  if (authorizationFields.length !== 1) {
    throw new MusicPrincipalError("TOKEN_INVALID", 401, "A single Music bearer credential is required.");
  }
  const match = MUSIC_BEARER_PATTERN.exec(authorizationFields[0]);
  if (!match) throw new MusicPrincipalError("TOKEN_INVALID", 401, "The Music credential is invalid.");
  return resolvePrincipal(match[1]);
}

export function assertMusicResourceOwner(principal: MusicPrincipal, musicUserId: number): void {
  if (!Number.isSafeInteger(musicUserId) || musicUserId < 1 || principal.musicUserId !== musicUserId) {
    throw new MusicPrincipalError("RESOURCE_FORBIDDEN", 403, "The Music resource is not owned by this identity.");
  }
}

export interface MusicSocketCredentialContext {
  readonly token: string;
  readonly principal: MusicPrincipal;
}

export function createMusicSocketCredentialVerifier(principals: MusicPrincipalService) {
  return {
    async handshake(input: { token: string }): Promise<MusicSocketCredentialContext> {
      return { token: input.token, principal: await principals.resolve(input.token) };
    },
    async recheck(context: MusicSocketCredentialContext): Promise<MusicPrincipal> {
      return principals.resolve(context.token);
    },
  };
}
