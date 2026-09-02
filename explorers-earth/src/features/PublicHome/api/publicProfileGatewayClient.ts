export type PublicCategory = "places" | "movies" | "books" | "games" | "guides" | "apps" | "products" | "people";

type FetchLike = typeof fetch;

export function createPublicProfileGatewayClient(baseUrl: string, fetchImpl: FetchLike = fetch) {
  const origin = baseUrl.replace(/\/$/, "");
  return {
    async shell(username: string, signal?: AbortSignal): Promise<unknown> {
      const response = await fetchImpl(`${origin}/api/explorers/v1/profiles/${encodeURIComponent(username)}`, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`PUBLIC_PROFILE_${response.status}`);
      return response.json();
    },
    async category(username: string, category: PublicCategory, signal?: AbortSignal): Promise<unknown> {
      const response = await fetchImpl(`${origin}/api/explorers/v1/profiles/${encodeURIComponent(username)}/recommendations/${category}`, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`PUBLIC_PROFILE_${response.status}`);
      return response.json();
    },
  };
}
