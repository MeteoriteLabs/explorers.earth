import { buildSchema, graphql, print } from "graphql";
import { describe, expect, it } from "vitest";

import {
	buildPublicRecommendedPlacesFilters,
	publicPlaceListBySlugQuery,
	publicRecommendedPlacesConnectionQuery,
} from "../query";
import schemaSource from "./fixtures/public-place-security-schema.graphql?raw";

type SecuredEntity = Record<string, any> & {
	__account: string;
	__visible: boolean;
};

function matchesScope(filters: any, entity: SecuredEntity): boolean {
	if (filters.account?.documentId?.eq !== entity.__account) return false;
	if (filters.Visibility?.eq !== entity.__visible) return false;
	const linkedList = filters.recommendation_lists;
	if (linkedList) {
		return entity.recommendation_lists.some((list: SecuredEntity) =>
			matchesScope(linkedList, list)
			&& (linkedList.or ?? []).some((choice: any) =>
				choice.slug?.eq === list.slug || choice.documentId?.eq === list.documentId,
			),
		);
	}
	return true;
}

describe("public Place linked recommendation security", () => {
	it("never selects private or cross-account people and products", async () => {
		const routeList: SecuredEntity = {
			__account: "account-1",
			__visible: true,
			documentId: "place-list-1",
			slug: "kyoto",
			Visibility: true,
		};
		const peopleLists: SecuredEntity[] = [
			{ __account: "account-1", __visible: true, documentId: "people-list-ok", List_Name: "People", slug: "people", recommendation_lists: [routeList] },
			{ __account: "account-1", __visible: false, documentId: "people-list-private", recommendation_lists: [routeList] },
			{ __account: "account-2", __visible: true, documentId: "people-list-cross", recommendation_lists: [routeList] },
		];
		const productLists: SecuredEntity[] = [
			{ __account: "account-1", __visible: true, documentId: "product-list-ok", List_Name: "Products", slug: "products", recommendation_lists: [routeList] },
			{ __account: "account-1", __visible: false, documentId: "product-list-private", recommendation_lists: [routeList] },
			{ __account: "account-2", __visible: true, documentId: "product-list-cross", recommendation_lists: [routeList] },
		];
		const people = peopleLists.map((person_list, index) => ({
			documentId: ["person-ok", "person-private", "person-cross"][index],
			person_list,
		}));
		const products = productLists.map((product_list, index) => ({
			documentId: ["product-ok", "product-private", "product-cross"][index],
			product_list,
		}));
		const pageInfo = { page: 1, pageSize: 200, pageCount: 1, total: 1 };

		const result = await graphql({
			schema: buildSchema(schemaSource),
			source: print(publicPlaceListBySlugQuery),
			variableValues: {
				accountDocumentId: "account-1",
				slug: "kyoto",
				documentId: "kyoto",
				peoplePagination: { page: 1, pageSize: 200 },
				productPagination: { page: 1, pageSize: 200 },
			},
			rootValue: {
				recommendationLists: () => [routeList],
				recommendedPeople_connection: (args: any) => ({
					nodes: people.filter(({ person_list }) => matchesScope(args.filters.person_list, person_list)),
					pageInfo,
				}),
				recommendedProducts_connection: (args: any) => ({
					nodes: products.filter(({ product_list }) => matchesScope(args.filters.product_list, product_list)),
					pageInfo,
				}),
			},
		});

		expect(result.errors).toBeUndefined();
		expect((result.data as any).recommendedPeople_connection.nodes.map(({ documentId }: any) => documentId)).toEqual(["person-ok"]);
		expect((result.data as any).recommendedProducts_connection.nodes.map(({ documentId }: any) => documentId)).toEqual(["product-ok"]);
	});

	it("executes the primary places connection with an account-owned published-list boundary", async () => {
		const lists: SecuredEntity[] = [
			{ __account: "account-1", __visible: true, documentId: "place-list-1", List_Name: "Public" },
			{ __account: "account-1", __visible: false, documentId: "place-list-1", List_Name: "Private" },
			{ __account: "account-2", __visible: true, documentId: "place-list-1", List_Name: "Cross account" },
		];
		const places = lists.map((recommendation_list, index) => ({
			documentId: ["place-ok", "place-private", "place-cross"][index],
			recommendation_list,
		}));
		const pageInfo = { page: 1, pageSize: 200, pageCount: 1, total: 1 };

		const result = await graphql({
			schema: buildSchema(schemaSource),
			source: print(publicRecommendedPlacesConnectionQuery),
			variableValues: {
				filters: buildPublicRecommendedPlacesFilters("account-1", "place-list-1"),
				pagination: { page: 1, pageSize: 200 },
			},
			rootValue: {
				recommendedPlaces_connection: (args: any) => ({
					nodes: places.filter(({ recommendation_list }) => {
						const filters = args.filters.recommendation_list;
						return filters.documentId?.eq === recommendation_list.documentId
							&& matchesScope(filters, recommendation_list);
					}),
					pageInfo,
				}),
			},
		});

		expect(result.errors).toBeUndefined();
		expect((result.data as any).recommendedPlaces_connection.nodes.map(({ documentId }: any) => documentId)).toEqual(["place-ok"]);
	});
});
