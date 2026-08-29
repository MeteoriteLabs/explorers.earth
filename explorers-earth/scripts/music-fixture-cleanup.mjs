export async function settleMusicFixture({ restore, parseEvidence, teardown, writeEvidence = async () => undefined }) {
  let restoration = { ok: false, cleanup: "restore-failed" };
  let evidence = [];
  try { restoration = await restore(); } catch { restoration = { ok: false, cleanup: "restore-failed" }; }
  try { evidence = await parseEvidence(); } catch { restoration = { ...restoration, ok: false, cleanup: restoration.ok ? "evidence-missing" : restoration.cleanup }; }
  let teardownOk = false;
  try { teardownOk = (await teardown()) === 0; } catch { teardownOk = false; }
  let cleanup = teardownOk ? restoration.cleanup : "teardown-failed";
  try { await writeEvidence({ cleanup, restoration, evidence }); } catch { if (cleanup === "restored") cleanup = "evidence-missing"; }
  return { cleanup, restoration, evidence, teardownOk, exitCode: cleanup === "restored" ? 0 : 5 };
}

export function prepareMusicFixtureArtifacts({ directory, authPath, storagePath, mkdir, write, chmod }) {
  mkdir(directory);
  write(storagePath, `${JSON.stringify({ cookies: [], origins: [] })}\n`);
  chmod(storagePath);
  return { authPath, storagePath };
}

export function stopMusicFixture({ artifactPaths, exists, unlink, stopStateService, down }) {
  let status = 0;
  for (const artifact of artifactPaths) {
    try { if (artifact && exists(artifact)) unlink(artifact); } catch { status = 1; }
  }
  try { stopStateService(); } catch { status = 1; }
  try { if (down() !== 0) status = 1; } catch { status = 1; }
  return status;
}
