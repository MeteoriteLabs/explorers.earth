import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MusicSearch } from "../MusicSearch";

const first = { id: { videoId: "abcdefghijk" }, snippet: { title: "First song", channelTitle: "Artist one", thumbnails: { default: { url: "https://img/1" } } } };
const second = { id: { videoId: "lmnopqrstuv" }, snippet: { title: "Second song", channelTitle: "Artist two", thumbnails: { default: { url: "https://img/2" } } } };

function clients() {
  return {
    searchClient: {
      searchYouTube: vi.fn().mockResolvedValue({ items: [first, second], nextPageToken: "next" }),
      videoFromUrl: vi.fn().mockResolvedValue(first),
    },
    queueClient: {
      addSong: vi.fn().mockResolvedValue({ id: 7, youtubeId: "abcdefghijk" }),
      setPlaying: vi.fn().mockResolvedValue({ id: 7 }),
    },
    onChanged: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MusicSearch", () => {
  it("uses one discovery input with attached URL and retired import actions", async () => {
    const props = clients();
    render(<MusicSearch {...props} />);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const input = screen.getByRole("searchbox", { name: "Search music or paste a URL" });
    await userEvent.type(input, "https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Open discovery actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add from URL" }));
    expect(props.searchClient.videoFromUrl).toHaveBeenCalledWith("https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Open discovery actions" }));
    const importAction = screen.getByRole("menuitem", { name: "Import playlist unavailable" });
    expect(importAction).toBeDisabled();
    expect(screen.getByText(/playlist import is not currently supported/i)).toBeInTheDocument();
  });

  it("adds selected discoveries to a chosen saved playlist", async () => {
    const props = clients();
    const playlistClient = { addPlaylistSong: vi.fn().mockResolvedValue({ id: 33 }) };
    render(<MusicSearch {...props} playlists={[{ id: 9, name: "Roads" }]} playlistClient={playlistClient} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select First song" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Add selected to" }), "9");
    await userEvent.click(screen.getByRole("button", { name: "Add 1 selected to Roads" }));
    expect(playlistClient.addPlaylistSong).toHaveBeenCalledWith(9, expect.objectContaining({ youtubeId: "abcdefghijk" }), expect.stringMatching(/^music-playlist-add-/));
  });
  it("searches, selects multiple results, adds them, and paginates", async () => {
    const props = clients();
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("First song")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select First song" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Second song" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 2 selected to queue" }));
    await waitFor(() => expect(props.queueClient.addSong).toHaveBeenCalledTimes(2));
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(props.searchClient.searchYouTube).toHaveBeenLastCalledWith("roads", "next");
  });

  it("looks up a URL and supports play now without an unhandled rejection", async () => {
    const props = clients();
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Open discovery actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add from URL" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    await waitFor(() => expect(props.queueClient.setPlaying).toHaveBeenCalledWith(7, expect.stringMatching(/^music-play-/)));
    expect(props.onChanged).toHaveBeenCalledTimes(1);
  });

  it("contains retryable failures, announces them, and can retry", async () => {
    const props = clients();
    props.searchClient.searchYouTube.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [], nextPageToken: null });
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Music search is temporarily unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try search again" }));
    expect(await screen.findByText("No music found.")).toBeInTheDocument();
  });

  it("reconciles the queue when a multi-add only partly succeeds", async () => {
    const props = clients();
    props.queueClient.addSong.mockResolvedValueOnce({ id: 7, youtubeId: "abcdefghijk" }).mockRejectedValueOnce(new Error("offline"));
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select First song" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Second song" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 2 selected to queue" }));
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent("Queue update failed");
    expect(screen.getByRole("checkbox", { name: "Select First song" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Second song" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Add 1 selected to queue" }));
    await waitFor(() => expect(props.queueClient.addSong).toHaveBeenCalledTimes(3));
    expect(props.queueClient.addSong.mock.calls[2][0]).toMatchObject({ youtubeId: "lmnopqrstuv" });
  });

  it("retries only playback after add succeeded", async () => {
    const props = clients();
    props.queueClient.setPlaying.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: 7 });
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    await userEvent.click(await screen.findByRole("button", { name: "Retry playing First song" }));
    await waitFor(() => expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(2));
    expect(props.queueClient.addSong).toHaveBeenCalledTimes(1);
  });

  it("invalidates pagination when the query changes and ignores stale results", async () => {
    const props = clients();
    let resolveOld!: (value: { items: Array<typeof first>; nextPageToken: string | null }) => void;
    props.searchClient.searchYouTube.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce({ items: [second], nextPageToken: null });
    render(<MusicSearch {...props} />);
    const input = screen.getByRole("searchbox", { name: "Search music or paste a URL" });
    await userEvent.type(input, "old");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.clear(input);
    await userEvent.type(input, "new");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    resolveOld({ items: [first], nextPageToken: "stale-next" });
    expect(await screen.findByText("Second song")).toBeInTheDocument();
    expect(screen.queryByText("First song")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("keeps discovery actions attached to the single input", async () => {
    const props = clients();
    render(<MusicSearch {...props} />);
    const toggle = screen.getByRole("button", { name: "Open discovery actions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toContainElement(screen.getByRole("menuitem", { name: "Add from URL" }));
  });

  it("treats refresh failure after successful play-now as committed and retries refresh only", async () => {
    const props = clients();
    props.onChanged.mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("played, but the latest queue could not be loaded");
    await userEvent.click(screen.getByRole("button", { name: "Retry refreshing queue" }));
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(2));
    expect(props.queueClient.addSong).toHaveBeenCalledTimes(1);
    expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful retry-play committed when only its refresh fails", async () => {
    const props = clients();
    props.queueClient.setPlaying.mockRejectedValueOnce(new Error("play failed")).mockResolvedValueOnce({ id: 7 });
    props.onChanged.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    await userEvent.click(await screen.findByRole("button", { name: "Retry playing First song" }));
    await userEvent.click(await screen.findByRole("button", { name: "Retry refreshing queue" }));
    expect(props.queueClient.addSong).toHaveBeenCalledTimes(1);
    expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(2);
  });

  it("synchronously locks duplicate search submits", async () => {
    const props = clients();
    props.searchClient.searchYouTube.mockReturnValue(new Promise(() => undefined));
    render(<MusicSearch {...props} />);
    const input = screen.getByRole("searchbox", { name: "Search music or paste a URL" });
    await userEvent.type(input, "roads");
    fireEvent.submit(input.closest("form")!);
    fireEvent.submit(input.closest("form")!);
    expect(props.searchClient.searchYouTube).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
  });

  it("synchronously locks duplicate URL submits", async () => {
    const props = clients();
    props.searchClient.videoFromUrl.mockReturnValue(new Promise(() => undefined));
    render(<MusicSearch {...props} />);
    const input = screen.getByRole("searchbox", { name: "Search music or paste a URL" });
    await userEvent.type(input, "https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Open discovery actions" }));
    const action = screen.getByRole("menuitem", { name: "Add from URL" });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(props.searchClient.videoFromUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Music discovery status")).toHaveTextContent("Searching");
  });

  it("preserves committed refresh recovery across mode, input, and discovery changes", async () => {
    const props = clients();
    props.onChanged.mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    render(<MusicSearch {...props} />);
    const input = screen.getByRole("searchbox", { name: "Search music or paste a URL" });
    await userEvent.type(input, "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("played, but the latest queue could not be loaded");

    await userEvent.clear(input);
    await userEvent.type(input, "https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Open discovery actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add from URL" }));
    expect(await screen.findByRole("button", { name: "Retry refreshing queue" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry refreshing queue" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry refreshing queue" })).not.toBeInTheDocument());
    expect(props.queueClient.addSong).toHaveBeenCalledTimes(1);
    expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(1);
  });
});
