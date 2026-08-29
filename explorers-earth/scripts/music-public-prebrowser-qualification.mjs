import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PREBROWSER_QUALIFICATION_VERSION = "explorers-public-prebrowser-qualification/v1";

const QUALIFICATION_CODES = new Set([
  "none", "not-run", "unexpected-failure", "identity-ensure-failed", "populated-snapshot-failed",
  "rollback-probe-failed", "phase-restore-failed", "public-capability-failed", "baseline-restore-failed",
  "ephemeral-owner-not-retired", "guard-not-clear",
]);
const CHECK_KEYS = Object.freeze([
  "populatedRollback", "profileCapability", "privateAuthority", "staleRejected", "publicProjection",
  "musicPrerequisites", "baselineRestored", "ephemeralOwnerRetired", "guardClear",
]);
const HASH_KEYS = Object.freeze([
  "populatedDatabase", "rollbackDatabase", "populatedProfile", "rollbackProfile", "baselineDatabase",
  "restoredBaselineDatabase", "baselineProfile", "restoredBaselineProfile", "publicSlug",
]);
const REVISION_KEYS = Object.freeze(["populated", "rollback", "baseline", "restoredBaseline"]);

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeHash(value) {
  return value === null || (typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
}

export function validateMusicPrebrowserQualificationRecord(value) {
  if (!exactKeys(value, ["schemaVersion", "status", "code", "checks", "counts", "hashes", "profileRevisions"])
      || value.schemaVersion !== PREBROWSER_QUALIFICATION_VERSION
      || !["unavailable", "failed", "passed"].includes(value.status)
      || !QUALIFICATION_CODES.has(value.code)
      || !exactKeys(value.checks, CHECK_KEYS)
      || !CHECK_KEYS.every((key) => typeof value.checks[key] === "boolean")
      || !exactKeys(value.counts, ["identityRows", "categoryQueries", "musicPrerequisites"])
      || ![0, 1].includes(value.counts.identityRows)
      || ![0, 20].includes(value.counts.categoryQueries)
      || !Number.isSafeInteger(value.counts.musicPrerequisites)
      || value.counts.musicPrerequisites < 0 || value.counts.musicPrerequisites > 32
      || !exactKeys(value.hashes, HASH_KEYS) || !HASH_KEYS.every((key) => safeHash(value.hashes[key]))
      || !exactKeys(value.profileRevisions, REVISION_KEYS)
      || !REVISION_KEYS.every((key) => value.profileRevisions[key] === null
        || (Number.isSafeInteger(value.profileRevisions[key]) && value.profileRevisions[key] >= 0))) {
    return false;
  }
  if (value.status === "unavailable") {
    return value.code === "not-run" && CHECK_KEYS.every((key) => value.checks[key] === false)
      && value.counts.identityRows === 0 && value.counts.categoryQueries === 0
      && value.counts.musicPrerequisites === 0 && HASH_KEYS.every((key) => value.hashes[key] === null)
      && REVISION_KEYS.every((key) => value.profileRevisions[key] === null);
  }
  if (value.status === "passed") {
    return value.code === "none" && CHECK_KEYS.every((key) => value.checks[key] === true)
      && value.counts.identityRows === 1 && value.counts.categoryQueries === 20
      && value.counts.musicPrerequisites > 0 && HASH_KEYS.every((key) => value.hashes[key] !== null)
      && REVISION_KEYS.every((key) => value.profileRevisions[key] !== null)
      && value.hashes.populatedDatabase === value.hashes.rollbackDatabase
      && value.hashes.populatedProfile === value.hashes.rollbackProfile
      && value.hashes.baselineDatabase === value.hashes.restoredBaselineDatabase
      && value.hashes.baselineProfile === value.hashes.restoredBaselineProfile
      && value.profileRevisions.populated === value.profileRevisions.rollback
      && value.profileRevisions.baseline === value.profileRevisions.restoredBaseline;
  }
  return value.code !== "none" && value.code !== "not-run";
}

export function isDistinctMusicCallbackCredential({ qualifierJwtFingerprint, callbackCredential } = {}) {
  if (typeof qualifierJwtFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(qualifierJwtFingerprint)
      || typeof callbackCredential !== "string"
      || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(callbackCredential)) return false;
  return sha256(callbackCredential.slice("Bearer ".length)) !== qualifierJwtFingerprint;
}

const clearChecks = () => ({
  populatedRollback: false,
  profileCapability: false,
  privateAuthority: false,
  staleRejected: false,
  publicProjection: false,
  musicPrerequisites: false,
  baselineRestored: false,
  ephemeralOwnerRetired: false,
  guardClear: false,
});

const explorerRoot = resolve(import.meta.dirname, "..");
const checkedInDocument = (relativePath, operation) => {
  const source = readFileSync(resolve(explorerRoot, relativePath), "utf8");
  const matches = [...source.matchAll(/gql`([\s\S]*?)`/g)]
    .map((match) => match[1])
    .filter((document) => new RegExp(`\\b(?:query|mutation)\\s+${operation}\\b`).test(document));
  if (matches.length !== 1) throw new Error(`pre-browser qualification requires one checked-in ${operation} document`);
  return matches[0];
};
const publicCategoryContracts = Object.freeze([
  ["GetPlacesLists", "recommendationLists", "places", "recommended_places"],
  ["GetMoviesLists", "movieLists", "movies", "recommended_movies"],
  ["GetBooksLists", "bookLists", "books", "recommended_books"],
  ["GetGamesLists", "gameLists", "games", "recommended_games"],
  ["GetAppsLists", "appLists", "apps", "recommended_apps"],
  ["GetProductsLists", "productLists", "products", "recommended_products"],
  ["GetPeopleLists", "personLists", "people", "recommended_people"],
  ["GetGuidesLists", "guides", "guides", "Title"],
].map(([operation, root, subject, contentKey]) => Object.freeze({ operation, root, subject, contentKey })));
const documents = Object.freeze({
  profileUser: checkedInDocument("src/features/Profile/api/query.ts", "UsersPermissionsUser"),
  settingsUser: checkedInDocument("src/features/Settings/api/mutation.ts", "UsersPermissionsUser"),
  updateAccount: checkedInDocument("src/features/Settings/api/mutation.ts", "UpdateAccount"),
  publicProfile: checkedInDocument("src/features/PublicHome/api/query.ts", "PublicProfileData"),
  publicCounts: checkedInDocument("src/features/PublicHome/api/query.ts", "PublicCategoryListCounts"),
  categories: Object.freeze(publicCategoryContracts.map((contract) => Object.freeze({
    ...contract,
    document: checkedInDocument("src/features/PublicHome/components/ProfileRecommendationsTab.tsx", contract.operation),
  }))),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactSnapshot(value) {
  return value?.version === "music-live-account-snapshot/v1"
    && typeof value.snapshotId === "string" && value.snapshotId.length > 0
    && value.profile && typeof value.profile === "object"
    && typeof value.profile.accountDocumentId === "string"
    && typeof value.profile.publicMusic === "boolean"
    && Number.isSafeInteger(value.profile.profileRevision) && value.profile.profileRevision >= 0
    && /^[a-f0-9]{64}$/.test(String(value.profile.profileHash))
    && Number.isSafeInteger(value.profile.fieldCount) && value.profile.fieldCount > 0
    && value.database && typeof value.database === "object"
    && /^e2e-public-music-[a-z0-9-]+$/.test(String(value.database.namespace))
    && /^[a-f0-9]{64}$/.test(String(value.database.dumpHash))
    && Number.isSafeInteger(value.database.identityRows)
    && [0, 1].includes(value.database.identityRows);
}

function exactRestoration(value, snapshot) {
  return value?.restored === true
    && value.beforeHash === snapshot.database.dumpHash
    && value.afterHash === snapshot.database.dumpHash
    && value.profileHash === snapshot.profile.profileHash
    && value.profileRevision === snapshot.profile.profileRevision;
}

function clearGuard(value) {
  return value?.version === "music-e2e-mutation-guard/v1"
    && value.state === "clear" && value.reason === "none" && value.stage === "preflight";
}

function safeRecord({ status, code, checks, counts, hashes, profileRevisions }) {
  return {
    schemaVersion: PREBROWSER_QUALIFICATION_VERSION,
    status,
    code,
    checks,
    counts,
    hashes,
    profileRevisions,
  };
}

export function unavailableMusicPrebrowserQualification() {
  return safeRecord({
    status: "unavailable",
    code: "not-run",
    checks: clearChecks(),
    counts: { identityRows: 0, categoryQueries: 0, musicPrerequisites: 0 },
    hashes: {
      populatedDatabase: null, rollbackDatabase: null,
      populatedProfile: null, rollbackProfile: null,
      baselineDatabase: null, restoredBaselineDatabase: null,
      baselineProfile: null, restoredBaselineProfile: null,
      publicSlug: null,
    },
    profileRevisions: { populated: null, rollback: null, baseline: null, restoredBaseline: null },
  });
}

function exactAuthority(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && value.stateOrigin === "http://127.0.0.1:55174"
    && value.tunesOrigin === "http://127.0.0.1:55000"
    && value.explorerOrigin === "http://localhost:55173"
    && value.strapiOrigin === "http://127.0.0.1:51337"
    && /^[A-Za-z0-9_-]{43,128}$/.test(String(value.stateToken))
    && /^[A-Za-z0-9_-]{43,128}$/.test(String(value.orchestrationToken))
    && /^[A-Za-z0-9_-]{43,128}$/.test(String(value.fixtureToken))
    && new Set([value.stateToken, value.orchestrationToken, value.fixtureToken]).size === 3
    && /^e2e-public-music-[a-z0-9-]+$/.test(String(value.namespace))
    && value.username === `${value.namespace}-owner`
    && value.accountDocumentId === `${value.namespace}-account`
    && value.userDocumentId === `${value.namespace}-user`;
}

function qualificationHeaders(authority, expectedRevision) {
  return {
    Authorization: `Bearer ${authority.fixtureToken}`,
    "Content-Type": "application/json",
    "X-Music-Fixture-Expected-Revision": String(expectedRevision),
    "X-Music-Fixture-Namespace": authority.namespace,
    "X-Music-Fixture-Username": authority.username,
    "X-Music-Fixture-Account-Document-Id": authority.accountDocumentId,
    "X-Music-Fixture-User-Document-Id": authority.userDocumentId,
  };
}

async function boundedResponse(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), ...options });
  let body;
  if (response.status !== 204) {
    const text = await response.text();
    if (Buffer.byteLength(text) > 64 * 1024) throw new Error("pre-browser response exceeded its private bound");
    try { body = text ? JSON.parse(text) : undefined; }
    catch { throw new Error("pre-browser response was malformed"); }
  }
  return { status: response.status, body };
}

function exactObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

export function validateMusicQualificationUpdateResponse({ status, body, accountDocumentId, expected } = {}) {
  const expectedFields = exactObject(expected);
  const keys = expectedFields ? Object.keys(expectedFields) : [];
  const allowed = new Set(["Bio", "public_profile", "public_recommendations", "public_music"]);
  if (status !== 200 || !/^e2e-public-music-[a-z0-9-]+-account$/.test(String(accountDocumentId))
      || keys.length < 1 || keys.length > 3 || keys.some((key) => !allowed.has(key))
      || keys.some((key) => typeof expectedFields[key] !== "string" || expectedFields[key].length > 256)
      || !exactKeys(body, ["data"])) return false;
  const updateAccount = exactObject(exactObject(body.data)?.updateAccount);
  return updateAccount?.documentId === accountDocumentId
    && keys.every((key) => updateAccount[key] === expectedFields[key]);
}

export function validateMusicQualificationPublicGraphql({
  operation, root, body, namespace, accountDocumentId,
} = {}) {
  if (!/^e2e-public-music-[a-z0-9-]+$/.test(String(namespace))
      || accountDocumentId !== `${namespace}-account` || !exactKeys(body, ["data"])) return false;
  const data = exactObject(body.data);
  if (!data) return false;
  if (operation === "PublicProfileData") {
    const accounts = data.accounts;
    const account = Array.isArray(accounts) && accounts.length === 1 ? exactObject(accounts[0]) : undefined;
    return root === "accounts" && account?.documentId === accountDocumentId
      && account.Account_Name === "Fixture Explorer" && account.public_profile === "Yes"
      && account.public_recommendations === "Yes" && account.public_music === "Yes";
  }
  if (operation === "PublicCategoryListCounts") {
    return root === "recommendationLists" && publicCategoryContracts.every(({ root: categoryRoot }) => {
      const values = data[categoryRoot];
      return Array.isArray(values) && values.length === 1
        && exactObject(values[0])?.documentId === `${namespace}-${categoryRoot}-count`;
    });
  }
  const contract = publicCategoryContracts.find((entry) => entry.operation === operation && entry.root === root);
  if (!contract) return false;
  const values = data[root];
  const item = Array.isArray(values) && values.length === 1 ? exactObject(values[0]) : undefined;
  const expectedDocumentId = `${namespace}-${contract.subject}-list`;
  if (item?.documentId !== expectedDocumentId) return false;
  if (contract.contentKey === "Title") return item.Title === "Fixture Guide";
  const content = item[contract.contentKey];
  return Array.isArray(content) && content.length === 1
    && exactObject(content[0])?.documentId === `${expectedDocumentId}-item`;
}

