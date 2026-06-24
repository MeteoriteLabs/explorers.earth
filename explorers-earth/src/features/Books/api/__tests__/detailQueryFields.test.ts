import { describe, it, expect } from "vitest";
import type { DocumentNode, OperationDefinitionNode, FieldNode } from "graphql";
import { BOOKS_BY_LIST } from "../query";
import { GAMES_BY_LIST } from "../../../Games/api/query";
import { MOVIES_BY_LIST } from "../../../Movies/api/query";

function listLevelFields(doc: DocumentNode, listField: string): string[] {
  const op = doc.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === "OperationDefinition",
  );
  const list = op?.selectionSet.selections.find(
    (s): s is FieldNode => s.kind === "Field" && s.name.value === listField,
  );
  return (list?.selectionSet?.selections ?? [])
    .filter((s): s is FieldNode => s.kind === "Field")
    .map((s) => s.name.value);
}

describe("detail queries select list-level display_order (optimisticResponse needs it)", () => {
  it("BOOKS_BY_LIST", () =>
    expect(listLevelFields(BOOKS_BY_LIST, "bookLists")).toContain("display_order"));
  it("GAMES_BY_LIST", () =>
    expect(listLevelFields(GAMES_BY_LIST, "gameLists")).toContain("display_order"));
  it("MOVIES_BY_LIST", () =>
    expect(listLevelFields(MOVIES_BY_LIST, "movieLists")).toContain("display_order"));
});
