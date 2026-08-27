import { describe, expect, it, vi } from "vitest";
import { createMusicPlaybackArbiter } from "../musicPlaybackCommand";

describe("createMusicPlaybackArbiter authority boundary", () => {
  it("does not dispatch a same-song stale-scope closure after authority changes", async () => {
    // Break caught: an old dashboard handler can use the global credential transport after account B becomes current.
    let authority = "user-a/account-a";
    const write = vi.fn(async () => ({ revision: 2 }));
    const options = {
      write,
      onAcknowledged: vi.fn(),
      currentRevision: () => 1,
      isAuthorityCurrent: () => authority === "user-a/account-a",
    };
    const arbiter = createMusicPlaybackArbiter(options);
    const requestId = arbiter.beginPlaybackRequest();

    authority = "user-b/account-b";
    await expect(arbiter.requestPlayback(42, requestId, "same-id-play"))
      .resolves.toBe("superseded");
    expect(write).not.toHaveBeenCalled();
  });
});
