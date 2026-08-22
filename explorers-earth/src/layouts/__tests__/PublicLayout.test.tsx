import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useSyncExternalStore } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePublicRouteLifecycle } from "../usePublicRouteLifecycle";

const { bootstrapResult, leafState } = vi.hoisted(() => ({
  bootstrapResult: {
    data: undefined as Record<string, unknown> | undefined,
    loading: true,
    error: undefined as Error | undefined,
    refetch: vi.fn<() => Promise<unknown>>(),
  },
  leafState: {
    loading: true,
    error: undefined as Error | undefined,
    hasUsableData: false,
    empty: false,
    label: "Apps content",
  },
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: () => bootstrapResult,
  };
});

vi.mock("../../components/PublicNav", () => ({
  default: () => <nav aria-label="Public profile navigation">Public nav</nav>,
}));

vi.mock("../../components/EarthLoader", () => ({
  EarthLoader: () => <div role="status" aria-label="Loading public profile identity" />,
}));

vi.mock("../../pages/NotFound", () => ({
  default: () => <h1>Page Not Found</h1>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === "string" ? fallback : fallback?.defaultValue ?? _key,
  }),
}));

import PublicLayout from "../PublicLayout";

let leafVersion = 0;
const leafListeners = new Set<() => void>();

function updateLeaf(patch: Partial<typeof leafState>) {
  Object.assign(leafState, patch);
  leafVersion += 1;
  for (const listener of leafListeners) listener();
}

function LeafHarness() {
  useSyncExternalStore(
    (listener) => {
      leafListeners.add(listener);
      return () => leafListeners.delete(listener);
    },
    () => leafVersion,
  );
  usePublicRouteLifecycle({
    loading: leafState.loading,
    error: leafState.error,
    retry: async () => undefined,
    hasUsableData: leafState.hasUsableData,
    empty: leafState.empty,
  });

  return (
    <article data-testid="leaf-content">
      <h1 tabIndex={-1}>{leafState.label}</h1>
    </article>
  );
}

