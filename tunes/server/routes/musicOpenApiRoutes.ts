import { randomUUID } from "node:crypto";
import type { Express } from "express";
import {
  musicEnsureResponseOpenApiSchema,
  musicErrorOpenApiSchema,
  musicPrincipalResponseOpenApiSchema,
} from "../../shared/musicError";

type Schema = Record<string, unknown>;
type Security = Array<Record<string, never[]>>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const requestIdParameter = { $ref: "#/components/parameters/XRequestId" } as const;
const originParameter = { $ref: "#/components/parameters/Origin" } as const;
const guestCapabilityOptional = { $ref: "#/components/parameters/GuestCapabilityOptional" } as const;
const guestCapabilityRequired = { $ref: "#/components/parameters/GuestCapabilityRequired" } as const;
const ownerSecurity: Security = [{ musicCredential: [] }];
const explorerSecurity: Security = [{ explorerProof: [] }];
const guestSecurity: Security = [{ guestCapability: [] }];

const pathParameter = (name: string, description: string, pattern = "^[1-9][0-9]*$") => ({
  name,
  in: "path" as const,
  required: true,
  description,
  schema: { type: "string", pattern },
});

const body = (schema: Schema, description: string) => ({
  required: true,
  description,
  content: { "application/json": { schema } },
});

const responseHeaders = (extra: Record<string, unknown> = {}) => ({
  "X-Request-Id": { $ref: "#/components/headers/XRequestId" },
  ...extra,
});

const success = (description: string, schema?: Schema, extraHeaders: Record<string, unknown> = {}) => ({
  description,
  headers: responseHeaders(extraHeaders),
  ...(schema ? { content: { "application/json": { schema } } } : {}),
});

const failure = (description: string, codes: string[], retryAfter = false) => ({
  description,
  headers: responseHeaders(retryAfter ? { "Retry-After": { $ref: "#/components/headers/RetryAfter" } } : {}),
  content: {
    "application/json": {
      schema: ref("MusicError"),
      examples: {
        failure: { value: { version: "music-error/v1", error: {
          code: codes[0], message: description, action: retryAfter ? "retry" : "none", retryable: retryAfter, requestId: "request-123",
        } } },
      },
    },
  },
  "x-error-codes": codes,
});

const ownerErrors = () => ({
  "400": failure("The request input is invalid.", ["REQUEST_INVALID"]),
  "401": failure("The C5 Music credential is missing, invalid, expired, or revoked.", ["AUTH_REQUIRED", "TOKEN_INVALID", "TOKEN_EXPIRED", "TOKEN_REVOKED"]),
  "403": failure("The Music identity is suspended or the exact request origin is not allowed.", ["IDENTITY_SUSPENDED", "ORIGIN_FORBIDDEN"]),
  "409": failure("The Music identity is pending deletion.", ["IDENTITY_PENDING_DELETION"]),
  "413": failure("The request body exceeds 64 KiB.", ["PAYLOAD_TOO_LARGE"]),
  "500": failure("A safe internal failure occurred.", ["INTERNAL_ERROR"]),
});

const ownerOperation = (options: {
  summary: string;
  status: "200" | "201" | "204";
  response?: Schema;
  request?: ReturnType<typeof body>;
  parameters?: unknown[];
  errors?: Record<string, unknown>;
  description?: string;
  origin?: boolean;
  success?: boolean;
}) => ({
  summary: options.summary,
  ...(options.description ? { description: options.description } : {}),
  security: ownerSecurity,
  parameters: [requestIdParameter, ...(options.origin ?? !(options.status === "200" && !options.request) ? [originParameter] : []), ...(options.parameters ?? [])],
  ...(options.request ? { requestBody: options.request } : {}),
  responses: {
    ...(options.success === false ? {} : { [options.status]: success(options.status === "204" ? "Mutation completed with no response body." : "Operation completed.", options.response) }),
    ...ownerErrors(),
    ...(options.errors ?? {}),
  },
  "x-origin-policy": options.origin ?? !(options.status === "200" && !options.request) ? "required-exact-allowlist-match" : "not-required-for-read",
});

