import type { Pool } from "pg";

export type MediaRecord = { id: string; account_id: string; purpose: string; status: string; mime_type: string;
  byte_size: string; alternative_text: string | null; caption: string | null; object_key: string;
  storage_environment: string; content_sha256: Buffer };

export class MediaRepository {
  constructor(private readonly db: Pool) {}

  async create(input: { id: string; accountId: string; purpose: string; mimeType: string; filename: string;
    bytes: Buffer; hash: Buffer; key: string }): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO media_assets(id,account_id,purpose,status,mime_type,byte_size,content_sha256,original_filename,ready_at)
        VALUES ($1,$2,$3,'ready',$4,$5,$6,$7,now())`, [input.id, input.accountId, input.purpose,
        input.mimeType, input.bytes.length, input.hash, input.filename]);
      await client.query(`INSERT INTO media_objects(media_id,variant,storage_environment,object_key,mime_type,byte_size,content_sha256)
        VALUES ($1,'original','local',$2,$3,$4,$5)`, [input.id, input.key, input.mimeType, input.bytes.length, input.hash]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async find(id: string): Promise<MediaRecord | undefined> {
    const result = await this.db.query<MediaRecord>(`SELECT m.id,m.account_id,m.purpose,m.status,m.mime_type,m.byte_size,
      m.alternative_text,m.caption,o.object_key,o.storage_environment,o.content_sha256
      FROM media_assets m JOIN media_objects o ON o.media_id=m.id AND o.variant='original' WHERE m.id=$1`, [id]);
    return result.rows[0];
  }

  async isPublicAttachment(id: string): Promise<boolean> {
    const result = await this.db.query<{ visible: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM profile_media pm JOIN creator_accounts a ON a.id=pm.account_id
      WHERE pm.media_id=$1 AND pm.slot IN ('profile','background','wallpaper')
        AND a.status='active' AND a.onboarding_status='complete' AND a.public_profile=true
      UNION ALL
      SELECT 1 FROM profile_feed_items pf JOIN creator_accounts a ON a.id=pf.account_id
      WHERE pf.media_id=$1 AND a.status='active' AND a.onboarding_status='complete' AND a.public_profile=true
    ) AS visible`, [id]);
    return result.rows[0]?.visible === true;
  }

  async markDelete(id: string, accountId: string): Promise<MediaRecord | undefined> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const refs = await client.query<{ count: string }>(`SELECT ((SELECT count(*) FROM profile_media WHERE media_id=$1 AND account_id=$2)
        + (SELECT count(*) FROM profile_feed_items WHERE media_id=$1 AND account_id=$2))::text AS count`, [id, accountId]);
      if (Number(refs.rows[0]?.count) > 0) { await client.query("ROLLBACK"); return undefined; }
      const changed = await client.query("UPDATE media_assets SET status='pending_delete',delete_requested_at=now(),updated_at=now() WHERE id=$1 AND account_id=$2 AND status='ready' RETURNING id", [id, accountId]);
      if (!changed.rows[0]) { await client.query("ROLLBACK"); return undefined; }
      const object = await client.query<MediaRecord>(`SELECT m.id,m.account_id,m.purpose,m.status,m.mime_type,m.byte_size,
        m.alternative_text,m.caption,o.object_key,o.storage_environment,o.content_sha256 FROM media_assets m
        JOIN media_objects o ON o.media_id=m.id AND o.variant='original' WHERE m.id=$1`, [id]);
      await client.query("COMMIT");
      return object.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async finalizeDelete(id: string): Promise<void> {
    await this.db.query(`UPDATE media_assets SET status='deleted',deleted_at=now(),updated_at=now() WHERE id=$1 AND status='pending_delete'`, [id]);
    await this.db.query("UPDATE media_objects SET deleted_at=now() WHERE media_id=$1", [id]);
  }

  async pendingDeletes(accountId: string, limit = 20): Promise<Array<{ id: string; object_key: string }>> {
    const result = await this.db.query<{ id: string; object_key: string }>(`SELECT m.id,o.object_key
      FROM media_assets m JOIN media_objects o ON o.media_id=m.id AND o.variant='original'
      WHERE m.account_id=$1 AND m.status='pending_delete' AND o.storage_environment='local'
      ORDER BY m.delete_requested_at,m.id LIMIT $2`, [accountId, limit]);
    return result.rows;
  }
}
