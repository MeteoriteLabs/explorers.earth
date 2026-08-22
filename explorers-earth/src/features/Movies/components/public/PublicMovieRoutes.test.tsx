import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));
const analyticsHarness = vi.hoisted(() => {
	const trackClick = vi.fn();
	const useTrackAnalytics = vi.fn(() => ({ trackClick }));
	const movies = vi.fn((accountId, pageUsername, locationId, recommendationId, route) => ({
		accountId, pageUsername, locationId, recommendationId, routeVariant: route?.variant, routePath: route?.path,
	}));
	return { movies, trackClick, useTrackAnalytics };
});

vi.mock("@apollo/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@apollo/client")>()),
	useQuery: () => ({
		data: queryState.data,
		loading: false,
		error: undefined,
		refetch: vi.fn().mockResolvedValue(undefined),
		fetchMore: vi.fn().mockResolvedValue(undefined),
	}),
}));
vi.mock("../../../../layouts/PublicProfileBootstrapContext", () => ({
	usePublicProfileBootstrapAccount: () => ({ documentId: "account-1" }),
}));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../../services/analyticsService", () => ({
	createAnalyticsOptions: { movies: analyticsHarness.movies },
	useTrackAnalytics: analyticsHarness.useTrackAnalytics,
}));
vi.mock("./MoviePosterCard", () => ({
	default: ({ movie, onClick }: any) => <button type="button" onClick={() => onClick(movie)}>{movie.title}</button>,
}));
vi.mock("./MovieDetailModal", () => ({ default: () => null }));

import PublicMovieGenre from "./PublicMovieGenre";
import PublicMovieList from "./PublicMovieList";

const connection = {
	nodes: [],
	pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 },
};

function renderGenre() {
	return render(
		<MemoryRouter initialEntries={["/alice/movies/genre/genre-1"]}>
			<Routes>
				<Route path="/:username/movies/genre/:genreSlug" element={<PublicMovieGenre />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

function renderList() {
	return render(
		<MemoryRouter initialEntries={["/alice/movies/favorites"]}>
			<Routes>
				<Route path="/:username/movies/:listSlug" element={<PublicMovieList />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicMovieGenre", () => {
	beforeEach(() => {
		queryState.data = undefined;
		analyticsHarness.movies.mockClear();
		analyticsHarness.trackClick.mockClear();
		analyticsHarness.useTrackAnalytics.mockClear();
		Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
	});

	it("keeps a published empty genre on its URL", () => {
		queryState.data = {
			movieCategories: [{ documentId: "genre-1", genre_name: "Comedy" }],
			recommendedMovies_connection: connection,
		};
		renderGenre();
		expect(screen.getByRole("heading", { name: "Comedy" })).toBeInTheDocument();
		expect(screen.getByText("No movies found in this genre.")).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing genre", async () => {
		queryState.data = { movieCategories: [], recommendedMovies_connection: connection };
		renderGenre();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("keeps a published empty movie list on its URL", () => {
		queryState.data = {
			movieLists: [{ documentId: "movie-list-1", List_Name: "Favorites", slug: "favorites" }],
			recommendedMovies_connection: connection,
		};
		renderList();
		expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing movie list", async () => {
		queryState.data = { movieLists: [], recommendedMovies_connection: connection };
		renderList();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("tracks list views, stable movie cards, and share with document IDs", async () => {
		queryState.data = {
			movieLists: [{ documentId: "movie-list-1", List_Name: "Favorites", slug: "favorites" }],
			recommendedMovies_connection: {
				...connection,
				nodes: [{ documentId: "movie-doc-1", title: "Arrival", media_type: "movie" }],
			},
		};
		renderList();

		expect(analyticsHarness.movies).toHaveBeenCalledWith("account-1", "alice", "movie-list-1", undefined, {
			variant: "list", path: "/alice/movies/favorites",
		});
		fireEvent.click(screen.getByRole("button", { name: "Arrival" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("movie-card", expect.objectContaining({ id: "movie-doc-1", listId: "movie-list-1" }));
		fireEvent.click(screen.getByRole("button", { name: "Share" }));
		await waitFor(() => expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", expect.objectContaining({ context: "movies-list" })));
	});

	it("tracks taxonomy views and cards with the stable genre document ID", () => {
		queryState.data = {
			movieCategories: [{ documentId: "genre-1", genre_name: "Comedy" }],
			recommendedMovies_connection: {
				...connection,
				nodes: [{ documentId: "movie-doc-2", title: "Clue", media_type: "movie" }],
			},
		};
		renderGenre();

		expect(analyticsHarness.movies).toHaveBeenCalledWith("account-1", "alice", "genre-1", undefined, {
			variant: "filter", path: "/alice/movies/genre/genre-1",
		});
		fireEvent.click(screen.getByRole("button", { name: "Clue" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("movie-card", expect.objectContaining({ id: "movie-doc-2", filterId: "genre-1" }));
	});
});
