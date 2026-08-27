import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MusicGuestControls } from "../MusicGuestControls";

const value = { allowSongRequests: true, allowGuestPlayOnDevice: false, allowPlaylistSharing: true, allowRecentlyPlayedVisibility: false };

describe("MusicGuestControls", () => {
  it("persists all four canonical settings as one owner-scoped update", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MusicGuestControls value={value} onSave={onSave} />);
    expect(screen.getAllByRole("switch")).toHaveLength(4);
    await userEvent.click(screen.getByRole("switch", { name: "Allow song requests" }));
    expect(onSave).toHaveBeenCalledWith({ ...value, allowSongRequests: false });
  });

  it("disables mutations while the workspace is read-only", () => {
    render(<MusicGuestControls value={value} onSave={vi.fn()} readOnly />);
    for (const control of screen.getAllByRole("switch")) expect(control).toBeDisabled();
  });
});
