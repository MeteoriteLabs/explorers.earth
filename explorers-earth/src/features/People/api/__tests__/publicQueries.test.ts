import { print } from "graphql";
import { describe, expect, it } from "vitest";

import { PEOPLE_BY_SECTOR, PERSON_LIST_BY_SLUG } from "../query";

describe("public people child queries", () => {
	it.each([PERSON_LIST_BY_SLUG, PEOPLE_BY_SECTOR])(
		"uses direct published server filters and a stable connection",
		(query) => {
			const source = print(query);
			expect(source).toContain("$accountDocumentId: ID!");
			expect(source).toContain("Visibility: {eq: true}");
			expect(source).toContain("recommendedPeople_connection");
			expect(source).toContain("pageInfo");
			expect(source).toContain('sort: ["display_order:asc", "documentId:asc"]');
		},
	);

	it("filters the sector entity and people by the requested category", () => {
		const source = print(PEOPLE_BY_SECTOR);
		expect(source).toContain("Category_name: {eq: $sectorName}");
		expect(source).toContain("pagination: {limit: 1}");
	});
});
