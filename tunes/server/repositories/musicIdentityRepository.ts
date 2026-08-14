import type { Pool, PoolClient } from "pg";
import { MusicIdentityError } from "../../shared/musicError";

export interface MusicIdentityProjection {
  id: number;
  strapiUserDocumentId: string;
  strapiAccountDocumentId: string;
  identityStatus: "active" | "suspended" | "pending_deletion";
  sessionVersion: number;
}

export interface CreateMusicIdentityInput {
  username: string;
  password: string;
  guestUrl: string;
  venueName: string;
  strapiUserDocumentId: string;
  strapiAccountDocumentId: string;
  guestCapabilityHash: string;
  operationId: string;
}

export interface EnsureMusicIdentityInput {
  userDocumentId: string;
  accountDocumentId: string;
  username: string;
  email: string;
  provider: "local" | "google";
  accountName: string;
  accountType: string;
  accountMobile: string;
  internalUsername: string;
  password: string;
  guestUrl: string;
  guestCapabilityHash: string;
  operationId: string;
  requestId: string;
}

export interface TombstoneMusicIdentityInput {
  strapiUserDocumentId: string;
  strapiAccountDocumentId: string;
  reason: string;
  operationId: string;
}

export interface TransitionMusicIdentityInput {
  strapiUserDocumentId: string;
  operationId: string;
  kind: "suspend" | "reactivate" | "request_deletion" | "cancel_deletion";
  targetStatus: MusicIdentityProjection["identityStatus"];
}

export interface RevokeMusicCredentialsInput {
  operationId: string;
  musicUserId: number;
  expectedSessionVersion: number;
  reason: "logout_all" | "entitlement_security_revocation" | "credential_compromise";
}

export interface MusicCredentialRevocationResult extends RevokeMusicCredentialsInput {
  strapiUserDocumentId: string;
  strapiAccountDocumentId: string;
  resultSessionVersion: number;
  operationState: "completed";
}

export class StaleLifecycleOperationError extends Error {
  readonly code = "STALE_LIFECYCLE_OPERATION" as const;

  constructor(operationId: string) {
    super(`lifecycle operation is stale: ${operationId}`);
    this.name = "StaleLifecycleOperationError";
  }
}

type TransactionPool = Pick<Pool, "query" | "connect">;

function projection(row: {
  id: number;
  strapi_user_document_id: string;
  strapi_account_document_id: string;
  identity_status: MusicIdentityProjection["identityStatus"];
  session_version: number;
}): MusicIdentityProjection {
  return {
    id: row.id,
    strapiUserDocumentId: row.strapi_user_document_id,
    strapiAccountDocumentId: row.strapi_account_document_id,
    identityStatus: row.identity_status,
    sessionVersion: row.session_version,
  };
}

async function lockIdentity(client: Pick<PoolClient, "query">, userDocumentId: string, accountDocumentId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`music:user:${userDocumentId}`]);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`music:account:${accountDocumentId}`]);
}

function isCredentialRevocationOperationIdCollision(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505"
    && databaseError.constraint === "music_credential_revocation_operations_pkey";
}

function validateEnsureInput(input: EnsureMusicIdentityInput): void {
  const required = [
    input.userDocumentId,input.accountDocumentId,input.username,input.email,input.accountName,input.accountType,
    input.accountMobile,input.internalUsername,input.password,input.guestUrl,input.operationId,input.requestId,
  ];
  if (required.some((value) => !value || value.length > 512)
      || !["local", "google"].includes(input.provider)
      || !/^[a-f0-9]{64}$/.test(input.guestCapabilityHash)) {
    throw new MusicIdentityError("REQUEST_INVALID", 400, "Music identity input is invalid.", "none", false);
  }
}

export class MusicIdentityRepository {
  constructor(
    private readonly pool: TransactionPool,
    private readonly hooks: { afterWrite?: () => Promise<void> } = {},
  ) {}

