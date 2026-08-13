import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { MusicIdentityProjection } from "../repositories/musicIdentityRepository";
import type { ResolvedStrapiIdentity, StrapiIdentityGateway } from "./strapiIdentityGateway";
import { fingerprintStrapiProof } from "./strapiIdentityGateway";
import { MusicIdentityError } from "../../shared/musicError";

export interface EnsureMusicIdentityInput extends ResolvedStrapiIdentity {
  internalUsername: string;
  password: string;
  guestUrl: string;
  guestCapabilityHash: string;
  operationId: string;
  requestId: string;
}

export interface ProjectionRepository {
  ensureIdentity(input: EnsureMusicIdentityInput): Promise<MusicIdentityProjection>;
}

export class MusicProjectionService {
  private readonly inflight = new Map<string, Promise<MusicIdentityProjection>>();
  private coalesced = 0;

  constructor(
    private readonly gateway: Pick<StrapiIdentityGateway, "resolve"> & Partial<Pick<StrapiIdentityGateway, "clear">>,
    private readonly repository: ProjectionRepository,
  ) {}

  ensure(proof: string, requestId: string): Promise<MusicIdentityProjection> {
    const fingerprint = fingerprintStrapiProof(proof);
    const existing = this.inflight.get(fingerprint);
    if (existing) {
      this.coalesced += 1;
      return existing;
    }
    const operation = this.run(proof, requestId).finally(() => {
      if (this.inflight.get(fingerprint) === operation) this.inflight.delete(fingerprint);
    });
    this.inflight.set(fingerprint, operation);
    return operation;
  }

  stats(): { inflight: number; coalesced: number } {
    return { inflight: this.inflight.size, coalesced: this.coalesced };
  }

  private async run(proof: string, requestId: string): Promise<MusicIdentityProjection> {
    const identity = await this.gateway.resolve(proof, requestId);
    const guestSecret = randomBytes(32).toString("base64url");
    const stableSuffix = createHash("sha256").update(identity.userDocumentId).digest("hex").slice(0, 24);
    try {
      return await this.repository.ensureIdentity({
        ...identity,
        internalUsername: `explorer-${stableSuffix}`,
        password: randomBytes(48).toString("base64url"),
        guestUrl: randomBytes(24).toString("base64url"),
        guestCapabilityHash: createHash("sha256").update(guestSecret).digest("hex"),
        operationId: randomUUID(),
        requestId,
      });
    } catch (error) {
      if (error instanceof MusicIdentityError && error.status === 409) {
        this.gateway.clear?.(fingerprintStrapiProof(proof));
      }
      throw error;
    }
  }
}
