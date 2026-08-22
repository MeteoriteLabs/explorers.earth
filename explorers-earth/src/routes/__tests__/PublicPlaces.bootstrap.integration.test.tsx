import { render, screen, waitFor } from "@testing-library/react";
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  InMemoryCache,
  Observable,
  type Operation,
  useQuery,
} from "@apollo/client";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ObservedOperation = {
  name: string;
  query: DocumentNode;
  variables: Record<string, unknown>;
};

const observedOperations: ObservedOperation[] = [];

function operationName(query: DocumentNode): string {
  const operation = query.definitions.find(
    (definition): definition is OperationDefinitionNode => definition.kind === "OperationDefinition",
  );
  return operation?.name?.value ?? "anonymous";
}

function rootFieldNames(query: DocumentNode): string[] {
  const operation = query.definitions.find(
    (definition): definition is OperationDefinitionNode => definition.kind === "OperationDefinition",
  );
  return operation?.selectionSet.selections.flatMap((selection) =>
    selection.kind === "Field" ? [selection.name.value] : [],
  ) ?? [];
}

function responseFor(operation: Operation) {
  switch (operation.operationName) {
    case "PublicProfileBootstrap":
      return {
        data: {
          accounts: [{
            __typename: "Account",
            documentId: "account-1",
            Account_Name: "Alice",
            Account_Type: "Personal",
            Primary_Address: { __typename: "ComponentAddressAddress", address: "Earth" },
            bg_picture: null,
            profile_picture: null,
            social_media: { __typename: "ComponentSocialSocial", theme_settings: { preset: "cinematic-dark" } },
            localtunes_public: false,
            public_profile: "Yes",
            public_recommendations: "Yes",
            public_music: "No",
            public_movie: "No",
            public_books: "No",
            public_guides: "No",
            public_games: "No",
            public_apps: "No",
            public_products: "No",
            public_people: "No",
            pinned_nav_tabs: [],
            auto_pinning: false,
          }],
        },
      };
    case "PublicCategoryListCounts":
      return {
        data: {
          recommendationLists: [], bookLists: [], movieLists: [], gameLists: [],
          appLists: [], productLists: [], personLists: [], guides: [],
        },
      };
    case "PublicPlacesLists":
      return { data: { recommendationLists: [] } };
    default:
      throw new Error(`Unexpected Apollo operation: ${operation.operationName}`);
  }
}

function createTestClient() {
  const link = new ApolloLink((operation) => new Observable((observer) => {
    observedOperations.push({
      name: operation.operationName,
      query: operation.query,
      variables: operation.variables,
    });
    queueMicrotask(() => {
      observer.next(responseFor(operation));
      observer.complete();
    });
  }));

  return new ApolloClient({
    cache: new InMemoryCache({ addTypename: false }),
    link,
    queryDeduplication: false,
  });
}

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
import { publicProfileBootstrapQuery } from "../../layouts/PublicProfileBootstrapContext";
import TabVisibilityGuard from "../validators/TabVisibilityGuard";
import { UsernameValidator } from "../validators/UsernameValidator";

function DeliberateBootstrapOwner() {
  useQuery(publicProfileBootstrapQuery, {
    variables: { filters: { username: { eq: "alice" } } },
    fetchPolicy: "network-only",
  });
  return null;
}

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

  it("makes a deliberately duplicated bootstrap owner fail the exact-one condition", async () => {
    render(
      <ApolloProvider client={createTestClient()}>
        <DeliberateBootstrapOwner />
        <DeliberateBootstrapOwner />
      </ApolloProvider>,
    );

    await waitFor(() => expect(
      observedOperations.filter(({ name }) => name === "PublicProfileBootstrap"),
    ).toHaveLength(2));

    expect(observedOperations.filter(({ name }) => name === "PublicProfileBootstrap")).not.toHaveLength(1);
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

    render(
      <ApolloProvider client={createTestClient()}>
        <RouterProvider router={router} />
      </ApolloProvider>,
    );

    await screen.findByRole("heading", { name: "No Places Yet" });
    await waitFor(() => expect(
      observedOperations.filter(({ name }) => name === "PublicProfileBootstrap"),
    ).toHaveLength(1));

    const bootstrap = observedOperations.filter(({ name }) => name === "PublicProfileBootstrap");
    expect(bootstrap).toHaveLength(1);
    expect(bootstrap[0]?.variables).toEqual({ filters: { username: { eq: "alice" } } });
    expect(rootFieldNames(bootstrap[0]!.query)).toEqual(["accounts"]);

    const places = observedOperations.filter(({ name }) => name === "PublicPlacesLists");
    expect(places).toHaveLength(1);
    expect(places[0]?.variables).toEqual({ accountDocumentId: "account-1" });
    expect(rootFieldNames(places[0]!.query)).toEqual(["recommendationLists"]);
  });
});
