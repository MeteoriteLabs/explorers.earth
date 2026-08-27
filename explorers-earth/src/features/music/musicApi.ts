import { createLocalTunesApiClient } from "../../lib/localTunesApiClient";
import useAuthStore from "../../store/store";
import { createMusicIdentityCoordinator } from "./musicIdentityCoordinator";
import { createMusicDevelopmentFetch } from "./musicDevelopmentTransport";

const musicOrigin = import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth";

export const musicApi = createLocalTunesApiClient({
  baseUrl: musicOrigin,
  fetchImpl: createMusicDevelopmentFetch(fetch, import.meta.env.DEV, musicOrigin),
  getStrapiBearer: async () => useAuthStore.getState().token ?? undefined,
});

export const musicIdentityCoordinator = createMusicIdentityCoordinator({
  ensureIdentity: () => musicApi.ensureIdentity(),
});

export function musicJson<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return musicApi.request({ method, path, body, idempotencyKey }).then(async (response) => {
    if (response.ok) return response.status === 204 ? undefined as T : response.json() as Promise<T>;
    throw new Error("Music request failed.");
  });
}
