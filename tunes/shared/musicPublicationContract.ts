export type MusicPublicationMode = "private" | "unlisted" | "public";

type Publication<M extends MusicPublicationMode> = {
  mode: M;
  publicSlug: string;
};

export type MusicPublicationCommandResponse =
  | { version: "music-publication/v1"; publication: Publication<"private"> }
  | { version: "music-publication/v1"; publication: Publication<"public"> }
  | { version: "music-publication/v1"; publication: Publication<"unlisted">; capability: string };

const PUBLIC_SLUG_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

export function parseMusicPublicationResponse(
  value: unknown,
  requestedMode: "unlisted",
): Extract<MusicPublicationCommandResponse, { publication: { mode: "unlisted" } }>;
export function parseMusicPublicationResponse(
  value: unknown,
  requestedMode: "private",
): Extract<MusicPublicationCommandResponse, { publication: { mode: "private" } }>;
export function parseMusicPublicationResponse(
  value: unknown,
  requestedMode: "public",
): Extract<MusicPublicationCommandResponse, { publication: { mode: "public" } }>;
export function parseMusicPublicationResponse(
  value: unknown,
  requestedMode: MusicPublicationMode,
): MusicPublicationCommandResponse;
export function parseMusicPublicationResponse(
  value: unknown,
  requestedMode: MusicPublicationMode,
): MusicPublicationCommandResponse {
  const invalid = () => { throw new Error("Music sharing returned an invalid response."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const result = value as Record<string, unknown>;
  const expectedRootKeys = requestedMode === "unlisted"
    ? ["capability", "publication", "version"]
    : ["publication", "version"];
  if (!hasExactKeys(result, expectedRootKeys) || result.version !== "music-publication/v1") invalid();
  if (!result.publication || typeof result.publication !== "object" || Array.isArray(result.publication)) invalid();
  const publication = result.publication as Record<string, unknown>;
  if (!hasExactKeys(publication, ["mode", "publicSlug"])
      || publication.mode !== requestedMode
      || typeof publication.publicSlug !== "string"
      || !PUBLIC_SLUG_PATTERN.test(publication.publicSlug)) invalid();
  if (requestedMode === "unlisted"
      && (typeof result.capability !== "string" || !CAPABILITY_PATTERN.test(result.capability))) invalid();
  return value as MusicPublicationCommandResponse;
}
