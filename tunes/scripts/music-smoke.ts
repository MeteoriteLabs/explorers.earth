const endpoints = [
  ["strapi health", "http://127.0.0.1:51337/health"],
  ["strapi identity", "http://127.0.0.1:51337/api/users/me"],
  ["strapi accounts", "http://127.0.0.1:51337/api/accounts"],
  ["Tunes application Strapi/PostgreSQL readiness", "http://127.0.0.1:55000/api/music-fixture/readiness"],
  ["Explorers application", "http://127.0.0.1:55173/"],
  ["Explorers-to-Tunes application path", "http://127.0.0.1:55173/api/music-fixture/readiness"],
] as const;

export {};

for (const [name, url] of endpoints) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  const body = await response.json();
  if (!body || typeof body !== "object") throw new Error(`${name} returned an invalid body`);
}
