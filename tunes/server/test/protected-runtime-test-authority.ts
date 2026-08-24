import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { provisionMusicRuntimeLogin } from "../db/music-runtime-role";

export async function prepareProtectedRuntimeTestAuthority(): Promise<void> {
  const target = new URL(process.env.DATABASE_URL_TEST ?? "");
  const runtimePassword = randomBytes(32).toString("base64url");
  const authority = new pg.Pool({ connectionString: target.toString(), max: 1 });
  try {
    await provisionMusicRuntimeLogin(authority, {
      loginRole: process.env.MUSIC_DATABASE_USER ?? "music_runtime_login",
      password: runtimePassword,
    });
  } finally {
    await authority.end();
  }
  const secretDirectory = mkdtempSync(join(tmpdir(), "music-runtime-integration-"));
  const passwordFile = join(secretDirectory, "runtime-password");
  writeFileSync(passwordFile, runtimePassword, { mode: 0o600 });
  process.env.MUSIC_DATABASE_HOST = target.hostname;
  process.env.MUSIC_DATABASE_PORT = target.port;
  process.env.MUSIC_DATABASE_NAME = target.pathname.slice(1);
  process.env.MUSIC_DATABASE_PASSWORD_FILE = passwordFile;
  delete process.env.DATABASE_URL;
}
