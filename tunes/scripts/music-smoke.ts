const endpoints = [
  ["strapi health", "http://127.0.0.1:51337/health"],
  ["strapi identity", "http://127.0.0.1:51337/api/users/me"],
  ["strapi accounts", "http://127.0.0.1:51337/api/accounts"],
  ["tunes health", "http://127.0.0.1:55000/health"],
  ["tunes identity projection", "http://127.0.0.1:55000/api/smoke"],
  ["explorers health", "http://127.0.0.1:55173/health"],
] as const;

export {};

for (const [name, url] of endpoints) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  const body = await response.json();
  if (!body || typeof body !== "object") throw new Error(`${name} returned an invalid body`);
}
