import { canReadPublicCategory, type PublicCategory } from "./publicProfilePolicy";

export interface PublicProfileGateway {
  resolveAccount(username: string): Promise<Record<string, unknown> | undefined>;
  resolveCategory(username: string, category: PublicCategory, limit: number): Promise<unknown>;
}

export type PublicProfileReadOptions = { bypassCache?: boolean };

type CacheEntry<T> = { value: T; expiresAt: number };

type PublicProfileServiceOptions = {
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
};

export class PublicProfileService {
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly accounts = new Map<string, CacheEntry<Record<string, unknown>>>();
  private readonly categories = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly gateway: PublicProfileGateway, options: PublicProfileServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 30_000;
    this.maxEntries = options.maxEntries ?? 500;
  }

  private read<T>(cache: Map<string, CacheEntry<T>>, key: string, bypassCache: boolean): T | undefined {
    if (bypassCache) return undefined;
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private write<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
    if (cache.size >= this.maxEntries && !cache.has(key)) cache.delete(cache.keys().next().value as string);
    cache.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  private async account(username: string, bypassCache: boolean): Promise<Record<string, unknown> | undefined> {
    const cached = this.read(this.accounts, username, bypassCache);
    if (cached) return cached;
    const account = await this.gateway.resolveAccount(username);
    if (account) this.write(this.accounts, username, account);
    return account;
  }

  async category(username: string, category: PublicCategory, limit: number, options: PublicProfileReadOptions = {}): Promise<unknown | undefined> {
    const key = `${username}:${category}:${limit}`;
    const cached = this.read(this.categories, key, Boolean(options.bypassCache));
    if (cached !== undefined) return cached;
    const account = await this.account(username, Boolean(options.bypassCache));
    if (!account || !canReadPublicCategory(account, category)) return undefined;
    const value = await this.gateway.resolveCategory(username, category, limit);
    this.write(this.categories, key, value);
    return value;
  }

  async shell(username: string, options: PublicProfileReadOptions = {}): Promise<Record<string, unknown> | undefined> {
    const account = await this.account(username, Boolean(options.bypassCache));
    return account?.public_profile === "Yes" ? account : undefined;
  }
}
