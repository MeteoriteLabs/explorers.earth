import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { modalOpenRenders } = vi.hoisted(() => ({ modalOpenRenders: { n: 0 } }));

vi.mock("../../../../../components/ListVisibilityModal", () => ({
  ListVisibilityModal: ({ isOpen }: { isOpen: boolean }) => {
    if (!isOpen) return null;
    modalOpenRenders.n += 1;
    return <div>PUBLISH-PROMPT</div>;
  },
}));

vi.mock("../../../../../store/store", () => ({
  default: () => ({ user: { username: "qa", accountDocumentId: "acc-1" } }),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: () => [vi.fn(), { loading: false }],
    useQuery: () => ({
      data: {
        bookLists: [
          {
            documentId: "list_1",
            List_Name: "Summer Reads",
            list_description: null,
            slug: "summer-reads",
            visibility: false, // NOTE: lowercase for books — draft → prompt opens
            display_order: 0,
            top_reads_heading: null,
            account: { documentId: "acc-1", username: "qa" },
            recommended_books: [],
          },
        ],
      },
      loading: false,
      refetch: vi.fn(),
    }),
  };
});

import BookListView from "../BookListView";

describe("BookListView publish prompt on justCreatedList (BUG-3 loop, lowercase visibility)", () => {
  beforeEach(() => {
    modalOpenRenders.n = 0;
  });

  it("opens the publish prompt once without an infinite re-render loop", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <MemoryRouter
          initialEntries={[
            { pathname: "/recommendations/books/list_1", state: { justCreatedList: true } },
          ]}
        >
          <Routes>
            <Route
              path="/recommendations/books/:listId"
              element={<BookListView />}
            />
          </Routes>
        </MemoryRouter>
      )
    ).not.toThrow();

    expect(screen.getByText("PUBLISH-PROMPT")).toBeInTheDocument();
    expect(modalOpenRenders.n).toBeLessThan(5);
    const loopWarned = errorSpy.mock.calls.some((c) =>
      String(c[0]).includes("Maximum update depth")
    );
    expect(loopWarned).toBe(false);

    errorSpy.mockRestore();
  });
});
