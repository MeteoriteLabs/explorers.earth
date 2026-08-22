import { print } from "graphql";
import { describe, expect, it } from "vitest";

import { MOVIES_BY_GENRE } from "../../features/Movies/api/query";
import { BOOKS_BY_SUBJECT } from "../../features/Books/api/query";
import { GAMES_BY_GENRE } from "../../features/Games/api/query";
import { PEOPLE_BY_SECTOR } from "../../features/People/api/query";

describe.each([
	["movies", MOVIES_BY_GENRE, "$legacyGenreName: String!"],
	["books", BOOKS_BY_SUBJECT, "$legacySubjectName: String!"],
	["games", GAMES_BY_GENRE, "$legacyGenreName: String!"],
	["people", PEOPLE_BY_SECTOR, "$legacySectorName: String!"],
])("%s taxonomy query", (_family, query, legacyVariable) => {
	it("resolves canonical document ids and only uses an exact-name legacy fallback", () => {
		const source = print(query);
		expect(source).toContain("$taxonomyDocumentId: ID!");
		expect(source).toContain(legacyVariable);
		expect(source).toContain("documentId: {eq: $taxonomyDocumentId}");
		expect(source).not.toContain("slug:");
	});
});
