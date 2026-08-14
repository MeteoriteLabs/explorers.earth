import { randomUUID } from "node:crypto";
import type { ResolvedStrapiIdentity } from "./strapiIdentityGateway";
import type { MusicIdentityProjection } from "../repositories/musicIdentityRepository";
import { MusicIdentityError } from "../../shared/musicError";

export interface MusicLifecycleStatus {
  operationId: string;
  musicUserId: number;
  identityStatus: "pending_deletion" | "suspended" | "tombstoned";
  phase: "prepared" | "finalized";
  state: "completed" | "requested" | "running" | "failed" | "cancelled";
  boundaryCrossed: boolean;
  retryable: boolean;
  deadLetter: boolean;
  upstreamUserDocumentId?: string;
  upstreamAccountDocumentId?: string;
}

interface LifecycleGateway {
  resolve(proof: string, requestId: string): Promise<ResolvedStrapiIdentity>;
  resolveUser(proof: string, requestId: string): Promise<{ userDocumentId: string }>;
}

interface LifecycleRepository {
  lifecycleBinding(userDocumentId: string): Promise<{
    userDocumentId: string;
    accountDocumentId: string;
    identityStatus: "active" | "suspended" | "pending_deletion";
  }>;
  prepareDeletion(input: { userDocumentId: string; accountDocumentId: string; operationId: string }): Promise<MusicLifecycleStatus>;
  lifecycleStatus(input: { userDocumentId: string; accountDocumentId: string }): Promise<MusicLifecycleStatus>;
  markDeletionBoundary(input: { userDocumentId: string; accountDocumentId: string }): Promise<MusicLifecycleStatus>;
  cancelDeletion(input: { userDocumentId: string; accountDocumentId: string; operationId: string }): Promise<MusicLifecycleStatus>;
  transitionIdentity(input: {
    strapiUserDocumentId: string;
    operationId: string;
    kind: "suspend" | "reactivate";
    targetStatus: "suspended" | "active";
  }): Promise<MusicIdentityProjection>;
}

export class MusicLifecycleService {
  private readonly operationIdFactory: () => string;
  private readonly disconnectOwner: (musicUserId: number) => Promise<void>;

  constructor(
    private readonly gateway: LifecycleGateway,
    private readonly repository: LifecycleRepository,
    options: {
      operationIdFactory?: () => string;
      disconnectOwner: (musicUserId: number) => Promise<void>;
    },
  ) {
    this.operationIdFactory = options.operationIdFactory ?? randomUUID;
    this.disconnectOwner = options.disconnectOwner;
  }

  async prepareDeletion(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.resolvePrepareBinding(proof, requestId);
    const status = await this.repository.prepareDeletion({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
      operationId: this.operationIdFactory(),
    });
    await this.disconnectOwner(status.musicUserId);
    return this.withUpstreamBinding(status, identity);
  }

  async status(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.resolveStoredBinding(proof, requestId);
    const status = await this.repository.lifecycleStatus({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
    });
    return this.withUpstreamBinding(status, identity);
  }

  async markDeletionBoundary(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.resolveStoredBinding(proof, requestId);
    const existing = await this.repository.lifecycleStatus({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
    });
    if (existing.boundaryCrossed) return this.withUpstreamBinding(existing, identity);
    await this.assertAuthoritativeBinding(proof, requestId, identity);
    const status = await this.repository.markDeletionBoundary({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
    });
    return this.withUpstreamBinding(status, identity);
  }

  async cancelDeletion(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.resolveStoredBinding(proof, requestId);
    const status = await this.repository.cancelDeletion({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
      operationId: this.operationIdFactory(),
    });
    return this.withUpstreamBinding(status, identity);
  }

  async suspend(strapiUserDocumentId: string): Promise<MusicIdentityProjection> {
    const result = await this.repository.transitionIdentity({
      strapiUserDocumentId,
      operationId: this.operationIdFactory(),
      kind: "suspend",
      targetStatus: "suspended",
    });
    await this.disconnectOwner(result.id);
    return result;
  }

  async reactivate(strapiUserDocumentId: string): Promise<MusicIdentityProjection> {
    return this.repository.transitionIdentity({
      strapiUserDocumentId,
      operationId: this.operationIdFactory(),
      kind: "reactivate",
      targetStatus: "active",
    });
  }

  private async resolveStoredBinding(proof: string, requestId: string) {
    const user = await this.gateway.resolveUser(proof, requestId);
    return this.repository.lifecycleBinding(user.userDocumentId);
  }

  private async resolvePrepareBinding(proof: string, requestId: string) {
    const binding = await this.resolveStoredBinding(proof, requestId);
    if (binding.identityStatus === "pending_deletion") {
      const status = await this.repository.lifecycleStatus({
        userDocumentId: binding.userDocumentId,
        accountDocumentId: binding.accountDocumentId,
      });
      if (status.boundaryCrossed) return binding;
    }
    await this.assertAuthoritativeBinding(proof, requestId, binding);
    return binding;
  }

  private async assertAuthoritativeBinding(
    proof: string,
    requestId: string,
    binding: { userDocumentId: string; accountDocumentId: string },
  ): Promise<void> {
    const authoritative = await this.gateway.resolve(proof, requestId);
    if (authoritative.userDocumentId !== binding.userDocumentId
        || authoritative.accountDocumentId !== binding.accountDocumentId) {
      throw new MusicIdentityError(
        "IDENTITY_CONFLICT", 409,
        "The Explorer identity does not match the durable Music owner.", "contact_support", false, undefined, "lifecycle",
      );
    }
  }

  private withUpstreamBinding(
    status: MusicLifecycleStatus,
    binding: { userDocumentId: string; accountDocumentId: string },
  ): MusicLifecycleStatus {
    return {
      ...status,
      upstreamUserDocumentId: binding.userDocumentId,
      upstreamAccountDocumentId: binding.accountDocumentId,
    };
  }
}