export function createLoopbackPrebrowserQualificationAdapter({ authority, initialSnapshot, fetchImpl = fetch } = {}) {
  if (!exactAuthority(authority) || !exactSnapshot(initialSnapshot) || typeof fetchImpl !== "function"
      || initialSnapshot.database.namespace !== authority.namespace
      || initialSnapshot.profile.accountDocumentId !== authority.accountDocumentId) {
    throw new Error("loopback pre-browser qualification authority is invalid");
  }
  const fixtureHeaders = { Authorization: `Bearer ${authority.fixtureToken}`, "Content-Type": "application/json" };
  const ownerHeaders = (qualifierJwt, idempotencyKey) => ({
    Authorization: `Bearer ${qualifierJwt}`,
    Origin: authority.explorerOrigin,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  });
  const tuple = {
    namespace: authority.namespace,
    username: authority.username,
    accountDocumentId: authority.accountDocumentId,
    userDocumentId: authority.userDocumentId,
  };
  const namespaceHash = sha256(authority.namespace);
  const publicationUuid = `${namespaceHash.slice(0, 8)}-${namespaceHash.slice(8, 12)}-4${namespaceHash.slice(13, 16)}-8${namespaceHash.slice(17, 20)}-${namespaceHash.slice(20, 32)}`;
  const stateRequest = (path, token, body) => boundedResponse(fetchImpl, `${authority.stateOrigin}${path}`, {
    method: path === "/health" ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const graphql = (origin, document, variables, headers = fixtureHeaders) => boundedResponse(fetchImpl, `${origin}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: document, variables }),
  });
  const privateProfile = (path, authorization, body) => boundedResponse(fetchImpl, `${authority.strapiOrigin}${path}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    async ensureEphemeralOwner() {
      const response = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/music/identity/ensure`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authority.fixtureToken}`, Origin: authority.explorerOrigin },
      });
      const body = exactObject(response.body);
      const identity = exactObject(body?.identity);
      const credential = exactObject(body?.credential);
      if (response.status !== 200 || identity?.status !== "active" || typeof credential?.token !== "string") {
        throw new Error("ephemeral owner ensure failed");
      }
      return credential.token;
    },
    async capture() {
      const response = await stateRequest("/snapshot", authority.stateToken);
      if (response.status !== 200) throw new Error("qualification snapshot failed");
      return response.body;
    },
    async verifyRollbackProbe({ qualifierJwt, profileRevision }) {
      const playlist = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/playlists`, {
        method: "POST",
        headers: ownerHeaders(qualifierJwt, "prebrowser-rollback-probe"),
        body: JSON.stringify({ name: "Pre-browser rollback probe", description: "Disposable qualification mutation" }),
      });
      if (playlist.status !== 201 || !Number.isSafeInteger(exactObject(playlist.body)?.id)) {
        throw new Error("database rollback probe failed");
      }
      for (const document of [documents.profileUser, documents.settingsUser]) {
        const identity = await graphql(authority.strapiOrigin, document, { documentId: authority.userDocumentId });
        const user = exactObject(exactObject(identity.body)?.data)?.usersPermissionsUser;
        if (identity.status !== 200 || exactObject(user)?.documentId !== authority.userDocumentId
            || exactObject(user)?.accounts?.[0]?.documentId !== authority.accountDocumentId) {
          throw new Error("profile query capability failed");
        }
      }

      const privateSnapshot = await privateProfile(
        "/__music-fixture/profile-state/snapshot", `Bearer ${authority.fixtureToken}`, tuple,
      );
      const privateBody = exactObject(privateSnapshot.body);
      if (privateSnapshot.status !== 200 || privateBody?.version !== "music-fixture-profile-state/v1"
          || !exactObject(privateBody?.snapshot)) throw new Error("private profile snapshot capability failed");
      const wrongToken = await privateProfile(
        "/__music-fixture/profile-state/snapshot", "Bearer invalid", tuple,
      );
      const wrongTuple = await privateProfile(
        "/__music-fixture/profile-state/snapshot", `Bearer ${authority.fixtureToken}`,
        { ...tuple, userDocumentId: `${authority.namespace}-other-user` },
      );
      if (wrongToken.status !== 403 || wrongTuple.status !== 403) throw new Error("private profile authority did not fail closed");

      const variables = { documentId: authority.accountDocumentId, data: { Bio: "Pre-browser qualification rollback probe" } };
      const current = await graphql(
        authority.strapiOrigin, documents.updateAccount, variables,
        qualificationHeaders(authority, profileRevision),
      );
      const stale = await graphql(
        authority.strapiOrigin, documents.updateAccount, variables,
        qualificationHeaders(authority, profileRevision),
      );
      const proxied = await graphql(
        authority.explorerOrigin, documents.updateAccount, variables,
        qualificationHeaders(authority, profileRevision),
      );
      if (!validateMusicQualificationUpdateResponse({
        status: current.status,
        body: current.body,
        accountDocumentId: authority.accountDocumentId,
        expected: variables.data,
      })
          || stale.status !== 409 || proxied.status !== 403) {
        throw new Error("profile optimistic revision capability failed");
      }
      const privateRestore = await privateProfile(
        "/__music-fixture/profile-state/restore", `Bearer ${authority.fixtureToken}`,
        { ...tuple, snapshot: privateBody.snapshot },
      );
      if (privateRestore.status !== 200 || exactObject(privateRestore.body)?.restored !== true) {
        throw new Error("private profile restore capability failed");
      }
      return { profileCapability: true, privateAuthority: true, staleRejected: true };
    },
    async restore(snapshot) {
      const response = await stateRequest("/restore", authority.stateToken, snapshot);
      if (response.status !== 200) throw new Error("qualification phase restore failed");
      return response.body;
    },
    async verifyPublicProfileAndMusic({ qualifierJwt, profileRevision }) {
      const visibilityVariables = {
        documentId: authority.accountDocumentId,
        data: { public_profile: "Yes", public_recommendations: "Yes", public_music: "Yes" },
      };
      const visible = await graphql(
        authority.strapiOrigin, documents.updateAccount, visibilityVariables,
        qualificationHeaders(authority, profileRevision),
      );
      if (!validateMusicQualificationUpdateResponse({
        status: visible.status,
        body: visible.body,
        accountDocumentId: authority.accountDocumentId,
        expected: visibilityVariables.data,
      })) {
        throw new Error("public profile visibility capability failed");
      }

      const dashboard = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/music/dashboard`, {
        headers: ownerHeaders(qualifierJwt),
      });
      const dashboardBody = exactObject(dashboard.body);
      if (dashboard.status !== 200 || !Number.isSafeInteger(dashboardBody?.queueRevision)
          || !Number.isSafeInteger(dashboardBody?.playbackRevision)
          || exactObject(dashboardBody?.publication)?.mode !== "private") {
        throw new Error("owner dashboard capability failed");
      }
      const playlist = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/playlists`, {
        method: "POST", headers: ownerHeaders(qualifierJwt, "prebrowser-public-playlist"),
        body: JSON.stringify({ name: "Pre-browser public fixture", description: "Disposable public capability" }),
      });
      const playlistId = exactObject(playlist.body)?.id;
      if (playlist.status !== 201 || !Number.isSafeInteger(playlistId)) throw new Error("public playlist capability failed");
      const songInputs = [
        { youtubeId: "abcdefghijk", title: "Fixture history song", artist: "Fixture artist", thumbnailUrl: `${authority.explorerOrigin}/images/tuneslogo.png` },
        { youtubeId: "lmnopqrstuv", title: "Fixture playing song", artist: "Fixture artist", thumbnailUrl: `${authority.explorerOrigin}/images/tuneslogo.png` },
        { youtubeId: "wxyzABC1234", title: "Fixture queued song", artist: "Fixture artist", thumbnailUrl: `${authority.explorerOrigin}/images/tuneslogo.png` },
      ];
      const songIds = [];
      for (const [index, song] of songInputs.entries()) {
        const saved = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/playlists/${playlistId}/songs`, {
          method: "POST", headers: ownerHeaders(qualifierJwt, `prebrowser-public-song-${index + 1}`),
          body: JSON.stringify(song),
        });
        const id = exactObject(saved.body)?.id;
        if (saved.status !== 201 || !Number.isSafeInteger(id) || songIds.includes(id)) {
          throw new Error("public song capability failed");
        }
        songIds.push(id);
      }
      const visibility = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/playlists/${playlistId}/visibility`, {
        method: "PATCH", headers: ownerHeaders(qualifierJwt, "prebrowser-public-visibility"),
        body: JSON.stringify({ isVisibleToGuests: true }),
      });
      if (visibility.status !== 204) throw new Error("public playlist visibility capability failed");
      const queue = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/music/queue/replace`, {
        method: "POST", headers: ownerHeaders(qualifierJwt, "prebrowser-public-queue"),
        body: JSON.stringify({ expectedRevision: dashboardBody.queueRevision,
          songs: songIds.map((songId) => ({ playlistId, songId })) }),
      });
      const queueRevision = exactObject(queue.body)?.revision;
      if (queue.status !== 200 || !Number.isSafeInteger(queueRevision)) throw new Error("public queue capability failed");
      let playbackRevision = dashboardBody.playbackRevision;
      let revision = queueRevision;
      for (const [index, songId] of songIds.slice(0, 2).entries()) {
        const playback = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/playlist/currently-playing`, {
          method: "POST", headers: ownerHeaders(qualifierJwt, `prebrowser-public-playback-${index + 1}`),
          body: JSON.stringify({ songId, expectedRevision: revision, expectedPlaybackRevision: playbackRevision }),
        });
        const playbackBody = exactObject(playback.body);
        if (playback.status !== 200 || !Number.isSafeInteger(playbackBody?.revision)
            || !Number.isSafeInteger(playbackBody?.playbackRevision)) throw new Error("public playback capability failed");
        revision = playbackBody.revision;
        playbackRevision = playbackBody.playbackRevision;
      }
      const controls = {
        allowSongRequests: true, allowGuestPlayOnDevice: true, allowPlaylistSharing: true,
        allowRecentlyPlayedVisibility: true, allowQueueVisibility: true,
      };
      const controlResponse = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/music/guest-controls`, {
        method: "PATCH", headers: ownerHeaders(qualifierJwt, "prebrowser-public-controls"), body: JSON.stringify(controls),
      });
      if (controlResponse.status !== 200) throw new Error("public controls capability failed");
      const publication = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/music/publication`, {
        method: "POST", headers: ownerHeaders(qualifierJwt, `tunes-share-v1-${Date.now()}-${publicationUuid}`),
        body: JSON.stringify({ mode: "public" }),
      });
      const publicationBody = exactObject(publication.body);
      const publicationState = exactObject(publicationBody?.publication);
      const publicSlug = publicationState?.publicSlug;
      if (publication.status !== 200 || publicationBody?.version !== "music-publication/v1"
          || publicationState?.mode !== "public" || typeof publicSlug !== "string"
          || !/^[A-Za-z0-9_-]{8,128}$/.test(publicSlug) || publicSlug === "qualification-public") {
        throw new Error("public publication capability failed");
      }

      const publicDocuments = [
        { operation: "PublicProfileData", document: documents.publicProfile,
          variables: { filters: { username: { eq: authority.username } } }, root: "accounts" },
        { operation: "PublicCategoryListCounts", document: documents.publicCounts,
          variables: { accountDocumentId: authority.accountDocumentId }, root: "recommendationLists" },
        ...documents.categories.map(({ operation, document, root }) => ({
          operation, document, variables: { accountDocumentId: authority.accountDocumentId }, root,
        })),
      ];
      let categoryQueries = 0;
      for (const origin of [authority.strapiOrigin, authority.explorerOrigin]) {
        for (const entry of publicDocuments) {
          const response = await graphql(origin, entry.document, entry.variables);
          if (response.status !== 200 || !validateMusicQualificationPublicGraphql({
            operation: entry.operation,
            root: entry.root,
            body: response.body,
            namespace: authority.namespace,
            accountDocumentId: authority.accountDocumentId,
          })) {
            throw new Error("public profile category capability failed");
          }
          categoryQueries += 1;
        }
      }
      for (const origin of [authority.tunesOrigin, authority.explorerOrigin]) {
        const resource = await boundedResponse(fetchImpl, `${origin}/api/music/public-resource/v1/${encodeURIComponent(publicSlug)}`);
        const body = exactObject(resource.body);
        if (resource.status !== 200 || body?.version !== "music-public-resource/v1"
            || exactObject(body?.currentlyPlaying)?.title !== "Fixture playing song"
            || !exactObject(body?.queue)?.items?.some((song) => song?.title === "Fixture queued song")
            || !exactObject(body?.recentlyPlayed)?.items?.some((song) => song?.title === "Fixture history song")
            || !exactObject(body?.playlists)?.items?.some((entry) => entry?.name === "Pre-browser public fixture")
            || Object.entries(controls).some(([key, enabled]) => exactObject(body?.permissions)?.[key] !== enabled)) {
          throw new Error("public Music projection capability failed");
        }
      }
      return { publicSlug, categoryQueries, musicPrerequisites: 9 };
    },
    async restoreBaseline(snapshot) {
      const response = await stateRequest("/restore-final", authority.orchestrationToken, snapshot);
      if (response.status !== 200) throw new Error("initial baseline restore failed");
      return response.body;
    },
    async verifyEphemeralOwnerRetired(qualifierJwt) {
      const response = await boundedResponse(fetchImpl, `${authority.tunesOrigin}/api/playlists`, {
        headers: ownerHeaders(qualifierJwt),
      });
      return [401, 403].includes(response.status);
    },
    async readGuard() {
      const response = await stateRequest("/health", authority.stateToken);
      if (response.status !== 200) throw new Error("mutation guard inspection failed");
      return exactObject(response.body)?.mutationGuard;
    },
  };
}

export async function runMusicPrebrowserQualification({ initialSnapshot, adapter } = {}) {
  if (!exactSnapshot(initialSnapshot) || !adapter || typeof adapter !== "object"
      || [
        "ensureEphemeralOwner", "capture", "verifyRollbackProbe", "restore",
        "verifyPublicProfileAndMusic", "restoreBaseline", "verifyEphemeralOwnerRetired", "readGuard",
      ].some((name) => typeof adapter[name] !== "function")) {
    throw new Error("pre-browser qualification contract is invalid");
  }
  const checks = clearChecks();
  const counts = { identityRows: 0, categoryQueries: 0, musicPrerequisites: 0 };
  const hashes = {
    populatedDatabase: null,
    rollbackDatabase: null,
    populatedProfile: null,
    rollbackProfile: null,
    baselineDatabase: initialSnapshot.database.dumpHash,
    restoredBaselineDatabase: null,
    baselineProfile: initialSnapshot.profile.profileHash,
    restoredBaselineProfile: null,
    publicSlug: null,
  };
  const profileRevisions = {
    populated: null,
    rollback: null,
    baseline: initialSnapshot.profile.profileRevision,
    restoredBaseline: null,
  };
  let code = "unexpected-failure";
  let qualifierJwt = "";
  let qualifierJwtFingerprint;
  let corePassed = false;

  try {
    code = "identity-ensure-failed";
    qualifierJwt = await adapter.ensureEphemeralOwner();
    if (typeof qualifierJwt !== "string" || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(qualifierJwt)
        || Buffer.byteLength(qualifierJwt) > 4_096) throw new Error("invalid ephemeral owner authority");
    qualifierJwtFingerprint = sha256(qualifierJwt);

    code = "populated-snapshot-failed";
    const populated = await adapter.capture();
    if (!exactSnapshot(populated) || populated.database.identityRows !== 1
        || populated.database.namespace !== initialSnapshot.database.namespace
        || populated.profile.accountDocumentId !== initialSnapshot.profile.accountDocumentId) {
      throw new Error("invalid populated qualification snapshot");
    }
    counts.identityRows = populated.database.identityRows;
    hashes.populatedDatabase = populated.database.dumpHash;
    hashes.populatedProfile = populated.profile.profileHash;
    profileRevisions.populated = populated.profile.profileRevision;

    code = "rollback-probe-failed";
    const rollbackProbe = await adapter.verifyRollbackProbe({
      qualifierJwt,
      profileRevision: populated.profile.profileRevision,
    });
    if (rollbackProbe?.profileCapability !== true || rollbackProbe?.privateAuthority !== true
        || rollbackProbe?.staleRejected !== true) throw new Error("rollback probe was incomplete");
    checks.profileCapability = true;
    checks.privateAuthority = true;
    checks.staleRejected = true;

    code = "phase-restore-failed";
    const rollback = await adapter.restore(populated);
    if (!exactRestoration(rollback, populated)) throw new Error("populated rollback mismatch");
    hashes.rollbackDatabase = rollback.afterHash;
    hashes.rollbackProfile = rollback.profileHash;
    profileRevisions.rollback = rollback.profileRevision;
    checks.populatedRollback = true;

    code = "populated-snapshot-failed";
    const publicSnapshot = await adapter.capture();
    if (!exactSnapshot(publicSnapshot) || publicSnapshot.database.identityRows !== 1
        || publicSnapshot.database.namespace !== initialSnapshot.database.namespace
        || publicSnapshot.profile.accountDocumentId !== initialSnapshot.profile.accountDocumentId) {
      throw new Error("invalid public qualification snapshot");
    }

    code = "public-capability-failed";
    const publicCapability = await adapter.verifyPublicProfileAndMusic({
      qualifierJwt,
      profileRevision: publicSnapshot.profile.profileRevision,
    });
    if (typeof publicCapability?.publicSlug !== "string"
        || !/^[A-Za-z0-9_-]{8,128}$/.test(publicCapability.publicSlug)
        || publicCapability.publicSlug === "qualification-public"
        || publicCapability.categoryQueries !== 20
        || !Number.isSafeInteger(publicCapability.musicPrerequisites)
        || publicCapability.musicPrerequisites < 1) {
      throw new Error("public capability was incomplete");
    }
    counts.categoryQueries = publicCapability.categoryQueries;
    counts.musicPrerequisites = publicCapability.musicPrerequisites;
    hashes.publicSlug = sha256(publicCapability.publicSlug);
    checks.publicProjection = true;
    checks.musicPrerequisites = true;

    code = "phase-restore-failed";
    const publicRestore = await adapter.restore(publicSnapshot);
    if (!exactRestoration(publicRestore, publicSnapshot)) throw new Error("public capability rollback mismatch");
    corePassed = true;
    code = "none";
  } catch {
    // Only the fixed code selected before each operation is retained.
  } finally {
    try {
      const baselineRestore = await adapter.restoreBaseline(initialSnapshot);
      if (!exactRestoration(baselineRestore, initialSnapshot)) throw new Error("baseline mismatch");
      hashes.restoredBaselineDatabase = baselineRestore.afterHash;
      hashes.restoredBaselineProfile = baselineRestore.profileHash;
      profileRevisions.restoredBaseline = baselineRestore.profileRevision;
      checks.baselineRestored = true;
    } catch {
      code = "baseline-restore-failed";
      corePassed = false;
    }
    if (qualifierJwt) {
      try {
        checks.ephemeralOwnerRetired = await adapter.verifyEphemeralOwnerRetired(qualifierJwt) === true;
        if (!checks.ephemeralOwnerRetired) {
          code = "ephemeral-owner-not-retired";
          corePassed = false;
        }
      } catch {
        code = "ephemeral-owner-not-retired";
        corePassed = false;
      }
    }
    qualifierJwt = "";
    try {
      checks.guardClear = clearGuard(await adapter.readGuard());
      if (!checks.guardClear) {
        code = "guard-not-clear";
        corePassed = false;
      }
    } catch {
      code = "guard-not-clear";
      corePassed = false;
    }
  }

  const ok = corePassed && checks.baselineRestored && checks.ephemeralOwnerRetired && checks.guardClear;
  const record = safeRecord({
    status: ok ? "passed" : "failed",
    code: ok ? "none" : code,
    checks,
    counts,
    hashes,
    profileRevisions,
  });
  return {
    ok,
    record,
    ...(ok ? { qualifierJwtFingerprint } : {}),
  };
}
