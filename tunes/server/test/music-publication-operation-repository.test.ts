import { describe, expect, it, vi } from "vitest";
import { MusicPublicationOperationRepository } from "../repositories/musicPublicationOperationRepository";
import {
  MusicPublicationResponseCipher,
  hashPublicationIdempotencyKey,
  publicationRequestFingerprint,
} from "../services/musicPublicationResponseCrypto";

const now = Date.parse("2026-08-21T00:00:00.000Z");
const capability = "C".repeat(43);
const cipher = new MusicPublicationResponseCipher({
  current: { kid: "publication-current-v1", key: Buffer.alloc(32, 0x31) },
  retentionSeconds: 86_400,
}, { now: () => now, randomBytes: (size) => Buffer.alloc(size, 0x42) });

function harness(handler: (text: string, values: unknown[]) => { rows?: unknown[]; rowCount?: number }) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      const normalized = text.replace(/\s+/g, " ").trim();
      calls.push({ text: normalized, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(normalized) || normalized.startsWith("SELECT pg_advisory_xact_lock")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0, ...handler(normalized, values) };
    },
    release: vi.fn(),
  };
  return {
    calls,
    pool: { query: client.query, connect: async () => client },
  };
}

function storedResponse() {
  const idempotencyKeyHash = hashPublicationIdempotencyKey("publication-command-1");
  const requestFingerprint = publicationRequestFingerprint("unlisted");
  const encrypted = cipher.encrypt({ musicUserId: 41, idempotencyKeyHash, requestFingerprint }, {
    version: "music-publication/v1",
    publication: { mode: "unlisted", publicSlug: "owner-public-slug" },
    capability,
  });
  return {
    music_user_id: 41,
    idempotency_key_hash: idempotencyKeyHash,
    request_fingerprint: requestFingerprint,
    request_mode: "unlisted",
    operation_state: "completed",
    expires_at: new Date(now + 86_400_000),
    response_key_id: encrypted.responseKeyId,
    response_nonce: encrypted.responseNonce,
    response_ciphertext: encrypted.responseCiphertext,
    response_tag: encrypted.responseTag,
  };
}

