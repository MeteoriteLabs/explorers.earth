import { lookup as dnsLookup } from "node:dns/promises";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import {
  validateMusicTokenConfiguration,
  type MusicTokenConfiguration,
} from "../services/musicTokenService";

export type MusicIdentityAddressResolver = (hostname: string) => Promise<string[]>;

export interface MusicIdentityConfigDependencies {
  resolveAddresses?: MusicIdentityAddressResolver;
  readSecretFile?: (path: string) => Promise<string>;
  now?: () => number;
}

export interface MusicIdentityRuntimeConfig {
  mode: "live" | "fixture";
  strapiOrigin: string;
  trustedProxyHops: 0 | 1;
  trustedProxyAddress?: string;
  isTrustedProxy: (peerAddress: string | undefined) => boolean;
  pinnedAddresses: string[];
  lookup: (hostname: string, options?: { all?: boolean; family?: 0 | 4 | 6 }) => Promise<
    { address: string; family: 4 | 6 } | Array<{ address: string; family: 4 | 6 }>
  >;
  fetchImpl: typeof fetch;
  maxConcurrency: number;
  maxPending: number;
  maxInflight: number;
  retries: number;
  connectTimeoutMs: number;
  readTimeoutMs: number;
  overallTimeoutMs: number;
  cacheTtlMs: number;
  circuitFailureThreshold: number;
  circuitOpenMs: number;
  rateLimitPerMinute: number;
  globalRateLimitPerMinute: number;
  rateMaxEntries: number;
  musicToken: MusicTokenConfiguration;
}

const integerBounds = {
  MUSIC_IDENTITY_MAX_CONCURRENCY: [1, 32],
  MUSIC_IDENTITY_MAX_PENDING: [1, 128],
  MUSIC_IDENTITY_MAX_INFLIGHT: [1, 128],
  MUSIC_IDENTITY_RETRIES: [0, 3],
  MUSIC_CONNECT_TIMEOUT_MS: [100, 10_000],
  MUSIC_READ_TIMEOUT_MS: [100, 30_000],
  MUSIC_IDENTITY_OVERALL_TIMEOUT_MS: [100, 60_000],
  MUSIC_IDENTITY_CACHE_TTL_MS: [0, 30_000],
  MUSIC_CIRCUIT_FAILURE_THRESHOLD: [1, 100],
  MUSIC_IDENTITY_CIRCUIT_OPEN_MS: [100, 300_000],
  MUSIC_RATE_LIMIT_PER_MINUTE: [1, 10_000],
  MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE: [1, 100_000],
  MUSIC_IDENTITY_RATE_MAX_ENTRIES: [2, 100_000],
} as const;

const defaults: Record<keyof typeof integerBounds, string> = {
  MUSIC_IDENTITY_MAX_CONCURRENCY: "8",
  MUSIC_IDENTITY_MAX_PENDING: "32",
  MUSIC_IDENTITY_MAX_INFLIGHT: "32",
  MUSIC_IDENTITY_RETRIES: "2",
  MUSIC_CONNECT_TIMEOUT_MS: "2000",
  MUSIC_READ_TIMEOUT_MS: "4000",
  MUSIC_IDENTITY_OVERALL_TIMEOUT_MS: "10000",
  MUSIC_IDENTITY_CACHE_TTL_MS: "30000",
  MUSIC_CIRCUIT_FAILURE_THRESHOLD: "3",
  MUSIC_IDENTITY_CIRCUIT_OPEN_MS: "15000",
  MUSIC_RATE_LIMIT_PER_MINUTE: "30",
  MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE: "300",
  MUSIC_IDENTITY_RATE_MAX_ENTRIES: "10000",
};

type Environment = Record<string, string | undefined>;

