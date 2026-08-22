import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));
const analyticsHarness = vi.hoisted(() => {
  const trackClick = vi.fn();
  const useTrackAnalytics = vi.fn(() => ({
    trackClick,
    trackEvent: vi.fn(),
    trackInteraction: vi.fn(),
    trackView: vi.fn(),
    loading: false,
    error: null,
  }));
  const apps = vi.fn((
    accountId: string,
    pageUsername?: string,
    locationId?: string,
    recommendationId?: string,
    route?: { variant: string; path: string },
  ) => ({
    accountId,
    pageUsername,
    locationId: locationId || null,
    recommendationId: recommendationId || null,
    pageName: "public-apps",
    autoTrackView: true,
    routeVariant: route?.variant || (locationId ? "list" : "index"),
    routePath: route?.path || `/${pageUsername}/apps`,
  }));

  return { apps, trackClick, useTrackAnalytics };
});

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apollo/client")>()),
  useQuery: () => ({
    data: queryState.data,
    loading: false,
    error: undefined,
    refetch: vi.fn().mockResolvedValue(undefined),
    fetchMore: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../../layouts/PublicProfileBootstrapContext", () => ({
  usePublicProfileBootstrapAccount: () => ({ documentId: "account-1", Account_Name: "Alice" }),
}));
vi.mock("../../../../../components/SEO", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../../../services/analyticsService", () => ({
  createAnalyticsOptions: { apps: analyticsHarness.apps },
  useTrackAnalytics: analyticsHarness.useTrackAnalytics,
}));
vi.mock("../AppCarouselRow", () => ({
  default: ({ list, onAppClick }: any) => (
    <button type="button" onClick={() => onAppClick(list.recommended_apps[0])}>
      Open {list.recommended_apps[0].title}
    </button>
  ),
}));
vi.mock("../AppTopPicksHero", () => ({ default: () => null }));
vi.mock("../AppTopPicksMobileHero", () => ({ default: () => null }));
vi.mock("../AppDetailModal", () => ({
  default: ({ app, onShare }: any) => app ? (
    <div>
      <div data-testid="selected-app">{app.documentId}</div>
      <button type="button" onClick={() => onShare?.(app.documentId)}>Share {app.title} detail</button>
    </div>
  ) : null,
}));

import PublicAppList from "../PublicAppList";
import PublicApps from "../PublicApps";

const app = {
  documentId: "app-doc-1",
  title: "Focus App",
  developer: "Acme",
  is_pinned: false,
  pin_order: null,
  display_order: 1,
  logo_url: null,
  app_list: { documentId: "app-list-1", List_Name: "Useful Apps", slug: "useful-apps" },
};
const pageInfo = { page: 1, pageSize: 200, pageCount: 1, total: 1 };

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={["/alice/apps"]}>
      <Routes><Route path="/:username/apps" element={<PublicApps />} /></Routes>
    </MemoryRouter>,
  );
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/alice/apps/useful-apps"]}>
      <Routes><Route path="/:username/apps/:listSlug" element={<PublicAppList />} /></Routes>
    </MemoryRouter>,
  );
}

describe("public apps analytics", () => {
  beforeEach(() => {
    queryState.data = undefined;
    analyticsHarness.apps.mockClear();
    analyticsHarness.trackClick.mockClear();
    analyticsHarness.useTrackAnalytics.mockClear();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("tracks the index view, stable app card, and share interaction", async () => {
    queryState.data = {
      appLists: [{
        documentId: "app-list-1",
        List_Name: "Useful Apps",
        slug: "useful-apps",
        recommended_apps: [app],
      }],
    };

    renderIndex();

    expect(analyticsHarness.apps).toHaveBeenCalledWith(
      "account-1",
      "alice",
      undefined,
      undefined,
      { variant: "index", path: "/alice/apps" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Focus App" }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("app-card", expect.objectContaining({
      id: "app-doc-1",
      title: "Focus App",
    }));
    expect(screen.getByTestId("selected-app")).toHaveTextContent("app-doc-1");
    fireEvent.click(screen.getByRole("button", { name: "Share Focus App detail" }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", {
      context: "apps-index-detail",
      id: "app-doc-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", { context: "apps-index" });
    });
  });

  it("tracks list views, cards, detail Share, and list Share with stable document IDs", async () => {
    queryState.data = {
      appLists: [{ documentId: "app-list-1", List_Name: "Useful Apps", slug: "useful-apps" }],
      recommendedApps_connection: { nodes: [app], pageInfo },
    };

    renderList();

    expect(analyticsHarness.apps).toHaveBeenCalledWith(
      "account-1",
      "alice",
      "app-list-1",
      undefined,
      { variant: "list", path: "/alice/apps/useful-apps" },
    );
    fireEvent.click(screen.getByRole("button", { name: /Focus App/ }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("app-card", expect.objectContaining({
      id: "app-doc-1",
      listId: "app-list-1",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Share Focus App detail" }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", {
      context: "apps-list-detail",
      id: "app-doc-1",
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", {
      context: "apps-list",
      listId: "app-list-1",
    }));
  });
});
