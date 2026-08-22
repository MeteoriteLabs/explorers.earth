import { render, screen, waitFor } from "@testing-library/react";
import type { DocumentNode, FieldNode, OperationDefinitionNode } from "graphql";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { observedOperations } = vi.hoisted(() => ({
  observedOperations: [] as DocumentNode[],
}));

function operationName(query: DocumentNode): string {
  const operation = query.definitions.find(
    (definition): definition is OperationDefinitionNode => definition.kind === "OperationDefinition",
  );
  return operation?.name?.value ?? "anonymous";
}

function hasRootAccountsField(query: DocumentNode): boolean {
  const operation = query.definitions.find(
    (definition): definition is OperationDefinitionNode => definition.kind === "OperationDefinition",
  );
  return Boolean(
    operation?.selectionSet.selections.some(
      (selection): selection is FieldNode =>
        selection.kind === "Field" && selection.name.value === "accounts",
    ),
  );
}

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: (query: DocumentNode) => {
      observedOperations.push(query);
      const name = operationName(query);
      if (name === "PublicProfileBootstrap") {
        return {
          data: {
            accounts: [{
              documentId: "account-1",
              Account_Name: "Alice",
              public_profile: "Yes",
              public_recommendations: "Yes",
              social_media: { theme_settings: { preset: "cinematic-dark" } },
            }],
          },
          loading: false,
          error: undefined,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }
      if (name === "PublicCategoryListCounts") {
        return {
          data: {
            recommendationLists: [], bookLists: [], movieLists: [], gameLists: [],
            appLists: [], productLists: [], personLists: [], guides: [],
          },
          loading: false,
          error: undefined,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }
      if (name === "user") {
        return {
          data: {
            accounts: [{
              documentId: "account-1",
              Account_Name: "Alice",
              Primary_Address: { address: "Earth" },
              recommendation_lists: [],
            }],
          },
          loading: false,
          error: undefined,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }
      if (name === "Account") {
        return {
          data: { accounts: [{ Account_Name: "Alice", recommendation_lists: [] }] },
          loading: false,
          error: undefined,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }
      if (name === "PublicPlacesLists") {
        return {
          data: { recommendationLists: [] },
          loading: false,
          error: undefined,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }
      return {
        data: undefined,
        loading: false,
        error: undefined,
        refetch: vi.fn().mockResolvedValue(undefined),
        fetchMore: vi.fn(),
      };
    },
  };
});

vi.mock("../../services/analyticsService", () => ({
  useTrackAnalytics: () => ({
    trackClick: vi.fn(),
    trackEvent: vi.fn(),
  }),
}));

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../hooks/useQRActions", () => ({
  useQRActions: () => ({ handleCopyLink: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === "string" ? fallback : fallback?.defaultValue ?? _key,
  }),
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Map: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pin: () => null,
  useMap: () => null,
}));

import PublicHome from "../../features/PublicHome/components/PublicHome";
import PublicLayout from "../../layouts/PublicLayout";
import TabVisibilityGuard from "../validators/TabVisibilityGuard";
import { UsernameValidator } from "../validators/UsernameValidator";

describe("real direct Places bootstrap ownership", () => {
  beforeEach(() => {
    observedOperations.length = 0;
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  });

  it("issues one account identity/theme/visibility operation and gives leaf data its own query", async () => {
    const router = createMemoryRouter(
      [{
        path: "/:username/*",
        element: <PublicLayout />,
        children: [{
          element: <UsernameValidator />,
          children: [{
            id: "places-index",
            path: "places",
            element: (
              <TabVisibilityGuard tabField="public_recommendations">
                <PublicHome />
              </TabVisibilityGuard>
            ),
          }],
        }],
      }],
      { initialEntries: ["/alice/places"] },
    );

    render(<RouterProvider router={router} />);

    await screen.findByRole("heading", { name: "No Places Yet" });
    await waitFor(() => {
      const accountOperations = Array.from(new Set(
        observedOperations.filter(hasRootAccountsField).map(operationName),
      ));
      expect(accountOperations).toEqual(["PublicProfileBootstrap"]);
    });
    expect(observedOperations.map(operationName)).toContain("PublicPlacesLists");
  });
});
