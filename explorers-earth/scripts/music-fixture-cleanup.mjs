export function prepareMusicFixtureArtifacts({ directory, authPath, storagePath, mkdir, write, chmod }) {
  mkdir(directory);
  write(storagePath, `${JSON.stringify({ cookies: [], origins: [] })}\n`);
  chmod(storagePath);
  return { authPath, storagePath };
}

export function stopMusicFixtureStateService(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (typeof child.kill !== "function" || child.kill("SIGKILL") !== true) {
    throw new Error("state service did not accept the stop signal");
  }
}

export function stopMusicFixture({ artifactPaths, artifactDirectories = [], exists, unlink, removeDirectory, stopStateService, down }) {
  let status = 0;
  for (const artifact of artifactPaths) {
    try { if (artifact && exists(artifact)) unlink(artifact); } catch { status = 1; }
  }
  for (const directory of artifactDirectories) {
    try { if (directory && exists(directory)) removeDirectory(directory); } catch { status = 1; }
  }
  try { stopStateService(); } catch { status = 1; }
  try { if (down() !== 0) status = 1; } catch { status = 1; }
  return status;
}
