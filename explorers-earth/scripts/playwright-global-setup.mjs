import { validateProtectedPrerequisites } from "./protected-prerequisites.mjs";

export default async function globalSetup() {
  const protectedRun = process.argv.some((argument) => argument.includes("real-account"));
  if (protectedRun) validateProtectedPrerequisites(process.env);
}
