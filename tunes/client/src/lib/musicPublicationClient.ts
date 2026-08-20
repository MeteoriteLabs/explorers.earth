import { apiRequest } from "./queryClient";

const GUEST_CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function requestUnlistedShareCapability(): Promise<string> {
  const response = await apiRequest(
    "POST",
    "/api/music/publication",
    { mode: "unlisted" },
    0,
    3,
    { "Idempotency-Key": `tunes-share-${crypto.randomUUID()}` },
  );
  const result = await response.json() as { version?: unknown; capability?: unknown };
  if (result.version !== "music-publication/v1" || typeof result.capability !== "string"
      || !GUEST_CAPABILITY_PATTERN.test(result.capability)) {
    throw new Error("Music sharing returned an invalid response.");
  }
  return result.capability;
}
