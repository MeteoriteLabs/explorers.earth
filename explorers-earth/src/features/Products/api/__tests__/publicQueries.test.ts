import { print } from "graphql";
import { describe, expect, it } from "vitest";

import { PRODUCT_LIST_BY_SLUG } from "../query";

describe("public product list query", () => {
	it("uses a direct published server filter and stable connection", () => {
		const source = print(PRODUCT_LIST_BY_SLUG);
		expect(source).toContain("$accountDocumentId: ID!");
		expect(source).toContain("Visibility: {eq: true}");
		expect(source).toContain("recommendedProducts_connection");
		expect(source).toContain("pageInfo");
		expect(source).toContain('sort: ["display_order:asc", "documentId:asc"]');
	});
});
