import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import {
  attestUatDatabaseAuthority,
  MUSIC_UAT_DATABASE_ACK,
  parseUatDatabaseAuthority,
} from "../../scripts/music-uat-database";
import { runMusicFixtureIdentityCountPsql } from "../../scripts/music-e2e-state-capture.mjs";

const enabled = process.env.MUSIC_C13_IDENTITY_COUNT_ADAPTER_POSTGRES_TEST === "1"
  && process.env.MUSIC_UAT_DATABASE_ACK === MUSIC_UAT_DATABASE_ACK;
const describePg = enabled ? describe.sequential : describe.skip;
const fixtureDatabase = "music_fixture";
const namespace = "e2e-public-music-adapter";
const captureAuthority = Object.freeze({
  namespace,
  username: `${namespace}-owner`,
  accountDocumentId: `${namespace}-account`,
  userDocumentId: `${namespace}-user`,
});

let admin: pg.Pool | undefined;
let fixture: pg.Pool | undefined;
let containerId = "";
let childDatabaseCreated = false;

function databaseUrl(name: string): string {
  const target = new URL(process.env.DATABASE_URL_TEST ?? "");
  target.pathname = `/${name}`;
  return target.toString();
}

function attestOwnedContainer(): { containerId: string } {
  const authority = parseUatDatabaseAuthority(process.env);
  if (!authority || authority.containerId !== containerId) {
    throw new Error("owned identity-count adapter authority changed");
  }
  const attested = attestUatDatabaseAuthority(process.env, authority.commit);
  if (!attested || attested.containerId !== containerId) {
    throw new Error("owned identity-count adapter authority changed");
  }
  return { containerId: attested.containerId };
}

describePg("owned PostgreSQL production identity-count adapter", () => {
  beforeAll(async () => {
    const authority = parseUatDatabaseAuthority(process.env);
    if (!authority) throw new Error("owned identity-count adapter authority is missing");
    const attested = attestUatDatabaseAuthority(process.env, authority.commit);
    if (!attested || attested.containerId !== authority.containerId) {
      throw new Error("owned identity-count adapter authority is invalid");
    }
    containerId = attested.containerId;
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 1 });
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [fixtureDatabase]);
    if (existing.rowCount !== 0) throw new Error("owned identity-count child database is not exclusive");
    await admin.query("CREATE DATABASE music_fixture");
    childDatabaseCreated = true;
    fixture = new pg.Pool({ connectionString: databaseUrl(fixtureDatabase), max: 1 });
    await migrateMusicDatabase(fixture);
  });

  afterAll(async () => {
    const retainedFixture = fixture;
    fixture = undefined;
    try {
      if (retainedFixture) await retainedFixture.end();
    } finally {
      const retainedAdmin = admin;
      admin = undefined;
      if (retainedAdmin) {
        try {
          if (childDatabaseCreated) {
            await retainedAdmin.query(
              "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
              [fixtureDatabase],
            );
            await retainedAdmin.query("DROP DATABASE music_fixture");
            const remaining = await retainedAdmin.query(
              "SELECT 1 FROM pg_database WHERE datname=$1", [fixtureDatabase],
            );
            if (remaining.rowCount !== 0) throw new Error("owned identity-count database cleanup failed");
          }
        } finally {
          childDatabaseCreated = false;
          containerId = "";
          await retainedAdmin.end();
        }
      } else {
        childDatabaseCreated = false;
        containerId = "";
      }
    }
  });

  it("uses the exact production docker-exec adapter for the real zero-to-one identity transition", async () => {
    expect(runMusicFixtureIdentityCountPsql({
      containerId,
      authority: captureAuthority,
      attestContainer: attestOwnedContainer,
    })).toBe(0);

    await fixture!.query(`INSERT INTO users(
      username,password,email,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
      lifecycle_operation_id,guest_capability_hash
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
      captureAuthority.username, "not-a-login-secret", "adapter@example.invalid",
      namespace, "Adapter fixture", captureAuthority.userDocumentId,
      captureAuthority.accountDocumentId, "adapter-provision", "d".repeat(64),
    ]);

    expect(runMusicFixtureIdentityCountPsql({
      containerId,
      authority: captureAuthority,
      attestContainer: attestOwnedContainer,
    })).toBe(1);
  });
});
