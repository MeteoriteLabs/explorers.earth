import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "src/components/AuthSyncManager.tsx",
  "src/components/MusicDashboard.tsx",
  "src/hooks/useTunesDashboard.ts",
  "src/pages/Music.tsx",
  "src/pages/OnBoarding.tsx",
  "src/pages/public/PublicMusic.tsx",
  "src/features/music/publicMusicClient.ts",
];

const retiredFiles = [
  "src/features/Settings/components/ConnectedAccounts.tsx",
  "src/lib/apiClient.ts",
  "src/services/localTunesService.ts",
  "src/services/ssoService.ts",
  "src/pages/TunesSsoRedirect.tsx",
];

describe("retired browser Music authority boundary", () => {
  it("contains no legacy identity, owner-target, persistence, or native login surface", () => {
    const source = files.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
    for (const forbidden of [
      "X-Username", "x-username", "?username=",
      "/api/auth/sync", "/auth?tab=login", "Connect to Local Tunes",
      "localTunes_session", "localtunes_cross_domain_auth", "localtunes_sync_done",
      "document.cookie", "changeLocalTunesPassword", "createLocalTunesUser",
    ]) expect(source).not.toContain(forbidden);
    for (const retired of retiredFiles) expect(existsSync(resolve(process.cwd(), retired))).toBe(false);
  });

  it("does not advertise or authorize Music through the retired mutable-username public route", () => {
    const publicNav = readFileSync(resolve(process.cwd(), "src/components/PublicNav.tsx"), "utf8");
    const publicRoutes = readFileSync(resolve(process.cwd(), "src/routes/PublicRoutes.tsx"), "utf8");

    expect(publicNav).not.toContain("path: `/${username}/music`");
    expect(publicNav).not.toContain("showMusicTab");
    expect(publicRoutes).not.toContain('tabField="public_music"');
    expect(publicRoutes).not.toContain('<Route path="music"');
  });

  it("hands completed onboarding back to the sole eligibility observer without a second ensure trigger", () => {
    const onboarding = readFileSync(resolve(process.cwd(), "src/pages/OnBoarding.tsx"), "utf8");
    expect(onboarding).toContain('include: ["MusicIdentityEligibility"]');
    expect(onboarding).not.toContain("musicIdentityCoordinator");
    expect(onboarding).not.toContain("ensureIdentity");
  });
});
