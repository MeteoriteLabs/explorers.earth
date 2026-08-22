const REQUIRED = [
  "E2E_PROFILE_USERNAME",
  "E2E_PROFILE_STORAGE_STATE",
  "E2E_PROFILE_LIVE_WRITES",
  "E2E_PROFILE_LIVE_WRITE_CONFIRMATION",
];

export const LIVE_WRITE_CONFIRMATION = "I_APPROVE_PROFILE_MUTATION_AND_RESTORE";

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

  const verification = verifyPublicProfileEnvironment({ mode: "mutation", env });
  if (verification.code !== "READY") {
    throw new Error(`${verification.code}: ${verification.summary}`);
  }

  return verification;
}
import { verifyPublicProfileEnvironment } from "./verify-public-profile-env.mjs";