export async function resolveMusicIdentityRuntimeConfig(
  environment: Environment,
  dependencies: MusicIdentityConfigDependencies = {},
): Promise<MusicIdentityRuntimeConfig> {
  const mode = environment.MUSIC_MODE;
  if (mode !== "live" && mode !== "fixture") throw new Error("MUSIC_MODE must be live or fixture");
  const url = parseOrigin(environment.STRAPI_URL, "STRAPI_URL");
  const trustedProxyHops = parseProxyHops(environment.TRUST_PROXY_HOPS, mode);
  const trustedProxyAddress = parseTrustedProxyAddress(environment.MUSIC_TRUSTED_PROXY_IP, mode);
  const controls = Object.fromEntries(Object.entries(integerBounds).map(([name, [minimum, maximum]]) => [
    name,
    parseBoundedInteger(name, environment[name] ?? defaults[name as keyof typeof defaults], minimum, maximum),
  ])) as Record<keyof typeof integerBounds, number>;
  assertCrossFieldBounds(controls);
  const musicToken = await resolveMusicTokenConfiguration(environment, dependencies);

  let pinnedAddresses: string[] = [];
  let fetchImpl: typeof fetch = fetch;
  if (mode === "fixture") {
    const fixtureOrigin = parseOrigin(environment.MUSIC_FIXTURE_STRAPI_ORIGIN, "MUSIC_FIXTURE_STRAPI_ORIGIN");
    if (url.origin !== fixtureOrigin.origin) throw new Error("STRAPI_URL must equal the exact fixture origin");
  } else {
    if (url.protocol !== "https:") throw new Error("live STRAPI_URL must be an HTTPS origin");
    const allowed = parseAllowedOrigins(environment.MUSIC_STRAPI_ALLOWED_ORIGINS);
    if (!allowed.includes(url.origin)) throw new Error("STRAPI_URL origin is not allowlisted");
    const hostname = unbracket(url.hostname);
    const resolveAddresses = dependencies.resolveAddresses ?? defaultResolver;
    pinnedAddresses = uniqueAddresses(isIP(hostname) ? [hostname] : await resolveAddresses(hostname));
    if (pinnedAddresses.length === 0 || pinnedAddresses.some((address) => !isPublicAddress(address))) {
      throw new Error("live STRAPI_URL must resolve only to public addresses");
    }
    fetchImpl = createPinnedHttpsFetch(url.origin, hostname, pinnedAddresses, controls.MUSIC_IDENTITY_MAX_CONCURRENCY);
  }
  const lookup = createPinnedLookup(unbracket(url.hostname), pinnedAddresses);
  return {
    mode,
    strapiOrigin: url.origin,
    trustedProxyHops,
    trustedProxyAddress,
    isTrustedProxy: (peerAddress) => trustedProxyAddress !== undefined
      && normalizePeerAddress(peerAddress) === trustedProxyAddress,
    pinnedAddresses,
    lookup,
    fetchImpl,
    maxConcurrency: controls.MUSIC_IDENTITY_MAX_CONCURRENCY,
    maxPending: controls.MUSIC_IDENTITY_MAX_PENDING,
    maxInflight: controls.MUSIC_IDENTITY_MAX_INFLIGHT,
    retries: controls.MUSIC_IDENTITY_RETRIES,
    connectTimeoutMs: controls.MUSIC_CONNECT_TIMEOUT_MS,
    readTimeoutMs: controls.MUSIC_READ_TIMEOUT_MS,
    overallTimeoutMs: controls.MUSIC_IDENTITY_OVERALL_TIMEOUT_MS,
    cacheTtlMs: controls.MUSIC_IDENTITY_CACHE_TTL_MS,
    circuitFailureThreshold: controls.MUSIC_CIRCUIT_FAILURE_THRESHOLD,
    circuitOpenMs: controls.MUSIC_IDENTITY_CIRCUIT_OPEN_MS,
    rateLimitPerMinute: controls.MUSIC_RATE_LIMIT_PER_MINUTE,
    globalRateLimitPerMinute: controls.MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE,
    rateMaxEntries: controls.MUSIC_IDENTITY_RATE_MAX_ENTRIES,
    musicToken,
  };
}

