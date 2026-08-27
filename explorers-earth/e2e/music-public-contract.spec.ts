import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const fixtureOrigin = "http://localhost:55173";
test.skip(process.env.PLAYWRIGHT_EXTERNAL_BASE_URL !== fixtureOrigin, "requires the integrated Music fixture");

type GuestControls = {
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
  allowQueueVisibility: boolean;
};

type OwnerState = {
  credential?: string;
  initialControls?: GuestControls;
  playlistId?: number;
  queueRevision?: number;
};

const ownerStates = new WeakMap<Page, OwnerState>();

function ownerState(page: Page): OwnerState {
  const state = ownerStates.get(page);
  if (!state) throw new Error("fixture owner state was not initialized");
  return state;
}

function mutationHeaders(credential: string, key = `music-contract-${randomUUID()}`): Record<string, string> {
  return { Authorization: credential, Origin: fixtureOrigin, "Idempotency-Key": key };
}

function publicationHeaders(credential: string): Record<string, string> {
  return mutationHeaders(credential, `tunes-share-v1-${Date.now()}-${randomUUID()}`);
}

async function authenticateOwner(page: Page): Promise<string> {
  await page.goto("/google-auth/callback?access_token=fixture-read-only-token");
  await expect(page.getByText("Login successful! Redirecting...")).toBeVisible();
  await page.goto("/recommendations/music");
  await expect(page.getByRole("tab", { name: "Playlists", exact: true })).toHaveAttribute("aria-selected", "true");
  const credential = ownerState(page).credential;
  expect(credential, "the fixture must mint an owner Music credential after Explorer login").toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return credential!;
}

async function publicResource(page: Page, publicSlug: string, capability?: string) {
  return page.request.get(`${fixtureOrigin}/api/playlist/${publicSlug}`, {
    headers: capability ? { "X-Music-Guest-Capability": capability } : undefined,
  });
}

test.beforeEach(async ({ page }) => {
  ownerStates.set(page, {});
  page.on("request", (request) => {
    const url = new URL(request.url());
    const authorization = request.headers().authorization;
    if (url.origin === fixtureOrigin
      && authorization?.startsWith("Bearer ")
      && authorization !== "Bearer fixture-read-only-token"
      && ["/api/music/dashboard", "/api/playlists", "/api/music/guest-controls"].includes(url.pathname)) {
      ownerState(page).credential = authorization;
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const state = ownerStates.get(page);
  try {
    if (!state?.credential) return;
    const credential = state.credential;
    if (state.queueRevision !== undefined) {
      const cleared = await page.request.post(`${fixtureOrigin}/api/music/queue/replace`, {
        headers: mutationHeaders(credential), data: { expectedRevision: state.queueRevision, songs: [] },
      });
      expect(cleared.status(), "fixture queue cleanup").toBe(200);
    }
    if (state.playlistId) {
      const deleted = await page.request.delete(`${fixtureOrigin}/api/playlists/${state.playlistId}`, {
        headers: mutationHeaders(credential),
      });
      expect(deleted.status(), "fixture contract playlist cleanup").toBe(204);
    }
    if (state.initialControls) {
      const restored = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
        headers: mutationHeaders(credential), data: state.initialControls,
      });
      expect(restored.status(), "fixture guest-control cleanup").toBe(200);
    }
    const privatePublication = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
      headers: publicationHeaders(credential), data: { mode: "private" },
    });
    expect(privatePublication.status(), "fixture publication cleanup").toBe(200);
  } finally {
    ownerStates.delete(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach("public-contract-fixture", { body: await page.screenshot(), contentType: "image/png" });
    }
  }
});

