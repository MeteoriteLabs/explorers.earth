import { act, render, screen, waitFor } from "@testing-library/react";
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable, type FetchResult, type Operation } from "@apollo/client";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../services/analyticsService", () => ({ useTrackAnalytics: () => ({ trackClick: vi.fn(), trackEvent: vi.fn() }) }));
vi.mock("../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../hooks/useQRActions", () => ({ useQRActions: () => ({ handleCopyLink: vi.fn() }) }));
vi.mock("@vis.gl/react-google-maps", () => ({
	AdvancedMarker: ({ children }: { children?: ReactNode }) => <>{children}</>,
	Map: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	Pin: () => null,
	useMap: () => null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import PublicHome from "./PublicHome";
import { PublicProfileBootstrapContext } from "../../../layouts/PublicProfileBootstrapContext";
import { PublicRouteReadinessContext, type PublicRouteReadinessContextValue } from "../../../layouts/PublicRouteReadinessContext";

const pageInfo = { __typename: "Pagination", page: 1, pageSize: 200, pageCount: 1, total: 0 };
const emptyConnection = { __typename: "Connection", nodes: [], pageInfo };

function parentResponse() {
	return {
		data: {
			recommendationLists: [{
				__typename: "RecommendationList", documentId: "place-list-1", List_Name: "Empty Places",
				slug: "empty-places", Visibility: true, is_pinned: false, pin_order: null,
				display_order: 1, List_Name_Details: null,
			}],
			recommendedPeople_connection: emptyConnection,
			recommendedProducts_connection: emptyConnection,
		},
	};
}

function renderRoute(link: ApolloLink, readiness: PublicRouteReadinessContextValue) {
	Object.defineProperty(globalThis, "IntersectionObserver", {
		configurable: true,
		value: class { observe() {} unobserve() {} disconnect() {} },
	});
	const client = new ApolloClient({ cache: new InMemoryCache(), link, queryDeduplication: false });
	return render(
		<ApolloProvider client={client}>
			<PublicProfileBootstrapContext.Provider value={{
				status: "ready", bootstrapKey: "alice", refreshing: false, retrying: false,
				retry: vi.fn().mockResolvedValue(undefined),
				account: { documentId: "account-1", Account_Name: "Alice", public_recommendations: "Yes" },
			}}>
				<PublicRouteReadinessContext.Provider value={readiness}>
					<MemoryRouter initialEntries={["/alice/places/empty-places"]}>
						<Routes><Route path="/:username/places/:placeSlug" element={<PublicHome />} /></Routes>
					</MemoryRouter>
				</PublicRouteReadinessContext.Provider>
			</PublicProfileBootstrapContext.Provider>
		</ApolloProvider>,
	);
}

function readinessSpies(): PublicRouteReadinessContextValue {
	return {
		generation: "places-generation",
		readiness: { generation: "places-generation", status: "initial-loading" },
		markLoading: vi.fn(), markReady: vi.fn(), markRefreshing: vi.fn(), markEmpty: vi.fn(),
		markNotFound: vi.fn(), markError: vi.fn(),
	};
}

describe("PublicHome connection lifecycle with real Apollo", () => {
	it("does not settle the leaf before the initial places connection settles", async () => {
		let connectionObserver: { next: (value: FetchResult) => void; complete: () => void } | undefined;
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			if (operation.operationName === "PublicPlaceListBySlug") {
				queueMicrotask(() => { observer.next(parentResponse()); observer.complete(); });
			} else if (operation.operationName === "PublicRecommendedPlacesConnection") {
				connectionObserver = { next: (value) => observer.next(value), complete: () => observer.complete() };
			}
		}));
		const readiness = readinessSpies();
		renderRoute(link, readiness);

		await waitFor(() => expect(connectionObserver).toBeDefined());
		expect(readiness.markReady).not.toHaveBeenCalled();
		expect(readiness.markEmpty).not.toHaveBeenCalled();
		expect(readiness.markLoading).toHaveBeenCalled();

		act(() => {
			connectionObserver!.next({ data: { recommendedPlaces_connection: emptyConnection } });
			connectionObserver!.complete();
		});
		await screen.findAllByText("Empty Places");
		await waitFor(() => expect(readiness.markEmpty).toHaveBeenCalledWith("places-generation"));
	});

	it("reports the initial connection error with a retry that refetches the connection", async () => {
		let connectionAttempts = 0;
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			queueMicrotask(() => {
				if (operation.operationName === "PublicPlaceListBySlug") {
					observer.next(parentResponse()); observer.complete(); return;
				}
				connectionAttempts += 1;
				if (connectionAttempts === 1) { observer.error(new Error("places failed")); return; }
				observer.next({ data: { recommendedPlaces_connection: emptyConnection } }); observer.complete();
			});
		}));
		const readiness = readinessSpies();
		renderRoute(link, readiness);

		await waitFor(() => expect(readiness.markError).toHaveBeenCalled());
		const [, source, retry, hasUsableContent] = vi.mocked(readiness.markError).mock.calls.at(-1)!;
		expect(source).toBe("route");
		expect(hasUsableContent).toBe(false);
		await act(() => retry());
		await waitFor(() => expect(connectionAttempts).toBe(2));
	});
});
