import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";

const port = Number(process.env.MUSIC_E2E_STATE_PORT ?? "55174");
const token = process.env.MUSIC_E2E_STATE_TOKEN ?? "";
const accountDocumentId = process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID ?? "";
const username = process.env.MUSIC_E2E_ACCOUNT_USERNAME ?? "";
const strapiOrigin = process.env.MUSIC_E2E_STRAPI_URL ?? "";
const strapiToken = process.env.MUSIC_E2E_STRAPI_TOKEN ?? "";
const snapshots = new Map();
const normalizeDump = (dump) => dump.toString("utf8").split(/\r?\n/)
  .filter((line) => !line.startsWith("--") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict")).join("\n");

if (!Number.isInteger(port) || port < 1024 || port > 65535 || token.length < 32
    || !/^e2e-public-music-[a-z0-9-]+-account$/.test(accountDocumentId)
    || !/^e2e-public-music-[a-z0-9-]+-owner$/.test(username)
    || !strapiToken || !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(strapiOrigin)) {
  throw new Error("state service requires a loopback port and complete namespaced fixture authority");
}

function docker(args, input) {
  if (args[0] !== "exec" || args[1] !== "-T" || args[2] !== "postgres") throw new Error("unsupported fixture database operation");
  const ownership = spawnSync("docker", ["inspect", "--format", "{{ index .Config.Labels \"com.explorers.music.fixture\" }}|{{ index .Config.Labels \"com.explorers.music.project\" }}", "explorers-music-fixture-postgres-1"], {
    cwd: new URL("../../", import.meta.url), encoding: "utf8", windowsHide: true,
  });
  if (ownership.status !== 0 || ownership.stdout.trim() !== "true|explorers-music-fixture") {
    throw new Error("disposable PostgreSQL ownership attestation failed");
  }
  const result = spawnSync("docker", ["exec", "-i", "explorers-music-fixture-postgres-1", ...args.slice(3)], {
    cwd: new URL("../../", import.meta.url), input, maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`disposable PostgreSQL snapshot operation failed (${result.status})`);
  return result.stdout;
}

async function json(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), ...options });
  if (!response.ok) throw new Error(`fixture state read failed: ${response.status} ${new URL(url).pathname}`);
  return response.json();
}

async function capture() {
  const dump = docker(["exec", "-T", "postgres", "pg_dump", "-U", "music_migrator", "-d", "music_fixture", "--format=plain", "--clean", "--if-exists", "--no-owner"]);
  const dataDump = docker(["exec", "-T", "postgres", "pg_dump", "-U", "music_migrator", "-d", "music_fixture", "--format=plain", "--data-only"]);
  const normalizedDump = normalizeDump(dump);
  const databaseHash = createHash("sha256").update(normalizedDump).digest("hex");
  const profile = await json(`${strapiOrigin}/api/accounts/${encodeURIComponent(accountDocumentId)}`, { headers: { Authorization: `Bearer ${strapiToken}` } });
  const snapshotId = randomUUID();
  const publicMusic = (profile.data?.attributes?.public_music ?? profile.data?.public_music ?? profile.public_music) === "Yes";
  const profileHash = createHash("sha256").update(`${accountDocumentId}\0${publicMusic ? "Yes" : "No"}`).digest("hex");
  const snapshot = {
    version: "music-live-account-snapshot/v1", snapshotId,
    publication: { coveredByDatabaseDump: true },
    guestControls: { coveredByDatabaseDump: true },
    queue: { coveredByDatabaseDump: true },
    playlists: { coveredByDatabaseDump: true },
    requests: { coveredByDatabaseDump: true },
    profile: { accountDocumentId, publicMusic, preferenceRevision: Number(profile.data?.attributes?.updatedAt ? Date.parse(profile.data.attributes.updatedAt) : 0), preferenceHash: profileHash },
    database: { namespace: username.replace(/-owner$/, ""), dumpHash: databaseHash },
  };
  snapshots.set(snapshotId, { dump, dataDump, snapshot });
  return snapshot;
}