test("owner publication, playlist visibility, and playlist-sharing settings persist and control fixture public access", async ({ page }) => {
  const credential = await authenticateOwner(page);
  const initialControlsResponse = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: { Authorization: credential },
  });
  expect(initialControlsResponse.status()).toBe(200);
  ownerState(page).initialControls = await initialControlsResponse.json() as GuestControls;

  const name = `Fixture public contract ${randomUUID().slice(0, 8)}`;
  const created = await page.request.post(`${fixtureOrigin}/api/playlists`, {
    headers: mutationHeaders(credential), data: { name, description: "Real fixture exposure matrix" },
  });
  expect(created.status()).toBe(201);
  const playlist = await created.json() as { id: number };
  ownerState(page).playlistId = playlist.id;

  const addedSong = await page.request.post(`${fixtureOrigin}/api/playlists/${playlist.id}/songs`, {
    headers: mutationHeaders(credential),
    data: { youtubeId: "abcdefghijk", title: "Fixture public song", artist: "Fixture artist", thumbnailUrl: `${fixtureOrigin}/images/tuneslogo.png` },
  });
  expect(addedSong.status()).toBe(201);
  const savedSong = await addedSong.json() as { id: number };

  const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, {
    headers: { Authorization: credential },
  });
  expect(dashboard.status()).toBe(200);
  const queued = await page.request.post(`${fixtureOrigin}/api/music/queue/replace`, {
    headers: mutationHeaders(credential),
    data: { expectedRevision: (await dashboard.json() as { queueRevision: number }).queueRevision, songs: [{ playlistId: playlist.id, songId: savedSong.id }] },
  });
  expect(queued.status(), "queue an owner saved song for the public visibility contract").toBe(200);
  ownerState(page).queueRevision = (await queued.json() as { revision: number }).revision;

  const visible = await page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: true },
  });
  expect(visible.status()).toBe(204);
  const sharingEnabled: GuestControls = { ...ownerState(page).initialControls!, allowPlaylistSharing: true };
  const enabled = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: sharingEnabled,
  });
  expect(enabled.status()).toBe(200);

  const madePublic = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "public" },
  });
  expect(madePublic.status()).toBe(200);
  const publicCommand = await madePublic.json() as { publication: { mode: string; publicSlug: string } };
  expect(publicCommand.publication.mode).toBe("public");

  const publicVisible = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicVisible.status(), "public workspace exposes a visible playlist when sharing is enabled").toBe(200);
  const publicVisibleBody = await publicVisible.json() as { playlists: Array<{ id: number; songs: Array<{ title: string }> }>; user: { allowPlaylistSharing: boolean } };
  expect(publicVisibleBody.user.allowPlaylistSharing).toBe(true);
  expect(publicVisibleBody.playlists).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: playlist.id, songs: [expect.objectContaining({ title: "Fixture public song" })] }),
  ]));
  expect(publicVisibleBody).toMatchObject({ songs: [], currentlyPlaying: null, allowQueueVisibility: false, user: { allowQueueVisibility: false } });

  const queueEnabled: GuestControls = { ...sharingEnabled, allowQueueVisibility: true };
  const enabledQueue = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: queueEnabled,
  });
  expect(enabledQueue.status()).toBe(200);
  const publicQueueEnabled = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicQueueEnabled.status()).toBe(200);
  expect(await publicQueueEnabled.json()).toMatchObject({
    songs: [expect.objectContaining({ id: expect.any(Number), title: "Fixture public song" })],
    allowQueueVisibility: true,
    user: { allowQueueVisibility: true },
  });

  await page.goto("/recommendations/music");
  await expect(page.getByRole("switch", { name: `Make ${name} private` })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Live", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Show shared playlists" })).toHaveAttribute("aria-checked", "true");

  const hidden = await page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: false },
  });
  expect(hidden.status()).toBe(204);
  const publicHiddenPlaylist = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicHiddenPlaylist.status()).toBe(200);
  expect((await publicHiddenPlaylist.json() as { playlists: Array<{ id: number }> }).playlists).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: playlist.id })]));

  const visibleAgain = await page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: true },
  });
  expect(visibleAgain.status()).toBe(204);
  const sharingDisabled: GuestControls = { ...queueEnabled, allowPlaylistSharing: false };
  const disabled = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: sharingDisabled,
  });
  expect(disabled.status()).toBe(200);
  const publicSharingDisabled = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicSharingDisabled.status()).toBe(200);
  expect((await publicSharingDisabled.json() as { playlists: unknown[] }).playlists).toEqual([]);

  const sharingRestored = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: queueEnabled,
  });
  expect(sharingRestored.status()).toBe(200);
  await page.goto("/recommendations/music");
  await expect(page.getByRole("switch", { name: `Make ${name} private` })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Live", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Show shared playlists" })).toHaveAttribute("aria-checked", "true");

  const madeUnlisted = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "unlisted" },
  });
  expect(madeUnlisted.status()).toBe(200);
  const unlistedCommand = await madeUnlisted.json() as { publication: { mode: string; publicSlug: string }; capability: string };
  expect(unlistedCommand.publication).toMatchObject({ mode: "unlisted", publicSlug: publicCommand.publication.publicSlug });
  expect(unlistedCommand.capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect((await publicResource(page, unlistedCommand.publication.publicSlug)).status(), "unlisted access without its fragment capability").toBe(404);
  const unlistedResource = await publicResource(page, unlistedCommand.publication.publicSlug, unlistedCommand.capability);
  expect(unlistedResource.status(), "unlisted access with its fragment capability").toBe(200);
  expect(unlistedResource.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  await page.goto(`/music/share/${unlistedCommand.publication.publicSlug}#access=${unlistedCommand.capability}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  const madePrivate = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "private" },
  });
  expect(madePrivate.status()).toBe(200);
  expect((await publicResource(page, publicCommand.publication.publicSlug, unlistedCommand.capability)).status(), "private workspaces never expose public resources").toBe(404);
});
