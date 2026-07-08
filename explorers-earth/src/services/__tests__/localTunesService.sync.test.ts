import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("syncLocalTunesUser", () => {
  it("uses the authenticated Local Tunes client for user sync", async () => {
    vi.stubEnv("VITE_LOCAL_TUNES_ENABLED", "true");

    const post = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 42,
          username: "qa-user",
          guestUrl: "qa-user",
        },
      },
    });

    vi.doMock("../../lib/apiClient", () => ({
      default: { post },
    }));

    const { syncLocalTunesUser } = await import("../localTunesService");

    const result = await syncLocalTunesUser({
      id: "1",
      username: "qa-user",
      email: "qa@example.com",
    });

    expect(result).toEqual({
      success: true,
      user: {
        id: 42,
        username: "qa-user",
        guestUrl: "qa-user",
      },
      message: "User synced with LocalTunes",
    });
    expect(post).toHaveBeenCalledWith(
      "/api/auth/sync",
      {
        strapiUser: {
          id: "1",
          username: "qa-user",
          email: "qa@example.com",
        },
      },
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })
    );
  });
});
