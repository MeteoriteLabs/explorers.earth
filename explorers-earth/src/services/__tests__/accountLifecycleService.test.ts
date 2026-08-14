import { describe, expect, it, vi } from "vitest";
import { AccountLifecycleError, createAccountLifecycleService } from "../accountLifecycleService";
import { deleteAccountMutation } from "../../features/Settings/api/mutation";

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
  },
};

describe("account lifecycle service", () => {
  it("deletes the upstream user last so a partial failure retains retry authority", () => {
    const operation = deleteAccountMutation.definitions.find((definition) => definition.kind === "OperationDefinition");
    const fields = operation && "selectionSet" in operation
      ? operation.selectionSet.selections.flatMap((selection) => selection.kind === "Field" ? [selection.name.value] : [])
      : [];
    expect(fields.at(-1)).toBe("deleteUsersPermissionsUser");
    expect(fields.indexOf("deleteAccount")).toBeLessThan(fields.indexOf("deleteUsersPermissionsUser"));
  });

  it("prepares and durably marks the boundary before attempting upstream deletion", async () => {
    // Break caught: the browser starts irreversible Strapi deletion before Music is durable.
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      order.push(url.endsWith("/prepare") ? "prepare" : "boundary");
      return new Response(JSON.stringify(pending), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "request-a" },
      });
    });
    const upstreamDelete = vi.fn(async () => { order.push("upstream"); });
    const clearAuth = vi.fn(() => order.push("logout"));
    const service = createAccountLifecycleService({
      baseUrl: "https://music.example/",
      getBearer: () => "authoritative-bearer-proof",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await service.deleteAccount({ upstreamDelete, clearAuth });

    expect(order).toEqual(["prepare", "boundary", "upstream", "logout"]);
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
      fetchImpl: async () => new Response(JSON.stringify(pending), { status: 200 }),
    });
    await expect(upstreamFailure.deleteAccount({ upstreamDelete: async () => { throw new Error("upstream"); }, clearAuth }))
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
