import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { Actor } from "./actor";
import { authorizeOperation } from "./authorization";
import type { MediaDto, RequestContext } from "../../shared/explorersContract";
import { MediaRepository } from "../repositories/mediaRepository";
import { LocalObjectStorage, type ObjectStorage } from "../services/objectStorage";

export type MediaUploadInput = { purpose: "profile" | "background" | "feed"; filename: string;
  mimeType: string; length: number; bytes: Buffer; alternativeText?: string | null; caption?: string | null };
export type AuthorizedMediaObject = { key: string; mimeType: string; length: number; bytes: Buffer;
  sha256: string };
export class MediaInputError extends Error {}
export class MediaUnavailable extends Error {}

const limits: Record<MediaUploadInput["purpose"], number> = { profile: 5 * 1024 * 1024,
  background: 5 * 1024 * 1024, feed: 10 * 1024 * 1024 };

function sniff(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP") return "image/webp";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.toString("ascii",0,6))) return "image/gif";
  if (bytes.length >= 12 && bytes.toString("ascii",4,8)==="ftyp") return "video/mp4";
  return undefined;
}

export class MediaService {
  private readonly repo: MediaRepository;
  constructor(private readonly db: Pool, private readonly storage: ObjectStorage = new LocalObjectStorage()) {
    this.repo = new MediaRepository(db);
  }

  /** Bounded retry for metadata retained after a failed object deletion. */
  async retryPendingDeletes(accountId: string): Promise<void> {
    for (const item of await this.repo.pendingDeletes(accountId)) {
      try { await this.storage.delete(item.object_key); await this.repo.finalizeDelete(item.id); }
      catch { /* keep the pending row for the next local cleanup pass */ }
    }
  }

  async createMedia(actor: Actor, input: MediaUploadInput, _context: RequestContext): Promise<MediaDto> {
    await authorizeOperation(this.db, actor, "media:create", actor.accountId);
    await this.retryPendingDeletes(actor.accountId);
    const limit = limits[input.purpose];
    if (!limit || !Buffer.isBuffer(input.bytes) || input.length !== input.bytes.length || input.length < 1 || input.length > limit
      || !/^[\w. -]{1,255}$/.test(input.filename) || sniff(input.bytes) !== input.mimeType
      || (input.purpose !== "feed" && !input.mimeType.startsWith("image/"))) throw new MediaInputError("Invalid media upload");
    const id = randomUUID();
    const key = `local/${actor.accountId}/${id}`;
    const hash = createHash("sha256").update(input.bytes).digest();
    try { await this.storage.put(key, input.bytes); }
    catch { throw new MediaUnavailable("Storage unavailable"); }
    try {
      await this.repo.create({ id, accountId: actor.accountId, purpose: input.purpose, mimeType: input.mimeType,
        filename: input.filename, bytes: input.bytes, hash, key });
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
    return { id, url: `/api/explorers/v1/media/${id}/content`, mimeType: input.mimeType,
      size: input.bytes.length, alternativeText: input.alternativeText ?? null, caption: input.caption ?? null };
  }

  async resolveMediaContent(actor: Actor | null, id: string): Promise<AuthorizedMediaObject> {
    const record = await this.repo.find(id);
    if (!record || record.status !== "ready" || record.storage_environment !== this.storage.environment) throw new MediaUnavailable("Media unavailable");
    const publicAttachment = record.purpose !== "claim-evidence" && await this.repo.isPublicAttachment(id);
    if (!publicAttachment) {
      if (!actor || actor.accountId !== record.account_id) throw new MediaUnavailable("Media unavailable");
      try { await authorizeOperation(this.db, actor, "media:read", record.account_id); }
      catch { throw new MediaUnavailable("Media unavailable"); }
    }
    const bytes = await this.storage.get(record.object_key);
    return { key: record.object_key, mimeType: record.mime_type, length: bytes.length, bytes,
      sha256: record.content_sha256.toString("hex") };
  }

  async deleteMedia(actor: Actor, id: string, _context: RequestContext): Promise<void> {
    await authorizeOperation(this.db, actor, "media:delete", actor.accountId);
    await this.retryPendingDeletes(actor.accountId);
    const record = await this.repo.markDelete(id, actor.accountId);
    if (!record || record.storage_environment !== this.storage.environment) throw new MediaUnavailable("Media unavailable");
    try { await this.storage.delete(record.object_key); await this.repo.finalizeDelete(id); }
    catch { /* pending_delete is retained for the bounded cleanup worker */ }
  }
}

export async function createMedia(db: Pool, actor: Actor, input: MediaUploadInput, context: RequestContext): Promise<MediaDto> {
  return new MediaService(db).createMedia(actor, input, context);
}
export async function deleteMedia(db: Pool, actor: Actor, id: string, context: RequestContext): Promise<void> {
  return new MediaService(db).deleteMedia(actor, id, context);
}
export async function resolveMediaContent(db: Pool, actor: Actor | null, id: string): Promise<AuthorizedMediaObject> {
  return new MediaService(db).resolveMediaContent(actor, id);
}
