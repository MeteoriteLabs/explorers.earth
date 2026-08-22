import { validateProtectedPrerequisites } from "./protected-prerequisites.mjs";

export async function runProtectedGlobalSetup({ projectNames, env, onProtectedReady } = {}) {
  const names = projectNames ?? [];
  if (!names.includes("real-account")) return;
  validateProtectedPrerequisites(env ?? process.env);
  onProtectedReady?.();
}

export default async function globalSetup() {
  const protectedRequested = process.argv.some((argument) => argument.includes("real-account"));
  const projectNames = protectedRequested ? ["real-account"] : [];
  await runProtectedGlobalSetup({ projectNames, env: process.env });
}
