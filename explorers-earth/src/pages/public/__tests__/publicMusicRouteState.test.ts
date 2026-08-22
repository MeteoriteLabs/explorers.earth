import { describe, expect, it } from "vitest";

import { derivePublicMusicRouteState } from "../publicMusicRouteState";

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
