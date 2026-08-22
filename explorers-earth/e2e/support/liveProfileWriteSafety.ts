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
