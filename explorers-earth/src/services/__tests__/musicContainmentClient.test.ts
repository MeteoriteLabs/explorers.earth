import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("contained Music client", () => {
  it("uses a bodyless authenticated compatibility tombstone and returns the typed error", async () => {
    vi.stubEnv("VITE_LOCAL_TUNES_ENABLED", "true");
    const post = vi.fn().mockRejectedValue({
      response: { data: { error: { code: "LEGACY_IDENTITY_ROUTE_REMOVED", message: "upgrade", requestId: "req-1" } } },
    });
    vi.doMock("../../lib/apiClient", () => ({ default: { post } }));
    const { syncLocalTunesUser } = await import("../localTunesService");

    const result = await syncLocalTunesUser({ id: "ignored", username: "ignored", email: "secret@example.test" });

    expect(post).toHaveBeenCalledWith("/api/auth/sync", undefined, expect.objectContaining({ timeout: expect.any(Number) }));
    expect(result).toEqual({ success: false, message: "upgrade", code: "LEGACY_IDENTITY_ROUTE_REMOVED", requestId: "req-1" });
  });

});
