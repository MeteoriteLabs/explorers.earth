import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicProfileFixedHeader } from "../PublicProfileChromePrimitives";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

describe("PublicProfileFixedHeader", () => {
  const trackClick = vi.fn();
  beforeEach(() => {
    trackClick.mockReset(); toastSuccess.mockReset();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  it("copies, confirms, and tracks the exact profile-header event", async () => {
    render(<MemoryRouter><PublicProfileFixedHeader shareUrl="https://explorers.earth/alice" profileName="Alice" onTrackClick={trackClick} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://explorers.earth/alice"));
    expect(toastSuccess).toHaveBeenCalledWith("Link copied!");
    expect(trackClick).toHaveBeenCalledWith("share-button", { context: "profile-header" });
  });
  it("uses native share with the existing title and text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<MemoryRouter><PublicProfileFixedHeader shareUrl="https://explorers.earth/alice" profileName="Alice" onTrackClick={trackClick} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Alice's Profile", text: "Check out this profile!", url: "https://explorers.earth/alice" }));
    expect(trackClick).toHaveBeenCalledWith("share-button", { context: "profile-header" });
  });
});
