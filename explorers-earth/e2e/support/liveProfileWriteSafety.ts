import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const PROFILE_BACKUP_FIELDS = [
  "Bio",
  "background_picture",
  "social_media",
  "public_profile",
] as const;

export type AllowlistedProfileState = Record<(typeof PROFILE_BACKUP_FIELDS)[number], unknown>;

export function pickAllowlistedProfileState(source: Record<string, unknown>): AllowlistedProfileState {
  return Object.fromEntries(PROFILE_BACKUP_FIELDS.map((field) => [
    field,
    source[field] === undefined ? null : structuredClone(source[field]),
  ])) as AllowlistedProfileState;
}

export async function writeProtectedProfileBackup({
  runId,
  group,
  state,
}: {
  runId: string;
  group: string;
  state: AllowlistedProfileState;
}): Promise<string> {
  if (!/^qa[-_][a-z0-9_-]{1,64}$/i.test(runId) || !/^[a-z0-9-]{1,64}$/i.test(group)) {
    throw new Error("BACKUP_ID_INVALID");
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "explorers-profile-recovery-"));
  await fs.chmod(directory, 0o700);
  const artifact = path.join(directory, `${runId}--${group}.json`);
  await fs.writeFile(artifact, `${JSON.stringify({ version: 1, runId, group, state })}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await fs.chmod(artifact, 0o600);
  return artifact;
}

export async function removeVerifiedProfileBackup(artifact: string): Promise<void> {
  const resolved = path.resolve(artifact);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(path.dirname(resolved)).startsWith("explorers-profile-recovery-")) {
    throw new Error("BACKUP_PATH_UNSAFE");
  }
  await fs.unlink(resolved);
  await fs.rmdir(path.dirname(resolved));
}

export async function restoreWithEmergency({
  normalRestore,
  emergencyRestore,
  verify,
}: {
  normalRestore: () => Promise<void>;
  emergencyRestore: () => Promise<void>;
  verify: () => Promise<void>;
}) {
  try {
    await normalRestore();
    await verify();
  } catch (normalRestoreError) {
    await emergencyRestore();
    await verify();
    throw normalRestoreError;
  }
}

interface ProtectedProfileMutationOptions<State, Template> {
  captureExactState: () => Promise<State>;
  captureMutationTemplate: () => Promise<Template>;
  backup: (state: State) => Promise<void>;
  mutate: (template: Template) => Promise<void>;
  verifyMutation: () => Promise<void>;
  normalRestore: (state: State, template: Template) => Promise<void>;
  emergencyRestore: (state: State, template: Template) => Promise<void>;
  verifyRestored: (state: State) => Promise<void>;
}

export async function runProtectedProfileMutation<State, Template>({
  captureExactState,
  captureMutationTemplate,
  backup,
  mutate,
  verifyMutation,
  normalRestore,
  emergencyRestore,
  verifyRestored,
}: ProtectedProfileMutationOptions<State, Template>) {
  const exactState = structuredClone(await captureExactState());
  const template = structuredClone(await captureMutationTemplate());
  await backup(exactState);
  let mutationStarted = false;

  try {
    mutationStarted = true;
    await mutate(template);
    await verifyMutation();
  } finally {
    if (mutationStarted) {
      await restoreWithEmergency({
        normalRestore: () => normalRestore(exactState, template),
        emergencyRestore: () => emergencyRestore(exactState, template),
        verify: () => verifyRestored(exactState),
      });
    }
  }
}
