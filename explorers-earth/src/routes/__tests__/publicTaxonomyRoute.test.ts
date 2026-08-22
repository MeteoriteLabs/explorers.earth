import { describe, expect, it } from "vitest";

import { publicTaxonomyPath } from "../publicTaxonomyRoute";

describe("public taxonomy routes", () => {
	it.each([
		["movies", "genre", "movie-category-sci-fi", "Sci-Fi & Fantasy"],
		["games", "genre", "game-category-rpg-日本", "Role-Playing (RPG) 日本"],
		["books", "subject", "book-category-c-plus-plus", "C++ / Systems"],
		["people", "sector", "people-category-r-and-d", "R&D — Leaders"],
	])(
		"uses the stored document id for %s instead of reconstructing %s from %s",
		(family, segment, documentId) => {
			expect(publicTaxonomyPath("alice", family, segment, documentId)).toBe(
				`/alice/${family}/${segment}/${encodeURIComponent(documentId)}`,
			);
		},
	);
});
