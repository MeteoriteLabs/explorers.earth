import { apiRequest } from "./queryClient";

const GUEST_CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
let pendingUnlistedOperationKey: string | undefined;

export async function requestUnlistedShareCapability(): Promise<string> {
  const operationKey = pendingUnlistedOperationKey ?? `tunes-share-${crypto.randomUUID()}`;
  pendingUnlistedOperationKey = operationKey;
  try {
    const response = await apiRequest(
      "POST",
      "/api/music/publication",
      { mode: "unlisted" },
      0,
      3,
      { "Idempotency-Key": operationKey },
    );
    const result = await response.json() as { version?: unknown; capability?: unknown };
    pendingUnlistedOperationKey = undefined;
    if (result.version !== "music-publication/v1" || typeof result.capability !== "string"
        || !GUEST_CAPABILITY_PATTERN.test(result.capability)) {
      throw new Error("Music sharing returned an invalid response.");
    }
    return result.capability;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status) : undefined;
    if (status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 429) {
      pendingUnlistedOperationKey = undefined;
    }
    throw error;
  }
}
