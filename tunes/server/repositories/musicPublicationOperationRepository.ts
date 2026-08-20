import type { Pool, PoolClient } from "pg";
import { createGuestCapability, hashGuestCapability } from "../policies/musicSurfacePolicy";
import {
  MUSIC_PUBLICATION_RESPONSE_RETENTION_SECONDS,
  MUSIC_PUBLICATION_RESPONSE_VERSION,
  MusicPublicationResponseCipher,
  hashPublicationIdempotencyKey,
  publicationRequestFingerprint,
  type MusicPublicationCommandResponse,
  type MusicPublicationMode,
} from "../services/musicPublicationResponseCrypto";

type QueryPool = Pick<Pool, "query" | "connect">;
const PUBLICATION_LOCK = 0x4d50;

export type MusicPublicationCommandResult =
  | { status: "completed"; replayed: boolean; response: MusicPublicationCommandResponse }
  | { status: "conflict" | "expired" | "not_found" };

export interface MusicPublicationOperationDependencies {
  now?: () => number;
  createCapability?: () => string;
  afterWrite?: (phase: "publication" | "operation") => void | Promise<void>;
}

interface StoredPublicationOperation {
  request_fingerprint: string;
  request_mode: MusicPublicationMode;
  operation_state: "completed" | "replay_expired";
  expires_at: Date;
  response_key_id: string | null;
  response_nonce: Buffer | null;
  response_ciphertext: Buffer | null;
  response_tag: Buffer | null;
}

export class MusicPublicationOperationRepository {
  private readonly now: () => number;
  private readonly createCapability: () => string;

  constructor(
    private readonly pool: QueryPool,
    private readonly cipher: MusicPublicationResponseCipher,
    private readonly dependencies: MusicPublicationOperationDependencies = {},
  ) {
    this.now = dependencies.now ?? Date.now;
    this.createCapability = dependencies.createCapability ?? createGuestCapability;
  }

  async execute(
    musicUserId: number,
    idempotencyKey: string,
    mode: MusicPublicationMode,
  ): Promise<MusicPublicationCommandResult> {
    const idempotencyKeyHash = hashPublicationIdempotencyKey(idempotencyKey);
    const requestFingerprint = publicationRequestFingerprint(mode);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1,$2)", [PUBLICATION_LOCK, musicUserId]);
      const prior = (await client.query<StoredPublicationOperation>(
        `SELECT request_fingerprint,request_mode,operation_state,expires_at,
                response_key_id,response_nonce,response_ciphertext,response_tag
           FROM music_publication_operations
          WHERE music_user_id=$1 AND idempotency_key_hash=$2
          FOR UPDATE`,
        [musicUserId, idempotencyKeyHash],
      )).rows[0];
      if (prior) {
        if (prior.request_fingerprint !== requestFingerprint || prior.request_mode !== mode) {
          await client.query("COMMIT");
          return { status: "conflict" };
        }
        const timestamp = this.now();
        if (prior.operation_state === "replay_expired" || prior.expires_at.getTime() <= timestamp) {
          if (prior.operation_state === "completed") {
            await client.query(
              `UPDATE music_publication_operations
                  SET operation_state='replay_expired',updated_at=$3,shredded_at=$3,
                      response_key_id=NULL,response_nonce=NULL,response_ciphertext=NULL,response_tag=NULL
                WHERE music_user_id=$1 AND idempotency_key_hash=$2 AND operation_state='completed'`,
              [musicUserId, idempotencyKeyHash, new Date(timestamp)],
            );
          }
          await client.query("COMMIT");
          return { status: "expired" };
        }
        if (!prior.response_key_id || !prior.response_nonce || !prior.response_ciphertext || !prior.response_tag) {
          throw new Error("Publication response authority is incomplete.");
        }
        const response = this.cipher.decrypt({ musicUserId, idempotencyKeyHash, requestFingerprint }, {
          responseKeyId: prior.response_key_id,
          responseNonce: prior.response_nonce,
          responseCiphertext: prior.response_ciphertext,
          responseTag: prior.response_tag,
        });
        await client.query("COMMIT");
        return { status: "completed", replayed: true, response };
      }

