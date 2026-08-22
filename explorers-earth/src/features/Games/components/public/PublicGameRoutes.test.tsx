import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));
const analyticsHarness = vi.hoisted(() => {
	const trackClick = vi.fn();
	const useTrackAnalytics = vi.fn(() => ({ trackClick }));
	const games = vi.fn((accountId, pageUsername, locationId, recommendationId, route) => ({ accountId, pageUsername, locationId, recommendationId, routeVariant: route?.variant, routePath: route?.path }));
	return { games, trackClick, useTrackAnalytics };
});

vi.mock("@apollo/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@apollo/client")>()),
	useQuery: () => ({ data: queryState.data, loading: false, error: undefined, refetch: vi.fn().mockResolvedValue(undefined), fetchMore: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../../../../layouts/PublicProfileBootstrapContext", () => ({ usePublicProfileBootstrapAccount: () => ({ documentId: "account-1" }) }));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../../services/analyticsService", () => ({ createAnalyticsOptions: { games: analyticsHarness.games }, useTrackAnalytics: analyticsHarness.useTrackAnalytics }));
vi.mock("./GameCoverCard", () => ({ default: ({ title, onClick }: any) => <button type="button" onClick={onClick}>{title}</button> }));
vi.mock("./GameDetailModal", () => ({ default: ({ game, onShare }: any) => game ? <button type="button" onClick={() => onShare?.(game.documentId)}>Share {game.title} detail</button> : null }));

import PublicGamesGenre from "./PublicGamesGenre";
import PublicGamesList from "./PublicGamesList";

const connection = { nodes: [], pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 } };

function renderGenre() {
	return render(
		<MemoryRouter initialEntries={["/alice/games/genre/genre-1"]}>
			<Routes>
				<Route path="/:username/games/genre/:genreSlug" element={<PublicGamesGenre />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

function renderList() {
	return render(
		<MemoryRouter initialEntries={["/alice/games/favorites"]}>
			<Routes>
				<Route path="/:username/games/:listSlug" element={<PublicGamesList />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicGamesGenre", () => {
	beforeEach(() => {
		queryState.data = undefined;
		analyticsHarness.games.mockClear();
		analyticsHarness.trackClick.mockClear();
		analyticsHarness.useTrackAnalytics.mockClear();
		Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
	});

	it("keeps a published empty genre on its URL", () => {
		queryState.data = {
			gameCategories: [{ documentId: "genre-1", genre_name: "Comedy" }],
			recommendedGames_connection: connection,
		};
		renderGenre();
		expect(screen.getByRole("heading", { name: "Comedy" })).toBeInTheDocument();
		expect(screen.getByText("No games found in this genre.")).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing genre", async () => {
		queryState.data = { gameCategories: [], recommendedGames_connection: connection };
		renderGenre();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("keeps a published empty game list on its URL", () => {
		queryState.data = {
			gameLists: [{ documentId: "game-list-1", List_Name: "Favorites", slug: "favorites" }],
			recommendedGames_connection: connection,
		};
		renderList();
		expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing game list", async () => {
		queryState.data = { gameLists: [], recommendedGames_connection: connection };
		renderList();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("tracks list views, stable game cards, and share with document IDs", async () => {
		queryState.data = {
			gameLists: [{ documentId: "game-list-1", List_Name: "Favorites", slug: "favorites" }],
			recommendedGames_connection: { ...connection, nodes: [{ documentId: "game-doc-1", title: "Journey", is_pinned: false }] },
		};
		renderList();

		expect(analyticsHarness.games).toHaveBeenCalledWith("account-1", "alice", "game-list-1", undefined, { variant: "list", path: "/alice/games/favorites" });
		fireEvent.click(screen.getByRole("button", { name: "Journey" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("game-card", expect.objectContaining({ id: "game-doc-1", listId: "game-list-1" }));
		fireEvent.click(screen.getByRole("button", { name: "Share Journey detail" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", { context: "games-list-detail", id: "game-doc-1" });
		fireEvent.click(screen.getByRole("button", { name: "Share" }));
		await waitFor(() => expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", expect.objectContaining({ context: "games-list" })));
	});

	it("tracks genre views and cards with the stable taxonomy document ID", () => {
		queryState.data = {
			gameCategories: [{ documentId: "genre-1", genre_name: "Comedy" }],
			recommendedGames_connection: { ...connection, nodes: [{ documentId: "game-doc-2", title: "Untitled Goose Game", is_pinned: false }] },
		};
		renderGenre();

		expect(analyticsHarness.games).toHaveBeenCalledWith("account-1", "alice", "genre-1", undefined, { variant: "filter", path: "/alice/games/genre/genre-1" });
		fireEvent.click(screen.getByRole("button", { name: "Untitled Goose Game" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("game-card", expect.objectContaining({ id: "game-doc-2", filterId: "genre-1" }));
	});
});
