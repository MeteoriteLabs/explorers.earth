import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Count how many times the publish modal is rendered while open — a loop would
// blow this up (or throw "Maximum update depth exceeded" before we even assert).
const { modalOpenRenders } = vi.hoisted(() => ({ modalOpenRenders: { n: 0 } }));

vi.mock("../../../../../components/ListVisibilityModal", () => ({
  ListVisibilityModal: ({ isOpen }: { isOpen: boolean }) => {
    if (!isOpen) return null;
    modalOpenRenders.n += 1;
    return <div>PUBLISH-PROMPT</div>;
  },
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: () => [vi.fn(), { loading: false }],
    useQuery: () => ({
      data: {
        movieLists: [
          {
            documentId: "list_1",
            List_Name: "My Sci-Fi",
            list_description: null,
            slug: "my-sci-fi",
            Visibility: false, // draft → prompt should open
            display_order: 0,
            top_picks_heading: null,
            recommended_movies: [],
          },
        ],
      },
      loading: false,
      refetch: vi.fn(),
    }),
  };
});

import MovieListView from "../MovieListView";

describe("MovieListView publish prompt on justCreatedList (BUG-3 loop)", () => {
  beforeEach(() => {
    modalOpenRenders.n = 0;
  });

  it("opens the publish prompt once without an infinite re-render loop", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Rendering flushes effects; the buggy version would throw
    // "Maximum update depth exceeded" here.
    expect(() =>
      render(
        <MemoryRouter
          initialEntries={[
            { pathname: "/recommendations/movies/list_1", state: { justCreatedList: true } },
          ]}
        >
          <Routes>
            <Route
              path="/recommendations/movies/:listId"
              element={<MovieListView />}
            />
          </Routes>
        </MemoryRouter>
      )
    ).not.toThrow();

    // Prompt opened…
    expect(screen.getByText("PUBLISH-PROMPT")).toBeInTheDocument();
    // …and it did not loop (a loop renders the open modal dozens of times).
    expect(modalOpenRenders.n).toBeLessThan(5);
    // No "Maximum update depth exceeded" warning was logged.
    const loopWarned = errorSpy.mock.calls.some((c) =>
      String(c[0]).includes("Maximum update depth")
    );
    expect(loopWarned).toBe(false);

    errorSpy.mockRestore();
  });
});