async function resolveMusicTokenConfiguration(
  environment: Environment,
  dependencies: MusicIdentityConfigDependencies,
): Promise<MusicTokenConfiguration> {
  const tokenLifetimeSeconds = parseBoundedInteger(
    "MUSIC_TOKEN_LIFETIME_SECONDS",
    environment.MUSIC_TOKEN_LIFETIME_SECONDS ?? "",
    600,
    600,
  );
  const clockSkewSeconds = parseBoundedInteger(
    "MUSIC_TOKEN_CLOCK_SKEW_SECONDS",
    environment.MUSIC_TOKEN_CLOCK_SKEW_SECONDS ?? "",
    0,
    30,
  );
  const current = {
    kid: requiredValue(environment.MUSIC_TOKEN_CURRENT_KID, "MUSIC_TOKEN_CURRENT_KID"),
    secret: await resolveSecret(
      environment.MUSIC_TOKEN_CURRENT_SECRET,
      environment.MUSIC_TOKEN_CURRENT_SECRET_FILE,
      "MUSIC_TOKEN_CURRENT_SECRET",
      dependencies,
    ),
  };
  const previousValues = [
    environment.MUSIC_TOKEN_PREVIOUS_KID,
    environment.MUSIC_TOKEN_PREVIOUS_SECRET,
    environment.MUSIC_TOKEN_PREVIOUS_SECRET_FILE,
    environment.MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL,
  ];
  let previous: MusicTokenConfiguration["previous"];
  if (previousValues.some((value) => value !== undefined && value !== "")) {
    if (!environment.MUSIC_TOKEN_PREVIOUS_KID || !environment.MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL
        || (!environment.MUSIC_TOKEN_PREVIOUS_SECRET && !environment.MUSIC_TOKEN_PREVIOUS_SECRET_FILE)) {
      throw new Error("Music token previous kid, secret, and UTC accept-until must be configured together");
    }
    const cutoff = environment.MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff)) {
      throw new Error("MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL must be an exact UTC instant");
    }
    const acceptUntil = Date.parse(cutoff);
    if (!Number.isSafeInteger(acceptUntil) || new Date(acceptUntil).toISOString() !== cutoff) {
      throw new Error("MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL must be a valid UTC instant");
    }
    previous = {
      kid: environment.MUSIC_TOKEN_PREVIOUS_KID,
      secret: await resolveSecret(
        environment.MUSIC_TOKEN_PREVIOUS_SECRET,
        environment.MUSIC_TOKEN_PREVIOUS_SECRET_FILE,
        "MUSIC_TOKEN_PREVIOUS_SECRET",
        dependencies,
      ),
      acceptUntil,
    };
  }
  const configuration: MusicTokenConfiguration = { current, previous, tokenLifetimeSeconds, clockSkewSeconds };
  validateMusicTokenConfiguration(configuration, (dependencies.now ?? Date.now)());
  return configuration;
}

async function resolveSecret(
  inline: string | undefined,
  path: string | undefined,
  name: string,
  dependencies: MusicIdentityConfigDependencies,
): Promise<string> {
  if ((inline && path) || (!inline && !path)) throw new Error(`${name} or ${name}_FILE must be configured exactly once`);
  if (inline) return inline;
  if (!path || path.length > 512 || path.includes("\0")) throw new Error(`${name}_FILE is invalid`);
  const contents = await (dependencies.readSecretFile ?? ((secretPath) => readFile(secretPath, "utf8")))(path);
  return contents.replace(/\r?\n$/, "");
}

function requiredValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseOrigin(value: string | undefined, name: string): URL {
  if (!value) throw new Error(`${name} is required`);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`${name} must be a valid origin URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must contain only an origin without credentials, path, query, or fragment`);
  }
  return url;
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) throw new Error("MUSIC_STRAPI_ALLOWED_ORIGINS is required");
  const origins = value.split(",").map((item) => parseOrigin(item.trim(), "MUSIC_STRAPI_ALLOWED_ORIGINS"));
  if (origins.some((origin) => origin.protocol !== "https:")) {
    throw new Error("MUSIC_STRAPI_ALLOWED_ORIGINS must contain only HTTPS origins");
  }
  return origins.map((origin) => origin.origin);
}

