import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));
const analyticsHarness = vi.hoisted(() => {
  const trackClick = vi.fn();
  const useTrackAnalytics = vi.fn(() => ({ trackClick, trackEvent: vi.fn(), trackInteraction: vi.fn(), trackView: vi.fn(), loading: false, error: null }));
  const products = vi.fn((accountId: string, pageUsername?: string, locationId?: string, recommendationId?: string, route?: { variant: string; path: string }) => ({
    accountId, pageUsername, locationId: locationId || null, recommendationId: recommendationId || null,
    pageName: "public-products", autoTrackView: true,
    routeVariant: route?.variant || (locationId ? "list" : "index"), routePath: route?.path || `/${pageUsername}/products`,
  }));
  return { products, trackClick, useTrackAnalytics };
});

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apollo/client")>()),
  useQuery: () => ({ data: queryState.data, loading: false, error: undefined, refetch: vi.fn().mockResolvedValue(undefined), fetchMore: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../../../../../layouts/PublicProfileBootstrapContext", () => ({ usePublicProfileBootstrapAccount: () => ({ documentId: "account-1", Account_Name: "Alice" }) }));
vi.mock("../../../../../components/SEO", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../../../services/analyticsService", () => ({ createAnalyticsOptions: { products: analyticsHarness.products }, useTrackAnalytics: analyticsHarness.useTrackAnalytics }));
vi.mock("../ProductCarouselRow", () => ({ default: ({ list, onProductClick }: any) => <button type="button" onClick={() => onProductClick(list.recommended_products[0])}>Open {list.recommended_products[0].title}</button> }));
vi.mock("../ProductTopPicksHero", () => ({ default: () => null }));
vi.mock("../ProductTopPicksMobileHero", () => ({ default: () => null }));
vi.mock("../ProductDetailModal", () => ({ default: ({ product }: any) => product ? <div data-testid="selected-product">{product.documentId}</div> : null }));

import PublicProductList from "../PublicProductList";
import PublicProducts from "../PublicProducts";

const product = { documentId: "product-doc-1", title: "Field Camera", brand: "Acme", is_pinned: false, pin_order: null, display_order: 1, logo_url: null, product_list: { documentId: "product-list-1", List_Name: "Gear", slug: "gear" } };
const pageInfo = { page: 1, pageSize: 200, pageCount: 1, total: 1 };

function renderAt(path: string, element: React.ReactNode, route: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /></Routes></MemoryRouter>);
}

describe("public products analytics", () => {
  beforeEach(() => {
    queryState.data = undefined;
    analyticsHarness.products.mockClear();
    analyticsHarness.trackClick.mockClear();
    analyticsHarness.useTrackAnalytics.mockClear();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("tracks the index view, stable product card, and share interaction", async () => {
    queryState.data = { productLists: [{ documentId: "product-list-1", List_Name: "Gear", slug: "gear", recommended_products: [product] }] };
    renderAt("/alice/products", <PublicProducts />, "/:username/products");

    expect(analyticsHarness.products).toHaveBeenCalledWith("account-1", "alice", undefined, undefined, { variant: "index", path: "/alice/products" });
    fireEvent.click(screen.getByRole("button", { name: "Open Field Camera" }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("product-card", expect.objectContaining({ id: "product-doc-1", title: "Field Camera" }));
    expect(screen.getByTestId("selected-product")).toHaveTextContent("product-doc-1");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", { context: "products-index" }));
  });

  it("tracks list views and cards with the product-list document ID", () => {
    queryState.data = { productLists: [{ documentId: "product-list-1", List_Name: "Gear", slug: "gear" }], recommendedProducts_connection: { nodes: [product], pageInfo } };
    renderAt("/alice/products/gear", <PublicProductList />, "/:username/products/:listSlug");

    expect(analyticsHarness.products).toHaveBeenCalledWith("account-1", "alice", "product-list-1", undefined, { variant: "list", path: "/alice/products/gear" });
    fireEvent.click(screen.getByRole("button", { name: /Field Camera/ }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("product-card", expect.objectContaining({ id: "product-doc-1", listId: "product-list-1" }));
  });
});
