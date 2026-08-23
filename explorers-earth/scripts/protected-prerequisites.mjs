const REQUIRED = [
  "E2E_PROFILE_USERNAME",
  "E2E_PROFILE_STORAGE_STATE",
  "E2E_PROFILE_NON_OWNER_STORAGE_STATE",
  "E2E_PROFILE_GALLERY_FILE",
  "E2E_PROFILE_RUN_ID",
  "E2E_PROFILE_LIVE_WRITES",
  "E2E_PROFILE_LIVE_WRITE_CONFIRMATION",
  "PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION",
  "PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY",
];

export const LIVE_WRITE_CONFIRMATION = "I_APPROVE_PROFILE_MUTATION_AND_RESTORE";

const ROUTE_VISIBILITY = new Map([
  ["profile", "public_profile"], ["music", "public_music"],
  ["places-index", "public_recommendations"], ["places-detail", "public_recommendations"],
  ["places-map", null], ["places-detail-map", null], ["places-map-detail", null],
  ["guides-index", "public_guides"], ["guides-detail", "public_guides"], ["community", null],
  ["movies-index", "public_movie"], ["movies-genre", "public_movie"], ["movies-list", "public_movie"],
  ["books-index", "public_books"], ["books-subject", "public_books"], ["books-list", "public_books"],
  ["games-index", "public_games"], ["games-genre", "public_games"], ["games-list", "public_games"],
  ["apps-index", "public_apps"], ["apps-list", "public_apps"],
  ["products-index", "public_products"], ["products-list", "public_products"],
  ["people-index", "public_people"], ["people-sector", "public_people"], ["people-list", "public_people"],
]);
const DETAIL_FIXTURES = new Map([
  ["places-detail", ["placeSlug", "placeSlugs"]], ["places-detail-map", ["placeSlug", "placeSlugs"]], ["places-map-detail", ["placeSlug", "placeSlugs"]],
  ["guides-detail", ["guideSlug", "guideSlugs"]],
  ["movies-genre", ["movieGenreSlug", "movieGenreSlugs"]], ["movies-list", ["movieListSlug", "movieListSlugs"]],
  ["books-subject", ["bookSubjectSlug", "bookSubjectSlugs"]], ["books-list", ["bookListSlug", "bookListSlugs"]],
  ["games-genre", ["gameGenreSlug", "gameGenreSlugs"]], ["games-list", ["gameListSlug", "gameListSlugs"]],
  ["apps-list", ["appListSlug", "appListSlugs"]], ["products-list", ["productListSlug", "productListSlugs"]],
  ["people-sector", ["peopleSectorSlug", "peopleSectorSlugs"]], ["people-list", ["peopleListSlug", "peopleListSlugs"]],
]);

function enabled(value) { return value === true || value === "Yes"; }

export function validateRouteFixtureCoverage(raw, accountVisibility, fixtureIdentities) {
  const fixtures = typeof raw === "string" ? JSON.parse(raw) : raw;
  const actual = new Set(fixtures.enabledRouteIds);
  const expected = new Set([...ROUTE_VISIBILITY].filter(([, field]) => field === null || enabled(accountVisibility?.[field])).map(([id]) => id));
  const missing = [...expected].filter((id) => !actual.has(id));
  const extra = [...actual].filter((id) => !expected.has(id) || !ROUTE_VISIBILITY.has(id));
  if (missing.length || extra.length || actual.size !== fixtures.enabledRouteIds.length) {
    throw new Error("ROUTE_FIXTURE_COVERAGE_MISMATCH");
  }
  const usedByParam = new Map();
  for (const routeId of actual) {
    const requirement = DETAIL_FIXTURES.get(routeId);
    if (!requirement) continue;
    const [param, identityKey] = requirement;
    const value = fixtures.params?.[param];
    if (typeof value !== "string" || value.length === 0 || !fixtureIdentities || !Array.isArray(fixtureIdentities[identityKey]) || !fixtureIdentities[identityKey].includes(value)) {
      throw new Error("ROUTE_FIXTURE_COVERAGE_MISMATCH");
    }
    usedByParam.set(param, value);
  }
  const used = [...usedByParam.values()];
  if (new Set(used).size !== used.length) throw new Error("ROUTE_FIXTURE_COVERAGE_MISMATCH");
  return fixtures;
}

export function validateRouteFixtures(env) {
  if (!env.E2E_PROFILE_ROUTE_FIXTURES) throw new Error("ENV_MISSING: E2E_PROFILE_ROUTE_FIXTURES");
  try {
    const fixtures = JSON.parse(env.E2E_PROFILE_ROUTE_FIXTURES);
    if (!fixtures || typeof fixtures !== "object" || !fixtures.params ||
      !Array.isArray(fixtures.enabledRouteIds) || fixtures.enabledRouteIds.length === 0 ||
      fixtures.enabledRouteIds.some((id) => typeof id !== "string" || !ROUTE_VISIBILITY.has(id)) ||
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
  if (!/^qa[-_]/i.test(env.PUBLIC_API_RUN_ID ?? "") ||
      !/^qa[-_]/i.test(env.E2E_PROFILE_RUN_ID ?? "") ||
      env.E2E_PROFILE_RUN_ID !== env.PUBLIC_API_RUN_ID ||
      !/^qa[-_]/i.test(env.PUBLIC_API_ANALYTICS_QA_SINK ?? "")) {
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
