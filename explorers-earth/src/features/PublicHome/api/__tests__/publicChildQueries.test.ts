import { print } from "graphql";
import { describe, expect, it } from "vitest";

import { GET_PUBLIC_GUIDE_BY_SLUG_QUERY } from "../../../Guides/api/queries";
import {
	publicPlaceListBySlugQuery,
	publicRecommendedPlacesConnectionQuery,
} from "../query";

describe("public place and guide child queries", () => {
	it("looks up one published place list by account and slug on the server", () => {
		const source = print(publicPlaceListBySlugQuery);

		expect(source).toContain("$accountDocumentId: ID!");
		expect(source).toContain("$slug: String!");
		expect(source).toContain("account: {documentId: {eq: $accountDocumentId}}");
		expect(source).toContain("slug: {eq: $slug}");
		expect(source).toContain("Visibility: {eq: true}");
		expect(source).toContain("pagination: {limit: 1}");
	});

	it("pages published places with pageInfo and a stable tie-breaker", () => {
		const source = print(publicRecommendedPlacesConnectionQuery);

		expect(source).toContain("recommendedPlaces_connection");
		expect(source).toContain("pageInfo");
		expect(source).toContain('sort: ["createdAt:asc", "documentId:asc"]');
	});

	it("looks up one published guide by account and slug on the server", () => {
		const source = print(GET_PUBLIC_GUIDE_BY_SLUG_QUERY);

		expect(source).toContain("$accountDocumentId: ID!");
		expect(source).toContain("$slug: String!");
		expect(source).toContain("account: {documentId: {eq: $accountDocumentId}}");
		expect(source).toContain("Visibility: {eq: true}");
		expect(source).toContain("pagination: {limit: 1}");
	});
});
