import { describe, expect, it } from "vitest";

import {
	publicTaxonomyLegacyLookupName,
	publicTaxonomyPath,
} from "../publicTaxonomyRoute";

describe("public taxonomy routes", () => {
	it.each([
		["movies", "genre", "movie-category-sci-fi"],
		["games", "genre", "game-category-rpg-日本"],
		["books", "subject", "book-category-c-plus-plus"],
		["people", "sector", "people-category-r-and-d"],
	])(
		"uses the stored document id for %s %s routes",
		(family, segment, documentId) => {
			expect(publicTaxonomyPath("alice", family, segment, documentId)).toBe(
				`/alice/${family}/${segment}/${encodeURIComponent(documentId)}`,
			);
		},
	);

	it("allows exact-name compatibility only for reversible single-token legacy slugs", () => {
		expect(publicTaxonomyLegacyLookupName("drama", "Drama")).toBe("Drama");
		expect(publicTaxonomyLegacyLookupName("sci-fi-fantasy", "Sci Fi Fantasy")).not.toBe("Sci Fi Fantasy");
		expect(publicTaxonomyLegacyLookupName("日本", "日本")).not.toBe("日本");
	});
});
