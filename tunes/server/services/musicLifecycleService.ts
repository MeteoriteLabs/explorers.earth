import { randomUUID } from "node:crypto";
import type { ResolvedStrapiIdentity } from "./strapiIdentityGateway";
import type { MusicIdentityProjection } from "../repositories/musicIdentityRepository";

export interface MusicLifecycleStatus {
  operationId: string;
  musicUserId: number;
  identityStatus: "pending_deletion" | "suspended" | "tombstoned";
  phase: "prepared" | "finalized";
  state: "completed" | "requested" | "running" | "failed" | "cancelled";
  boundaryCrossed: boolean;
  retryable: boolean;
  deadLetter: boolean;
}

interface LifecycleGateway {
  resolve(proof: string, requestId: string): Promise<ResolvedStrapiIdentity>;
}

interface LifecycleRepository {
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
    const identity = await this.gateway.resolve(proof, requestId);
    const status = await this.repository.prepareDeletion({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
      operationId: this.operationIdFactory(),
    });
    await this.disconnectOwner(status.musicUserId);
    return status;
  }

  async status(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.gateway.resolve(proof, requestId);
    return this.repository.lifecycleStatus({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
    });
  }

  async markDeletionBoundary(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.gateway.resolve(proof, requestId);
    return this.repository.markDeletionBoundary({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
    });
  }

  async cancelDeletion(proof: string, requestId: string): Promise<MusicLifecycleStatus> {
    const identity = await this.gateway.resolve(proof, requestId);
    return this.repository.cancelDeletion({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
      operationId: this.operationIdFactory(),
    });
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
}
