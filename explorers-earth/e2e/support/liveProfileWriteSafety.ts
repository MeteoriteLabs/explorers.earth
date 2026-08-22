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
