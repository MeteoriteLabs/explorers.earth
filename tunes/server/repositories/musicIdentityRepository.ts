import type { Pool } from "pg";

export interface MusicIdentityProjection {
  id: number;
  strapiUserDocumentId: string;
  strapiAccountDocumentId: string;
  identityStatus: "active" | "suspended" | "pending_deletion";
  sessionVersion: number;
}

export class MusicIdentityRepository {
  constructor(private readonly pool: Pick<Pool, "query">) {}

  async findByExternalIdentity(strapiUserDocumentId: string): Promise<MusicIdentityProjection | undefined> {
    const result = await this.pool.query<{
      id: number;
      strapi_user_document_id: string;
      strapi_account_document_id: string;
      identity_status: MusicIdentityProjection["identityStatus"];
      session_version: number;
    }>(`SELECT id,strapi_user_document_id,strapi_account_document_id,identity_status,session_version
       FROM users WHERE strapi_user_document_id=$1`, [strapiUserDocumentId]);
    const row = result.rows[0];
    return row ? {
      id: row.id,
      strapiUserDocumentId: row.strapi_user_document_id,
      strapiAccountDocumentId: row.strapi_account_document_id,
      identityStatus: row.identity_status,
      sessionVersion: row.session_version,
    } : undefined;
  }

  async isTombstoned(strapiUserDocumentId: string): Promise<boolean> {
    const result = await this.pool.query<{ present: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM music_identity_tombstones WHERE strapi_user_document_id=$1) AS present",
      [strapiUserDocumentId],
    );
    return result.rows[0]?.present === true;
  }

  async assertCanCreate(strapiUserDocumentId: string, strapiAccountDocumentId: string): Promise<void> {
    if (await this.isTombstoned(strapiUserDocumentId)) throw new Error("immutable external identity is tombstoned");
    const result = await this.pool.query<{ present: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users
       WHERE strapi_user_document_id=$1 OR strapi_account_document_id=$2) AS present`,
      [strapiUserDocumentId, strapiAccountDocumentId],
    );
    if (result.rows[0]?.present) throw new Error("immutable external identity already exists");
  }
}
