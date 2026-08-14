import type { MusicIdentityProjection } from "../repositories/musicIdentityRepository";
import { MusicTokenError, type MusicTokenService } from "../services/musicTokenService";
import type { RequestHandler } from "express";

export interface MusicPrincipal {
  musicUserId: number;
  subject: string;
  accountDocumentId: string;
  sessionVersion: number;
}

export interface MusicCredentialSubjectState {
  identity?: MusicIdentityProjection;
  tombstoned: boolean;
}

export interface MusicCredentialSubjectRepository {
  resolveCredentialSubject(subject: string): Promise<MusicCredentialSubjectState>;
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
}

const MUSIC_BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

export function createMusicPrincipalMiddleware(
  resolvePrincipal: (token: string) => Promise<MusicPrincipal>,
): RequestHandler {
  return async (req, _res, next) => {
    try {
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
      req.musicPrincipal = await resolvePrincipal(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
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
