import { createHash } from "node:crypto";
import { z } from "zod";
import { MusicIdentityError } from "../../shared/musicError";

const boundedString = z.string().trim().min(1).max(512);
const strapiUserSchema = z.object({
  documentId: boundedString,
  username: boundedString,
  email: z.string().email().max(320),
  provider: boundedString,
  confirmed: z.boolean(),
  blocked: z.boolean().default(false),
}).passthrough();

const strapiAccountSchema = z.object({
  documentId: boundedString,
  Account_Name: z.string().trim().max(512).nullable().optional(),
  Account_Type: z.string().trim().max(128).nullable().optional(),
  mobile_number: z.string().trim().max(64).nullable().optional(),
}).passthrough();

const strapiAccountsSchema = z.object({
  data: z.array(strapiAccountSchema).max(50),
}).passthrough();

export interface ResolvedStrapiIdentity {
  userDocumentId: string;
  accountDocumentId: string;
  username: string;
  email: string;
  provider: "local" | "google";
  accountName: string;
  accountType: string;
  accountMobile: string;
}

export interface StrapiIdentityGatewayOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  maxConcurrency: number;
  retries: number;
  connectTimeoutMs: number;
  readTimeoutMs: number;
  overallTimeoutMs: number;
  cacheTtlMs: number;
  circuitFailureThreshold: number;
  circuitOpenMs: number;
  now?: () => number;
  random?: () => number;
}

interface CacheEntry {
  value: ResolvedStrapiIdentity;
  expiresAt: number;
}

type CircuitState = "closed" | "open" | "half-open";

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maximum: number) {}

  async use<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.maximum) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
  }
}

export function fingerprintStrapiProof(proof: string): string {
  return createHash("sha256").update(proof, "utf8").digest("hex");
}

export class StrapiIdentityGateway {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly semaphore: Semaphore;
  private readonly cache = new Map<string, CacheEntry>();
  private circuitState: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedUntil = 0;
  private probeActive = false;
  private upstreamCalls = 0;
  private retries = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private circuitRejections = 0;

  constructor(private readonly options: StrapiIdentityGatewayOptions) {
    if (!/^https?:\/\//.test(options.baseUrl) || options.maxConcurrency < 1 || options.maxConcurrency > 64
        || options.retries < 0 || options.retries > 3 || options.cacheTtlMs < 0 || options.cacheTtlMs > 30_000) {
      throw new Error("invalid bounded Strapi identity gateway configuration");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.semaphore = new Semaphore(options.maxConcurrency);
  }

  async resolve(proof: string, requestId: string): Promise<ResolvedStrapiIdentity> {
    const fingerprint = fingerprintStrapiProof(proof);
    const cached = this.cache.get(fingerprint);
    if (cached && cached.expiresAt > this.now()) {
      this.cacheHits += 1;
      return cached.value;
    }
    this.cacheMisses += 1;
    if (cached) this.cache.delete(fingerprint);
    this.assertCircuitAvailable();
    try {
      const value = await this.resolveFresh(proof, requestId);
      this.recordSuccess();
      this.cache.set(fingerprint, { value, expiresAt: this.now() + this.options.cacheTtlMs });
      this.pruneCache();
      return value;
    } catch (error) {
      if (error instanceof MusicIdentityError && [502, 503].includes(error.status)) this.recordFailure();
      else this.releaseProbe();
      throw error;
    }
  }

  clear(fingerprint?: string): void {
    if (fingerprint) this.cache.delete(fingerprint);
    else this.cache.clear();
  }

  stats(): {
    cacheEntries: number;
    circuitState: CircuitState;
    upstreamCalls: number;
    retries: number;
    cacheHits: number;
    cacheMisses: number;
    circuitRejections: number;
  } {
    return {
      cacheEntries: this.cache.size,
      circuitState: this.circuitState,
      upstreamCalls: this.upstreamCalls,
      retries: this.retries,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      circuitRejections: this.circuitRejections,
    };
  }

  private async resolveFresh(proof: string, requestId: string): Promise<ResolvedStrapiIdentity> {
    const deadline = this.now() + this.options.overallTimeoutMs;
    const userBody = await this.requestJson("/api/users/me", proof, requestId, deadline);
    const parsedUser = strapiUserSchema.safeParse(userBody);
    if (!parsedUser.success) throw malformed();
    const user = parsedUser.data;
    const provider = user.provider.toLowerCase();
    const eligible = !user.blocked && ((provider === "local" && user.confirmed) || provider === "google");
    if (!eligible) {
      throw new MusicIdentityError("IDENTITY_INELIGIBLE", 403, "This Explorer identity is not eligible for Music.", "complete_onboarding", false);
    }

    const params = new URLSearchParams({
      "filters[users_permissions_user][documentId][$eq]": user.documentId,
      "pagination[pageSize]": "50",
    });
    const accountBody = await this.requestJson(`/api/accounts?${params.toString()}`, proof, requestId, deadline);
    const parsedAccounts = strapiAccountsSchema.safeParse(accountBody);
    if (!parsedAccounts.success) throw malformed();
    const completed = parsedAccounts.data.data.filter((account) =>
      Boolean(account.Account_Name && account.Account_Type && account.mobile_number));
    if (completed.length === 0) {
      throw new MusicIdentityError("ONBOARDING_INCOMPLETE", 409, "Complete Explorer onboarding before using Music.", "complete_onboarding", false);
    }
    if (completed.length !== 1) {
      throw new MusicIdentityError("ACCOUNT_AMBIGUOUS", 409, "Music cannot select an unambiguous Explorer Account.", "contact_support", false);
    }
    const account = completed[0];
    return {
      userDocumentId: user.documentId,
      accountDocumentId: account.documentId,
      username: user.username,
      email: user.email,
      provider: provider as "local" | "google",
      accountName: account.Account_Name!,
      accountType: account.Account_Type!,
      accountMobile: account.mobile_number!,
    };
  }

  private async requestJson(path: string, proof: string, requestId: string, deadline: number): Promise<unknown> {
    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      const remaining = deadline - this.now();
      if (remaining <= 0) throw unavailable();
      try {
        const result = await this.semaphore.use(async () => {
          if (this.circuitState === "open" && this.now() < this.openedUntil) throw unavailable();
          const controller = new AbortController();
          let response: Response;
          this.upstreamCalls += 1;
          response = await withDeadline(
            this.fetchImpl(new URL(path, this.options.baseUrl), {
              method: "GET",
              headers: {
                authorization: `Bearer ${proof}`,
                accept: "application/json",
                "x-request-id": requestId,
              },
              signal: controller.signal,
            }),
            Math.min(remaining, this.options.connectTimeoutMs),
            controller,
          );
          if (response!.status >= 400) return { response: response!, body: undefined };
          const body = await withDeadline(
            response!.text(),
            Math.min(this.options.readTimeoutMs, Math.max(1, deadline - this.now())),
            controller,
          );
          return { response: response!, body };
        });
        const { response } = result;
        if (response.status === 401 || response.status === 403) {
          throw new MusicIdentityError("AUTH_INVALID", 401, "The Explorer proof is invalid or expired.", "authenticate", false);
        }
        if (response.status >= 400 && response.status < 500 && response.status !== 429) throw malformed();
        if (response.status === 429 || response.status >= 500) {
          if (attempt < this.options.retries) {
            this.retries += 1;
            await this.backoff(response.headers.get("retry-after"), deadline);
            continue;
          }
          throw unavailable(response.headers.get("retry-after"));
        }
        const body = result.body ?? "";
        if (body.length > 128 * 1024) throw malformed();
        try {
          return JSON.parse(body);
        } catch {
          throw malformed();
        }
      } catch (error) {
        if (error instanceof MusicIdentityError) throw error;
        if (attempt < this.options.retries) {
          this.retries += 1;
          await this.backoff(null, deadline);
          continue;
        }
        throw unavailable();
      }
    }
    throw unavailable();
  }

