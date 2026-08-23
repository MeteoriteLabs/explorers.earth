import { Kind, type FieldNode } from "graphql";
import { describe, expect, it } from "vitest";

import { GET_PUBLIC_GUIDE_BY_SLUG_QUERY } from "./queries";

// Regression: ISSUE-002 — A valid guide detail vanished when its section query mixed relation operators.
// Found by /qa on 2026-08-23
describe("GET_PUBLIC_GUIDE_BY_SLUG_QUERY", () => {
  it("groups the linked guide relation constraints under one or operator", () => {
    const operation = GET_PUBLIC_GUIDE_BY_SLUG_QUERY.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );
    const sections = operation?.kind === Kind.OPERATION_DEFINITION
      ? operation.selectionSet.selections.find(
        (selection): selection is FieldNode =>
          selection.kind === Kind.FIELD && selection.name.value === "guideSections_connection",
      )
      : undefined;
    const filters = sections?.arguments?.find((argument) => argument.name.value === "filters");
    const guide = filters?.value.kind === Kind.OBJECT
      ? filters.value.fields.find((field) => field.name.value === "guide")
      : undefined;

    expect(
      guide?.value.kind === Kind.OBJECT
        ? guide.value.fields.map((field) => field.name.value)
        : [],
    ).toEqual(["or"]);
  });
});
