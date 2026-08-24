import { describe, expect, it, vi } from "vitest";
import { deactivateExplorerAndMusic } from "./accountDeactivationCoordinator";

describe("deactivateExplorerAndMusic", () => {
  it("does not block Explorer when Music suspension fails", async () => {
    const blockExplorer = vi.fn();
    await expect(deactivateExplorerAndMusic({
      blockExplorer,
      suspendMusic: vi.fn().mockRejectedValue(new Error("Music unavailable")),
      resumeMusic: vi.fn(),
    })).rejects.toThrow("Music unavailable");
    expect(blockExplorer).not.toHaveBeenCalled();
  });

  it("suspends Music before blocking Explorer", async () => {
    const events: string[] = [];
    await deactivateExplorerAndMusic({
      blockExplorer: vi.fn(async () => { events.push("explorer-blocked"); return true; }),
      suspendMusic: vi.fn(async () => { events.push("music-suspended"); }),
      resumeMusic: vi.fn(),
    });
    expect(events).toEqual(["music-suspended", "explorer-blocked"]);
  });

  it("reactivates Music when Explorer blocking is unconfirmed", async () => {
    const events: string[] = [];
    await expect(deactivateExplorerAndMusic({
      suspendMusic: vi.fn(async () => { events.push("music-suspended"); }),
      blockExplorer: vi.fn(async () => { events.push("explorer-unconfirmed"); return false; }),
      resumeMusic: vi.fn(async () => { events.push("music-reactivated"); }),
    })).rejects.toThrow("Explorer account status update was not confirmed");
    expect(events).toEqual(["music-suspended", "explorer-unconfirmed", "music-reactivated"]);
  });

  it("reactivates Music before propagating an Explorer blocking failure", async () => {
    const events: string[] = [];
    const failure = new Error("Explorer unavailable");
    await expect(deactivateExplorerAndMusic({
      suspendMusic: vi.fn(async () => { events.push("music-suspended"); }),
      blockExplorer: vi.fn(async () => { events.push("explorer-failed"); throw failure; }),
      resumeMusic: vi.fn(async () => { events.push("music-reactivated"); }),
    })).rejects.toBe(failure);
    expect(events).toEqual(["music-suspended", "explorer-failed", "music-reactivated"]);
  });
});
