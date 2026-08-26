import { render, screen, waitFor } from "@testing-library/react";
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
  });
});
