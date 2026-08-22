import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function renderRoute(
	link: ApolloLink,
	readiness: PublicRouteReadinessContextValue,
	entry = "/alice/places/empty-places",
) {
	Object.defineProperty(globalThis, "IntersectionObserver", {
		configurable: true,
		value: class { observe() {} unobserve() {} disconnect() {} },
	});
	const client = new ApolloClient({ cache: new InMemoryCache(), link, queryDeduplication: false });
	const view = render(
		<ApolloProvider client={client}>
			<PublicProfileBootstrapContext.Provider value={{
				status: "ready", bootstrapKey: "alice", refreshing: false, retrying: false,
				retry: vi.fn().mockResolvedValue(undefined),
				account: { documentId: "account-1", Account_Name: "Alice", public_recommendations: "Yes" },
			}}>
				<PublicRouteReadinessContext.Provider value={readiness}>
					<MemoryRouter initialEntries={[entry]}>
						<Routes>
							<Route path="/:username/places" element={<PublicHome />} />
							<Route path="/:username/places/:placeSlug" element={<PublicHome />} />
						</Routes>
					</MemoryRouter>
				</PublicRouteReadinessContext.Provider>
			</PublicProfileBootstrapContext.Provider>
		</ApolloProvider>,
	);
	return { ...view, client };
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
	it("keeps account ownership and publication filters on a later Place page", async () => {
		let laterPageVariables: Record<string, unknown> | undefined;
		const place = {
			__typename: "RecommendedPlace", documentId: "place-1",
			Place_Details: { Title: "First Place", Photos: [] }, media_details: null,
			Recommendation_Type: "place", Contact_Name: null, Media: [], recommendation_category: null,
			recommendation_list: { __typename: "RecommendationList", documentId: "place-list-1" },
			user_rating: null, google_rating: null,
		};
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			queueMicrotask(() => {
				if (operation.operationName === "PublicPlaceListBySlug") {
					observer.next(parentResponse()); observer.complete(); return;
				}
				const page = (operation.variables.pagination as { page: number }).page;
				if (page === 2) laterPageVariables = operation.variables;
				observer.next({ data: { recommendedPlaces_connection: {
					__typename: "Connection",
					nodes: page === 1 ? [place] : [{ ...place, documentId: "place-2", Place_Details: { Title: "Second Place", Photos: [] } }],
					pageInfo: { __typename: "Pagination", page, pageSize: 200, pageCount: 2, total: 2 },
				} } });
				observer.complete();
			});
		}));
		renderRoute(link, readinessSpies());
		await screen.findByText("First Place");
		fireEvent.click(screen.getByRole("button", { name: "common.loadMore" }));
		await screen.findByText("Second Place");

		expect(laterPageVariables).toEqual({
			pagination: { page: 2, pageSize: 200 },
			filters: {
				recommendation_list: {
					documentId: { eq: "place-list-1" },
					account: { documentId: { eq: "account-1" } },
					Visibility: { eq: true },
				},
			},
		});
	});

	it("waits for the selected root collection's secure linked connections before settling", async () => {
		let linkedObserver: { next: (value: FetchResult) => void; complete: () => void } | undefined;
		let linkedVariables: Record<string, unknown> | undefined;
		let placesVariables: Record<string, unknown> | undefined;
		const rootPlace = {
			__typename: "RecommendedPlace",
			documentId: "root-place-1",
			Place_Details: { Title: "Root Place", Photos: [] },
			media_details: null,
			Recommendation_Type: "place",
			Contact_Name: null,
			Media: [],
			recommendation_category: null,
		};
		const rootList = {
			__typename: "RecommendationList",
			documentId: "place-list-root",
			List_Name: "Root Places",
			slug: "root-places",
			Visibility: true,
			is_pinned: false,
			pin_order: null,
			display_order: 1,
			List_Name_Details: null,
			recommended_places: [rootPlace],
			person_lists: [],
			product_lists: [],
		};
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			if (operation.operationName === "PublicPlacesLists") {
				queueMicrotask(() => { observer.next({ data: { recommendationLists: [rootList] } }); observer.complete(); });
				return;
			}
			if (operation.operationName === "PublicRecommendedPlacesConnection") {
				placesVariables = operation.variables;
				queueMicrotask(() => {
					observer.next({ data: { recommendedPlaces_connection: {
						...emptyConnection,
						nodes: [rootPlace],
						pageInfo: { ...pageInfo, total: 1 },
					} } });
					observer.complete();
				});
				return;
			}
			if (operation.operationName === "PublicPlaceListBySlug") {
				linkedVariables = operation.variables;
				linkedObserver = { next: (value) => observer.next(value), complete: () => observer.complete() };
			}
		}));
		const readiness = readinessSpies();
		renderRoute(link, readiness, "/alice/places");

		await waitFor(() => expect(linkedObserver).toBeDefined());
		expect(linkedVariables).toEqual({
			accountDocumentId: "account-1",
			slug: "root-places",
			documentId: "place-list-root",
			peoplePagination: { page: 1, pageSize: 200 },
			productPagination: { page: 1, pageSize: 200 },
		});
		expect(placesVariables).toEqual({
			pagination: { page: 1, pageSize: 200 },
			filters: {
				recommendation_list: {
					documentId: { eq: "place-list-root" },
					account: { documentId: { eq: "account-1" } },
					Visibility: { eq: true },
				},
			},
		});
		expect(readiness.markReady).not.toHaveBeenCalled();
		expect(readiness.markEmpty).not.toHaveBeenCalled();
		expect(readiness.markLoading).toHaveBeenCalledWith("places-generation");

		act(() => {
			linkedObserver!.next(parentResponse());
			linkedObserver!.complete();
		});
		expect(await screen.findByText("Root Place")).toBeVisible();
		await waitFor(() => expect(readiness.markReady).toHaveBeenCalledWith("places-generation"));
	});

	it("surfaces a selected root collection's initial linked error and retries that query", async () => {
		let linkedAttempts = 0;
		const rootList = {
			__typename: "RecommendationList", documentId: "place-list-root", List_Name: "Root Places",
			slug: "root-places", Visibility: true, is_pinned: false, pin_order: null,
			display_order: 1, List_Name_Details: null, recommended_places: [], person_lists: [], product_lists: [],
		};
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			queueMicrotask(() => {
				if (operation.operationName === "PublicPlacesLists") {
					observer.next({ data: { recommendationLists: [rootList] } }); observer.complete(); return;
				}
				if (operation.operationName === "PublicRecommendedPlacesConnection") {
					observer.next({ data: { recommendedPlaces_connection: emptyConnection } }); observer.complete(); return;
				}
				linkedAttempts += 1;
				if (linkedAttempts === 1) { observer.error(new Error("linked root failed")); return; }
				observer.next(parentResponse()); observer.complete();
			});
		}));
		const readiness = readinessSpies();
		renderRoute(link, readiness, "/alice/places");

		await waitFor(() => expect(readiness.markError).toHaveBeenCalled());
		const [, source, retry, hasUsableContent] = vi.mocked(readiness.markError).mock.calls.at(-1)!;
		expect(source).toBe("route");
		expect(hasUsableContent).toBe(false);
		await act(() => retry());
		await waitFor(() => expect(linkedAttempts).toBe(2));
	});

	it("retains selected root content through a linked refresh and refresh failure", async () => {
		let linkedAttempts = 0;
		let refreshObserver: { error: (error: Error) => void } | undefined;
		const rootPlace = {
			__typename: "RecommendedPlace", documentId: "root-place-1",
			Place_Details: { Title: "Root Place", Photos: [] }, media_details: null,
			Recommendation_Type: "place", Contact_Name: null, Media: [], recommendation_category: null,
		};
		const rootList = {
			__typename: "RecommendationList", documentId: "place-list-root", List_Name: "Root Places",
			slug: "root-places", Visibility: true, is_pinned: false, pin_order: null,
			display_order: 1, List_Name_Details: null, recommended_places: [rootPlace], person_lists: [], product_lists: [],
		};
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			if (operation.operationName === "PublicPlaceListBySlug") {
				linkedAttempts += 1;
				if (linkedAttempts > 1) {
					refreshObserver = { error: (error) => observer.error(error) };
					return;
				}
			}
			queueMicrotask(() => {
				if (operation.operationName === "PublicPlacesLists") {
					observer.next({ data: { recommendationLists: [rootList] } });
				} else if (operation.operationName === "PublicRecommendedPlacesConnection") {
					observer.next({ data: { recommendedPlaces_connection: { ...emptyConnection, nodes: [rootPlace] } } });
				} else {
					observer.next(parentResponse());
				}
				observer.complete();
			});
		}));
		const readiness = readinessSpies();
		const { client } = renderRoute(link, readiness, "/alice/places");
		await screen.findByText("Root Place");
		await waitFor(() => expect(readiness.markReady).toHaveBeenCalled());

		void client.refetchQueries({ include: ["PublicPlaceListBySlug"] });
		await waitFor(() => expect(refreshObserver).toBeDefined());
		await waitFor(() => expect(readiness.markRefreshing).toHaveBeenCalledWith("places-generation"));
		expect(screen.getByText("Root Place")).toBeVisible();

		act(() => refreshObserver!.error(new Error("linked refresh failed")));
		await waitFor(() => expect(readiness.markError).toHaveBeenCalledWith(
			"places-generation", "route", expect.any(Function), true,
		));
		expect(screen.getByText("Root Place")).toBeVisible();
	});

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
