export async function deactivateExplorerAndMusic(input: {
  blockExplorer: () => Promise<boolean>;
  suspendMusic: () => Promise<unknown>;
}): Promise<void> {
  if (!await input.blockExplorer()) {
    throw new Error("Explorer account status update was not confirmed.");
  }
  await input.suspendMusic();
}