const playlistId = pathParameter("playlistId", "Owner-predicated saved playlist identifier");
const songId = pathParameter("songId", "Owner-predicated song identifier");
const guestUrl = pathParameter("guestUrl", "Public playlist slug; never a capability", "^[A-Za-z0-9_-]{8,128}$");
const publicationAction = {
  name: "action", in: "path" as const, required: true,
  description: "Explicit public discovery transition",
  schema: { type: "string", enum: ["publish", "unpublish"] },
};

const paths = {
  "/api-docs": {
    get: {
      summary: "Read this live Music OpenAPI document",
      security: [],
      parameters: [requestIdParameter],
      responses: { "200": success("OpenAPI 3.1 document.", { type: "object" }) },
    },
  },
  "/api/music/identity/ensure": {
    post: {
      summary: "Mint a C5 local Music credential from one authoritative Explorer proof",
      description: "Bodyless endpoint. Browser owner/account/document selectors are forbidden.",
      security: explorerSecurity,
      parameters: [requestIdParameter],
      responses: {
        "200": success("Stable local identity and exact 600-second C5 credential.", ref("MusicIdentityEnsureResponse")),
        "400": failure("The bodyless identity request is invalid.", ["REQUEST_INVALID"]),
        "401": failure("The Explorer proof is missing or invalid.", ["AUTH_REQUIRED", "AUTH_INVALID"]),
        "403": failure("The Explorer identity is ineligible or suspended.", ["IDENTITY_INELIGIBLE", "ONBOARDING_INCOMPLETE", "IDENTITY_SUSPENDED"]),
        "409": failure("The identity is ambiguous, tombstoned, pending deletion, or conflicts.", ["ACCOUNT_AMBIGUOUS", "ACCOUNT_SWITCH_CONFLICT", "IDENTITY_CONFLICT", "IDENTITY_TOMBSTONED", "IDENTITY_PENDING_DELETION"]),
        "413": failure("The bodyless endpoint received a payload.", ["PAYLOAD_TOO_LARGE"]),
        "429": failure("The identity boundary is rate limited.", ["RATE_LIMITED"], true),
        "500": failure("A safe internal failure occurred.", ["INTERNAL_ERROR"]),
        "502": failure("The authoritative Explorer response is malformed.", ["UPSTREAM_MALFORMED"]),
        "503": failure("The identity boundary is temporarily unavailable.", ["UPSTREAM_UNAVAILABLE", "DATABASE_UNAVAILABLE", "ENTRY_DISABLED"], true),
      },
    },
  },
  "/api/music/identity/current": {
    get: ownerOperation({
      summary: "Resolve the current C5 local Music principal",
      status: "200",
      response: ref("MusicPrincipalResponse"),
    }),
  },
  "/api/playlists": {
    get: ownerOperation({ summary: "List owner saved playlists", status: "200", response: { type: "array", items: ref("Playlist") } }),
    post: ownerOperation({ summary: "Create an owner saved playlist", status: "201", response: ref("Playlist"), request: body(ref("PlaylistInput"), "Saved playlist input") }),
  },
  "/api/playlists/{playlistId}": {
    get: ownerOperation({ summary: "Read one owner saved playlist", status: "200", response: ref("Playlist"), parameters: [playlistId], errors: { "404": failure("The owner-predicated playlist was not found.", ["PUBLIC_NOT_FOUND"]) } }),
    patch: ownerOperation({ summary: "Update one owner saved playlist", status: "200", response: ref("Playlist"), request: body(ref("PlaylistInput"), "Saved playlist input"), parameters: [playlistId], errors: { "404": failure("The owner-predicated playlist was not found.", ["PUBLIC_NOT_FOUND"]) } }),
    delete: ownerOperation({ summary: "Delete one owner saved playlist", status: "204", parameters: [playlistId], errors: { "404": failure("The owner-predicated playlist was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlists/{playlistId}/songs": {
    post: ownerOperation({ summary: "Add a saved-playlist song", status: "201", response: ref("PlaylistSong"), request: body(ref("SongInput"), "Saved song input"), parameters: [playlistId], errors: { "404": failure("The owner-predicated playlist was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlists/{playlistId}/songs/{songId}": {
    delete: ownerOperation({ summary: "Remove a saved-playlist song", status: "204", parameters: [playlistId, songId], errors: { "404": failure("The owner-predicated song was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlists/{playlistId}/reorder": {
    patch: ownerOperation({ summary: "Reposition a saved-playlist song", status: "204", request: body(ref("SavedReorderInput"), "Saved song position"), parameters: [playlistId], errors: { "404": failure("The owner-predicated song was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlists/{playlistId}/visibility": {
    patch: ownerOperation({ summary: "Set saved-playlist guest visibility", status: "204", request: body(ref("VisibilityInput"), "Explicit guest visibility"), parameters: [playlistId], errors: { "404": failure("The owner-predicated playlist was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlist/songs": {
    get: ownerOperation({ summary: "List the owner queue", status: "200", response: { type: "array", items: ref("Song") } }),
    post: ownerOperation({ summary: "Add to the owner queue", status: "201", response: ref("Song"), request: body(ref("SongInput"), "Queue song input") }),
  },
  "/api/music/dashboard": {
    get: ownerOperation({ summary: "Read private owner playback state", status: "200", response: ref("Dashboard") }),
  },
  "/api/playlist/currently-playing": {
    post: ownerOperation({ summary: "Set or complete the owner playing song", status: "200", response: ref("Song"), request: body(ref("PlayingInput"), "Song identifier or null to complete playback"), errors: {
      "204": success("Current playback completed with no response body."),
      "404": failure("The owner-predicated song was not found.", ["PUBLIC_NOT_FOUND"]),
    } }),
  },
  "/api/playlist/songs/bulk": {
    delete: ownerOperation({ summary: "Remove up to 100 owner queue songs", status: "204", request: body(ref("BulkSongInput"), "Owner queue identifiers") }),
  },
  "/api/playlist/songs/{songId}": {
    delete: ownerOperation({ summary: "Remove one owner queue song", status: "204", parameters: [songId], errors: { "404": failure("The owner-predicated song was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlist/songs/{songId}/position": {
    patch: ownerOperation({ summary: "Reposition one owner queue song", status: "200", response: ref("Song"), request: body(ref("PositionInput"), "Non-negative queue position"), parameters: [songId], errors: { "404": failure("The owner-predicated song was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/playlist/history": {
    delete: ownerOperation({ summary: "Clear owner playback history", status: "204" }),
  },
  "/api/youtube/search": {
    post: ownerOperation({ summary: "Run bounded server-only YouTube search", status: "200", response: ref("YouTubeSearchResponse"), request: body(ref("YouTubeSearchInput"), "Search query and optional page token") }),
  },
  "/api/youtube/video-from-url": {
    post: ownerOperation({ summary: "Resolve one YouTube video URL", status: "200", response: ref("YouTubeVideo"), request: body(ref("YouTubeUrlInput"), "YouTube URL"), errors: { "404": failure("The video was not found.", ["PUBLIC_NOT_FOUND"]) } }),
  },
  "/api/music/guest-capability/rotate": {
    post: ownerOperation({ summary: "Rotate and return a new guest capability", status: "200", response: ref("GuestCapabilityResponse"), origin: true, description: "Only the SHA-256 capability hash is stored. Rotation invalidates existing guest sessions." }),
  },
  "/api/music/guest-capability/revoke": {
    post: ownerOperation({ summary: "Revoke the current guest capability", status: "204", description: "Revocation also removes public discovery authority." }),
  },
  "/api/music/publication/{action}": {
    post: ownerOperation({ summary: "Explicitly publish or unpublish Music discovery", status: "204", parameters: [publicationAction], description: "publish enables public/discoverable mode; unpublish returns to private or capability-only unlisted access." }),
  },
  "/api/music/paid/import": {
    post: ownerOperation({
      summary: "Entitlement-gated retired import boundary",
      status: "204",
      success: false,
      request: body({ type: "object", additionalProperties: false, required: ["source"], properties: { source: { type: "string", enum: ["youtube"] } } }, "Import source"),
      errors: {
        "403": failure("A current server-derived entitlement and exact origin are required.", ["ENTITLEMENT_REQUIRED", "IDENTITY_SUSPENDED", "ORIGIN_FORBIDDEN"]),
        "410": failure("The paid import operation is retired.", ["SURFACE_REMOVED"]),
      },
      description: "The browser cannot assert entitlement or refresh its source timestamp. The live operation currently returns typed 410 after entitlement authorization.",
    }),
  },
  "/api/music/entitlement": {
    get: ownerOperation({ summary: "Read server-derived entitlement freshness", status: "200", response: ref("EntitlementResponse"), description: "Local reads never refresh sourceUpdatedAt; paidMutation is true only within the 600-second maximum freshness window." }),
  },
  "/api/playlist/{guestUrl}": {
    get: {
      summary: "Read an explicit public or unlisted capability playlist",
      description: "Public discovery requires explicit publish. Unlisted responses set X-Robots-Tag: noindex, nofollow and never enter the sitemap. Unknown, private, suspended, pending, revoked, and zero-visible resources share the same safe 404.",
      security: [{}, ...guestSecurity],
      parameters: [requestIdParameter, guestUrl, guestCapabilityOptional],
      responses: {
        "200": success("Published playlist. X-Robots-Tag is present only for unlisted capability access.", ref("PublicPlaylist"), { "X-Robots-Tag": { $ref: "#/components/headers/RobotsTag" } }),
        "404": failure("The Music resource was not found.", ["PUBLIC_NOT_FOUND"]),
        "413": failure("The request exceeds 64 KiB.", ["PAYLOAD_TOO_LARGE"]),
        "429": failure("The public read rate limit was exceeded.", ["RATE_LIMITED"], true),
        "500": failure("A safe internal failure occurred.", ["INTERNAL_ERROR"]),
      },
      "x-publication-modes": ["public/discoverable", "unlisted capability; noindex/no-sitemap"],
    },
  },
  "/api/playlist/{guestUrl}/requests": {
    post: {
      summary: "Submit an allowlisted guest song request bound to this public slug",
      description: "The header capability and slug are resolved together in one owner-predicated SQL query. The secret is forbidden from URLs, logs, sitemap, and analytics.",
      security: guestSecurity,
      parameters: [requestIdParameter, originParameter, guestUrl, guestCapabilityRequired],
      requestBody: body(ref("SongInput"), "Allowlisted guest song request"),
      responses: {
        "201": success("Guest request inserted only into the capability-and-slug owner queue.", ref("Song")),
        "400": failure("The request body is invalid.", ["REQUEST_INVALID"]),
        "403": failure("The capability, slug binding, lifecycle, permission, or origin is invalid.", ["GUEST_CAPABILITY_INVALID", "ORIGIN_FORBIDDEN"]),
        "413": failure("The request body exceeds 64 KiB.", ["PAYLOAD_TOO_LARGE"]),
        "429": failure("The guest request rate limit was exceeded.", ["RATE_LIMITED"], true),
        "500": failure("A safe internal failure occurred.", ["INTERNAL_ERROR"]),
      },
      "x-origin-policy": "required-exact-allowlist-match",
    },
  },
  "/api/playlist/{guestUrl}/youtube/search": {
    post: {
      summary: "Run bounded YouTube search for an authorized guest request",
      description: "The per-slug capability is sent only in the header and is resolved with the slug before server-only lookup. No C5 owner credential or browser entitlement is accepted.",
      security: guestSecurity,
      parameters: [requestIdParameter, originParameter, guestUrl, guestCapabilityRequired],
      requestBody: body(ref("YouTubeSearchInput"), "Bounded guest search query"),
      responses: {
        "200": success("Bounded guest search results.", ref("YouTubeSearchResponse")),
        "400": failure("The search input is invalid.", ["REQUEST_INVALID"]),
        "403": failure("The capability, slug binding, lifecycle, permission, or origin is invalid.", ["GUEST_CAPABILITY_INVALID", "ORIGIN_FORBIDDEN"]),
        "413": failure("The request body exceeds 64 KiB.", ["PAYLOAD_TOO_LARGE"]),
        "429": failure("The guest lookup rate limit was exceeded.", ["RATE_LIMITED"], true),
        "500": failure("A safe internal failure occurred.", ["INTERNAL_ERROR"]),
      },
      "x-origin-policy": "required-exact-allowlist-match",
    },
  },
  "/api/playlist/{guestUrl}/youtube/video-from-url": {
    post: {
      summary: "Resolve one YouTube URL for an authorized guest request",
      description: "The per-slug capability is sent only in the header and is resolved with the slug before server-only lookup. No C5 owner credential or browser entitlement is accepted.",
      security: guestSecurity,
      parameters: [requestIdParameter, originParameter, guestUrl, guestCapabilityRequired],
      requestBody: body(ref("YouTubeUrlInput"), "Bounded guest YouTube URL"),
      responses: {
        "200": success("Resolved guest video.", ref("YouTubeVideo")),
        "400": failure("The YouTube URL is invalid.", ["REQUEST_INVALID"]),
        "403": failure("The capability, slug binding, lifecycle, permission, or origin is invalid.", ["GUEST_CAPABILITY_INVALID", "ORIGIN_FORBIDDEN"]),
        "404": failure("The video was not found.", ["PUBLIC_NOT_FOUND"]),
        "413": failure("The request body exceeds 64 KiB.", ["PAYLOAD_TOO_LARGE"]),
        "429": failure("The guest lookup rate limit was exceeded.", ["RATE_LIMITED"], true),
        "500": failure("A safe internal failure occurred.", ["INTERNAL_ERROR"]),
      },
      "x-origin-policy": "required-exact-allowlist-match",
    },
  },
} as const;

export const MUSIC_OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Explorers Music API",
    version: "music-principal-v1",
    description: "Live C5 owner, guest capability, publication, and identity routes only.",
  },
  paths,
  components: {
    securitySchemes: {
      explorerProof: { type: "http", scheme: "bearer", bearerFormat: "Authoritative Explorer access token" },
      musicCredential: { type: "http", scheme: "bearer", bearerFormat: "C5 Music credential; 600-second TTL" },
      guestCapability: { type: "apiKey", in: "header", name: "X-Music-Guest-Capability", description: "Per-slug 256-bit guest secret; never place it in a URL." },
    },
    parameters: {
      XRequestId: { name: "X-Request-Id", in: "header", required: false, description: "Optional safe caller correlation ID; unsafe values are replaced.", schema: { type: "string", minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$" } },
      Origin: { name: "Origin", in: "header", required: true, description: "Exact configured browser origin. Missing, opaque, wildcard, or suffix matches are rejected.", schema: { type: "string", format: "uri" } },
      GuestCapabilityOptional: { name: "X-Music-Guest-Capability", in: "header", required: false, description: "Required only for unlisted capability access; omitted for explicit public discovery.", schema: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" } },
      GuestCapabilityRequired: { name: "X-Music-Guest-Capability", in: "header", required: true, description: "Capability for this exact guestUrl slug.", schema: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" } },
    },
    headers: {
      XRequestId: { description: "Request correlation ID matching a Music error envelope when present.", required: true, schema: { type: "string", minLength: 1, maxLength: 64 } },
      RetryAfter: { description: "Positive whole seconds before retry.", required: true, schema: { type: "string", pattern: "^[1-9][0-9]*$" } },
      RobotsTag: { description: "Present as noindex, nofollow for unlisted capability access; omitted for public discovery.", required: false, schema: { type: "string", const: "noindex, nofollow" } },
    },
    schemas: {
      MusicError: musicErrorOpenApiSchema,
      MusicIdentityEnsureResponse: musicEnsureResponseOpenApiSchema,
      MusicPrincipalResponse: musicPrincipalResponseOpenApiSchema,
      PlaylistInput: { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 120 }, description: { type: ["string", "null"], maxLength: 2_000 } } },
      SongInput: { type: "object", additionalProperties: false, required: ["youtubeId", "title", "artist", "thumbnailUrl"], properties: { youtubeId: { type: "string", minLength: 1, maxLength: 1_024 }, title: { type: "string", minLength: 1, maxLength: 1_024 }, artist: { type: "string", minLength: 1, maxLength: 1_024 }, thumbnailUrl: { type: "string", minLength: 1, maxLength: 1_024 } } },
      Song: { type: "object", additionalProperties: false, required: ["id", "userId", "youtubeId", "title", "artist", "thumbnailUrl", "position", "status", "playedAt"], properties: { id: { type: "integer", minimum: 1 }, userId: { type: "integer", minimum: 1 }, youtubeId: { type: "string" }, title: { type: "string" }, artist: { type: "string" }, thumbnailUrl: { type: "string" }, position: { type: "integer", minimum: 0 }, status: { type: "string", enum: ["queued", "playing", "played"] }, playedAt: { type: ["string", "null"], format: "date-time" } } },
      PlaylistSong: { type: "object", additionalProperties: false, required: ["id", "playlistId", "youtubeId", "title", "artist", "thumbnailUrl", "position", "addedAt"], properties: { id: { type: "integer", minimum: 1 }, playlistId: { type: "integer", minimum: 1 }, youtubeId: { type: "string" }, title: { type: "string" }, artist: { type: "string" }, thumbnailUrl: { type: "string" }, position: { type: "integer", minimum: 0 }, addedAt: { type: "string", format: "date-time" } } },
      Playlist: { type: "object", additionalProperties: false, required: ["id", "userId", "name", "description", "isVisibleToGuests", "createdAt", "updatedAt", "songs"], properties: { id: { type: "integer", minimum: 1 }, userId: { type: "integer", minimum: 1 }, name: { type: "string" }, description: { type: ["string", "null"] }, isVisibleToGuests: { type: "boolean" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, songs: { type: "array", items: ref("PlaylistSong") } } },
      Dashboard: { type: "object", additionalProperties: false, required: ["songs", "currentlyPlaying", "playedSongs"], properties: { songs: { type: "array", items: ref("Song") }, currentlyPlaying: { oneOf: [ref("Song"), { type: "null" }] }, playedSongs: { type: "array", items: ref("Song") } } },
      PublicTheme: { type: "object", additionalProperties: false, required: ["primary"], properties: { primary: { type: "string" } } },
      PublicUser: { type: "object", additionalProperties: false, required: ["id", "username", "guestUrl", "venueName", "theme", "allowSongRequests", "allowGuestPlayOnDevice", "allowPlaylistSharing", "allowRecentlyPlayedVisibility"], properties: { id: { type: "integer", minimum: 1 }, username: { type: "string" }, guestUrl: { type: "string" }, venueName: { type: ["string", "null"] }, theme: { oneOf: [ref("PublicTheme"), { type: "null" }] }, allowSongRequests: { type: "boolean" }, allowGuestPlayOnDevice: { type: "boolean" }, allowPlaylistSharing: { type: "boolean" }, allowRecentlyPlayedVisibility: { type: "boolean" } } },
      PublicPlaylist: { type: "object", additionalProperties: false, required: ["songs", "currentlyPlaying", "playedSongs", "user", "allowGuestPlayOnDevice", "allowRecentlyPlayedVisibility", "playlists"], properties: { songs: { type: "array", items: ref("Song") }, currentlyPlaying: { oneOf: [ref("Song"), { type: "null" }] }, playedSongs: { type: "array", items: ref("Song") }, user: ref("PublicUser"), allowGuestPlayOnDevice: { type: "boolean" }, allowRecentlyPlayedVisibility: { type: "boolean" }, playlists: { type: "array", items: ref("Playlist") } } },
      SavedReorderInput: { type: "object", additionalProperties: false, required: ["songId", "position"], properties: { songId: { type: "integer", minimum: 1 }, position: { type: "integer", minimum: 0 } } },
      VisibilityInput: { type: "object", additionalProperties: false, required: ["isVisibleToGuests"], properties: { isVisibleToGuests: { type: "boolean" } } },
      PlayingInput: { type: "object", additionalProperties: false, required: ["songId"], properties: { songId: { type: ["integer", "null"], minimum: 1 } } },
      BulkSongInput: { type: "object", additionalProperties: false, required: ["songIds"], properties: { songIds: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "integer", minimum: 1 } } } },
      PositionInput: { type: "object", additionalProperties: false, required: ["position"], properties: { position: { type: "integer", minimum: 0 } } },
      GuestCapabilityResponse: { type: "object", additionalProperties: false, required: ["version", "capability"], properties: { version: { const: "music-guest-capability/v1" }, capability: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" } } },
      EntitlementResponse: { type: "object", additionalProperties: false, required: ["state", "paidMutation", "coreRead", "coreMutation", "maxAgeSeconds"], properties: { state: { type: "string", enum: ["unknown", "included", "eligible", "entitled", "revoked"] }, sourceUpdatedAt: { type: "string", format: "date-time" }, paidMutation: { type: "boolean" }, coreRead: { type: "boolean", const: true }, coreMutation: { type: "boolean", const: true }, maxAgeSeconds: { type: "integer", const: 600 } } },
      YouTubeSearchInput: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", minLength: 1, maxLength: 200 }, pageToken: { type: "string", maxLength: 256 } } },
      YouTubeUrlInput: { type: "object", additionalProperties: false, required: ["url"], properties: { url: { type: "string", maxLength: 2_048 } } },
      YouTubeVideoId: { type: "object", additionalProperties: false, required: ["videoId"], properties: { videoId: { type: "string", pattern: "^[A-Za-z0-9_-]{11}$" } } },
      YouTubeThumbnail: { type: "object", additionalProperties: false, required: ["url"], properties: { url: { type: "string", maxLength: 2_048 } } },
      YouTubeThumbnails: { type: "object", additionalProperties: false, required: ["default"], properties: { default: ref("YouTubeThumbnail") } },
      YouTubeSnippet: { type: "object", additionalProperties: false, required: ["title", "channelTitle", "thumbnails"], properties: { title: { type: "string", maxLength: 1_024 }, channelTitle: { type: "string", maxLength: 1_024 }, thumbnails: ref("YouTubeThumbnails") } },
      YouTubeVideo: { type: "object", additionalProperties: false, required: ["id", "snippet"], properties: { id: ref("YouTubeVideoId"), snippet: ref("YouTubeSnippet") } },
      YouTubeSearchResponse: { type: "object", additionalProperties: false, required: ["items", "nextPageToken"], properties: { items: { type: "array", items: ref("YouTubeVideo") }, nextPageToken: { type: ["string", "null"] } } },
    },
  },
} as const;

export function setupMusicOpenApiRoutes(app: Express): void {
  app.get("/api-docs", (req, res) => {
    const supplied = req.get("x-request-id");
    const requestId = supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(supplied) ? supplied : randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.status(200).json(MUSIC_OPENAPI_DOCUMENT);
  });
}