  private async backoff(retryAfter: string | null, deadline: number): Promise<void> {
    const seconds = retryAfter && /^\d{1,3}$/.test(retryAfter) ? Number(retryAfter) : 0;
    const delay = Math.min(Math.max(seconds * 1_000, 10 + Math.floor(this.random() * 20)), 1_000, Math.max(0, deadline - this.now()));
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private assertCircuitAvailable(): void {
    if (this.circuitState !== "open") {
      if (this.circuitState === "half-open" && this.probeActive) {
        this.circuitRejections += 1;
        throw unavailable("1");
      }
      return;
    }
    if (this.now() < this.openedUntil) {
      this.circuitRejections += 1;
      throw unavailable(String(Math.max(1, Math.ceil((this.openedUntil - this.now()) / 1_000))));
    }
    this.circuitState = "half-open";
    if (this.probeActive) {
      this.circuitRejections += 1;
      throw unavailable("1");
    }
    this.probeActive = true;
  }

  private recordFailure(): void {
    this.releaseProbe();
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.circuitFailureThreshold) {
      this.circuitState = "open";
      this.openedUntil = this.now() + this.options.circuitOpenMs;
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = "closed";
    this.releaseProbe();
  }

  private releaseProbe(): void {
    this.probeActive = false;
  }

  private pruneCache(): void {
    const now = this.now();
    this.cache.forEach((entry, key) => {
      if (entry.expiresAt <= now) this.cache.delete(key);
    });
    while (this.cache.size > 1_024) this.cache.delete(this.cache.keys().next().value as string);
  }
}

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number, controller: AbortController): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("deadline exceeded"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function malformed(): MusicIdentityError {
  return new MusicIdentityError("UPSTREAM_MALFORMED", 502, "Explorer returned an invalid identity response.", "retry", true, 2);
}

function unavailable(retryAfter?: string | null): MusicIdentityError {
  const seconds = retryAfter && /^\d{1,3}$/.test(retryAfter) ? Math.max(1, Number(retryAfter)) : 2;
  return new MusicIdentityError("UPSTREAM_UNAVAILABLE", 503, "Music identity is temporarily unavailable.", "retry", true, seconds);
}
