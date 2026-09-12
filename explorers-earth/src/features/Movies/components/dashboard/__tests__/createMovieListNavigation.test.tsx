import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loginSurface, surfaceHarness } from "../../../../navigation/__tests__/surfaceHarness";

// Spy on navigation so we can assert the newly created list is opened.
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// Authenticated user.
const createFn = vi.fn(async () => ({
  data: { createMovieList: { documentId: "movie-1" } },
}));
import MoviesHome from "../MoviesHome";

describe("MoviesHome create-list navigation (BUG-3)", () => {
  beforeEach(() => {
    loginSurface();
    navigateSpy.mockClear();
    createFn.mockClear();
  });

  it("navigates into the newly created list with justCreatedList state", async () => {
    const h = surfaceHarness(<MoviesHome />, { initial: { documentId: "acc-1", public_movie: "No" },
      respond: name => name === "CreateMovieList" ? createFn().then(result => result.data) : undefined,
    });
    await h.ready();

    // Open the create-list modal (header renders a New List button).
    const newListButtons = await screen.findAllByRole("button", {
      name: /New List/i,
    });
    await userEvent.click(newListButtons[0]);

    // Fill the list name and submit.
    const nameInput = await screen.findByPlaceholderText(/Enter List Name/i);
    await userEvent.type(nameInput, "Sci-Fi Picks");

    await userEvent.click(
      screen.getByRole("button", { name: /Create List/i })
    );

    await waitFor(() => expect(createFn).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/recommendations/movies/movie-1", {
        state: { justCreatedList: true },
      })
    );
    expect(h.writes).toEqual([]);
  });
});
