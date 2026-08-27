export const MUSIC_DEVELOPMENT_PROXY_PREFIX = "/__localtunes";

export function createMusicDevelopmentFetch(
  fetchImpl: typeof fetch,
  enabled: boolean,
  configuredOrigin: string,
): typeof fetch {
  if (!enabled) return (input, init) => fetchImpl(input, init);
  const authority = new URL(configuredOrigin).origin;
  return (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    const target = new URL(raw);
    if (target.origin !== authority) return Promise.reject(new Error("Music development proxy rejected an unexpected origin."));
    return fetchImpl(`${MUSIC_DEVELOPMENT_PROXY_PREFIX}${target.pathname}${target.search}`, init);
  };
}
