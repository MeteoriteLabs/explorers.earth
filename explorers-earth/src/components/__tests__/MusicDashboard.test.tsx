import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MusicDashboard from "../MusicDashboard";
import { musicWorkspaceClient } from "../../hooks/useTunesDashboard";
import { MusicClientError } from "../../lib/localTunesApiClient";

const base = {
  playlists: [] as Array<any>,
  dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private" as const, publicSlug: "public-slug-123" } },
  entitlement: { state: "included" as const, coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};
const scope = { userDocumentId: "explorer-user-a", accountDocumentId: "explorer-account-a" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("Music workspace UI", () => {
  afterEach(() => vi.restoreAllMocks());
  it("composes the approved owner player, search, queue, and history surface", () => {
    const playlists = [{ id: 1, name: "Saved mix", description: null, isVisibleToGuests: false, songs: [] }];
    render(<MusicDashboard data={{ ...base, playlists, dashboard: { ...base.dashboard, queueRevision: 0 } }} scope={scope} complete />);
    expect(screen.getByLabelText("Music player region")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Find music" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Recently played" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your first song" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Saved mix" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create playlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sharing settings" })).toBeInTheDocument();
  });
  it("renders the approved ready-empty hierarchy with one primary action", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    expect(screen.getByRole("heading", { name: "Create your first playlist" })).toBeInTheDocument();
    expect(screen.getByText("Build a playlist to collect and share the music you love.")).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Create playlist" });
    expect(action.className).toContain("min-h-11");
    await userEvent.click(action);
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();
    expect(screen.getByLabelText("Playlist name")).toHaveFocus();
  });

  it("uses semantic tabs with arrow-key navigation and announces keyboard reorder", async () => {
    const playlists = [
      { id: 1, name: "One", description: null, isVisibleToGuests: false, songs: [{ id: 11, title: "A", artist: "B", thumbnailUrl: "x", position: 0 }] },
      { id: 2, name: "Two", description: null, isVisibleToGuests: false, songs: [] },
    ];
    render(<MusicDashboard data={{ ...base, playlists }} scope={scope} />);
    const first = screen.getByRole("tab", { name: /One/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Two/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Two/ }), { key: "ArrowLeft" });
    expect(first).toHaveFocus();
    expect(screen.getByLabelText("Move A down")).toHaveClass("min-h-11", "min-w-11");
  });

  it("offers only Private, Unlisted, and Public with mode-specific copy under Music", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual(["private", "unlisted", "public"]);
    expect(screen.getByText("Only you can open this Music workspace.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Unlisted" }));
    expect(screen.getByText("Anyone with the private link can view shared playlists. The page won’t appear in search.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save sharing" })).toHaveClass("min-h-11");
  });

  it("closes dialogs with Escape and returns focus to the opener", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    const opener = screen.getByRole("button", { name: "Sharing settings" });
    await userEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("returns focus through Cancel and successful create while keeping failed/retry focus inside", async () => {
    const create = vi.spyOn(musicWorkspaceClient, "createPlaylist")
      .mockRejectedValueOnce(new Error("contained"))
      .mockResolvedValueOnce({ id: 9, name: "Roads", description: null, isVisibleToGuests: false, songs: [] });
    const data = { ...base, refetch: vi.fn(async () => undefined) };
    render(<MusicDashboard data={data} scope={scope} />);
    const opener = screen.getByRole("button", { name: "Create playlist" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.type(screen.getByLabelText("Playlist name"), "Roads");
    const submit = screen.getByRole("dialog", { name: "Create playlist" }).querySelector<HTMLButtonElement>("button[type='submit']")!;
    await userEvent.click(submit);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();
    expect(submit).toHaveFocus();
    await userEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create playlist" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("centralizes sharing Cancel, failure, retry-success, and focus restoration", async () => {
    const publish = vi.spyOn(musicWorkspaceClient, "setPublication")
      .mockRejectedValueOnce(new Error("contained"))
      .mockResolvedValueOnce({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });
    const data = { ...base, refetch: vi.fn(async () => undefined) };
    render(<MusicDashboard data={data} scope={scope} />);
    const opener = screen.getByRole("button", { name: "Sharing settings" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    const save = screen.getByRole("button", { name: "Save sharing" });
    await userEvent.click(save);
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(save).toHaveFocus();
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Music sharing" })).not.toBeInTheDocument());
    expect(publish.mock.calls[0][0]).toBe("public");
    expect(publish.mock.calls[0][1]).toMatch(/^tunes-share-v1-\d{13}-[0-9a-f-]{36}$/);
    expect(publish.mock.calls[1]).toEqual(publish.mock.calls[0]);
    expect(opener).toHaveFocus();
  });

  it.each(["Escape", "Cancel", "backdrop", "mode"] as const)("does not lose an in-flight sharing command through %s", async (closePath) => {
    const pending = deferred<{ version: "music-publication/v1"; publication: { mode: "public"; publicSlug: string } }>();
    vi.spyOn(musicWorkspaceClient, "setPublication").mockReturnValue(pending.promise);
    render(<MusicDashboard data={base} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    const dialog = screen.getByRole("dialog", { name: "Music sharing" });

    if (closePath === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
    else if (closePath === "Cancel") await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    else if (closePath === "backdrop") fireEvent.mouseDown(dialog.parentElement!);
    else await userEvent.click(screen.getByRole("radio", { name: "Private" }));

    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Public" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    pending.resolve({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Music sharing" })).not.toBeInTheDocument());
  });

  it("reuses an ambiguous command after dialog remount and mode toggles", async () => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    const publish = vi.spyOn(musicWorkspaceClient, "setPublication")
      .mockRejectedValueOnce(new Error("malformed successful response"))
      .mockResolvedValueOnce({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });
    const first = render(<MusicDashboard data={base} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("radio", { name: "Private" }));
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    first.unmount();

    render(<MusicDashboard data={base} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1][1]).toBe(publish.mock.calls[0][1]);
  });

  it.each([
    new MusicClientError("REQUEST_INVALID", 400, "The publication command is invalid."),
    new MusicClientError(
      "AUTH_UNAVAILABLE",
      409,
      "The saved publication command has expired.",
      undefined,
      "PUBLICATION_REPLAY_EXPIRED",
      false,
    ),
  ])("retires a publication command rejected with terminal code $code/$upstreamCode", async (terminalError) => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    const publish = vi.spyOn(musicWorkspaceClient, "setPublication")
      .mockRejectedValueOnce(terminalError)
      .mockResolvedValueOnce({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });

    render(<MusicDashboard data={base} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));

    expect(publish.mock.calls[1][1]).not.toBe(publish.mock.calls[0][1]);
  });

  it("keeps recovery and sharing guidance at the approved body-size token", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    await userEvent.click(screen.getByRole("radio", { name: "Unlisted" }));
    expect(screen.getByText("Save to create a new private link. Creating another link replaces the previous one.")).toHaveClass("text-base");
  });

  it("shows the canonical link and preview affordance for a public workspace", async () => {
    render(<MusicDashboard data={{ ...base, dashboard: { ...base.dashboard, publication: { mode: "public", publicSlug: "public-slug-123" } } }} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    expect(screen.getByLabelText("Music share link")).toHaveValue(`${window.location.origin}/music/share/public-slug-123`);
    expect(screen.getByRole("link", { name: "Preview public Music page" })).toHaveAttribute("target", "_blank");
  });
});
