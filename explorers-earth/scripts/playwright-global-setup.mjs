import {
  validateProtectedPrerequisites,
  validateProtectedReadOnlyPrerequisites,
} from "./protected-prerequisites.mjs";

export async function runProtectedGlobalSetup({ projectNames, mode, env, onProtectedReady } = {}) {
  const names = projectNames ?? [];
  if (!names.includes("real-account")) return;
  const selectedMode = mode ?? env?.E2E_PROFILE_PROTECTED_MODE ?? process.env.E2E_PROFILE_PROTECTED_MODE ?? "mutation";
  if (selectedMode === "read-only") validateProtectedReadOnlyPrerequisites(env ?? process.env);
  else if (selectedMode === "mutation") validateProtectedPrerequisites(env ?? process.env);
  else throw new Error("ENV_MISSING: E2E_PROFILE_PROTECTED_MODE must be read-only or mutation");
  onProtectedReady?.();
}

export default async function globalSetup() {
  const protectedRequested = process.argv.some((argument) => argument.includes("real-account"));
  const projectNames = protectedRequested ? ["real-account"] : [];
  await runProtectedGlobalSetup({ projectNames, env: process.env });
}
