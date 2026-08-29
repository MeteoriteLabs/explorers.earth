export function prepareMusicFixtureArtifacts({ directory, authPath, storagePath, mkdir, write, chmod }) {
  mkdir(directory);
  write(storagePath, `${JSON.stringify({ cookies: [], origins: [] })}\n`);
  chmod(storagePath);
  return { authPath, storagePath };
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
