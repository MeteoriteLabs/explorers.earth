import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PublicMusicContent } from "../public/PublicMusic";

vi.mock("../../components/SEO", () => ({ default: () => null }));

describe("public Music page", () => {
  it("uses the unified public 404 for private, missing, and invalid links", () => {
    render(<MemoryRouter><PublicMusicContent state="not-found" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Music page unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Explorers" })).toHaveAttribute("href", "/");
  });

  it("uses the approved zero-public-playlist copy", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={{ songs: [], playlists: [] }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByText("No public playlists yet.")).toBeInTheDocument();
  });

  it("renders public playlist content without edit controls", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={{ songs: [], playlists: [{ id: 7, name: "Roads", description: null, isVisibleToGuests: true, songs: [{ id: 8, title: "North", artist: "Sky", thumbnailUrl: "https://images.example/north.jpg", position: 0 }] }] }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Roads" })).toBeInTheDocument();
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