      const capability = mode === "unlisted" ? this.createCapability() : undefined;
      if (capability && !/^[A-Za-z0-9_-]{43}$/.test(capability)) {
        throw new Error("Publication capability generation failed.");
      }
      const publication = (await client.query<{ guest_url: string }>(
        `UPDATE users
            SET guest_discoverable=($2='public'),
                guest_capability_hash=CASE WHEN $2='unlisted' THEN $3 ELSE guest_capability_hash END,
                guest_capability_rotated_at=CASE WHEN $2='unlisted' THEN $4 ELSE guest_capability_rotated_at END,
                guest_capability_revoked_at=CASE WHEN $2='unlisted' THEN NULL ELSE $4 END
          WHERE id=$1 AND identity_status='active'
          RETURNING guest_url`,
        [musicUserId, mode, capability ? hashGuestCapability(capability) : null, new Date(this.now())],
      )).rows[0];
      if (!publication) {
        await client.query("COMMIT");
        return { status: "not_found" };
      }
      await this.dependencies.afterWrite?.("publication");

      const response: MusicPublicationCommandResponse = {
        version: MUSIC_PUBLICATION_RESPONSE_VERSION,
        publication: { mode, publicSlug: String(publication.guest_url) },
        ...(capability ? { capability } : {}),
      };
      const encrypted = this.cipher.encrypt({ musicUserId, idempotencyKeyHash, requestFingerprint }, response);
      const completedAt = this.now();
      const completedDate = new Date(completedAt);
      const expiresAt = new Date(completedAt + MUSIC_PUBLICATION_RESPONSE_RETENTION_SECONDS * 1_000);
      await client.query(
        `INSERT INTO music_publication_operations(
           music_user_id,idempotency_key_hash,request_fingerprint,request_mode,operation_state,
           created_at,completed_at,expires_at,updated_at,
           response_key_id,response_nonce,response_ciphertext,response_tag
         ) VALUES ($1,$2,$3,$4,'completed',$5,$5,$6,$5,$7,$8,$9,$10)`,
        [
          musicUserId, idempotencyKeyHash, requestFingerprint, mode, completedDate, expiresAt,
          encrypted.responseKeyId, encrypted.responseNonce, encrypted.responseCiphertext, encrypted.responseTag,
        ],
      );
      await this.dependencies.afterWrite?.("operation");
      await client.query("COMMIT");
      return { status: "completed", replayed: false, response };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyReplayReadiness(): Promise<void> {
    const now = new Date(this.now());
    const rows = (await this.pool.query<{ response_key_id: string; max_expires_at: Date }>(
      `SELECT response_key_id,max(expires_at) AS max_expires_at
         FROM music_publication_operations
        WHERE operation_state='completed' AND expires_at>$1
        GROUP BY response_key_id`,
      [now],
    )).rows;
    if (rows.some((row) => !this.cipher.acceptsReplayKey(row.response_key_id, row.max_expires_at.getTime()))) {
      throw new Error("Music publication replay key readiness failed.");
    }
  }

  async shredExpiredResponses(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Publication response shred limit is invalid.");
    }
    const result = await this.pool.query(
      `WITH expired AS (
         SELECT music_user_id,idempotency_key_hash
           FROM music_publication_operations
          WHERE operation_state='completed' AND expires_at<=$1
          ORDER BY expires_at,music_user_id,idempotency_key_hash
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       UPDATE music_publication_operations operation
          SET operation_state='replay_expired',updated_at=$1,shredded_at=$1,
              response_key_id=NULL,response_nonce=NULL,response_ciphertext=NULL,response_tag=NULL
         FROM expired
        WHERE operation.music_user_id=expired.music_user_id
          AND operation.idempotency_key_hash=expired.idempotency_key_hash`,
      [new Date(this.now()), limit],
    );
    return result.rowCount ?? 0;
  }
}
