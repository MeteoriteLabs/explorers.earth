import { print } from "graphql";
import { describe, expect, it } from "vitest";

import { BOOKS_BY_SUBJECT, BOOK_LIST_BY_SLUG } from "../query";

describe("public book child queries", () => {
	it.each([BOOK_LIST_BY_SLUG, BOOKS_BY_SUBJECT])(
		"uses direct published server filters and a stable connection",
		(query) => {
			const source = print(query);
			expect(source).toContain("$accountDocumentId: ID!");
			expect(source).toContain("visibility: {eq: true}");
			expect(source).toContain("recommendedBooks_connection");
			expect(source).toContain("pageInfo");
			expect(source).toContain('sort: ["display_order:asc", "documentId:asc"]');
		},
	);

	it("filters the taxonomy entity and its books by the requested subject", () => {
		const source = print(BOOKS_BY_SUBJECT);
		expect(source).toContain("subject_name: {eq: $subjectName}");
		expect(source).toContain("pagination: {limit: 1}");
	});
});
