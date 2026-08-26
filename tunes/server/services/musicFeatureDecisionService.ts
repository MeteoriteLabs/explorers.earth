import { createHash, randomUUID } from "node:crypto";
import type { MusicPrincipal } from "../middleware/musicPrincipal";

export const musicFeatureFlags = ["ownerWorkspace", "guestWorkspace", "playlistImports"] as const;
export type MusicFeatureFlag = typeof musicFeatureFlags[number];
export type MusicFeatureExposure = Record<MusicFeatureFlag, boolean> & { exposureId: string; expiresAt: string };

export interface MusicFeatureDecisionOptions {
  killSwitch: () => boolean;
  salt: string;
  cohortVersion: string;
  allowlists?: Partial<Record<MusicFeatureFlag, ReadonlySet<string>>>;
  percentages?: Partial<Record<MusicFeatureFlag, number>>;
  cacheTtlMs?: number;
  now?: () => number;
  exposureId?: () => string;
  log?: (entry: { flag: MusicFeatureFlag; decision: boolean; cohortVersion: string; exposureId: string }) => void;
}

export class MusicFeatureDecisionService {
  private readonly cache = new Map<string, { expires: number; value: MusicFeatureExposure }>();
  constructor(private readonly options: MusicFeatureDecisionOptions) {}

  decide(principal: MusicPrincipal): MusicFeatureExposure {
    const now = this.options.now?.() ?? Date.now();
    if (this.options.killSwitch()) {
      const exposureId = this.options.exposureId?.() ?? randomUUID();
      for (const flag of musicFeatureFlags) this.options.log?.({ flag, decision: false, cohortVersion: this.options.cohortVersion, exposureId });
      return { ownerWorkspace: false, guestWorkspace: false, playlistImports: false, exposureId, expiresAt: new Date(now).toISOString() };
    }
    const cacheKey = `${principal.musicUserId}:${principal.accountDocumentId}:${principal.sessionVersion}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > now) return cached.value;
    const ttl = Math.min(Math.max(this.options.cacheTtlMs ?? 60_000, 0), 60_000);
    const expires = now + ttl;
    const exposureId = this.options.exposureId?.() ?? randomUUID();
    const decision = Object.fromEntries(musicFeatureFlags.map((flag) => [flag, this.flag(flag, principal)])) as Record<MusicFeatureFlag, boolean>;
    for (const flag of musicFeatureFlags) this.options.log?.({ flag, decision: decision[flag], cohortVersion: this.options.cohortVersion, exposureId });
    const value = { ...decision, exposureId, expiresAt: new Date(expires).toISOString() };
    this.cache.set(cacheKey, { expires, value });
    return value;
  }

  private flag(flag: MusicFeatureFlag, principal: MusicPrincipal): boolean {
    if (this.options.allowlists?.[flag]?.has(principal.accountDocumentId)) return true;
    const percentage = Math.min(Math.max(this.options.percentages?.[flag] ?? 0, 0), 100);
    if (percentage === 0 || this.options.salt.trim().length === 0) return false;
    const digest = createHash("sha256").update(`${this.options.salt}:${this.options.cohortVersion}:${flag}:${principal.accountDocumentId}`).digest();
    return digest.readUInt32BE(0) % 10_000 < percentage * 100;
  }
}
