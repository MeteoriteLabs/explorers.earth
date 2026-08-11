import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Spy on navigation so we can assert the newly created list is opened.
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// Authenticated user.
vi.mock("../../../../../store/store", () => ({
  default: () => ({ user: { documentId: "u1", username: "qa" } }),
}));

// A create mutation that returns a documentId; account + list queries resolved
// synchronously so the create modal mounts and we can submit it.
const createFn = vi.fn(async () => ({
  data: { createMovieList: { documentId: "movie-1" } },
}));
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: () => [createFn, { loading: false }],
    useQuery: (query: { definitions: Array<{ name?: { value: string } }> }) => {
      const opName = query?.definitions?.[0]?.name?.value;
      if (opName === "MyAccountForMovies") {
        return {
          data: {
            usersPermissionsUser: {
              accounts: [
                {
                  documentId: "acc-1",
                  Account_Name: "QA",
                  public_movie: "No",
                  public_recommendations: "No",
                  public_books: "No",
                  public_games: "No",
                  public_music: "No",
                },
              ],
            },
          },
          loading: false,
          refetch: vi.fn(),
        };
      }
      // MovieListsByAccount
      return { data: { movieLists: [] }, loading: false, refetch: vi.fn() };
    },
  };
});

import MoviesHome from "../MoviesHome";

describe("MoviesHome create-list navigation (BUG-3)", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    createFn.mockClear();
  });

  it("navigates into the newly created list with justCreatedList state", async () => {
    render(
      <MemoryRouter>
        <MoviesHome />
      </MemoryRouter>
    );

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
  });
});
