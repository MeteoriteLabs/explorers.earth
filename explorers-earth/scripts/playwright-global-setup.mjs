import {
  validateProtectedPrerequisites,
  validateProtectedReadOnlyPrerequisites,
  validateRouteFixtureCoverage,
} from "./protected-prerequisites.mjs";
import { runPublicApiPreflight, runPublicReadOnlyPreflight } from "./verify-public-api-access.mjs";

export async function runProtectedGlobalSetup({ projectNames, mode, env, onProtectedReady, verifyReleasePrerequisites = runPublicApiPreflight, verifyReadOnlyPrerequisites = runPublicReadOnlyPreflight } = {}) {
  const names = projectNames ?? [];
  if (!names.includes("real-account")) return;
  const selectedMode = mode ?? env?.E2E_PROFILE_PROTECTED_MODE ?? process.env.E2E_PROFILE_PROTECTED_MODE ?? "mutation";
  if (selectedMode === "read-only") {
    const selectedEnv = env ?? process.env;
    validateProtectedReadOnlyPrerequisites(selectedEnv);
    const release = await verifyReadOnlyPrerequisites({ username: selectedEnv.E2E_PROFILE_USERNAME, env: selectedEnv });
    if (release.code !== "PUBLIC_API_READY") throw new Error(`${release.code}: protected read-only preflight blocked`);
    validateRouteFixtureCoverage(selectedEnv.E2E_PROFILE_ROUTE_FIXTURES, release.accountVisibility, release.fixtureIdentities);
  }
  else if (selectedMode === "mutation") {
    const selectedEnv = env ?? process.env;
    validateProtectedPrerequisites(selectedEnv);
    const release = await verifyReleasePrerequisites({ username: selectedEnv.E2E_PROFILE_USERNAME, env: selectedEnv });
    if (release.code !== "PUBLIC_API_READY") throw new Error(`${release.code}: protected release preflight blocked`);
    validateRouteFixtureCoverage(selectedEnv.E2E_PROFILE_ROUTE_FIXTURES, release.accountVisibility, release.fixtureIdentities);
  }
  else throw new Error("ENV_MISSING: E2E_PROFILE_PROTECTED_MODE must be read-only or mutation");
  onProtectedReady?.();
}

export default async function globalSetup() {
  const protectedRequested = process.argv.some((argument) => argument.includes("real-account"));
  const projectNames = protectedRequested ? ["real-account"] : [];
  await runProtectedGlobalSetup({ projectNames, env: process.env });
}
