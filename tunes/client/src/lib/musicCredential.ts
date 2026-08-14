interface CachedMusicCredential { token: string; expiresAt: number; }

let current: CachedMusicCredential | undefined;
let inflight: Promise<CachedMusicCredential> | undefined;
const GUEST_CAPABILITY_KEY = "musicGuestCapability";
const GUEST_CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function clearMusicCredential(): void {
  current = undefined;
  inflight = undefined;
}

/** Accepts an out-of-band capability after the guest explicitly supplies it. */
export function setGuestMusicCapability(capability: string): void {
  if (!GUEST_CAPABILITY_PATTERN.test(capability)) throw new Error("A valid guest capability is required.");
  sessionStorage.setItem(GUEST_CAPABILITY_KEY, capability);
}

export function getGuestMusicCapability(): string | undefined {
  const capability = sessionStorage.getItem(GUEST_CAPABILITY_KEY) ?? "";
  if (!GUEST_CAPABILITY_PATTERN.test(capability)) {
    sessionStorage.removeItem(GUEST_CAPABILITY_KEY);
    return undefined;
  }
  return capability;
}

export function clearGuestMusicCapability(): void {
  sessionStorage.removeItem(GUEST_CAPABILITY_KEY);
}

export function acquireGuestMusicCapability(): string | undefined {
  const existing = getGuestMusicCapability();
  if (existing) return existing;
  const supplied = globalThis.prompt("Enter the guest capability shared by the playlist owner:")?.trim() ?? "";
  if (!supplied) return undefined;
  setGuestMusicCapability(supplied);
  return supplied;
}

export async function musicCredentialForRequest(now = Date.now()): Promise<string> {
  if (current && current.expiresAt - now > 5_000) return current.token;
  if (!inflight) inflight = mintMusicCredential().finally(() => { inflight = undefined; });
  current = await inflight;
  return current.token;
}

export async function musicPrincipalForRequest(): Promise<{ musicUserId: number; status: "active" }> {
  const token = await musicCredentialForRequest();
  const response = await fetch("/api/music/identity/current", {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  const body = await response.json();
  if (!response.ok || body?.version !== "music-principal/v1" || !Number.isSafeInteger(body?.identity?.musicUserId)
      || body.identity.musicUserId < 1 || body.identity.status !== "active") {
    throw new Error(body?.error?.message || "Music principal resolution failed.");
  }
  return body.identity;
}

async function mintMusicCredential(): Promise<CachedMusicCredential> {
  const explorerProof = localStorage.getItem("qrtoken");
  if (!explorerProof) throw new Error("Explorer authentication is required before Music access.");
  const response = await fetch("/api/music/identity/ensure", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${explorerProof}` },
    body: undefined,
    credentials: "include",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "Music authentication failed.");
  const token = body?.credential?.token;
  const expiresAt = body?.credential?.expiresAt;
  if (body?.version !== "music-identity/v1" || typeof token !== "string" || token.length < 64
      || token.length > 4_096 || token.split(".").length !== 3
      || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Music authentication returned an invalid credential.");
  }
  return { token, expiresAt };
}

export function isMusicOwnerRequest(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return path === "/api/music/identity/current"
    || path.startsWith("/api/playlists")
    || path.startsWith("/api/playlist/songs")
    || path.startsWith("/api/playlist/currently-playing")
    || path.startsWith("/api/playlist/history")
    || path.startsWith("/api/playlist/import-")
    || path.startsWith("/api/music/guest-capability/")
    || path.startsWith("/api/music/publication/")
    || path.startsWith("/api/music/paid/")
    || path === "/api/music/dashboard"
    || path === "/api/music/entitlement"
    || path.startsWith("/api/user")
    || path.startsWith("/api/system-settings/")
    || path.startsWith("/api/youtube/")
    || path.startsWith("/api/instagram/")
    || path.startsWith("/api/payments/")
    || path.startsWith("/api/subscriptions/")
    || path.startsWith("/api/gemini/")
    || path.startsWith("/api/email/")
    || path === "/api/seo";
}

export async function guestMusicRequest(
  capability: string,
  song: { youtubeId: string; title: string; artist: string; thumbnailUrl: string },
): Promise<Response> {
  if (!GUEST_CAPABILITY_PATTERN.test(capability)) throw new Error("A valid guest capability is required.");
  const response = await fetch("/api/music/guest/request", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Music-Guest-Capability": capability,
    },
    body: JSON.stringify(song),
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message || "Guest Music request failed.");
  }
  return response;
}
