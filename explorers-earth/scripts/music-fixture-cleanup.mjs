export async function settleMusicFixture({ restore, parseEvidence, teardown, writeEvidence = async () => undefined }) {
  let restoration = { ok: false, cleanup: "restore-failed" };
  let evidence = [];
  try { restoration = await restore(); } catch { restoration = { ok: false, cleanup: "restore-failed" }; }
  try { evidence = await parseEvidence(); } catch { restoration = { ...restoration, ok: false, cleanup: restoration.ok ? "evidence-missing" : restoration.cleanup }; }
  let teardownOk = false;
  try { teardownOk = (await teardown()) === 0; } catch { teardownOk = false; }
  const cleanup = teardownOk ? restoration.cleanup : "teardown-failed";
  try { await writeEvidence({ cleanup, restoration, evidence }); } catch { /* cleanup must win over reporting */ }
  return { cleanup, restoration, evidence, teardownOk };
}