describe("durable publication operation repository", () => {
  it("atomically mutates publication and persists only an encrypted exact response", async () => {
    const db = harness((text) => text.includes("FROM music_publication_operations")
      ? { rows: [] }
      : text.startsWith("UPDATE users")
        ? { rows: [{ guest_url: "owner-public-slug" }], rowCount: 1 }
        : { rows: [], rowCount: text.startsWith("INSERT INTO music_publication_operations") ? 1 : 0 });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, {
      now: () => now,
      createCapability: () => capability,
    });
    await expect(repository.execute(41, "publication-command-1", "unlisted")).resolves.toEqual({
      status: "completed", replayed: false,
      response: {
        version: "music-publication/v1",
        publication: { mode: "unlisted", publicSlug: "owner-public-slug" },
        capability,
      },
    });
    expect(db.calls.map(({ text }) => text)).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
    expect(db.calls.filter(({ text }) => text.startsWith("UPDATE users"))).toHaveLength(1);
    expect(db.calls.filter(({ text }) => text.startsWith("INSERT INTO music_publication_operations"))).toHaveLength(1);
    const serialized = JSON.stringify(db.calls);
    expect(serialized).not.toContain("publication-command-1");
    expect(serialized).not.toContain(capability);
    expect(serialized).toContain(hashPublicationIdempotencyKey("publication-command-1"));
  });

  it("replays the exact prior response across a new repository instance without another owner write", async () => {
    const stored = storedResponse();
    const db = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [stored] } : { rows: [] });
    const restarted = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now + 1_000 });
    await expect(restarted.execute(41, "publication-command-1", "unlisted")).resolves.toEqual({
      status: "completed", replayed: true,
      response: { version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "owner-public-slug" }, capability },
    });
    expect(db.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);
    expect(db.calls.some(({ text }) => text.startsWith("INSERT INTO music_publication_operations"))).toBe(false);
  });

  it("returns conflict before mutation when the same hashed key has another fingerprint", async () => {
    const stored = { ...storedResponse(), request_fingerprint: publicationRequestFingerprint("private"), request_mode: "private" };
    const db = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [stored] } : { rows: [] });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
    await expect(repository.execute(41, "publication-command-1", "unlisted")).resolves.toEqual({ status: "conflict" });
    expect(db.calls.some(({ text }) => /UPDATE users|INSERT INTO music_publication_operations/.test(text))).toBe(false);
  });

  it("shreds an expired response, retains the tombstone, and never rotates publication", async () => {
    const stored = { ...storedResponse(), expires_at: new Date(now - 1) };
    const db = harness((text) => text.includes("FROM music_publication_operations")
      ? { rows: [stored] }
      : { rows: [], rowCount: text.startsWith("UPDATE music_publication_operations") ? 1 : 0 });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
    await expect(repository.execute(41, "publication-command-1", "unlisted")).resolves.toEqual({ status: "expired" });
    const shred = db.calls.find(({ text }) => text.startsWith("UPDATE music_publication_operations"));
    expect(shred?.text).toMatch(/operation_state='replay_expired'.*response_ciphertext=NULL/i);
    expect(db.calls.some(({ text }) => text.startsWith("DELETE"))).toBe(false);
    expect(db.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);
  });

  it.each(["publication", "operation"] as const)("rolls back an injected failure after the %s write", async (phase) => {
    const db = harness((text) => text.includes("FROM music_publication_operations")
      ? { rows: [] }
      : text.startsWith("UPDATE users")
        ? { rows: [{ guest_url: "owner-public-slug" }], rowCount: 1 }
        : { rows: [], rowCount: 1 });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, {
      now: () => now,
      createCapability: () => capability,
      afterWrite: (completedPhase) => { if (completedPhase === phase) throw new Error(`injected ${phase} failure`); },
    });
    await expect(repository.execute(41, "publication-command-1", "unlisted")).rejects.toThrow(`injected ${phase} failure`);
    expect(db.calls.map(({ text }) => text)).toContain("ROLLBACK");
    expect(db.calls.map(({ text }) => text)).not.toContain("COMMIT");
  });

  it("fails readiness when an unexpired row needs an unavailable or prematurely expiring previous key", async () => {
    const db = harness(() => ({ rows: [{ response_key_id: "missing-key", max_expires_at: new Date(now + 60_000) }] }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
    await expect(repository.verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);
  });

  it("shreds a bounded batch of expired response ciphertext without deleting tombstones", async () => {
    const db = harness((text) => ({ rows: [], rowCount: text.startsWith("WITH expired") ? 3 : 0 }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
    await expect(repository.shredExpiredResponses(3)).resolves.toBe(3);
    expect(db.calls.at(-1)?.text).toMatch(/LIMIT \$2[\s\S]*operation_state='replay_expired'/i);
    expect(db.calls.at(-1)?.values).toEqual([new Date(now), 3]);
    expect(db.calls.at(-1)?.text).not.toMatch(/DELETE/i);
  });

  it("uses default dependencies for a private command and returns not-found without operation history", async () => {
    const missing = harness((text) => text.includes("FROM music_publication_operations")
      ? { rows: [] }
      : text.startsWith("UPDATE users") ? { rows: [], rowCount: 0 } : { rows: [] });
    const missingRepository = new MusicPublicationOperationRepository(missing.pool as never, cipher);
    await expect(missingRepository.execute(41, "publication-command-missing", "private"))
      .resolves.toEqual({ status: "not_found" });
    expect(missing.calls.some(({ text }) => text.startsWith("INSERT INTO music_publication_operations"))).toBe(false);

    const found = harness((text) => text.includes("FROM music_publication_operations")
      ? { rows: [] }
      : text.startsWith("UPDATE users") ? { rows: [{ guest_url: "private-owner" }], rowCount: 1 }
        : { rows: [], rowCount: 1 });
    const foundRepository = new MusicPublicationOperationRepository(found.pool as never, cipher);
    await expect(foundRepository.execute(41, "publication-command-private", "private")).resolves.toMatchObject({
      status: "completed",
      replayed: false,
      response: { publication: { mode: "private", publicSlug: "private-owner" } },
    });
    const ownerWrite = found.calls.find(({ text }) => text.startsWith("UPDATE users"));
    expect(ownerWrite?.values[2]).toBeNull();
  });

  it("rolls back a malformed generated capability before any owner write", async () => {
    const db = harness(() => ({ rows: [] }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, {
      now: () => now,
      createCapability: () => "short",
    });
    await expect(repository.execute(41, "publication-command-invalid-capability", "unlisted"))
      .rejects.toThrow(/capability generation failed/i);
    expect(db.calls.map(({ text }) => text)).toContain("ROLLBACK");
    expect(db.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);
  });

  it("returns an existing expired tombstone without another shred and rejects incomplete live authority", async () => {
    const tombstone = { ...storedResponse(), operation_state: "replay_expired" as const };
    const tombstoneDb = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [tombstone] } : { rows: [] });
    const tombstoneRepository = new MusicPublicationOperationRepository(tombstoneDb.pool as never, cipher, { now: () => now });
    await expect(tombstoneRepository.execute(41, "publication-command-1", "unlisted"))
      .resolves.toEqual({ status: "expired" });
    expect(tombstoneDb.calls.filter(({ text }) => text.startsWith("UPDATE music_publication_operations"))).toHaveLength(0);

    for (const field of ["response_key_id", "response_nonce", "response_ciphertext", "response_tag"] as const) {
      const incomplete = { ...storedResponse(), [field]: null };
      const db = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [incomplete] } : { rows: [] });
      const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
      await expect(repository.execute(41, "publication-command-1", "unlisted"))
        .rejects.toThrow(/response authority is incomplete/i);
      expect(db.calls.map(({ text }) => text)).toContain("ROLLBACK");
    }
  });

  it("accepts empty/current-key readiness and validates shred limits and empty row counts", async () => {
    for (const rows of [[], [{ response_key_id: "publication-current-v1", max_expires_at: new Date(now + 60_000) }]]) {
      const db = harness(() => ({ rows }));
      const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
      await expect(repository.verifyReplayReadiness()).resolves.toBeUndefined();
    }
    const db = harness(() => ({ rows: [] }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher, { now: () => now });
    for (const limit of [1.5, 0, 1_001]) {
      await expect(repository.shredExpiredResponses(limit)).rejects.toThrow(/shred limit is invalid/i);
    }
    const withoutRowCount = new MusicPublicationOperationRepository({
      query: async () => ({ rows: [] }),
      connect: async () => { throw new Error("connect is not used by shredding"); },
    } as never, cipher, { now: () => now });
    await expect(withoutRowCount.shredExpiredResponses()).resolves.toBe(0);
  });
});
