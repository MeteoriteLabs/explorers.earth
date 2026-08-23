const REQUIRED = [
  "E2E_PROFILE_USERNAME",
  "E2E_PROFILE_STORAGE_STATE",
  "E2E_PROFILE_NON_OWNER_STORAGE_STATE",
  "E2E_PROFILE_GALLERY_FILE",
  "E2E_PROFILE_LIVE_WRITES",
  "E2E_PROFILE_LIVE_WRITE_CONFIRMATION",
  "PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION",
  "PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY",
];

export const LIVE_WRITE_CONFIRMATION = "I_APPROVE_PROFILE_MUTATION_AND_RESTORE";

function validateRouteFixtures(env) {
  if (!env.E2E_PROFILE_ROUTE_FIXTURES) throw new Error("ENV_MISSING: E2E_PROFILE_ROUTE_FIXTURES");
  try {
    const fixtures = JSON.parse(env.E2E_PROFILE_ROUTE_FIXTURES);
    const requiredParams = ["placeSlug", "place", "guideSlug", "genreSlug", "subjectSlug", "sectorSlug", "listSlug"];
    if (!fixtures || typeof fixtures !== "object" || !fixtures.params ||
      requiredParams.some((name) => typeof fixtures.params[name] !== "string" || fixtures.params[name].length === 0) ||
      !Array.isArray(fixtures.enabledRouteIds) || fixtures.enabledRouteIds.length === 0 ||
      !fixtures.hiddenPath || !fixtures.deletedPath || !fixtures.unknownUsername) {
      throw new Error("shape");
    }
  } catch {
    throw new Error("ROUTE_FIXTURE_INVALID");
  }
}

export function validateProtectedReadOnlyPrerequisites(env = process.env) {
  const verification = verifyPublicProfileEnvironment({ mode: "read-only", env });
  if (verification.code !== "READY") {
    throw new Error(`${verification.code}: ${verification.summary}`);
  }
  if (!env.E2E_PROFILE_USERNAME) throw new Error("ENV_MISSING: E2E_PROFILE_USERNAME");
  validateRouteFixtures(env);
  return verification;
}

export function validateProtectedPrerequisites(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (env.E2E_PROFILE_LIVE_WRITES && env.E2E_PROFILE_LIVE_WRITES !== "1") {
    missing.push("E2E_PROFILE_LIVE_WRITES=1");
  }
  if (
    env.E2E_PROFILE_LIVE_WRITE_CONFIRMATION &&
    env.E2E_PROFILE_LIVE_WRITE_CONFIRMATION !== LIVE_WRITE_CONFIRMATION
  ) {
    missing.push(`E2E_PROFILE_LIVE_WRITE_CONFIRMATION=${LIVE_WRITE_CONFIRMATION}`);
  }
  if (missing.length > 0) {
    throw new Error(`ENV_MISSING: ${missing.join(", ")}`);
  }
  validateRouteFixtures(env);
  if (!/^qa[-_]/i.test(env.PUBLIC_API_RUN_ID ?? "") || !/^qa[-_]/i.test(env.PUBLIC_API_ANALYTICS_QA_SINK ?? "")) {
    throw new Error("ANALYTICS_CANARY_REQUIRED");
  }
  if (!/\bcleanup\s*:/.test(env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION ?? "") ||
      !/\bremaining\s*:/.test(env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY ?? "")) {
    throw new Error("ANALYTICS_CLEANUP_FAILED: run cleanup contract missing");
  }

  const verification = verifyPublicProfileEnvironment({ mode: "mutation", env });
  if (verification.code !== "READY") {
    throw new Error(`${verification.code}: ${verification.summary}`);
  }

  return verification;
}
import { verifyPublicProfileEnvironment } from "./verify-public-profile-env.mjs";
