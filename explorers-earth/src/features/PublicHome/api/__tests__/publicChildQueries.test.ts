import { buildSchema, print, validate } from "graphql";
import { describe, expect, it } from "vitest";
import publicGuideSchemaSource from "./fixtures/public-guide-schema.graphql?raw";

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
		expect(source).toContain("$documentId: ID!");
		expect(source).toContain("account: {documentId: {eq: $accountDocumentId}}");
		expect(source).toContain("or: [{slug: {eq: $slug}}, {documentId: {eq: $documentId}}]");
		expect(source).toContain("Visibility: {eq: true}");
		expect(source).toContain("pagination: {limit: 1}");
	});

	it("filters every linked Place recommendation connection at the server boundary", () => {
		const source = print(publicPlaceListBySlugQuery);

		expect(source).toMatch(/recommendedPeople_connection[\s\S]*?person_list:[\s\S]*?account:[\s\S]*?\$accountDocumentId[\s\S]*?Visibility:[\s\S]*?true[\s\S]*?recommendation_list:[\s\S]*?\$documentId/);
		expect(source).toMatch(/recommendedProducts_connection[\s\S]*?product_list:[\s\S]*?account:[\s\S]*?\$accountDocumentId[\s\S]*?Visibility:[\s\S]*?true[\s\S]*?recommendation_list:[\s\S]*?\$documentId/);
		expect(source).not.toMatch(/pagination:\s*\{limit:\s*(50|100|200)\}/);
	});

	it("pages published places with pageInfo and a stable tie-breaker", () => {
		const source = print(publicRecommendedPlacesConnectionQuery);

		expect(source).toContain("recommendedPlaces_connection");
		expect(source).toContain("pageInfo");
		expect(source).toContain('sort: ["createdAt:asc", "documentId:asc"]');
	});

	it("builds the same account-owned published-list filter for initial and later Place pages", async () => {
		const { buildPublicRecommendedPlacesFilters } = await import("../query");
		expect(buildPublicRecommendedPlacesFilters("account-1", "place-list-1", "Museums")).toEqual({
			recommendation_list: {
				documentId: { eq: "place-list-1" },
				account: { documentId: { eq: "account-1" } },
				Visibility: { eq: true },
			},
			recommendation_category: { Category_Name: { eq: "Museums" } },
		});
	});

	it("looks up one published guide by account and slug on the server", () => {
		const source = print(GET_PUBLIC_GUIDE_BY_SLUG_QUERY);

		expect(source).toContain("$accountDocumentId: ID!");
		expect(source).toContain("$slug: String!");
		expect(source).toContain("$documentId: ID!");
		expect(source).toContain("account: {documentId: {eq: $accountDocumentId}}");
		expect(source).toContain("Visibility: {eq: true}");
		expect(source).toContain("pagination: {limit: 1}");
	});

	it("validates the public guide document against the checked-in Strapi contract", () => {
		const errors = validate(
			buildSchema(publicGuideSchemaSource),
			GET_PUBLIC_GUIDE_BY_SLUG_QUERY,
		);

		expect(errors.map(({ message }) => message)).toEqual([]);
	});

	it("pages guide sections through an account-owned published guide connection", () => {
		const source = print(GET_PUBLIC_GUIDE_BY_SLUG_QUERY);

		expect(source).toContain("$sectionPagination: PaginationArg!");
		expect(source).toContain("guideSections_connection");
		expect(source).toContain("guide: {or: [{account: {documentId: {eq: $accountDocumentId}}, Visibility: {eq: true}, slug: {eq: $slug}}");
		expect(source).toContain('sort: ["Sequence:asc", "documentId:asc"]');
		expect(source).toContain("pageInfo");
		expect(source).not.toContain("guide_sections(pagination: {limit: 100}");
	});
});
