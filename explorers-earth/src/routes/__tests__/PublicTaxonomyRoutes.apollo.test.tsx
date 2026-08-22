import { render, screen, waitFor } from "@testing-library/react";
import {
	ApolloClient,
	ApolloLink,
	ApolloProvider,
	InMemoryCache,
	Observable,
	type Operation,
} from "@apollo/client";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../layouts/PublicProfileBootstrapContext", () => ({
	usePublicProfileBootstrapAccount: () => ({ documentId: "account-1", Account_Name: "Alice" }),
}));
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../features/Movies/components/public/MoviePosterCard", () => ({ default: () => null }));
vi.mock("../../features/Movies/components/public/MovieDetailModal", () => ({ default: () => null }));
vi.mock("../../features/Books/components/public/BookCoverCard", () => ({ default: () => null }));
vi.mock("../../features/Books/components/public/BookDetailModal", () => ({ default: () => null }));
vi.mock("../../features/Games/components/public/GameCoverCard", () => ({ default: () => null }));
vi.mock("../../features/Games/components/public/GameDetailModal", () => ({ default: () => null }));
vi.mock("../../features/People/components/public/PersonDetailModal", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import PublicMovieGenre from "../../features/Movies/components/public/PublicMovieGenre";
import PublicBookSubject from "../../features/Books/components/public/PublicBookSubject";
import PublicGamesGenre from "../../features/Games/components/public/PublicGamesGenre";
import PublicPersonSector from "../../features/People/components/public/PublicPersonSector";

type Family = {
	name: string;
	Component: ComponentType;
	routePath: string;
	pathFor: (identifier: string) => string;
	operationName: string;
	categoryField: string;
	nameField: string;
	legacyVariable: string;
	connectionField: string;
	simpleLegacy: string;
	simpleName: string;
	canonicalDocumentId: string;
	lossyLegacy: string;
	lossyCollisionName: string;
	newDocumentId: string;
	newName: string;
};

const families: Family[] = [
	{
		name: "movies", Component: PublicMovieGenre, routePath: "/:username/movies/genre/:genreSlug",
		pathFor: (value) => `/alice/movies/genre/${encodeURIComponent(value)}`,
		operationName: "MoviesByGenre", categoryField: "movieCategories", nameField: "genre_name",
		legacyVariable: "legacyGenreName", connectionField: "recommendedMovies_connection",
		simpleLegacy: "drama", simpleName: "Drama", canonicalDocumentId: "movie-category-drama",
		lossyLegacy: "sci-fi-fantasy", lossyCollisionName: "Sci Fi Fantasy",
		newDocumentId: "movie-category-sci-fi-日本", newName: "Sci-Fi & Fantasy 日本",
	},
	{
		name: "books", Component: PublicBookSubject, routePath: "/:username/books/subject/:subjectSlug",
		pathFor: (value) => `/alice/books/subject/${encodeURIComponent(value)}`,
		operationName: "BooksBySubject", categoryField: "bookCategories", nameField: "subject_name",
		legacyVariable: "legacySubjectName", connectionField: "recommendedBooks_connection",
		simpleLegacy: "fiction", simpleName: "Fiction", canonicalDocumentId: "book-category-fiction",
		lossyLegacy: "c-systems", lossyCollisionName: "C Systems",
		newDocumentId: "book-category-c++-日本", newName: "C++ / Systems 日本",
	},
	{
		name: "games", Component: PublicGamesGenre, routePath: "/:username/games/genre/:genreSlug",
		pathFor: (value) => `/alice/games/genre/${encodeURIComponent(value)}`,
		operationName: "GamesByGenre", categoryField: "gameCategories", nameField: "genre_name",
		legacyVariable: "legacyGenreName", connectionField: "recommendedGames_connection",
		simpleLegacy: "strategy", simpleName: "Strategy", canonicalDocumentId: "game-category-strategy",
		lossyLegacy: "role-playing-rpg-日本", lossyCollisionName: "Role Playing Rpg 日本",
		newDocumentId: "game-category-rpg-日本", newName: "Role-Playing (RPG) 日本",
	},
	{
		name: "people", Component: PublicPersonSector, routePath: "/:username/people/sector/:sectorSlug",
		pathFor: (value) => `/alice/people/sector/${encodeURIComponent(value)}`,
		operationName: "PeopleBySector", categoryField: "peopleCategories", nameField: "Category_name",
		legacyVariable: "legacySectorName", connectionField: "recommendedPeople_connection",
		simpleLegacy: "engineering", simpleName: "Engineering", canonicalDocumentId: "people-category-engineering",
		lossyLegacy: "r-d-leaders", lossyCollisionName: "R D Leaders",
		newDocumentId: "people-category-r&d-日本", newName: "R&D — Leaders 日本",
	},
];

const pageInfo = { __typename: "Pagination", page: 1, pageSize: 200, pageCount: 1, total: 0 };

function renderTaxonomy(
	family: Family,
	identifier: string,
	resolveCategory: (operation: Operation) => { documentId: string; name: string } | undefined,
) {
	const operations: Operation[] = [];
	const link = new ApolloLink((operation) => new Observable((observer) => {
		operations.push(operation);
		const category = resolveCategory(operation);
		queueMicrotask(() => {
			observer.next({ data: {
				[family.categoryField]: category ? [{
					__typename: family.categoryField,
					documentId: category.documentId,
					[family.nameField]: category.name,
				}] : [],
				[family.connectionField]: { __typename: family.connectionField, nodes: [], pageInfo },
			} });
			observer.complete();
		});
	}));
	const client = new ApolloClient({ cache: new InMemoryCache(), link, queryDeduplication: false });
	const router = createMemoryRouter([
		{ path: family.routePath, element: <family.Component /> },
		{ path: "/:username", element: <div>Profile fallback</div> },
	], { initialEntries: [`${family.pathFor(identifier)}?utm_source=legacy#taxonomy`] });
	render(<ApolloProvider client={client}><RouterProvider router={router} /></ApolloProvider>);
	return { operations, router };
}

describe.each(families)("$name routed taxonomy lookup", (family) => {
	it("resolves a simple exact-name legacy slug then replace-canonicalizes without losing search or hash", async () => {
		const { operations, router } = renderTaxonomy(family, family.simpleLegacy, (operation) => {
			if (operation.variables.taxonomyDocumentId === family.canonicalDocumentId) {
				return { documentId: family.canonicalDocumentId, name: family.simpleName };
			}
			if (operation.variables[family.legacyVariable] === family.simpleName) {
				return { documentId: family.canonicalDocumentId, name: family.simpleName };
			}
		});

		await waitFor(() => expect(router.state.location.pathname).toBe(family.pathFor(family.canonicalDocumentId)));
		expect(router.state.location.search).toBe("?utm_source=legacy");
		expect(router.state.location.hash).toBe("#taxonomy");
		expect(router.state.historyAction).toBe("REPLACE");
		expect(operations[0]?.operationName).toBe(family.operationName);
		expect(operations[0]?.variables).toMatchObject({
			accountDocumentId: "account-1",
			taxonomyDocumentId: family.simpleLegacy,
			[family.legacyVariable]: family.simpleName,
		});
		await waitFor(() => expect(operations.at(-1)?.variables.taxonomyDocumentId).toBe(family.canonicalDocumentId));
	});

	it("does not wrong-match a punctuation or unicode legacy slug to a colliding reconstructed name", async () => {
		const { operations, router } = renderTaxonomy(family, family.lossyLegacy, (operation) => {
			if (operation.variables[family.legacyVariable] === family.lossyCollisionName) {
				return { documentId: `${family.name}-wrong-collision`, name: family.lossyCollisionName };
			}
		});

		await screen.findByText("Profile fallback");
		expect(router.state.location.pathname).toBe("/alice");
		expect(router.state.location.search).toBe("?utm_source=legacy");
		expect(router.state.location.hash).toBe("#taxonomy");
		expect(operations[0]?.variables.taxonomyDocumentId).toBe(family.lossyLegacy);
		expect(operations[0]?.variables[family.legacyVariable]).not.toBe(family.lossyCollisionName);
	});

	it("queries a new stored document-id route by the exact decoded identifier", async () => {
		const { operations, router } = renderTaxonomy(family, family.newDocumentId, (operation) => {
			if (operation.variables.taxonomyDocumentId === family.newDocumentId) {
				return { documentId: family.newDocumentId, name: family.newName };
			}
		});

		await waitFor(() => expect(operations).toHaveLength(1));
		expect(operations[0]?.variables.taxonomyDocumentId).toBe(family.newDocumentId);
		expect(router.state.location.pathname).toBe(family.pathFor(family.newDocumentId));
		expect(router.state.location.search).toBe("?utm_source=legacy");
		expect(router.state.location.hash).toBe("#taxonomy");
	});
});