function renderLayout(
  initialEntry: string | { pathname: string; state?: unknown } = "/alice/apps",
  { strict = false }: { strict?: boolean } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "/:username/*",
        element: <PublicLayout />,
        children: [
          { id: "profile", index: true, element: <LeafHarness /> },
          { id: "apps-index", path: "apps", element: <LeafHarness /> },
          { id: "products-index", path: "products", element: <LeafHarness /> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );
  const provider = <RouterProvider router={router} />;
  const result = render(strict ? <StrictMode>{provider}</StrictMode> : provider);
  return { ...result, router };
}

function settleBootstrap() {
  bootstrapResult.data = {
    accounts: [
      {
        documentId: "account-1",
        Account_Name: "Alice",
        public_profile: "Yes",
        public_apps: "Yes",
        public_products: "Yes",
        social_media: { theme_settings: { preset: "cinematic-dark" } },
      },
    ],
  };
  bootstrapResult.loading = false;
  bootstrapResult.error = undefined;
}

describe("PublicLayout visual state contract", () => {
  beforeEach(() => {
    bootstrapResult.data = undefined;
    bootstrapResult.loading = true;
    bootstrapResult.error = undefined;
    bootstrapResult.refetch = vi.fn().mockResolvedValue(undefined);
    leafState.loading = true;
    leafState.error = undefined;
    leafState.hasUsableData = false;
    leafState.empty = false;
    leafState.label = "Apps content";
    leafVersion += 1;
    leafListeners.clear();
  });

  it("shows Earth only while bootstrap identity is unresolved", () => {
    renderLayout();

    expect(screen.getByRole("status", { name: "Loading public profile identity" })).toBeInTheDocument();
    expect(screen.queryByTestId("public-route-skeleton-collection")).not.toBeInTheDocument();
    expect(screen.queryByTestId("public-profile-shell")).not.toBeInTheDocument();
  });

  it("keeps a bootstrap failure on the requested URL with a focused Retry region", async () => {
    bootstrapResult.loading = false;
    bootstrapResult.error = new Error("bootstrap offline");
    const { router } = renderLayout();

    const errorRegion = await screen.findByRole("alert", {
      name: "Couldn’t verify this profile",
    });
    expect(errorRegion).toHaveFocus();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading public profile identity" })).toBeNull();
    expect(router.state.location.pathname).toBe("/alice/apps");
  });

  it("replaces Earth with exactly one matched route skeleton before content", async () => {
    settleBootstrap();
    const { rerender, router } = renderLayout();

    rerender(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Loading public profile identity" })).not.toBeInTheDocument();
      expect(screen.getAllByTestId("public-route-skeleton-collection")).toHaveLength(1);
    });
    expect(screen.queryByTestId("public-route-skeleton-profile-root")).not.toBeInTheDocument();
    expect(screen.getByTestId("leaf-content").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("keeps public chrome mounted during same-username navigation", async () => {
    settleBootstrap();
    leafState.loading = false;
    leafState.hasUsableData = true;
    const { rerender, router } = renderLayout();

    await waitFor(() => expect(screen.getByText("Apps content")).toBeVisible());
    const nav = screen.getByRole("navigation", { name: "Public profile navigation" });

    updateLeaf({ loading: true, hasUsableData: false, label: "Products content" });
    await act(() => router.navigate("/alice/products"));
    rerender(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByTestId("public-route-skeleton-collection")).toBeVisible());
    expect(screen.queryByRole("status", { name: "Loading public profile identity" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Public profile navigation" })).toBe(nav);
  });

  it("settles once under Strict Mode remount semantics", async () => {
    settleBootstrap();
    leafState.loading = false;
    leafState.hasUsableData = true;

    renderLayout("/alice/apps", { strict: true });

    await waitFor(() => expect(screen.getByText("Apps content")).toBeVisible());
    expect(screen.getAllByRole("navigation", { name: "Public profile navigation" })).toHaveLength(1);
    expect(screen.getAllByTestId("leaf-content")).toHaveLength(1);
    expect(screen.queryByRole("status", { name: "Loading public profile identity" })).toBeNull();
    expect(screen.queryByTestId("public-route-skeleton-collection")).toBeNull();
  });

  it("retains content and focus while a background refresh is active", async () => {
    settleBootstrap();
    leafState.loading = false;
    leafState.hasUsableData = true;
    const { rerender, router } = renderLayout();

    const heading = await screen.findByRole("heading", { name: "Apps content" });
    heading.focus();
    act(() => updateLeaf({ loading: true }));

    await waitFor(() => expect(screen.getByTestId("public-route-refresh-progress")).toBeInTheDocument());
    expect(screen.getByTestId("leaf-content")).toBeVisible();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(heading).toHaveFocus();
    expect(screen.queryByTestId("public-route-skeleton-collection")).not.toBeInTheDocument();
  });

  it("keeps a refresh failure non-blocking and focuses recovered content after Retry", async () => {
    settleBootstrap();
    leafState.loading = false;
    leafState.hasUsableData = true;
    leafState.error = new Error("refresh failed");
    const { rerender, router } = renderLayout();

    await waitFor(() => expect(screen.getByTestId("leaf-content")).toBeVisible());
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t refresh this section");

    act(() => updateLeaf({ error: undefined }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Apps content" })).toHaveFocus());
  });

  it("retains route content when bootstrap revalidation fails", async () => {
    settleBootstrap();
    bootstrapResult.error = new Error("bootstrap refresh failed");
    leafState.loading = false;
    leafState.hasUsableData = true;
    renderLayout();

    await waitFor(() => expect(screen.getByTestId("leaf-content")).toBeVisible());
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t refresh this section");
    expect(screen.queryByTestId("public-route-skeleton-collection")).toBeNull();
    expect(screen.queryByRole("status", { name: "Loading public profile identity" })).toBeNull();
  });

  it("keeps an initial leaf failure on its URL with a focused scoped Retry region", async () => {
    settleBootstrap();
    leafState.loading = false;
    leafState.error = new Error("offline");
    leafState.hasUsableData = false;
    const { router } = renderLayout();

    const errorRegion = await screen.findByRole("alert");
    expect(errorRegion).toHaveFocus();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByTestId("leaf-content").closest("[aria-hidden='true']")).not.toBeNull();
    expect(router.state.location.pathname).toBe("/alice/apps");
  });

  it("focuses the profile heading only after a fallback replacement", async () => {
    settleBootstrap();
    leafState.loading = false;
    leafState.hasUsableData = true;
    leafState.label = "Alice profile";

    renderLayout({ pathname: "/alice", state: { publicProfileFallback: true } });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice profile" })).toHaveFocus());
  });
});
