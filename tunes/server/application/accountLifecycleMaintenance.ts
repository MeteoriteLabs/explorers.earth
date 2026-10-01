import type { Pool } from "pg";
import type { ObjectStorage } from "../services/objectStorage";

export async function runAccountLifecycleMaintenance(pool: Pool, storage: ObjectStorage, batchSize = 25): Promise<number> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error("Invalid maintenance batch size");
  await pool.query("SELECT purge_expired_account_recovery_proofs($1)", [batchSize]);
  await pool.query(`WITH due AS (SELECT id FROM application_command_receipts
    WHERE status='completed' AND replay_until<=clock_timestamp() ORDER BY replay_until,id LIMIT $1)
    UPDATE application_command_receipts r SET status='retired',response=NULL FROM due WHERE r.id=due.id`, [batchSize]);
  await pool.query(`WITH due AS (SELECT id FROM deletion_feedback WHERE reason IS NOT NULL
    AND created_at<=clock_timestamp()-interval '30 days' ORDER BY created_at,id LIMIT $1)
    UPDATE deletion_feedback f SET reason=NULL,user_id=NULL,purged_at=clock_timestamp()
    FROM due WHERE f.id=due.id`, [batchSize]);

  const claimed = await pool.query<{ id: string; account_id: string }>(`WITH due AS (
    SELECT o.id FROM account_lifecycle_operations o JOIN creator_accounts a ON a.id=o.account_id
    WHERE o.kind='delete' AND a.status='pending_deletion'
      AND a.deletion_requested_at<=clock_timestamp()
      AND (o.state='pending' OR (o.state='running' AND o.updated_at<clock_timestamp()-interval '10 minutes'))
    ORDER BY o.created_at,o.id LIMIT $1 FOR UPDATE OF o,a SKIP LOCKED)
    UPDATE account_lifecycle_operations o SET state='running',updated_at=clock_timestamp(),failure_code=NULL
    FROM due WHERE o.id=due.id RETURNING o.id,o.account_id`, [batchSize]);
  for (const operation of claimed.rows) {
    try {
      const mapping = await pool.query("SELECT 1 FROM account_music_identity WHERE account_id=$1", [operation.account_id]);
      if (mapping.rowCount) throw new Error("MUSIC_BOUNDARY_PENDING");
      const objects = await pool.query<{ media_id: string; variant: string; object_key: string; storage_environment: string }>(
        `SELECT mo.media_id,mo.variant,mo.object_key,mo.storage_environment FROM media_objects mo
         JOIN media_assets ma ON ma.id=mo.media_id WHERE ma.account_id=$1 AND mo.deleted_at IS NULL
         ORDER BY mo.media_id,mo.variant`, [operation.account_id]);
      for (const object of objects.rows) {
        if (object.storage_environment !== storage.environment) throw new Error("STORAGE_ENVIRONMENT_MISMATCH");
        // Delete all versions, including a crash-orphaned latest version, before marking the object absent.
        await storage.delete(object.object_key);
        await pool.query(`UPDATE media_objects SET deleted_at=clock_timestamp() WHERE media_id=$1 AND variant=$2`,
          [object.media_id, object.variant]);
      }
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const account = await db.query<{ status: string; user_id: string }>(`SELECT a.status,m.user_id FROM creator_accounts a
          JOIN account_memberships m ON m.account_id=a.id AND m.role='owner'
          WHERE a.id=$1 FOR UPDATE OF a`, [operation.account_id]);
        const active = await db.query("SELECT 1 FROM account_lifecycle_operations WHERE id=$1 AND state='running' FOR UPDATE", [operation.id]);
        const mappingNow = await db.query("SELECT 1 FROM account_music_identity WHERE account_id=$1", [operation.account_id]);
        if (!account.rows[0] || account.rows[0].status !== "pending_deletion" || !active.rowCount || mappingNow.rowCount)
          throw new Error("LIFECYCLE_CHANGED");
        const missing = await db.query(`SELECT 1 FROM media_objects mo JOIN media_assets ma ON ma.id=mo.media_id
          WHERE ma.account_id=$1 AND mo.deleted_at IS NULL LIMIT 1`, [operation.account_id]);
        if (missing.rowCount) throw new Error("MEDIA_CLEANUP_INCOMPLETE");
        await db.query("DELETE FROM profile_media WHERE account_id=$1", [operation.account_id]);
        await db.query("DELETE FROM profile_feed_items WHERE account_id=$1", [operation.account_id]);
        await db.query("DELETE FROM media_objects WHERE media_id IN (SELECT id FROM media_assets WHERE account_id=$1)", [operation.account_id]);
        await db.query("DELETE FROM media_assets WHERE account_id=$1", [operation.account_id]);
        await db.query("DELETE FROM account_category_settings WHERE account_id=$1", [operation.account_id]);
        await db.query("DELETE FROM account_presentation WHERE account_id=$1", [operation.account_id]);
        await db.query(`UPDATE account_recovery_proofs SET revoked_at=clock_timestamp()
          WHERE account_id=$1 AND revoked_at IS NULL`, [operation.account_id]);
        await db.query(`UPDATE deletion_feedback SET reason=NULL,user_id=NULL,purged_at=clock_timestamp()
          WHERE account_id=$1 AND reason IS NOT NULL`, [operation.account_id]);
        await db.query("UPDATE application_command_receipts SET status='retired',response=NULL WHERE account_id=$1 AND status='completed'", [operation.account_id]);
        await db.query("DELETE FROM auth_session WHERE user_id=$1", [account.rows[0].user_id]);
        await db.query(`UPDATE auth_account SET access_token=NULL,refresh_token=NULL,id_token=NULL,password=NULL,
          updated_at=clock_timestamp() WHERE user_id=$1`, [account.rows[0].user_id]);
        await db.query(`UPDATE auth_user SET name='Deleted account',email=$2,image=NULL,updated_at=clock_timestamp()
          WHERE id=$1`, [account.rows[0].user_id, `deleted+${operation.account_id}@invalid.local`]);
        await db.query(`UPDATE creator_accounts SET handle=NULL,display_name=NULL,account_type=NULL,
          onboarding_status='incomplete',public_profile=false,auto_pinning=false,mobile_number=NULL,
          mobile_number_visible=false,bio_plain=NULL,bio_rich=NULL,primary_address=NULL,
          additional_addresses='[]'::jsonb,public_address=NULL,profile_place_details=NULL,
          status='deleted',deleted_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1
          WHERE id=$1`, [operation.account_id]);
        await db.query(`UPDATE account_lifecycle_operations SET state='succeeded',completed_at=clock_timestamp(),
          updated_at=clock_timestamp(),failure_code=NULL WHERE id=$1`, [operation.id]);
        await db.query("COMMIT");
      } catch (error) { await db.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { db.release(); }
    } catch (error) {
      const code = error instanceof Error && error.message === "MUSIC_BOUNDARY_PENDING"
        ? "MUSIC_BOUNDARY_PENDING" : "FINALIZATION_RETRY";
      await pool.query(`UPDATE account_lifecycle_operations SET state=CASE WHEN $2='MUSIC_BOUNDARY_PENDING'
        THEN 'pending' ELSE 'running' END,failure_code=$2,
        updated_at=clock_timestamp() WHERE id=$1 AND state='running'`, [operation.id, code]);
    }
  }
  return claimed.rowCount ?? 0;
}
