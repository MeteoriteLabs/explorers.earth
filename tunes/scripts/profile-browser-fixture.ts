import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { createCanonicalApp } from '../server/auth/canonicalApp';
import { resolveExplorersAuthConfig } from '../server/auth/betterAuth';
import { issueRecoveryProof } from '../server/auth/recoveryProof';
import { ensureInitialAccount } from '../server/auth/initialAccount';
import { migrateMusicDatabase } from '../server/db/migrate';
import { MUSIC_UAT_DATABASE_ACK, startOwnedUatDatabase, stopOwnedUatDatabase,
  type OwnedUatDatabaseAuthority } from './music-uat-database';
import { prepareFixtureMusicTokenSecret, cleanupFixtureMusicTokenSecret } from './music-fixture-secret';
import { readSecureMusicSecretFile } from '../server/config/secure-music-secret-file';

const root = resolve(import.meta.dirname, '../..');
const frontend = resolve(root, 'explorers-earth');
const suite = process.argv[2] === '--suite' && process.argv[3] === 'auth' ? 'auth' : 'profile';
const expectedArgs = suite === 'auth' ? `--suite auth --ack ${MUSIC_UAT_DATABASE_ACK}` : `--ack ${MUSIC_UAT_DATABASE_ACK}`;
if (process.argv.slice(2).join(' ') !== expectedArgs)
  throw new Error('Browser E2E requires exact disposable PostgreSQL acknowledgement');
for (const key of ['DATABASE_URL', 'DATABASE_URL_TEST', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'GATE_PROD',
  'MUSIC_DEPLOY_PRODUCTION', 'MUSIC_DEPLOY_PROD']) {
  if (process.env[key]) throw new Error('Ambient database or Docker authority is forbidden');
}
if (process.env.NODE_ENV === 'production' || Object.keys(process.env).some((key) => key.startsWith('MUSIC_C10_STANDALONE_POSTGRES_')))
  throw new Error('Production or unrelated database authority is forbidden');
const runId = randomBytes(16).toString('hex');
const database = `music_uat_${runId}`;
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const disposable = mkdtempSync(join(tmpdir(), 'explorers-profile-e2e-'));
const passwordFile = prepareFixtureMusicTokenSecret(root);
let authority: OwnedUatDatabaseAuthority | undefined;
let db: pg.Pool | undefined;
let apiServer: ReturnType<ReturnType<typeof createCanonicalApp>['app']['listen']> | undefined;
let vite: ChildProcess | undefined;
let browser: ChildProcess | undefined;
let interrupted = false;

