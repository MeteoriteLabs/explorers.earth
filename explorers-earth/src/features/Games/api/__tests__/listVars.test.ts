import { describe, it, expect } from "vitest";
import {
  GAMES_BY_LIST,
  GAMES_BY_LIST_PAGE_SIZE,
  gamesByListVars,
  refetchGamesByList,
} from "../query";

describe("Games list-query variable helpers", () => {
  it("is the exact page-0 window the list view queries", () => {
    expect(GAMES_BY_LIST_PAGE_SIZE).toBe(200);
    expect(gamesByListVars("abc123")).toEqual({
      gameListDocumentId: "abc123",
      page: 0,
      pageSize: GAMES_BY_LIST_PAGE_SIZE,
    });
  });

  it("refetch descriptor targets GAMES_BY_LIST with matching variables", () => {
    const [descriptor] = refetchGamesByList("abc123");
    expect(descriptor.query).toBe(GAMES_BY_LIST);
    expect(descriptor.variables).toEqual(gamesByListVars("abc123"));
  });
});
