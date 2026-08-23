import { describe, expect, it } from "vitest";

import {
  publicMusicPollingInterval,
  shouldRetryPublicMusicPlaylist,
} from "../PublicMusic";
import { derivePublicMusicRouteState } from "../publicMusicRouteState";

describe("public music playlist retry policy", () => {
  it("retries two transient failures and stops before a third retry", () => {
    expect([0, 1, 2, 3].map(shouldRetryPublicMusicPlaylist)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("polls successful playlists but stops scheduled polling after an error", () => {
    expect(publicMusicPollingInterval({ state: { status: "success" } })).toBe(1_000);
    expect(publicMusicPollingInterval({ state: { status: "pending" } })).toBe(1_000);
    expect(publicMusicPollingInterval({ state: { status: "error" } })).toBe(false);
  });
});

describe("derivePublicMusicRouteState", () => {
  it("settles as empty when the account has no Local Tunes URL", () => {
    expect(derivePublicMusicRouteState({
      accountLoading: false,
      accountError: undefined,
      guestUrl: null,
      playlistLoading: false,
      playlistError: undefined,
      playlist: undefined,
    })).toEqual({ loading: false, error: undefined, hasUsableData: false, empty: true });
  });

  it("surfaces account lookup failures", () => {
    const accountError = new Error("account failed");
    expect(derivePublicMusicRouteState({
      accountLoading: false,
      accountError,
      guestUrl: null,
      playlistLoading: false,
      playlistError: undefined,
      playlist: undefined,
    })).toEqual({ loading: false, error: accountError, hasUsableData: false, empty: false });
  });

  it("loads the playlist only after a guest URL is available", () => {
    expect(derivePublicMusicRouteState({
      accountLoading: false,
      accountError: undefined,
      guestUrl: "guest-token",
      playlistLoading: true,
      playlistError: undefined,
      playlist: undefined,
    })).toEqual({ loading: true, error: undefined, hasUsableData: false, empty: false });
  });

  it("keeps usable playlist content during a background refresh", () => {
    const playlist = { user: { venueName: "Test" } };
    expect(derivePublicMusicRouteState({
      accountLoading: false,
      accountError: undefined,
      guestUrl: "guest-token",
      playlistLoading: true,
      playlistError: undefined,
      playlist,
    })).toEqual({ loading: true, error: undefined, hasUsableData: true, empty: false });
  });
});
