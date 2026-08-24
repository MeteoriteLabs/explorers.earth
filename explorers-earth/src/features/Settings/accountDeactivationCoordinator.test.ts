import { describe, expect, it, vi } from "vitest";
import { deactivateExplorerAndMusic } from "./accountDeactivationCoordinator";

describe("deactivateExplorerAndMusic", () => {
  it("does not suspend Music until Explorer blocking is confirmed", async () => {
    const suspendMusic = vi.fn();
    await expect(deactivateExplorerAndMusic({
      blockExplorer: vi.fn().mockResolvedValue(false),
      suspendMusic,
    })).rejects.toThrow("Explorer account status update was not confirmed");
    expect(suspendMusic).not.toHaveBeenCalled();
  });

  it("suspends Music only after Explorer blocking is confirmed", async () => {
    const events: string[] = [];
    await deactivateExplorerAndMusic({
      blockExplorer: vi.fn(async () => { events.push("explorer-blocked"); return true; }),
      suspendMusic: vi.fn(async () => { events.push("music-suspended"); }),
    });
    expect(events).toEqual(["explorer-blocked", "music-suspended"]);
  });
});
