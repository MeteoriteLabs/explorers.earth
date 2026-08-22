import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));

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

import PublicMovieGenre from "./PublicMovieGenre";

const connection = {
	nodes: [],
	pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 },
};

function renderGenre() {
	return render(
		<MemoryRouter initialEntries={["/alice/movies/genre/comedy"]}>
			<Routes>
				<Route path="/:username/movies/genre/:genreSlug" element={<PublicMovieGenre />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicMovieGenre", () => {
	beforeEach(() => { queryState.data = undefined; });

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
});
