import { describe, it, expect } from "vitest";
import {
  MOVIES_BY_LIST,
  MOVIES_BY_LIST_PAGE_SIZE,
  moviesByListVars,
  refetchMoviesByList,
} from "../query";

describe("Movies list-query variable helpers", () => {
  it("is the exact page-0 window the list view queries", () => {
    expect(MOVIES_BY_LIST_PAGE_SIZE).toBe(100);
    expect(moviesByListVars("abc123")).toEqual({
      movieListDocumentId: "abc123",
      page: 0,
      pageSize: MOVIES_BY_LIST_PAGE_SIZE,
    });
  });

  it("refetch descriptor targets MOVIES_BY_LIST with matching variables", () => {
    const [descriptor] = refetchMoviesByList("abc123");
    expect(descriptor.query).toBe(MOVIES_BY_LIST);
    expect(descriptor.variables).toEqual(moviesByListVars("abc123"));
  });
});
