export type PublicCategory = "places" | "movies" | "books" | "games" | "guides" | "apps" | "products" | "people";

type FetchLike = typeof fetch;

export function createPublicProfileGatewayClient(baseUrl: string, fetchImpl: FetchLike = fetch) {
  const origin = baseUrl.replace(/\/$/, "");
  const cache = new Map<string, { etag: string; value: unknown }>();
  const request = async (path: string, signal?: AbortSignal, bypassCache = false): Promise<unknown> => {
    const url = `${origin}${path}`;
    const cached = cache.get(url);
    const response = await fetchImpl(url, {
      signal,
      headers: {
        Accept: "application/json",
        ...(cached ? { "If-None-Match": cached.etag } : {}),
        ...(bypassCache ? { "Cache-Control": "no-cache" } : {}),
      },
    });
    if (response.status === 304) {
      if (cached) return cached.value;
      throw new Error("PUBLIC_PROFILE_304");
    }
    if (!response.ok) throw new Error(`PUBLIC_PROFILE_${response.status}`);
    const value = await response.json();
    const etag = response.headers.get("etag");
    if (etag) cache.set(url, { etag, value });
    return value;
  };
  return {
    async shell(username: string, signal?: AbortSignal, bypassCache = false): Promise<unknown> {
      return request(`/api/explorers/v1/profiles/${encodeURIComponent(username)}`, signal, bypassCache);
    },
    async category(username: string, category: PublicCategory, signal?: AbortSignal, bypassCache = false): Promise<unknown> {
      return request(`/api/explorers/v1/profiles/${encodeURIComponent(username)}/recommendations/${category}`, signal, bypassCache);
    },
    async detail(username: string, category: PublicCategory, slug: string, signal?: AbortSignal, bypassCache = false): Promise<unknown> {
      return request(`/api/explorers/v1/profiles/${encodeURIComponent(username)}/recommendations/${category}/${encodeURIComponent(slug)}`, signal, bypassCache);
    },
  };
}

export const publicProfileGatewayClient = createPublicProfileGatewayClient(
  import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth",
);
