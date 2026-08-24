export async function deactivateExplorerAndMusic(input: {
  blockExplorer: () => Promise<boolean>;
  suspendMusic: () => Promise<unknown>;
  resumeMusic: () => Promise<unknown>;
}): Promise<void> {
  await input.suspendMusic();
  if (await input.blockExplorer()) return;
  await input.resumeMusic();
  throw new Error("Explorer account status update was not confirmed.");
}