  async ensureIdentity(input: EnsureMusicIdentityInput): Promise<MusicIdentityProjection> {
    validateEnsureInput(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('music.request_id',$1,true)", [input.requestId]);
      await lockIdentity(client, input.userDocumentId, input.accountDocumentId);
      const tombstone = await client.query(`SELECT strapi_user_document_id,strapi_account_document_id
        FROM music_identity_tombstones
        WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2`, [input.userDocumentId, input.accountDocumentId]);
      if (tombstone.rowCount) {
        throw new MusicIdentityError("IDENTITY_TOMBSTONED", 409, "This Music identity was permanently removed.", "contact_support", false, undefined, "tombstone");
      }
      const existing = await client.query<any>(`SELECT id,strapi_user_document_id,strapi_account_document_id,
        identity_status,session_version FROM users
        WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2 FOR UPDATE`, [input.userDocumentId, input.accountDocumentId]);
      const row = existing.rows[0];
      if (row) {
        if (row.strapi_user_document_id === input.userDocumentId
            && row.strapi_account_document_id !== input.accountDocumentId) {
          throw new MusicIdentityError("ACCOUNT_SWITCH_CONFLICT", 409, "The selected Explorer Account cannot be changed automatically.", "contact_support", false, undefined, "account_switch");
        }
        if (row.strapi_user_document_id !== input.userDocumentId
            || row.strapi_account_document_id !== input.accountDocumentId) {
          throw new MusicIdentityError("IDENTITY_CONFLICT", 409, "The Explorer identity conflicts with an existing Music identity.", "contact_support", false, undefined, "immutable_collision");
        }
        if (row.identity_status === "suspended") {
          throw new MusicIdentityError("IDENTITY_SUSPENDED", 403, "This Music identity is suspended.", "contact_support", false, undefined, "suspended");
        }
        if (row.identity_status === "pending_deletion") {
          throw new MusicIdentityError("IDENTITY_PENDING_DELETION", 409, "This Music identity is pending deletion.", "contact_support", false, undefined, "pending_deletion");
        }
        const updated = await client.query<any>(`UPDATE users SET
          strapi_username_snapshot=$2,strapi_email_snapshot=$3,strapi_provider_snapshot=$4,
          strapi_account_name_snapshot=$5,strapi_account_type_snapshot=$6,strapi_account_mobile_snapshot=$7,
          last_identity_sync_at=now(),updated_at=now()
          WHERE id=$1
          RETURNING id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version`, [
          row.id,input.username,input.email,input.provider,input.accountName,input.accountType,input.accountMobile,
        ]);
        await this.hooks.afterWrite?.();
        await client.query("COMMIT");
        return projection(updated.rows[0]);
      }
      const inserted = await client.query<any>(`INSERT INTO users(
        username,password,email,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
        strapi_username_snapshot,strapi_email_snapshot,strapi_provider_snapshot,strapi_account_name_snapshot,
        strapi_account_type_snapshot,strapi_account_mobile_snapshot,last_identity_sync_at,
        guest_capability_hash,lifecycle_operation_id
      ) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$4,$10,$11,now(),$12,$13)
      RETURNING id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version`, [
        input.internalUsername,input.password,input.guestUrl,input.accountName,input.userDocumentId,input.accountDocumentId,
        input.username,input.email,input.provider,input.accountType,input.accountMobile,input.guestCapabilityHash,input.operationId,
      ]);
      await this.hooks.afterWrite?.();
      await client.query("COMMIT");
      return projection(inserted.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof MusicIdentityError) throw error;
      const sqlCode = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (["23505", "23514", "P0001"].includes(sqlCode)) {
        throw new MusicIdentityError("IDENTITY_CONFLICT", 409, "The Explorer identity conflicts with an existing Music identity.", "contact_support", false, undefined, "constraint");
      }
      if (/^08/.test(sqlCode) || ["40001", "40P01", "53300", "53400", "55P03", "57P01", "57P03"].includes(sqlCode)) {
        throw new MusicIdentityError("DATABASE_UNAVAILABLE", 503, "Music identity is temporarily unavailable.", "retry", true, 2);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async findByExternalIdentity(strapiUserDocumentId: string): Promise<MusicIdentityProjection | undefined> {
    const result = await this.pool.query<{
      id: number;
      strapi_user_document_id: string;
      strapi_account_document_id: string;
      identity_status: MusicIdentityProjection["identityStatus"];
      session_version: number;
    }>(`SELECT id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version
       FROM users WHERE strapi_user_document_id=$1`, [strapiUserDocumentId]);
    return result.rows[0] ? projection(result.rows[0]) : undefined;
  }

  async isTombstoned(strapiUserDocumentId: string): Promise<boolean> {
    const result = await this.pool.query<{ present: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM music_identity_tombstones WHERE strapi_user_document_id=$1) AS present",
      [strapiUserDocumentId],
    );
    return result.rows[0]?.present === true;
  }

  async resolveCredentialSubject(strapiUserDocumentId: string): Promise<{
    identity?: MusicIdentityProjection;
    tombstoned: boolean;
  }> {
    const result = await this.pool.query<{
      id: number | null;
      strapi_user_document_id: string | null;
      strapi_account_document_id: string | null;
      identity_status: MusicIdentityProjection["identityStatus"] | null;
      session_version: number | null;
      tombstoned: boolean;
    }>(`SELECT u.id,u.strapi_user_document_id,u.strapi_account_document_id,u.identity_status,u.session_version,
        EXISTS(SELECT 1 FROM music_identity_tombstones t
          WHERE t.strapi_user_document_id=requested.subject
             OR (u.strapi_account_document_id IS NOT NULL
                 AND t.strapi_account_document_id=u.strapi_account_document_id)) AS tombstoned
      FROM (VALUES ($1::text)) AS requested(subject)
      LEFT JOIN users u ON u.strapi_user_document_id=requested.subject`, [strapiUserDocumentId]);
    const row = result.rows[0];
    if (!row?.id || !row.strapi_user_document_id || !row.strapi_account_document_id
        || !row.identity_status || !row.session_version) {
      return { identity: undefined, tombstoned: row?.tombstoned === true };
    }
    return {
      identity: projection({
        id: row.id,
        strapi_user_document_id: row.strapi_user_document_id,
        strapi_account_document_id: row.strapi_account_document_id,
        identity_status: row.identity_status,
        session_version: row.session_version,
      }),
      tombstoned: row.tombstoned === true,
    };
  }

  async revokeAllCredentials(input: RevokeMusicCredentialsInput): Promise<MusicCredentialRevocationResult> {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.operationId)
        || !Number.isSafeInteger(input.musicUserId) || input.musicUserId < 1
        || !Number.isSafeInteger(input.expectedSessionVersion) || input.expectedSessionVersion < 1
        || !["logout_all", "entitlement_security_revocation", "credential_compromise"].includes(input.reason)) {
      throw new MusicIdentityError("REQUEST_INVALID", 400, "Music credential revocation input is invalid.", "none", false);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const readOperation = async () => (await client.query<any>(`SELECT operation_id,music_user_id,
        strapi_user_document_id,strapi_account_document_id,reason,expected_session_version,
        result_session_version,operation_state
        FROM music_credential_revocation_operations WHERE operation_id=$1`, [input.operationId])).rows[0];
      const exactReplay = (operation: any): MusicCredentialRevocationResult => {
        if (operation.music_user_id !== input.musicUserId
            || operation.reason !== input.reason
            || operation.expected_session_version !== input.expectedSessionVersion
            || operation.result_session_version !== input.expectedSessionVersion + 1
            || operation.operation_state !== "completed") {
          throw new MusicIdentityError("IDENTITY_CONFLICT", 409, "The Music credential revocation state conflicts.", "retry", false, undefined, "operation_mismatch");
        }
        return {
          operationId: operation.operation_id,
          musicUserId: operation.music_user_id,
          strapiUserDocumentId: operation.strapi_user_document_id,
          strapiAccountDocumentId: operation.strapi_account_document_id,
          reason: operation.reason,
          expectedSessionVersion: operation.expected_session_version,
          resultSessionVersion: operation.result_session_version,
          operationState: operation.operation_state,
        };
      };

      const prior = await readOperation();
      if (prior) {
        const replay = exactReplay(prior);
        await client.query("COMMIT");
        return replay;
      }

      const result = await client.query<any>(`SELECT id,strapi_user_document_id,
        strapi_account_document_id,identity_status,session_version
        FROM users WHERE id=$1 FOR UPDATE`, [input.musicUserId]);
      const row = result.rows[0];
      const concurrentReplay = await readOperation();
      if (concurrentReplay) {
        const replay = exactReplay(concurrentReplay);
        await client.query("COMMIT");
        return replay;
      }
      if (!row || row.session_version !== input.expectedSessionVersion) {
        throw new MusicIdentityError("IDENTITY_CONFLICT", 409, "The Music credential revocation state conflicts.", "retry", false, undefined, "session_version");
      }

      const operation = await client.query<any>(`INSERT INTO music_credential_revocation_operations(
        operation_id,music_user_id,strapi_user_document_id,strapi_account_document_id,reason,
        expected_session_version,result_session_version,operation_state
      ) VALUES ($1,$2,$3,$4,$5,$6,$6+1,'completed')
      RETURNING operation_id,music_user_id,strapi_user_document_id,strapi_account_document_id,reason,
        expected_session_version,result_session_version,operation_state`, [
        input.operationId,input.musicUserId,row.strapi_user_document_id,row.strapi_account_document_id,
        input.reason,input.expectedSessionVersion,
      ]);
      const updated = await client.query<any>(`UPDATE users SET session_version=session_version+1,updated_at=now()
        WHERE id=$1 AND session_version=$2
        RETURNING session_version`, [
        input.musicUserId,input.expectedSessionVersion,
      ]);
      if (updated.rows[0]?.session_version !== input.expectedSessionVersion + 1) {
        throw new MusicIdentityError("IDENTITY_CONFLICT", 409, "The Music credential revocation state conflicts.", "retry", false, undefined, "session_version");
      }
      await client.query("COMMIT");
      return exactReplay(operation.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isCredentialRevocationOperationIdCollision(error)) {
        throw new MusicIdentityError(
          "IDENTITY_CONFLICT",
          409,
          "The Music credential revocation state conflicts.",
          "retry",
          false,
          undefined,
          "operation_mismatch",
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createIdentity(input: CreateMusicIdentityInput): Promise<MusicIdentityProjection> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockIdentity(client, input.strapiUserDocumentId, input.strapiAccountDocumentId);
      const tombstone = await client.query(`SELECT 1 FROM music_identity_tombstones
        WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2`,
      [input.strapiUserDocumentId, input.strapiAccountDocumentId]);
      if (tombstone.rowCount) throw new Error("immutable external identity is tombstoned");
      const existing = await client.query<any>(`SELECT id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version,lifecycle_operation_id
        FROM users WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2 FOR UPDATE`,
      [input.strapiUserDocumentId, input.strapiAccountDocumentId]);
      if (existing.rows[0]) {
        if (existing.rows[0].strapi_user_document_id === input.strapiUserDocumentId
            && existing.rows[0].strapi_account_document_id === input.strapiAccountDocumentId
            && existing.rows[0].lifecycle_operation_id === input.operationId) {
          await client.query("COMMIT");
          return projection(existing.rows[0]);
        }
        throw new Error("immutable external identity already exists");
      }
      const inserted = await client.query<any>(`INSERT INTO users
        (username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
         guest_capability_hash,lifecycle_operation_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version`, [
        input.username, input.password, input.guestUrl, input.venueName,
        input.strapiUserDocumentId, input.strapiAccountDocumentId,
        input.guestCapabilityHash, input.operationId,
      ]);
      await client.query("COMMIT");
      return projection(inserted.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async tombstoneIdentity(input: TombstoneMusicIdentityInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existingTombstone = await client.query<any>(`SELECT strapi_user_document_id,strapi_account_document_id,lifecycle_operation_id
        FROM music_identity_tombstones WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2`,
      [input.strapiUserDocumentId, input.strapiAccountDocumentId]);
      if (existingTombstone.rows[0]) {
        const row = existingTombstone.rows[0];
        if (row.strapi_user_document_id !== input.strapiUserDocumentId
            || row.strapi_account_document_id !== input.strapiAccountDocumentId
            || row.lifecycle_operation_id !== input.operationId) throw new Error("lifecycle operation mismatch");
        await client.query("COMMIT");
        return;
      }
      const live = await client.query<any>(`SELECT id,strapi_user_document_id,strapi_account_document_id FROM users
        WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2`,
      [input.strapiUserDocumentId, input.strapiAccountDocumentId]);
      if (live.rows[0] && (live.rows[0].strapi_user_document_id !== input.strapiUserDocumentId
          || live.rows[0].strapi_account_document_id !== input.strapiAccountDocumentId)) {
        throw new Error("immutable external identity mismatch");
      }
      if (live.rows[0]) {
        await client.query("SELECT finalize_music_identity_deletion($1::integer,$2::text,$3::text)", [
          live.rows[0].id,input.operationId,input.reason,
        ]);
      }
      if (!live.rows[0]) {
        await client.query(`INSERT INTO music_identity_tombstones
          (strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id)
          VALUES ($1,$2,$3,$4)`, [
          input.strapiUserDocumentId, input.strapiAccountDocumentId, input.reason, input.operationId,
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async transitionIdentity(input: TransitionMusicIdentityInput): Promise<MusicIdentityProjection> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const identity = await client.query<any>(`SELECT id,strapi_user_document_id,strapi_account_document_id,
        identity_status,session_version,lifecycle_operation_id FROM users WHERE strapi_user_document_id=$1`,
      [input.strapiUserDocumentId]);
      if (!identity.rows[0]) throw new Error("immutable external identity not found");
      const row = identity.rows[0];
      await lockIdentity(client, row.strapi_user_document_id, row.strapi_account_document_id);
      const locked = (await client.query<any>(`SELECT id,strapi_user_document_id,strapi_account_document_id,
        identity_status,session_version,lifecycle_operation_id FROM users WHERE id=$1 FOR UPDATE`, [row.id])).rows[0];
      if (!locked) throw new Error("immutable external identity not found");
      const operationKind = input.kind === "request_deletion" ? "delete" : input.kind;
      const operation = await client.query<any>(`SELECT operation_id,strapi_user_document_id,strapi_account_document_id,
        music_user_id,operation_kind,requested_identity_status,operation_state,result_session_version,operation_phase
        FROM music_identity_lifecycle_operations WHERE operation_id=$1`, [input.operationId]);
      if (operation.rows[0]) {
        const prior = operation.rows[0];
        if (prior.strapi_user_document_id !== input.strapiUserDocumentId
            || prior.strapi_account_document_id !== locked.strapi_account_document_id
            || prior.music_user_id !== locked.id
            || prior.operation_kind !== operationKind
            || prior.requested_identity_status !== input.targetStatus) throw new Error("lifecycle operation mismatch");
        if (prior.operation_state !== "completed" || !prior.result_session_version) throw new Error("lifecycle operation is incomplete");
        if (locked.lifecycle_operation_id !== input.operationId
            || locked.identity_status !== input.targetStatus
            || locked.session_version !== prior.result_session_version) {
          throw new StaleLifecycleOperationError(input.operationId);
        }
        await client.query("COMMIT");
        return {
          id: locked.id,
          strapiUserDocumentId: input.strapiUserDocumentId,
          strapiAccountDocumentId: locked.strapi_account_document_id,
          identityStatus: input.targetStatus,
          sessionVersion: prior.result_session_version,
        };
      }
      const valid = (locked.identity_status === "active" && input.targetStatus === "suspended" && input.kind === "suspend")
        || (locked.identity_status === "suspended" && input.targetStatus === "active" && input.kind === "reactivate")
        || (["active", "suspended"].includes(locked.identity_status) && input.targetStatus === "pending_deletion" && input.kind === "request_deletion")
        || (locked.identity_status === "pending_deletion" && input.targetStatus === "suspended" && input.kind === "cancel_deletion");
      if (!valid) throw new Error(`invalid identity lifecycle transition: ${locked.identity_status} -> ${input.targetStatus}`);
      const invalidatesSession = (locked.identity_status === "active" && input.targetStatus === "suspended")
        || input.targetStatus === "pending_deletion";
      const resultSessionVersion = locked.session_version + (invalidatesSession ? 1 : 0);
      await client.query(`INSERT INTO music_identity_lifecycle_operations(
        operation_id,strapi_user_document_id,strapi_account_document_id,music_user_id,operation_kind,requested_identity_status,operation_phase
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
        input.operationId,input.strapiUserDocumentId,locked.strapi_account_document_id,locked.id,operationKind,input.targetStatus,
        input.kind === "request_deletion" ? "prepared" : "single",
      ]);
      await client.query(`UPDATE music_identity_lifecycle_operations
        SET operation_state='running',attempt_count=attempt_count+1 WHERE operation_id=$1`, [input.operationId]);
      await client.query(`UPDATE music_identity_lifecycle_operations
        SET operation_state='completed',result_session_version=$2 WHERE operation_id=$1`, [input.operationId,resultSessionVersion]);
      const updated = await client.query<any>(`UPDATE users SET identity_status=$2,session_version=$3,
        lifecycle_operation_id=$4,lifecycle_state='completed',lifecycle_attempt_count=lifecycle_attempt_count+1,
        lifecycle_last_attempt_at=now(),lifecycle_error_code=NULL
        WHERE id=$1 RETURNING id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version`, [
        locked.id,input.targetStatus,resultSessionVersion,input.operationId,
      ]);
      await client.query("COMMIT");
      return projection(updated.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
