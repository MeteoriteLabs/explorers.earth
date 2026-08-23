import { Kind, type FieldNode } from "graphql";
import { describe, expect, it } from "vitest";

import { publicPlaceListBySlugQuery } from "./query";

// Regression: ISSUE-001 — Places content vanished after its linked-list query failed schema validation.
// Found by /qa on 2026-08-23
describe("publicPlaceListBySlugQuery", () => {
  it("uses the backend's singular recommendation_list relation in linked-list filters", () => {
    const listFilters = publicPlaceListBySlugQuery.definitions
      .filter((definition) => definition.kind === Kind.OPERATION_DEFINITION)
      .flatMap((definition) => definition.selectionSet.selections)
      .filter((selection): selection is FieldNode => selection.kind === Kind.FIELD)
      .filter((field) =>
        field.name.value === "recommendedPeople_connection" ||
        field.name.value === "recommendedProducts_connection")
      .map((field) => {
        const filters = field.arguments?.find((argument) => argument.name.value === "filters");
        const personOrProductList = filters?.value.kind === Kind.OBJECT
          ? filters.value.fields.find((entry) =>
            entry.name.value === "person_list" || entry.name.value === "product_list")
          : undefined;
        return personOrProductList?.value.kind === Kind.OBJECT
          ? personOrProductList.value
          : undefined;
      });

    expect(listFilters.map((filter) => filter?.fields.map((entry) => entry.name.value))).toEqual([
      ["account", "Visibility", "recommendation_list"],
      ["account", "Visibility", "recommendation_list"],
    ]);
    expect(listFilters.map((filter) => {
      const relation = filter?.fields.find((entry) => entry.name.value === "recommendation_list");
      return relation?.value.kind === Kind.OBJECT
        ? relation.value.fields.map((entry) => entry.name.value)
        : [];
    })).toEqual([["or"], ["or"]]);
  });
});
