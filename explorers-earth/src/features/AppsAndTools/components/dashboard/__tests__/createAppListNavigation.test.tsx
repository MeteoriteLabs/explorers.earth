import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("../../../../../store/store", () => ({
  default: () => ({ user: { documentId: "u1", username: "qa" } }),
}));

const createFn = vi.fn(async () => ({
  data: { createAppList: { documentId: "app-1" } },
}));
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: () => [createFn, { loading: false }],
    useQuery: (query: { definitions: Array<{ name?: { value: string } }> }) => {
      const opName = query?.definitions?.[0]?.name?.value;
      if (opName === "MyAccountForApps") {
        return {
          data: {
            usersPermissionsUser: {
              accounts: [{ documentId: "acc-1", public_apps: "No" }],
            },
          },
          loading: false,
          refetch: vi.fn(),
        };
      }
      return { data: { appLists: [] }, loading: false, refetch: vi.fn() };
    },
  };
});

import AppsHome from "../AppsHome";

describe("AppsHome create-list navigation (BUG-3)", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    createFn.mockClear();
  });

  it("navigates into the newly created list with justCreatedList state", async () => {
    render(
      <MemoryRouter>
        <AppsHome />
      </MemoryRouter>
    );

    const newListButtons = await screen.findAllByRole("button", {
      name: /New List/i,
    });
    await userEvent.click(newListButtons[0]);

    await waitFor(() =>
      expect(document.querySelector('input[name="List_Name"]')).toBeTruthy()
    );
    const nameInput = document.querySelector(
      'input[name="List_Name"]'
    ) as HTMLInputElement;
    await userEvent.type(nameInput, "Dev Tools");

    await userEvent.click(screen.getByRole("button", { name: /Create List/i }));

    await waitFor(() => expect(createFn).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/recommendations/apps/app-1", {
        state: { justCreatedList: true },
      })
    );
  });
});
