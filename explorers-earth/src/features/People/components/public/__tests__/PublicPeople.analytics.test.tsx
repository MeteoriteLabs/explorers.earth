import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));
const analyticsHarness = vi.hoisted(() => {
  const trackClick = vi.fn();
  const useTrackAnalytics = vi.fn(() => ({ trackClick, trackEvent: vi.fn(), trackInteraction: vi.fn(), trackView: vi.fn(), loading: false, error: null }));
  const people = vi.fn((accountId: string, pageUsername?: string, locationId?: string, recommendationId?: string, route?: { variant: string; path: string }) => ({
    accountId, pageUsername, locationId: locationId || null, recommendationId: recommendationId || null,
    pageName: "public-people", autoTrackView: true,
    routeVariant: route?.variant || (locationId ? "list" : "index"), routePath: route?.path || `/${pageUsername}/people`,
  }));
  return { people, trackClick, useTrackAnalytics };
});

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apollo/client")>()),
  useQuery: () => ({ data: queryState.data, loading: false, error: undefined, refetch: vi.fn().mockResolvedValue(undefined), fetchMore: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../../../../../layouts/PublicProfileBootstrapContext", () => ({ usePublicProfileBootstrapAccount: () => ({ documentId: "account-1", Account_Name: "Alice" }) }));
vi.mock("../../../../../components/SEO", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../../../services/analyticsService", () => ({ createAnalyticsOptions: { people: analyticsHarness.people }, useTrackAnalytics: analyticsHarness.useTrackAnalytics }));
vi.mock("../PersonCarouselRow", () => ({ default: ({ list, onPersonClick }: any) => <button type="button" onClick={() => onPersonClick(list.recommended_people[0])}>Open {list.recommended_people[0].full_name}</button> }));
vi.mock("../PersonTopPicksHero", () => ({ default: () => null }));
vi.mock("../PersonTopPicksMobileHero", () => ({ default: () => null }));
vi.mock("../PersonDetailModal", () => ({ default: ({ person }: any) => person ? <div data-testid="selected-person">{person.documentId}</div> : null }));

import PublicPeople from "../PublicPeople";
import PublicPersonList from "../PublicPersonList";
import PublicPersonSector from "../PublicPersonSector";

const person = { documentId: "person-doc-1", full_name: "Asha Rao", headline: "Explorer", handle: "asha", platform: null, avatar_url: null, is_pinned: false, pin_order: null, display_order: 1, person_list: { documentId: "person-list-1", List_Name: "Creators", slug: "creators" }, people_category: { documentId: "sector-doc-1", Category_name: "Scientists" } };
const pageInfo = { page: 1, pageSize: 200, pageCount: 1, total: 1 };

function renderAt(path: string, element: React.ReactNode, route: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /></Routes></MemoryRouter>);
}

describe("public people analytics", () => {
  beforeEach(() => {
    queryState.data = undefined;
    analyticsHarness.people.mockClear();
    analyticsHarness.trackClick.mockClear();
    analyticsHarness.useTrackAnalytics.mockClear();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("tracks the index view, stable person card, and share interaction", async () => {
    queryState.data = { personLists: [{ documentId: "person-list-1", List_Name: "Creators", slug: "creators", recommended_people: [person] }] };
    renderAt("/alice/people", <PublicPeople />, "/:username/people");

    expect(analyticsHarness.people).toHaveBeenCalledWith("account-1", "alice", undefined, undefined, { variant: "index", path: "/alice/people" });
    fireEvent.click(screen.getByRole("button", { name: "Open Asha Rao" }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("person-card", expect.objectContaining({ id: "person-doc-1", name: "Asha Rao" }));
    expect(screen.getByTestId("selected-person")).toHaveTextContent("person-doc-1");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", { context: "people-index" }));
  });

  it("tracks list views and cards with the person-list document ID", () => {
    queryState.data = { personLists: [{ documentId: "person-list-1", List_Name: "Creators", slug: "creators" }], recommendedPeople_connection: { nodes: [person], pageInfo } };
    renderAt("/alice/people/creators", <PublicPersonList />, "/:username/people/:listSlug");

    expect(analyticsHarness.people).toHaveBeenCalledWith("account-1", "alice", "person-list-1", undefined, { variant: "list", path: "/alice/people/creators" });
    fireEvent.click(screen.getByRole("button", { name: /Asha Rao/ }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("person-card", expect.objectContaining({ id: "person-doc-1", listId: "person-list-1" }));
  });

  it("tracks sector filters with the stable taxonomy document ID", () => {
    queryState.data = { peopleCategories: [{ documentId: "sector-doc-1", Category_name: "Scientists" }], recommendedPeople_connection: { nodes: [person], pageInfo } };
    renderAt("/alice/people/sector/sector-doc-1", <PublicPersonSector />, "/:username/people/sector/:sectorSlug");

    expect(analyticsHarness.people).toHaveBeenCalledWith("account-1", "alice", "sector-doc-1", undefined, { variant: "filter", path: "/alice/people/sector/sector-doc-1" });
    fireEvent.click(screen.getByRole("button", { name: /Asha Rao/ }));
    expect(analyticsHarness.trackClick).toHaveBeenCalledWith("person-card", expect.objectContaining({ id: "person-doc-1", filterId: "sector-doc-1" }));
  });
});
