import { print } from "graphql";
import { describe, expect, it } from "vitest";

import { MOVIES_BY_GENRE, MOVIE_LIST_BY_SLUG } from "../query";

describe("public movie child queries", () => {
	it.each([MOVIE_LIST_BY_SLUG, MOVIES_BY_GENRE])(
		"uses direct published server filters and a stable connection",
		(query) => {
			const source = print(query);
			expect(source).toContain("$accountDocumentId: ID!");
			expect(source).toContain("Visibility: {eq: true}");
			expect(source).toContain("recommendedMovies_connection");
			expect(source).toContain("pageInfo");
			expect(source).toContain('sort: ["display_order:asc", "documentId:asc"]');
		},
	);

	it("filters the taxonomy entity and its movies by the requested genre", () => {
		const source = print(MOVIES_BY_GENRE);
		expect(source).toContain("genre_name: {eq: $genreName}");
		expect(source).toContain("pagination: {limit: 1}");
	});
});
