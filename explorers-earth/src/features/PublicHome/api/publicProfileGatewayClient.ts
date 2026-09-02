export type PublicCategory = "places" | "movies" | "books" | "games" | "guides" | "apps" | "products" | "people";

type FetchLike = typeof fetch;

export function createPublicProfileGatewayClient(baseUrl: string, fetchImpl: FetchLike = fetch) {
  const origin = baseUrl.replace(/\/$/, "");
  const cache = new Map<string, { etag: string; value: unknown }>();
  const request = async (path: string, signal?: AbortSignal): Promise<unknown> => {
    const url = `${origin}${path}`;
    const cached = cache.get(url);
    const response = await fetchImpl(url, {
      signal,
      headers: cached ? { Accept: "application/json", "If-None-Match": cached.etag } : { Accept: "application/json" },
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
    async shell(username: string, signal?: AbortSignal): Promise<unknown> {
      return request(`/api/explorers/v1/profiles/${encodeURIComponent(username)}`, signal);
    },
    async category(username: string, category: PublicCategory, signal?: AbortSignal): Promise<unknown> {
      return request(`/api/explorers/v1/profiles/${encodeURIComponent(username)}/recommendations/${category}`, signal);
    },
  };
}

export const publicProfileGatewayClient = createPublicProfileGatewayClient(
  import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth",
);
