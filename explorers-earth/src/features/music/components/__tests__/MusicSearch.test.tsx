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
  it("searches, selects multiple results, adds them, and paginates", async () => {
    const props = clients();
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
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
    await userEvent.click(screen.getByRole("tab", { name: "URL" }));
    await userEvent.type(screen.getByRole("textbox", { name: "YouTube URL" }), "https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Look up" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    await waitFor(() => expect(props.queueClient.setPlaying).toHaveBeenCalledWith(7, expect.stringMatching(/^music-play-/)));
    expect(props.onChanged).toHaveBeenCalledTimes(1);
  });

  it("contains retryable failures, announces them, and can retry", async () => {
    const props = clients();
    props.searchClient.searchYouTube.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [], nextPageToken: null });
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Music search is temporarily unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try search again" }));
    expect(await screen.findByText("No music found.")).toBeInTheDocument();
  });

  it("reconciles the queue when a multi-add only partly succeeds", async () => {
    const props = clients();
    props.queueClient.addSong.mockResolvedValueOnce({ id: 7, youtubeId: "abcdefghijk" }).mockRejectedValueOnce(new Error("offline"));
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
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
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
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
    const input = screen.getByRole("searchbox", { name: "Search music" });
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

  it("uses roving ARIA tabs and ignores a completion after switching modes", async () => {
    const props = clients();
    let resolveSearch!: (value: { items: Array<typeof first>; nextPageToken: string | null }) => void;
    props.searchClient.searchYouTube.mockReturnValueOnce(new Promise((resolve) => { resolveSearch = resolve; }));
    render(<MusicSearch {...props} />);
    const searchTab = screen.getByRole("tab", { name: "Search" });
    const urlTab = screen.getByRole("tab", { name: "URL" });
    expect(searchTab).toHaveAttribute("aria-controls", "music-search-panel");
    expect(searchTab).toHaveAttribute("tabindex", "0");
    searchTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(urlTab).toHaveFocus();
    expect(urlTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "music-url-panel");
    await userEvent.keyboard("{Home}");
    expect(searchTab).toHaveFocus();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "old");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(urlTab);
    resolveSearch({ items: [first], nextPageToken: "stale" });
    await waitFor(() => expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "music-url-panel"));
    expect(screen.queryByText("First song")).not.toBeInTheDocument();
  });

  it("wraps ArrowRight and ArrowLeft cyclically while Home and End remain absolute", async () => {
    const props = clients();
    render(<MusicSearch {...props} />);
    const search = screen.getByRole("tab", { name: "Search" });
    const url = screen.getByRole("tab", { name: "URL" });
    url.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(search).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(url).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(search).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(url).toHaveFocus();
  });

  it("treats refresh failure after successful play-now as committed and retries refresh only", async () => {
    const props = clients();
    props.onChanged.mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
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
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
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
    const input = screen.getByRole("searchbox", { name: "Search music" });
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
    await userEvent.click(screen.getByRole("tab", { name: "URL" }));
    const input = screen.getByRole("textbox", { name: "YouTube URL" });
    await userEvent.type(input, "https://youtu.be/abcdefghijk");
    fireEvent.submit(input.closest("form")!);
    fireEvent.submit(input.closest("form")!);
    expect(props.searchClient.videoFromUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Look up" })).toBeDisabled();
  });

  it("preserves committed refresh recovery across mode, input, and discovery changes", async () => {
    const props = clients();
    props.onChanged.mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    render(<MusicSearch {...props} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music" }), "roads");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play First song now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("played, but the latest queue could not be loaded");

    await userEvent.click(screen.getByRole("tab", { name: "URL" }));
    await userEvent.type(screen.getByRole("textbox", { name: "YouTube URL" }), "https://youtu.be/abcdefghijk");
    await userEvent.click(screen.getByRole("button", { name: "Look up" }));
    expect(await screen.findByRole("button", { name: "Retry refreshing queue" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry refreshing queue" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry refreshing queue" })).not.toBeInTheDocument());
    expect(props.queueClient.addSong).toHaveBeenCalledTimes(1);
    expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(1);
  });
});