function parseBoundedInteger(name: string, value: string, minimum: number, maximum: number): number {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error(`${name} must be a finite integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function parseProxyHops(value: string | undefined, mode: "live" | "fixture"): 0 | 1 {
  const expected = mode === "live" ? "1" : "0";
  if (value !== expected) throw new Error(`TRUST_PROXY_HOPS must be exactly ${expected} in ${mode} mode`);
  return Number(expected) as 0 | 1;
}

function parseTrustedProxyAddress(value: string | undefined, mode: "live" | "fixture"): string | undefined {
  if (mode === "fixture") {
    if (value) throw new Error("MUSIC_TRUSTED_PROXY_IP must be absent in fixture mode");
    return undefined;
  }
  const normalized = normalizePeerAddress(value);
  if (!normalized || isIP(normalized) === 0) {
    throw new Error("MUSIC_TRUSTED_PROXY_IP must be one exact IP address in live mode");
  }
  return normalized;
}

function normalizePeerAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const unwrapped = unbracket(value.trim());
  return unwrapped.toLowerCase().startsWith("::ffff:") ? unwrapped.slice(7) : unwrapped;
}

function assertCrossFieldBounds(controls: Record<keyof typeof integerBounds, number>): void {
  if (controls.MUSIC_IDENTITY_MAX_PENDING < controls.MUSIC_IDENTITY_MAX_CONCURRENCY) {
    throw new Error("bounded configuration requires max pending >= max concurrency");
  }
  if (controls.MUSIC_IDENTITY_MAX_INFLIGHT > controls.MUSIC_IDENTITY_MAX_PENDING) {
    throw new Error("bounded configuration requires max inflight <= max pending");
  }
  if (controls.MUSIC_IDENTITY_OVERALL_TIMEOUT_MS < Math.max(controls.MUSIC_CONNECT_TIMEOUT_MS, controls.MUSIC_READ_TIMEOUT_MS)) {
    throw new Error("bounded configuration requires overall timeout >= connect/read timeout");
  }
  if (controls.MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE < controls.MUSIC_RATE_LIMIT_PER_MINUTE) {
    throw new Error("bounded configuration requires global rate >= per-source rate");
  }
}

async function defaultResolver(hostname: string): Promise<string[]> {
  return (await dnsLookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
}

function uniqueAddresses(addresses: string[]): string[] {
  return Array.from(new Set(addresses.map(unbracket)));
}

function unbracket(value: string): string {
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

function createPinnedLookup(hostname: string, addresses: string[]) {
  return async (requestedHostname: string, options: { all?: boolean; family?: 0 | 4 | 6 } = {}) => {
    if (requestedHostname !== hostname || addresses.length === 0) throw new Error("unvalidated DNS lookup refused");
    const candidates = addresses.map((address) => ({ address, family: isIP(address) as 4 | 6 }))
      .filter(({ family }) => !options.family || family === options.family);
    if (candidates.length === 0) throw new Error("no pinned address for requested family");
    return options.all ? candidates : candidates[0];
  };
}

function createPinnedHttpsFetch(origin: string, hostname: string, addresses: string[], maxSockets: number): typeof fetch {
  let cursor = 0;
  const pinnedLookup = (requested: string, options: unknown, callback: (...args: unknown[]) => void) => {
    if (requested !== hostname) return callback(new Error("unpinned DNS lookup refused"));
    const family = typeof options === "number"
      ? options
      : typeof options === "object" && options && "family" in options
        ? Number((options as { family?: unknown }).family)
        : 0;
    const all = typeof options === "object" && options && "all" in options
      && (options as { all?: unknown }).all === true;
    const candidates = addresses.map((address) => ({ address, family: isIP(address) as 4 | 6 }))
      .filter((candidate) => !family || candidate.family === family);
    if (candidates.length === 0) return callback(new Error("no pinned address for requested family"));
    if (all) return callback(null, candidates);
    const candidate = candidates[cursor++ % candidates.length];
    return callback(null, candidate.address, candidate.family);
  };
  // This private agent is reachable only through the exact-origin closure below;
  // neither its pinned lookup nor a pooled socket can be shared with another origin.
  const agent = new HttpsAgent({
    keepAlive: true,
    maxSockets,
    maxFreeSockets: maxSockets,
    scheduling: "fifo",
    lookup: pinnedLookup as never,
  });
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const target = new URL(input instanceof URL || typeof input === "string" ? input : input.url);
    if (target.origin !== origin || target.protocol !== "https:") throw new Error("unpinned upstream origin refused");
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    return new Promise<Response>((resolve, reject) => {
      const request = httpsRequest(target, {
        method: init.method ?? "GET",
        headers,
        signal: init.signal ?? undefined,
        servername: isIP(hostname) ? undefined : hostname,
        agent,
      }, (incoming) => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
          else if (value !== undefined) responseHeaders.set(name, value);
        }
        resolve(new Response(Readable.toWeb(incoming) as ReadableStream, {
          status: incoming.statusCode ?? 502,
          statusText: incoming.statusMessage,
          headers: responseHeaders,
        }));
      });
      request.once("error", reject);
      request.end();
    });
  }) as typeof fetch;
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const bytes = address.split(".").map(Number);
    const [a, b, c] = bytes;
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && c === 0)
      || (a === 192 && b === 0 && c === 2)
      || (a === 192 && b === 88 && c === 99)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const normalized = unbracket(new URL(`http://[${address}]/`).hostname).toLowerCase();
    if (normalized.startsWith("::ffff:")) return false;
    const [firstText, secondText = "0"] = normalized.split(":");
    const first = Number.parseInt(firstText || "0", 16);
    const second = Number.parseInt(secondText || "0", 16);
    if (first < 0x2000 || first > 0x3fff) return false;
    if (first === 0x2002) return false;
    if (first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) return false;
    return true;
  }
  return false;
}
