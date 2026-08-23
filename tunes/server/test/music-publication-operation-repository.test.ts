import { describe, expect, it, vi } from "vitest";
import { MusicPublicationOperationRepository } from "../repositories/musicPublicationOperationRepository";
import {
  MusicPublicationResponseCipher,
  hashPublicationIdempotencyKey,
  publicationRequestFingerprint,
} from "../services/musicPublicationResponseCrypto";

const now = Date.parse("2026-08-21T00:00:00.000Z");
const databaseOperationTime = "2026-08-21 00:00:00.123456+00";
const capability = "C".repeat(43);
const cipher = new MusicPublicationResponseCipher({
  current: { kid: "publication-current-v1", key: Buffer.alloc(32, 0x31) },
  retentionSeconds: 86_400,
}, { now: () => now, randomBytes: (size) => Buffer.alloc(size, 0x42) });

function harness(
  handler: (text: string, values: unknown[]) => { rows?: unknown[]; rowCount?: number },
  operationTime: unknown = databaseOperationTime,
) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      const normalized = text.replace(/\s+/g, " ").trim();
      calls.push({ text: normalized, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(normalized) || normalized.startsWith("SELECT pg_advisory_xact_lock")) {
        return { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith("SELECT transaction_timestamp()::text AS operation_time")) {
        return { rows: [{ operation_time: operationTime }], rowCount: 1 };
      }
      const handled = { rows: [], rowCount: 0, ...handler(normalized, values) };
      if (normalized.includes("AS active_count") && handled.rows.length === 0) {
        return { rows: [{ active_count: 0, retry_after_seconds: 1 }], rowCount: 1 };
      }
      return handled;
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
    response_expired: false,
    replay_deadline_covered: true,
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
    const databaseClock = db.calls.find(({ text }) => text.startsWith("SELECT transaction_timestamp()::text AS operation_time"));
    const ownerWrite = db.calls.find(({ text }) => text.startsWith("UPDATE users"));
    const operationWrite = db.calls.find(({ text }) => text.startsWith("INSERT INTO music_publication_operations"));
    expect(databaseClock).toBeDefined();
    expect(db.calls.indexOf(databaseClock!)).toBeLessThan(db.calls.indexOf(ownerWrite!));
    expect(ownerWrite?.text).toMatch(/guest_capability_(?:rotated|revoked)_at=.*transaction_timestamp\(\)/i);
    expect(ownerWrite?.values).toHaveLength(3);
    expect(operationWrite?.values).toContain(databaseOperationTime);
    const serialized = JSON.stringify(db.calls);
    expect(serialized).not.toContain("publication-command-1");
    expect(serialized).not.toContain(capability);
    expect(serialized).toContain(hashPublicationIdempotencyKey("publication-command-1"));
  });

  it("fails closed before publication mutation when the database transaction clock is unavailable", async () => {
    const db = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [] } : { rows: [] }, null);
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
    await expect(repository.execute(41, "publication-command-clock-unavailable", "public"))
      .rejects.toThrow(/database clock authority is unavailable/i);
    expect(db.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);
    expect(db.calls.map(({ text }) => text)).toContain("ROLLBACK");
  });

  it("replays the exact prior response across a new repository instance without another owner write", async () => {
    const stored = storedResponse();
    const db = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [stored] } : { rows: [] });
    const restarted = new MusicPublicationOperationRepository(db.pool as never, cipher);
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
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
    await expect(repository.execute(41, "publication-command-1", "unlisted")).resolves.toEqual({ status: "conflict" });
    expect(db.calls.some(({ text }) => /UPDATE users|INSERT INTO music_publication_operations/.test(text))).toBe(false);
  });

  it("rate-limits fresh keys at the per-owner replayable-operation quota before publication mutation", async () => {
    const db = harness((text) => {
      if (text.includes("FROM music_publication_operations") && text.includes("idempotency_key_hash=$2")) return { rows: [] };
      if (text.includes("music_lookup_publication_operation_archive")) return { rows: [] };
      if (text.includes("active_count")) return { rows: [{ active_count: 100, retry_after_seconds: 37 }] };
      return { rows: [] };
    });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);

    await expect(repository.execute(41, "fresh-command-at-quota", "public")).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 37,
    });
    expect(db.calls.some(({ text }) => text.includes("music_lookup_publication_operation_archive"))).toBe(true);
    expect(db.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);
    expect(db.calls.some(({ text }) => text.startsWith("INSERT INTO music_publication_operations"))).toBe(false);
    expect(db.calls.map(({ text }) => text)).toContain("COMMIT");
  });

  it("keeps compacted tombstones authoritative for exact expiry and conflicting reuse", async () => {
    const archived = {
      request_fingerprint: publicationRequestFingerprint("unlisted"),
      request_mode: "unlisted",
    };
    const exactDb = harness((text) => text.includes("music_lookup_publication_operation_archive")
      ? { rows: [archived] }
      : { rows: [] });
    await expect(new MusicPublicationOperationRepository(exactDb.pool as never, cipher)
      .execute(41, "publication-command-1", "unlisted")).resolves.toEqual({ status: "expired" });
    expect(exactDb.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);

    const conflictDb = harness((text) => text.includes("music_lookup_publication_operation_archive")
      ? { rows: [{ ...archived, request_fingerprint: publicationRequestFingerprint("private"), request_mode: "private" }] }
      : { rows: [] });
    await expect(new MusicPublicationOperationRepository(conflictDb.pool as never, cipher)
      .execute(41, "publication-command-1", "unlisted")).resolves.toEqual({ status: "conflict" });
    expect(conflictDb.calls.some(({ text }) => text.startsWith("UPDATE users"))).toBe(false);
  });

  it("shreds an expired response, retains the tombstone, and never rotates publication", async () => {
    const stored = { ...storedResponse(), expires_at: new Date(now - 1), response_expired: true };
    const db = harness((text) => text.includes("FROM music_publication_operations")
      ? { rows: [stored] }
      : { rows: [], rowCount: text.startsWith("UPDATE music_publication_operations") ? 1 : 0 });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
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
      createCapability: () => capability,
      afterWrite: (completedPhase) => { if (completedPhase === phase) throw new Error(`injected ${phase} failure`); },
    });
    await expect(repository.execute(41, "publication-command-1", "unlisted")).rejects.toThrow(`injected ${phase} failure`);
    expect(db.calls.map(({ text }) => text)).toContain("ROLLBACK");
    expect(db.calls.map(({ text }) => text)).not.toContain("COMMIT");
  });

  it("fails readiness when an unexpired row needs an unavailable replay key", async () => {
    const db = harness(() => ({ rows: [{ ...storedResponse(), response_key_id: "missing-key" }] }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
    await expect(repository.verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);
  });

  it("proves actual current key material and exact AAD by decrypting a bounded representative row", async () => {
    const stored = storedResponse();
    const db = harness(() => ({ rows: [stored] }));
    const wrongMaterial = new MusicPublicationResponseCipher({
      current: { kid: stored.response_key_id, key: Buffer.alloc(32, 0x77) },
      retentionSeconds: 86_400,
    }, { now: () => now });
    const repository = new MusicPublicationOperationRepository(db.pool as never, wrongMaterial);
    await expect(repository.verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);
    expect(db.calls[0]?.text).toMatch(/DISTINCT ON.*LIMIT 3/i);
  });

  it("fails readiness for representative ciphertext corruption and succeeds when no rows need replay", async () => {
    const stored = storedResponse();
    const corrupt = { ...stored, response_ciphertext: Buffer.from(stored.response_ciphertext) };
    corrupt.response_ciphertext[0] ^= 0xff;
    const corruptDb = harness(() => ({ rows: [corrupt] }));
    await expect(new MusicPublicationOperationRepository(corruptDb.pool as never, cipher)
      .verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);

    const emptyDb = harness(() => ({ rows: [] }));
    await expect(new MusicPublicationOperationRepository(emptyDb.pool as never, cipher)
      .verifyReplayReadiness()).resolves.toBeUndefined();
  });

  it("fails readiness when the bounded query finds more active KIDs than the current/previous contract can represent", async () => {
    const stored = storedResponse();
    const db = harness(() => ({ rows: [
      stored,
      { ...stored, response_key_id: "unexpected-key-two" },
      { ...stored, response_key_id: "unexpected-key-three" },
    ] }));
    await expect(new MusicPublicationOperationRepository(db.pool as never, cipher)
      .verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);
  });

  it("proves previous key material for an unexpired representative row", async () => {
    const previousKey = Buffer.alloc(32, 0x24);
    const oldCipher = new MusicPublicationResponseCipher({
      current: { kid: "publication-previous-v1", key: previousKey }, retentionSeconds: 86_400,
    }, { now: () => now, randomBytes: (size) => Buffer.alloc(size, 0x23) });
    const idempotencyKeyHash = hashPublicationIdempotencyKey("publication-command-previous");
    const requestFingerprint = publicationRequestFingerprint("public");
    const encrypted = oldCipher.encrypt({ musicUserId: 52, idempotencyKeyHash, requestFingerprint }, {
      version: "music-publication/v1", publication: { mode: "public", publicSlug: "previous-owner" },
    });
    const row = {
      music_user_id: 52, idempotency_key_hash: idempotencyKeyHash, request_fingerprint: requestFingerprint,
      request_mode: "public", expires_at: new Date(now + 60_000),
      replay_deadline_covered: true,
      response_key_id: encrypted.responseKeyId, response_nonce: encrypted.responseNonce,
      response_ciphertext: encrypted.responseCiphertext, response_tag: encrypted.responseTag,
    };
    const readyCipher = new MusicPublicationResponseCipher({
      current: { kid: "publication-current-v2", key: Buffer.alloc(32, 0x25) },
      previous: { kid: "publication-previous-v1", key: previousKey, acceptUntil: now + 60_000 },
      retentionSeconds: 86_400,
    }, { now: () => now });
    const db = harness(() => ({ rows: [row] }));
    await expect(new MusicPublicationOperationRepository(db.pool as never, readyCipher)
      .verifyReplayReadiness()).resolves.toBeUndefined();

    const wrongPrevious = new MusicPublicationResponseCipher({
      current: readyCipher.keyring.current,
      previous: { kid: "publication-previous-v1", key: Buffer.alloc(32, 0x26), acceptUntil: now + 60_000 },
      retentionSeconds: 86_400,
    }, { now: () => now });
    await expect(new MusicPublicationOperationRepository(db.pool as never, wrongPrevious)
      .verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);
  });

  it("fails readiness when PostgreSQL says a previous-key row exceeds the deadline below one millisecond", async () => {
    const previousKey = Buffer.alloc(32, 0x24);
    const oldCipher = new MusicPublicationResponseCipher({
      current: { kid: "publication-previous-v1", key: previousKey }, retentionSeconds: 86_400,
    }, { now: () => now, randomBytes: (size) => Buffer.alloc(size, 0x23) });
    const idempotencyKeyHash = hashPublicationIdempotencyKey("publication-command-submillisecond");
    const requestFingerprint = publicationRequestFingerprint("public");
    const encrypted = oldCipher.encrypt({ musicUserId: 53, idempotencyKeyHash, requestFingerprint }, {
      version: "music-publication/v1", publication: { mode: "public", publicSlug: "submillisecond-owner" },
    });
    const deadline = now + 60_000;
    const db = harness(() => ({ rows: [{
      music_user_id: 53,
      idempotency_key_hash: idempotencyKeyHash,
      request_fingerprint: requestFingerprint,
      response_key_id: encrypted.responseKeyId,
      response_nonce: encrypted.responseNonce,
      response_ciphertext: encrypted.responseCiphertext,
      response_tag: encrypted.responseTag,
      expires_at: new Date(deadline),
      replay_deadline_covered: false,
    }] }));
    const readyCipher = new MusicPublicationResponseCipher({
      current: { kid: "publication-current-v2", key: Buffer.alloc(32, 0x25) },
      previous: { kid: "publication-previous-v1", key: previousKey, acceptUntil: deadline },
      retentionSeconds: 86_400,
    }, { now: () => now });

    await expect(new MusicPublicationOperationRepository(db.pool as never, readyCipher)
      .verifyReplayReadiness()).rejects.toThrow(/publication replay key readiness/i);
    expect(db.calls[0]?.text).toMatch(/extract\(epoch FROM expires_at\)\*1000000\)::numeric<=\$3::bigint\*1000/i);
    expect(db.calls[0]?.values).toEqual([
      "publication-current-v2",
      "publication-previous-v1",
      deadline,
    ]);
  });

  it("shreds a bounded batch of expired response ciphertext without deleting tombstones", async () => {
    const db = harness((text) => ({ rows: [], rowCount: text.startsWith("WITH expired") ? 3 : 0 }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
    await expect(repository.shredExpiredResponses(3)).resolves.toBe(3);
    expect(db.calls.at(-1)?.text).toMatch(/LIMIT \$1[\s\S]*operation_state='replay_expired'/i);
    expect(db.calls.at(-1)?.values).toEqual([3]);
    expect(db.calls.at(-1)?.text).not.toMatch(/DELETE/i);
  });

  it("compacts a bounded batch only through the database-owned archive function", async () => {
    const db = harness((text) => text.includes("music_compact_publication_operations")
      ? { rows: [{ compacted_count: 7 }], rowCount: 1 }
      : { rows: [] });
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
    await expect(repository.compactExpiredOperations(7)).resolves.toBe(7);
    expect(db.calls.at(-1)).toMatchObject({ values: [7] });
    expect(db.calls.at(-1)?.text).toMatch(/^SELECT music_compact_publication_operations\(\$1\)::integer AS compacted_count$/i);
    for (const limit of [0, 1.5, 1_001]) {
      await expect(repository.compactExpiredOperations(limit)).rejects.toThrow(/compaction limit is invalid/i);
    }
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
    const tombstoneRepository = new MusicPublicationOperationRepository(tombstoneDb.pool as never, cipher);
    await expect(tombstoneRepository.execute(41, "publication-command-1", "unlisted"))
      .resolves.toEqual({ status: "expired" });
    expect(tombstoneDb.calls.filter(({ text }) => text.startsWith("UPDATE music_publication_operations"))).toHaveLength(0);

    for (const field of ["response_key_id", "response_nonce", "response_ciphertext", "response_tag"] as const) {
      const incomplete = { ...storedResponse(), [field]: null };
      const db = harness((text) => text.includes("FROM music_publication_operations") ? { rows: [incomplete] } : { rows: [] });
      const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
      await expect(repository.execute(41, "publication-command-1", "unlisted"))
        .rejects.toThrow(/response authority is incomplete/i);
      expect(db.calls.map(({ text }) => text)).toContain("ROLLBACK");
    }
  });

  it("validates shred limits and empty row counts", async () => {
    const db = harness(() => ({ rows: [] }));
    const repository = new MusicPublicationOperationRepository(db.pool as never, cipher);
    for (const limit of [1.5, 0, 1_001]) {
      await expect(repository.shredExpiredResponses(limit)).rejects.toThrow(/shred limit is invalid/i);
    }
    const withoutRowCount = new MusicPublicationOperationRepository({
      query: async () => ({ rows: [] }),
      connect: async () => { throw new Error("connect is not used by shredding"); },
    } as never, cipher);
    await expect(withoutRowCount.shredExpiredResponses()).resolves.toBe(0);
  });
});