async function restore(snapshot) {
  const stored = snapshots.get(snapshot?.snapshotId);
  if (!stored || stored.snapshot.database.dumpHash !== snapshot.database?.dumpHash) throw new Error("unknown or mismatched fixture snapshot");
  docker(["exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "music_migrator", "-d", "music_fixture", "-c",
    "DO $$ DECLARE tables text; BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO tables FROM pg_tables WHERE schemaname='public'; IF tables IS NOT NULL THEN EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE'; END IF; END $$;"]);
  docker(["exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "music_migrator", "-d", "music_fixture"], stored.dataDump);
  await json(`${strapiOrigin}/api/accounts/${encodeURIComponent(accountDocumentId)}`, {
    method: "PUT", headers: { Authorization: `Bearer ${strapiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: { public_music: snapshot.profile.publicMusic ? "Yes" : "No" } }),
  });
  const verifiedProfile = await json(`${strapiOrigin}/api/accounts/${encodeURIComponent(accountDocumentId)}`, { headers: { Authorization: `Bearer ${strapiToken}` } });
  const verifiedPublicMusic = verifiedProfile.data?.attributes?.public_music ?? verifiedProfile.data?.public_music ?? verifiedProfile.public_music;
  if (verifiedPublicMusic !== (snapshot.profile.publicMusic ? "Yes" : "No")) throw new Error("Strapi public_music restore verification mismatch");
  const after = await capture();
  const afterStored = snapshots.get(after.snapshotId);
  snapshots.delete(after.snapshotId);
  if (!timingSafeEqual(Buffer.from(after.database.dumpHash, "hex"), Buffer.from(snapshot.database.dumpHash, "hex"))) {
    const classify = (line = "") => /^(?:GRANT|REVOKE|ALTER|CREATE|DROP|COPY|SELECT pg_catalog\.setval|INSERT)\b/i.exec(line.trim())?.[0]?.toUpperCase() ?? "DATA";
    const beforeLines = normalizeDump(stored.dump).split("\n");
    const afterLines = afterStored ? normalizeDump(afterStored.dump).split("\n") : [];
    const index = beforeLines.findIndex((line, offset) => line !== afterLines[offset]);
    throw new Error(`fixture database restore hash mismatch (${snapshot.database.dumpHash.slice(0, 12)} != ${after.database.dumpHash.slice(0, 12)}; firstDifference=${index}:${classify(beforeLines[index])}->${classify(afterLines[index])}); all subsequent live tests must stop`);
  }
  snapshots.delete(snapshot.snapshotId);
  return { restored: true, beforeHash: snapshot.database.dumpHash, afterHash: after.database.dumpHash };
}

createServer(async (request, response) => {
  try {
    if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(403).end(); return; }
    if (request.url === "/health" && request.method === "GET") { response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ready", service: "music-e2e-state", accountDocumentId })); return; }
    if (request.url === "/snapshot" && request.method === "POST") {
      const payload = await capture();
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload)); return;
    }
    if (request.url === "/restore" && request.method === "POST") {
      let body = ""; for await (const chunk of request) { body += chunk; if (body.length > 2 * 1024 * 1024) throw new Error("restore body too large"); }
      const payload = await restore(JSON.parse(body));
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload)); return;
    }
    if (request.url === "/restore-all" && request.method === "POST") {
      const pending = [...snapshots.values()].map(({ snapshot }) => snapshot);
      for (const snapshot of pending) if (snapshots.has(snapshot.snapshotId)) await restore(snapshot);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ restored: true, pending: 0 })); return;
    }
    response.writeHead(404).end();
  } catch (error) {
    if (!response.headersSent) response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "fixture state failure" }));
  }
}).listen(port, "127.0.0.1", () => process.stdout.write(`music-e2e-state ready http://127.0.0.1:${port}\n`));
