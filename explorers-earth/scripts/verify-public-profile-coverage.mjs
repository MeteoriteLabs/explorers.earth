import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PURE_COVERAGE_MODULES = Object.freeze([
  "publicRouteContract.ts",
  "publicRouteResourceState.ts",
  "resolvePublicChildState.ts",
  "publicRouteReadiness.ts",
  "apolloTransport.ts",
]);

export const LEGACY_COVERAGE_MODULES = Object.freeze([
  "PublicProfileFallbackRedirect.tsx",
  "PublicProfileBootstrapContext.tsx",
  "PublicRouteReadinessContext.tsx",
  "usePublicRouteLifecycle.ts",
  "analyticsService.ts",
]);

const readSummary = (summaryPath) =>
  JSON.parse(fs.readFileSync(summaryPath, "utf8"));

const coveredBasenames = (summary) => new Set(
  Object.keys(summary)
    .filter((entry) => entry !== "total")
    .map((entry) => path.basename(entry.replaceAll("\\", "/"))),
);

const assertModules = (label, summary, requiredModules) => {
  const available = coveredBasenames(summary);
  const missing = requiredModules.filter((moduleName) => !available.has(moduleName));
  if (missing.length > 0) {
    throw new Error(`${label}_COVERAGE_MODULES_MISSING:${missing.join(",")}`);
  }
};

export function verifyCoverageReports({ pureSummaryPath, legacySummaryPath }) {
  const pure = readSummary(pureSummaryPath);
  const legacy = readSummary(legacySummaryPath);

  assertModules("PURE", pure, PURE_COVERAGE_MODULES);
  assertModules("LEGACY", legacy, LEGACY_COVERAGE_MODULES);

  if (pure.total?.branches?.pct !== 100) {
    throw new Error(`PURE_BRANCH_COVERAGE_NOT_100:${pure.total?.branches?.pct ?? "missing"}`);
  }

  return {
    pureBranches: pure.total.branches.pct,
    legacyBranches: legacy.total?.branches?.pct ?? null,
  };
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = verifyCoverageReports({
    pureSummaryPath: path.resolve("coverage/public-profile/coverage-summary.json"),
    legacySummaryPath: path.resolve("coverage/public-profile-legacy/coverage-summary.json"),
  });
  process.stdout.write(
    `[public-profile-coverage] pure branches=${result.pureBranches}% legacy branches=${result.legacyBranches}%\n`,
  );
}
