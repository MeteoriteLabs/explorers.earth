import { describe, expect, it, vi } from "vitest";
import { MusicIdentityError } from "../../shared/musicError";
import { MusicLifecycleService } from "../services/musicLifecycleService";

const identity = {
  userDocumentId: "user-document-a",
  accountDocumentId: "account-document-a",
  username: "mutable-name",
  email: "private@example.invalid",
  provider: "local" as const,
  accountName: "Account A",
  accountType: "Explorer",
  accountMobile: "+10000000000",
};

function harness() {
  const status = {
    operationId: "6f74f9e0-7eb3-41fc-9c71-6572ce77ab47",
    musicUserId: 41,
    identityStatus: "pending_deletion" as const,
    phase: "prepared" as const,
    state: "completed" as const,
    boundaryCrossed: false,
    retryable: false,
    deadLetter: false,
  };
  const repository = {
    prepareDeletion: vi.fn(async () => status),
    lifecycleStatus: vi.fn(async () => status),
    markDeletionBoundary: vi.fn(async () => ({ ...status, boundaryCrossed: true, state: "requested" as const })),
    cancelDeletion: vi.fn(async () => ({ ...status, identityStatus: "suspended" as const, state: "cancelled" as const })),
    transitionIdentity: vi.fn(),
  };
  const gateway = { resolve: vi.fn(async () => identity) };
  const disconnectOwner = vi.fn(async () => undefined);
  return { status, repository, gateway, disconnectOwner };
}

describe("MusicLifecycleService", () => {
  it("prepares from the authoritative tuple and disconnects the durable numeric owner", async () => {
    // Break caught: accepting caller identity fields or omitting immediate socket eviction.
    const h = harness();
    const service = new MusicLifecycleService(h.gateway, h.repository, {
      operationIdFactory: () => h.status.operationId,
      disconnectOwner: h.disconnectOwner,
    });

    await expect(service.prepareDeletion("authoritative-proof", "request-a")).resolves.toEqual(h.status);
    expect(h.repository.prepareDeletion).toHaveBeenCalledWith({
      userDocumentId: identity.userDocumentId,
      accountDocumentId: identity.accountDocumentId,
      operationId: h.status.operationId,
    });
    expect(h.disconnectOwner).toHaveBeenCalledWith(41);
  });

  it("refuses cancellation after the repository reports the irreversible boundary", async () => {
    // Break caught: allowing a cancel after any upstream deletion attempt.
    const h = harness();
    h.repository.cancelDeletion.mockRejectedValueOnce(new MusicIdentityError(
      "LIFECYCLE_CANCEL_FORBIDDEN", 409, "Music deletion can no longer be cancelled.", "contact_support", false,
    ));
    const service = new MusicLifecycleService(h.gateway, h.repository, {
      operationIdFactory: () => "3e34409a-3836-4223-b8c1-5d5da0cc249c",
      disconnectOwner: h.disconnectOwner,
    });

    await expect(service.cancelDeletion("authoritative-proof", "request-b")).rejects.toMatchObject({
      code: "LIFECYCLE_CANCEL_FORBIDDEN",
      status: 409,
    });
  });

  it("suspends without exposing an HTTP owner input and evicts owner sockets", async () => {
    // Break caught: suspension preserving a live session/socket or remapping ownership.
    const h = harness();
    h.repository.transitionIdentity.mockResolvedValueOnce({
      id: 41,
      strapiUserDocumentId: identity.userDocumentId,
      strapiAccountDocumentId: identity.accountDocumentId,
      identityStatus: "suspended",
      sessionVersion: 8,
    });
    const service = new MusicLifecycleService(h.gateway, h.repository, {
      operationIdFactory: () => "a7275ae4-a8ce-414a-9aef-cf5813eaeebf",
      disconnectOwner: h.disconnectOwner,
    });

    const result = await service.suspend(identity.userDocumentId);
    expect(result).toMatchObject({ id: 41, identityStatus: "suspended", sessionVersion: 8 });
    expect(h.disconnectOwner).toHaveBeenCalledWith(41);
  });

  it("resolves every browser lifecycle action from the authoritative tuple", async () => {
    const h = harness();
    const service = new MusicLifecycleService(h.gateway, h.repository, {
      operationIdFactory: () => "a7275ae4-a8ce-414a-9aef-cf5813eaeebf",
      disconnectOwner: h.disconnectOwner,
    });

    await service.status("authoritative-proof", "request-status");
    await service.markDeletionBoundary("authoritative-proof", "request-boundary");
    await service.cancelDeletion("authoritative-proof", "request-cancel");

    const tuple = { userDocumentId: identity.userDocumentId, accountDocumentId: identity.accountDocumentId };
    expect(h.repository.lifecycleStatus).toHaveBeenCalledWith(tuple);
    expect(h.repository.markDeletionBoundary).toHaveBeenCalledWith(tuple);
    expect(h.repository.cancelDeletion).toHaveBeenCalledWith({ ...tuple, operationId: "a7275ae4-a8ce-414a-9aef-cf5813eaeebf" });
  });

  it("reactivates the stable owner and uses a cryptographic operation id by default", async () => {
    const h = harness();
    h.repository.transitionIdentity.mockResolvedValueOnce({
      id: 41, strapiUserDocumentId: identity.userDocumentId, strapiAccountDocumentId: identity.accountDocumentId,
      identityStatus: "active", sessionVersion: 8,
    });
    const service = new MusicLifecycleService(h.gateway, h.repository, { disconnectOwner: h.disconnectOwner });

    await expect(service.reactivate(identity.userDocumentId)).resolves.toMatchObject({ id: 41, identityStatus: "active" });
    expect(h.repository.transitionIdentity).toHaveBeenCalledWith(expect.objectContaining({
      strapiUserDocumentId: identity.userDocumentId,
      operationId: expect.stringMatching(/^[a-f0-9-]{36}$/),
      kind: "reactivate",
      targetStatus: "active",
    }));
    expect(h.disconnectOwner).not.toHaveBeenCalled();
  });
});
