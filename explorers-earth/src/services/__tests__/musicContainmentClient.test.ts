import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("disables password-based Music registration without network or secret logs", async () => {
    vi.stubEnv("VITE_LOCAL_TUNES_ENABLED", "true");
    const post = vi.fn();
    vi.doMock("axios", () => ({ default: { post } }));
    vi.doMock("../../lib/apiClient", () => ({ default: { post: vi.fn() } }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { createLocalTunesUser } = await import("../localTunesService");

    await expect(createLocalTunesUser({
      username: "private-owner",
      email: "private-owner@example.test",
      password: "raw-password-never-log",
      venueName: "Private Venue",
    })).rejects.toMatchObject({ code: "LEGACY_MUSIC_REGISTRATION_DISABLED", message: "Music account setup is temporarily unavailable." });

    expect(post).not.toHaveBeenCalled();
    const captured = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
    expect(captured).not.toContain("raw-password-never-log");
    expect(captured).not.toContain("private-owner@example.test");
  });

  it("disables embedded Music SSO and removes browser-readable session state", async () => {
    localStorage.setItem("localtunes_cross_domain_auth", "raw-browser-session-secret");
    sessionStorage.setItem("localtunes_cross_domain_auth", "raw-browser-session-secret");
    localStorage.setItem("localTunes_session", "raw-native-session-secret");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { performLocalTunesSSO } = await import("../ssoService");
    const apollo = { query: vi.fn(), mutate: vi.fn() } as any;

    const result = await performLocalTunesSSO(apollo, "account-a", {
      enabled: true,
      localTunesApiUrl: "https://localtunes.example.test",
      timeout: 1000,
    });

    expect(result).toEqual(expect.objectContaining({ success: false, error: "EMBEDDED_MUSIC_SESSION_DISABLED" }));
    expect(apollo.query).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("localtunes_cross_domain_auth")).toBeNull();
    expect(sessionStorage.getItem("localtunes_cross_domain_auth")).toBeNull();
    expect(localStorage.getItem("localTunes_session")).toBeNull();
    expect(JSON.stringify(log.mock.calls)).not.toContain("raw-browser-session-secret");
  });

  it("keeps password registration callers and browser session writers out of production code", () => {
    const registrationCallers = [
      "src/pages/Music.tsx",
      "src/pages/Checkout.tsx",
      "src/pages/SubscriptionPlans.tsx",
      "src/features/Settings/components/ConnectedAccounts.tsx",
    ];

    for (const relativePath of registrationCallers) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source, relativePath).not.toContain("createLocalTunesUserWithRetry");
      expect(source, relativePath).not.toContain("prepareLocalTunesUserData");
    }

    for (const relativePath of ["src/pages/Music.tsx", "src/features/Settings/components/ConnectedAccounts.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source, relativePath).not.toContain('type="password"');
      expect(source, relativePath).not.toContain("showPasswordModal");
      expect(source, relativePath).not.toContain("connectWithManualPassword");
      expect(source, relativePath).not.toContain("Enter your explorers password");
      expect(source, relativePath).not.toContain("setPassword(");
      expect(source, relativePath).not.toContain("passwordVisible");
      expect(source, relativePath).not.toMatch(/create (?:your )?Local Tunes account/i);
    }

    for (const relativePath of ["src/services/ssoService.ts", "src/lib/apiClient.ts", "src/utils/cookieSetter.ts"]) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source, relativePath).not.toMatch(/(?:localStorage|sessionStorage)\.setItem\(['\"](?:localTunes_session|localtunes_cross_domain_auth)['\"]/);
      expect(source, relativePath).not.toContain("setItem(SESSION_STORAGE_KEY");
      expect(source, relativePath).not.toContain("setItem('localtunes_session_cookie'");
      expect(source, relativePath).not.toMatch(/document\.cookie\s*=\s*`localtunes_/);
    }
  });

});