async function freePort(min = 55000, max = 60999): Promise<number> {
  for (let i = 0; i < 150; i++) {
    const port = min + randomBytes(2).readUInt16BE(0) % (max - min + 1);
    const free = await new Promise<boolean>((done) => {
      const server = createServer();
      server.once('error', () => done(false));
      server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
    });
    if (free) return port;
  }
  throw new Error('No local fixture port available');
}
async function waitFor(url: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('Local fixture server did not start');
}
function stopChild(child: ChildProcess | undefined): void {
  if (!child || child.exitCode !== null) return;
  child.kill();
}
async function dropOwnedDatabase(owned: OwnedUatDatabaseAuthority, password: string): Promise<void> {
  const url = new URL('postgresql://127.0.0.1/postgres');
  url.username = 'music_migrator'; url.password = password; url.port = String(owned.port);
  const admin = new pg.Pool({ connectionString: url.toString(), max: 1 });
  try { await admin.query(`DROP DATABASE ${owned.database}`); }
  finally { await admin.end(); }
}
async function main(): Promise<number> {
  const password = await readSecureMusicSecretFile(passwordFile, { mode: 'fixture' });
  const pgPort = await freePort(56000, 60999);
  const apiPort = await freePort(54000, 55999);
  const webPort = await freePort(52000, 53999);
  authority = await startOwnedUatDatabase({ runId, database, commit, port: pgPort, passwordFile });
  const dbUrl = new URL('postgresql://127.0.0.1');
  dbUrl.username = 'music_migrator'; dbUrl.password = password;
  dbUrl.port = String(pgPort); dbUrl.pathname = database;
  db = new pg.Pool({ connectionString: dbUrl.toString(), max: 4 });
  await migrateMusicDatabase(db);
  const origin = `http://127.0.0.1:${webPort}`;
  const config = resolveExplorersAuthConfig({ EXPLORERS_PUBLIC_ORIGIN: origin,
    EXPLORERS_AUTH_SECRET: randomBytes(32).toString('hex'),
    GOOGLE_CLIENT_ID: 'profile-fixture-google', GOOGLE_CLIENT_SECRET: 'profile-fixture-secret' });
  const composed = createCanonicalApp(db, config);
  apiServer = await new Promise((done) => {
    const server = composed.app.listen(apiPort, '127.0.0.1', () => done(server));
  });
  const personas: Record<string, { userId: string; cookie: string; handle: string }> = {};
  for (const name of ['ownerA', 'ownerB']) {
    const userId = `profile-e2e-${randomUUID()}`;
    await db.query('INSERT INTO auth_user(id,name,email) VALUES ($1,$2,$3)', [userId, name, `${userId}@example.invalid`]);
    await db.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,updated_at) VALUES ($1,$2,'google',$3,now())",
      [randomUUID(), `google-${userId}`, userId]);
    const context = await composed.auth.$context;
    const session = await context.internalAdapter.createSession(userId, false);
    const signature = createHmac('sha256', config.secret).update(session.token).digest('base64');
    const cookie = `${context.authCookies.sessionToken.name}=${session.token}.${signature}`;
    personas[name] = { userId, cookie, handle: `profile${name.toLowerCase()}${runId.slice(0, 4)}` };
  }
  let recoveryProof: string | undefined;
  if (suite === 'auth') {
    const recovery = personas.ownerB;
    const selected = await ensureInitialAccount(db, recovery.userId);
    await db.query("UPDATE creator_accounts SET status='suspended',suspended_at=now() WHERE id=$1", [selected.accountId]);
    await db.query('UPDATE user_security_state SET blocked_at=now(),session_version=session_version+1 WHERE user_id=$1', [recovery.userId]);
    await db.query('DELETE FROM auth_session WHERE user_id=$1', [recovery.userId]);
    const context = await composed.auth.$context;
    const temporary = await context.internalAdapter.createSession(recovery.userId, false);
    recoveryProof = (await issueRecoveryProof(db, { userId: recovery.userId,
      subject: `google-${recovery.userId}`, sessionId: temporary.id })).token;
  }
  const fixturePath = join(disposable, 'sessions.json');
  writeFileSync(fixturePath, JSON.stringify({ origin, personas, recoveryProof }), { mode: 0o600 });
  vite = spawn(process.execPath, [resolve(frontend, 'node_modules/vite/bin/vite.js'),
    '--config', 'e2e/replatform/profile.vite.config.ts'], {
    cwd: frontend, windowsHide: true, stdio: 'inherit', env: { ...process.env,
      PROFILE_E2E_LOCAL_AUTHORITY: 'owned-disposable-pg15', PROFILE_E2E_WEB_PORT: String(webPort),
      PROFILE_E2E_API_PORT: String(apiPort) },
  });
  await waitFor(origin);
  browser = spawn(process.execPath, [resolve(frontend, 'node_modules/@playwright/test/cli.js'),
    'test', `e2e/replatform/${suite}.spec.ts`, '--project=chromium-pr-safe', '--retries=0'], {
    cwd: frontend, windowsHide: true, stdio: 'inherit', env: { ...process.env,
      [suite === 'auth' ? 'AUTH_E2E_FIXTURE_PATH' : 'PROFILE_E2E_FIXTURE_PATH']: fixturePath,
      PLAYWRIGHT_EXTERNAL_BASE_URL: origin },
  });
  return await new Promise<number>((done) => browser!.once('exit', (code) => done(code ?? 1)));
}
const signal = () => { interrupted = true; stopChild(browser); stopChild(vite); };
process.once('SIGINT', signal);
process.once('SIGTERM', signal);
try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`Profile E2E fixture failed: ${error instanceof Error ? error.message.replaceAll(disposable, '<fixture>') : 'unknown'}\n`);
  process.exitCode = 1;
} finally {
  stopChild(browser); stopChild(vite);
  await new Promise<void>((done) => apiServer?.close(() => done()) ?? done());
  await db?.end();
  if (authority) {
    const password = await readSecureMusicSecretFile(passwordFile, { mode: 'fixture' });
    await stopOwnedUatDatabase(authority, { dropDatabase: (owned) => dropOwnedDatabase(owned, password) });
  }
  cleanupFixtureMusicTokenSecret(root, passwordFile);
  rmSync(disposable, { recursive: true, force: true });
  if (interrupted) process.exitCode = 130;
}
