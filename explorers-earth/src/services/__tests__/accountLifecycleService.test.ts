import { describe, expect, it, vi } from "vitest";
import { AccountLifecycleError, createAccountLifecycleService } from "../accountLifecycleService";
import { deleteExplorerAccountMutation, deleteExplorerUserMutation } from "../../features/Settings/api/mutation";

const pending = {
  version: "music-lifecycle/v1",
  operation: {
    operationId: "server-operation-id",
    status: "pending_deletion",
    phase: "prepared",
    state: "completed",
    boundaryCrossed: false,
    retryable: false,
    deadLetter: false,
    upstreamUserDocumentId: "user-document-a",
    upstreamAccountDocumentId: "account-document-a",
  },
};
const crossed = { ...pending, operation: {
  ...pending.operation, state: "requested" as const, boundaryCrossed: true, retryable: true,
} };
const acknowledgedLifecycleFetch = async (input: string | URL | Request) => new Response(JSON.stringify(
  new URL(String(input)).pathname.endsWith("/boundary") ? crossed : pending,
), { status: 200 });

describe("account lifecycle service", () => {
  it("uses distinct Account and user GraphQL operations", () => {
    // Break caught: GraphQL executes both destructive fields in one request after an Account failure.
    const operationNames = [deleteExplorerAccountMutation, deleteExplorerUserMutation].map((document) => {
      const operation = document.definitions.find((definition) => definition.kind === "OperationDefinition");
      return operation && "name" in operation ? operation.name?.value : undefined;
    });
    expect(operationNames).toEqual(["DeleteExplorerAccount", "DeleteExplorerUser"]);
  });

  it("prepares and durably marks the boundary before attempting upstream deletion", async () => {
    // Break caught: the browser starts irreversible Strapi deletion before Music is durable.
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      order.push(url.endsWith("/prepare") ? "prepare" : "boundary");
      return new Response(JSON.stringify(url.endsWith("/prepare") ? pending : crossed), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "request-a" },
      });
    });
    const readAccountPresence = vi.fn(async () => ({ status: "present" as const, accountDocumentId: "account-document-a" }));
    const deleteExplorerAccount = vi.fn(async () => { order.push("account"); return "account-document-a"; });
    const deleteExplorerUser = vi.fn(async () => { order.push("user"); return "user-document-a"; });
    const clearAuth = vi.fn(() => order.push("logout"));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example/",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await service.deleteAccount({
      readAccountPresence,
      deleteExplorerAccount,
      deleteExplorerUser,
      clearAuth,
    });

    expect(order).toEqual(["prepare", "boundary", "account", "user", "logout"]);
  });

  it("refuses a 2xx boundary response that does not acknowledge the irreversible boundary", async () => {
    // Break caught: stale boundaryCrossed=false unlocks the upstream Account/user mutations.
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response(JSON.stringify(pending), { status: 200 }),
    });
    const readAccountPresence = vi.fn(async () => ({ status: "absent" as const }));
    const deleteExplorerAccount = vi.fn(async () => "account-document-a");
    const deleteExplorerUser = vi.fn(async () => "user-document-a");
    const clearAuth = vi.fn();

    await expect(service.deleteAccount({ readAccountPresence, deleteExplorerAccount, deleteExplorerUser, clearAuth }))
      .rejects.toMatchObject({ name: "AccountLifecycleError", code: "LIFECYCLE_RESPONSE_INVALID" });
    expect(readAccountPresence).not.toHaveBeenCalled();
    expect(deleteExplorerAccount).not.toHaveBeenCalled();
    expect(deleteExplorerUser).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it.each([
    { label: "wrong version", response: { ...crossed, version: "music-lifecycle/v2" } },
    { label: "empty operation", response: { ...crossed, operation: { ...crossed.operation, operationId: "" } } },
    { label: "empty tuple", response: { ...crossed, operation: { ...crossed.operation, upstreamAccountDocumentId: "" } } },
    { label: "cancelled running state", response: { ...crossed, operation: { ...crossed.operation, state: "cancelled" } } },
    { label: "missing operation", response: { version: "music-lifecycle/v1" } },
    { label: "wrong primitive", response: { ...crossed, operation: { ...crossed.operation, boundaryCrossed: "true" } } },
    { label: "unexpected root member", response: { ...crossed, unchecked: true } },
    { label: "unexpected operation member", response: { ...crossed, operation: { ...crossed.operation, unchecked: true } } },
    { label: "uncrossed requested state", response: { ...pending, operation: { ...pending.operation, state: "requested" } } },
    { label: "crossed completed state", response: { ...crossed, operation: { ...crossed.operation, state: "completed" } } },
    { label: "dead letter without failed state", response: { ...crossed, operation: { ...crossed.operation, deadLetter: true } } },
  ])("fails closed on a malformed $label boundary DTO", async ({ response }) => {
    // Break caught: unchecked JSON reaches GraphQL merely because HTTP returned 2xx.
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pending), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof", fetchImpl: fetchImpl as typeof fetch,
    });
    const readAccountPresence = vi.fn(async () => ({ status: "absent" as const }));
    const clearAuth = vi.fn();

    await expect(service.deleteAccount({
      readAccountPresence,
      deleteExplorerAccount: async () => "account-document-a",
      deleteExplorerUser: async () => "user-document-a",
      clearAuth,
    })).rejects.toMatchObject({ name: "AccountLifecycleError", code: "LIFECYCLE_RESPONSE_INVALID" });
    expect(readAccountPresence).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it.each(["error", "null", "wrong-document", "unknown"] as const)(
    "never deletes the user when Account deletion ends as %s",
    async (outcome) => {
      // Break caught: an ambiguous or failed Account mutation destroys the bearer needed for reload retry.
      const service = createAccountLifecycleService({
        baseUrl: "https://music.example",
        getBearer: () => "authoritative-bearer-proof",
        fetchImpl: acknowledgedLifecycleFetch as typeof fetch,
      });
      const deleteExplorerUser = vi.fn(async () => "user-document-a");
      const clearAuth = vi.fn();
      const deleteExplorerAccount = vi.fn(async () => {
        if (outcome === "error") throw new Error("lost Account response");
        if (outcome === "null") return null;
        return outcome === "wrong-document" ? "different-account" : "account-document-a";
      });
      const readAccountPresence = vi.fn(async () => outcome === "unknown"
        ? { status: "unknown" as const }
        : { status: "present" as const, accountDocumentId: "account-document-a" });

      await expect(service.deleteAccount({
        readAccountPresence,
        deleteExplorerAccount,
        deleteExplorerUser,
        clearAuth,
      })).rejects.toBeInstanceOf(Error);
      expect(deleteExplorerUser).not.toHaveBeenCalled();
      expect(clearAuth).not.toHaveBeenCalled();
    },
  );

  it("deletes the user without repeating Account deletion when an authoritative read proves Account absence", async () => {
    // Break caught: reload cannot resume after Account deletion succeeded but its response was lost.
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: acknowledgedLifecycleFetch as typeof fetch,
    });
    const deleteExplorerAccount = vi.fn(async () => "account-document-a");
    const deleteExplorerUser = vi.fn(async () => "user-document-a");
    const clearAuth = vi.fn();
    await service.deleteAccount({
      readAccountPresence: async () => ({ status: "absent" }),
      deleteExplorerAccount,
      deleteExplorerUser,
      clearAuth,
    });
    expect(deleteExplorerAccount).not.toHaveBeenCalled();
    expect(deleteExplorerUser).toHaveBeenCalledOnce();
    expect(clearAuth).toHaveBeenCalledOnce();
  });

  it("uses the durable Account binding and refuses a replacement Account after reload", async () => {
    // Break caught: current Account B is deleted even though the durable operation was prepared for Account A.
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response(JSON.stringify({
        ...pending,
        operation: { ...pending.operation, boundaryCrossed: true, state: "requested", retryable: true },
      }), { status: 200 }),
    });
    const readAccountPresence = vi.fn(async (expectedAccountDocumentId: string) => {
      expect(expectedAccountDocumentId).toBe("account-document-a");
      return { status: "unknown" as const };
    });
    const deleteExplorerAccount = vi.fn(async () => "account-document-b");
    const deleteExplorerUser = vi.fn(async () => "user-document-a");

    await expect(service.deleteAccount({
      readAccountPresence,
      deleteExplorerAccount,
      deleteExplorerUser,
      clearAuth: vi.fn(),
    })).rejects.toMatchObject({ code: "UPSTREAM_ACCOUNT_UNKNOWN" });
    expect(deleteExplorerAccount).not.toHaveBeenCalled();
    expect(deleteExplorerUser).not.toHaveBeenCalled();
  });

  it("fails closed when prepare and boundary return different durable bindings", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pending), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...pending,
        operation: {
          ...pending.operation, upstreamAccountDocumentId: "account-document-b",
          boundaryCrossed: true, state: "requested", retryable: true,
        },
      }), { status: 200 }));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const readAccountPresence = vi.fn(async () => ({ status: "absent" as const }));

    await expect(service.deleteAccount({
      readAccountPresence,
      deleteExplorerAccount: async () => "account-document-a",
      deleteExplorerUser: async () => "user-document-a",
      clearAuth: vi.fn(),
    })).rejects.toMatchObject({ code: "LIFECYCLE_IDENTITY_CONFLICT" });
    expect(readAccountPresence).not.toHaveBeenCalled();
  });

  it.each([null, "different-user"])("preserves retry authority when user deletion returns %s", async (deletedUser) => {
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: acknowledgedLifecycleFetch as typeof fetch,
    });
    const clearAuth = vi.fn();

    await expect(service.deleteAccount({
      readAccountPresence: async () => ({ status: "absent" }),
      deleteExplorerAccount: async () => "account-document-a",
      deleteExplorerUser: async () => deletedUser,
      clearAuth,
    })).rejects.toMatchObject({ code: "UPSTREAM_USER_DELETE_UNCONFIRMED" });
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it.each([
    { ...pending, operation: { ...pending.operation, deadLetter: true, state: "failed" as const, boundaryCrossed: true } },
    { ...pending, operation: { ...pending.operation, status: "tombstoned" as const, phase: "finalized" as const, boundaryCrossed: true } },
  ])("stops before boundary and GraphQL when prepare returns a terminal operation", async (terminal) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(terminal), { status: 200 }));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof", fetchImpl: fetchImpl as typeof fetch,
    });
    const deleteExplorerAccount = vi.fn(async () => "account-document-a");
    const deleteExplorerUser = vi.fn(async () => "user-document-a");

    await expect(service.deleteAccount({
      readAccountPresence: async () => ({ status: "present", accountDocumentId: "account-document-a" }),
      deleteExplorerAccount,
      deleteExplorerUser,
      clearAuth: vi.fn(),
    })).rejects.toMatchObject({ code: "LIFECYCLE_TERMINAL" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(deleteExplorerAccount).not.toHaveBeenCalled();
    expect(deleteExplorerUser).not.toHaveBeenCalled();
  });

  it("stops before GraphQL when boundary returns a terminal operation", async () => {
    const terminal = { ...pending, operation: { ...pending.operation, deadLetter: true, state: "failed" as const, boundaryCrossed: true } };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pending), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(terminal), { status: 200 }));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof", fetchImpl: fetchImpl as typeof fetch,
    });
    const deleteExplorerUser = vi.fn(async () => "user-document-a");

    await expect(service.deleteAccount({
      readAccountPresence: async () => ({ status: "absent" }),
      deleteExplorerAccount: async () => "account-document-a",
      deleteExplorerUser,
      clearAuth: vi.fn(),
    })).rejects.toMatchObject({ code: "LIFECYCLE_TERMINAL" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(deleteExplorerUser).not.toHaveBeenCalled();
  });

  it("never writes operation or proof material to browser persistence", async () => {
    // Break caught: a lifecycle operation ID or Music/Strapi secret surviving in browser storage.
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example/",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response(JSON.stringify(pending), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "request-b" },
      }),
    });

    await service.prepare();
    await service.status();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("uses exact bodyless methods for status and cancellation", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(pending), { status: 200 }));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example/path-is-not-forwarded",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: fetchImpl as typeof fetch,
    });
    await service.status();
    await service.cancel();
    expect(fetchImpl.mock.calls).toEqual([
      ["https://music.example/api/music/identity/lifecycle/status", { method: "GET", headers: { Authorization: "Bearer authoritative-bearer-proof" } }],
      ["https://music.example/api/music/identity/lifecycle/cancel", { method: "POST", headers: { Authorization: "Bearer authoritative-bearer-proof" } }],
    ]);
  });

  it("accepts the exact durable suspended lifecycle state", async () => {
    const suspended = { ...pending, operation: {
      ...pending.operation, status: "suspended" as const, state: "cancelled" as const,
    } };
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response(JSON.stringify(suspended), { status: 200 }),
    });
    await expect(service.status()).resolves.toEqual(suspended);
  });

  it("accepts only the exact bodyless suspension acknowledgement", async () => {
    const valid = { version: "music-lifecycle/v1", identity: { status: "suspended" } };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(valid), { status: 200 }));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof", fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(service.suspend()).resolves.toEqual(valid);
    expect(fetchImpl).toHaveBeenCalledWith("https://music.example/api/music/identity/lifecycle/suspend", {
      method: "POST", headers: { Authorization: "Bearer authoritative-bearer-proof" },
    });

    for (const invalid of [
      { ...valid, unchecked: true },
      { ...valid, identity: { ...valid.identity, unchecked: true } },
      { ...valid, identity: { status: "active" } },
    ]) {
      const invalidService = createAccountLifecycleService({
        baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
        fetchImpl: async () => new Response(JSON.stringify(invalid), { status: 200 }),
      });
      await expect(invalidService.suspend()).rejects.toMatchObject({ code: "LIFECYCLE_RESPONSE_INVALID" });
    }
  });

  it("returns typed authentication, transport, and server errors without clearing auth", async () => {
    const missing = createAccountLifecycleService({ baseUrl: "https://music.example", getBearer: () => undefined });
    await expect(missing.prepare()).rejects.toMatchObject({ name: "AccountLifecycleError", code: "AUTH_REQUIRED", status: 401, retryable: false });

    const unavailable = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => { throw new Error("network secret"); },
    });
    await expect(unavailable.prepare()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503, retryable: true });

    const denied = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response(JSON.stringify({ error: {
        code: "LIFECYCLE_CANCEL_FORBIDDEN", message: "Cancellation boundary crossed.", retryable: false, requestId: "request-denied",
      } }), { status: 409 }),
    });
    await expect(denied.cancel()).rejects.toMatchObject({
      code: "LIFECYCLE_CANCEL_FORBIDDEN", status: 409, message: "Cancellation boundary crossed.", requestId: "request-denied",
    });

    const clearAuth = vi.fn();
    const upstreamFailure = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
      fetchImpl: acknowledgedLifecycleFetch as typeof fetch,
    });
    await expect(upstreamFailure.deleteAccount({
      readAccountPresence: async () => ({ status: "present", accountDocumentId: "account-document-a" }),
      deleteExplorerAccount: async () => { throw new Error("upstream"); },
      deleteExplorerUser: async () => "user-document-a",
      clearAuth,
    }))
      .rejects.toThrow("upstream");
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it("falls back to redacted service errors and rejects unsafe origins", async () => {
    const malformed = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response("not-json", { status: 503, headers: { "x-request-id": "request-header" } }),
    });
    await expect(malformed.prepare()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE", status: 503, message: "Account deletion is temporarily unavailable.",
      retryable: false, requestId: "request-header",
    });
    const noRequestId = createAccountLifecycleService({
      baseUrl: "https://music.example", getBearer: () => "authoritative-bearer-proof",
      fetchImpl: async () => new Response("not-json", { status: 500 }),
    });
    await expect(noRequestId.prepare()).rejects.toMatchObject({ requestId: undefined });
    for (const origin of ["not a url", "http://music.example", "https://user:password@music.example", "https://music.example?q=secret", "https://music.example/#secret"]) {
      expect(() => createAccountLifecycleService({ baseUrl: origin, getBearer: () => "authoritative-bearer-proof" }))
        .toThrow(AccountLifecycleError);
    }
  });
});
