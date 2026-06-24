import { describe, it, expect } from "vitest";
import {
  BOOKS_BY_LIST,
  BOOKS_BY_LIST_PAGE_SIZE,
  booksByListVars,
  refetchBooksByList,
} from "../query";

describe("Books list-query variable helpers", () => {
  it("is the exact page-0 window the list view queries", () => {
    expect(BOOKS_BY_LIST_PAGE_SIZE).toBe(200);
    expect(booksByListVars("abc123")).toEqual({
      bookListDocumentId: "abc123",
      page: 0,
      pageSize: BOOKS_BY_LIST_PAGE_SIZE,
    });
  });

  it("refetch descriptor targets BOOKS_BY_LIST with matching variables", () => {
    const [descriptor] = refetchBooksByList("abc123");
    expect(descriptor.query).toBe(BOOKS_BY_LIST);
    expect(descriptor.variables).toEqual(booksByListVars("abc123"));
  });
});
