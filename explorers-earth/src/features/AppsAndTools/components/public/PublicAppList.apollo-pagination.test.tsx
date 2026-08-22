import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
	ApolloClient,
	ApolloLink,
	ApolloProvider,
	InMemoryCache,
	Observable,
	type FetchResult,
	type Operation,
} from "@apollo/client";
import type { ReactNode } from "react";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../layouts/PublicProfileBootstrapContext", () => ({
	usePublicProfileBootstrapAccount: () => ({ documentId: "account-1", Account_Name: "Alice" }),
}));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("./AppDetailModal", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, { label }: { label?: string } = {}) => ({
			"common.loadMore": `Load more ${label}`,
			"common.loadingMore": `Loading more ${label}`,
			"common.retryLoadingMore": `Retry loading more ${label}`,
		}[key] ?? key),
	}),
}));

import PublicAppList from "./PublicAppList";
import { PublicRouteReadinessContext } from "../../../../layouts/PublicRouteReadinessContext";

type Deferred = {
	next: (result: FetchResult) => void;
	complete: () => void;
};

function app(documentId: string, title: string) {
	return {
		__typename: "RecommendedApp", documentId, title,
		app_url: null, logo_url: null, description: null, developer: null,
		platforms: null, price_tier: null, download_url: null, screenshots: null,
		user_recommendation_note: null, user_rating: null, is_pinned: false,
		pin_order: null, app_category: null,
	};
}

function response(slug: string, nodes: ReturnType<typeof app>[], page: number, pageCount: number, total: number) {
	return {
		data: {
			appLists: [{
				__typename: "AppList", documentId: `list-${slug}`, List_Name: `${slug} list`, slug,
				list_description: null, cover_image: null, top_apps_heading: null,
				account: { __typename: "Account", documentId: "account-1", username: "alice" },
			}],
			recommendedApps_connection: {
				__typename: "RecommendedAppConnection",
				nodes,
				pageInfo: { __typename: "Pagination", page, pageSize: 200, pageCount, total },
			},
		},
	};
}

function renderWithLink(link: ApolloLink, initialEntry = "/alice/apps/old") {
	const client = new ApolloClient({
		cache: new InMemoryCache(),
		link,
		queryDeduplication: false,
	});
	const router = createMemoryRouter([{ element: <GenerationLayout />, children: [
		{ path: "/:username/apps/:listSlug", element: <PublicAppList /> },
		{ path: "/:username/products/:listSlug", element: <div>Current products leaf</div> },
		{ path: "/:username", element: <div>Profile fallback</div> },
	] }], { initialEntries: [initialEntry] });
	const view = render(<ApolloProvider client={client}><RouterProvider router={router} /></ApolloProvider>);
	return { ...view, router };
}

function GenerationLayout() {
	const location = useLocation();
	const generation = location.pathname;
	return (
		<PublicRouteReadinessContext.Provider value={{
			generation,
			readiness: { generation, status: "ready" },
			markLoading: () => {}, markReady: () => {}, markRefreshing: () => {},
			markEmpty: () => {}, markNotFound: () => {}, markError: () => {},
		}}>
			<Outlet />
		</PublicRouteReadinessContext.Provider>
	);
}

describe("PublicAppList real Apollo pagination", () => {
	it("keeps 200 items through a later-page failure, then appends the 201st once on local retry", async () => {
		let pageTwoAttempts = 0;
		const firstPage = Array.from({ length: 200 }, (_, index) => app(`app-${index + 1}`, `App ${index + 1}`));
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			const page = (operation.variables.pagination as { page: number }).page;
			queueMicrotask(() => {
				if (page === 1) {
					observer.next(response("old", firstPage, 1, 2, 201));
					observer.complete();
					return;
				}
				pageTwoAttempts += 1;
				if (pageTwoAttempts === 1) {
					observer.error(new Error("later page failed"));
					return;
				}
				observer.next(response("old", [app("app-200", "App 200"), app("app-201", "App 201")], 2, 2, 201));
				observer.complete();
			});
		}));

		renderWithLink(link);
		await screen.findByText("App 200");
		fireEvent.click(screen.getByRole("button", { name: /load more apps/i }));
		await screen.findByRole("button", { name: /retry loading more apps/i });
		expect(screen.getByText("App 1")).toBeVisible();
		expect(screen.queryByText("App 201")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: /retry loading more apps/i }));
		await screen.findByText("App 201");
		expect(screen.getAllByText("App 200")).toHaveLength(1);
		expect(screen.getAllByText(/^App \d+$/)).toHaveLength(201);
	}, 10_000);

	it("does not merge an old slug's deferred page into the new slug view", async () => {
		let oldPageTwo: Deferred | undefined;
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			const page = (operation.variables.pagination as { page: number }).page;
			const slug = operation.variables.slug as string;
			if (slug === "old" && page === 2) {
				oldPageTwo = {
					next: (result) => observer.next(result),
					complete: () => observer.complete(),
				};
				return;
			}
			queueMicrotask(() => {
				observer.next(response(slug, [app(`${slug}-app`, `${slug} app`)], 1, slug === "old" ? 2 : 1, slug === "old" ? 2 : 1));
				observer.complete();
			});
		}));
		const { router } = renderWithLink(link);

		await screen.findByText("old app");
		fireEvent.click(screen.getByRole("button", { name: /load more apps/i }));
		await waitFor(() => expect(oldPageTwo).toBeDefined());
		await act(async () => {
			await router.navigate("/alice/apps/new");
		});
		await screen.findByText("new app");

		act(() => {
			oldPageTwo!.next(response("old", [app("old-late", "old late app")], 2, 2, 2));
			oldPageTwo!.complete();
		});
		await waitFor(() => expect(screen.getByText("new app")).toBeVisible());
		expect(screen.queryByText("old late app")).toBeNull();
		expect(router.state.location.pathname).toBe("/alice/apps/new");
	});

	it("cannot redirect or replace a new slug when the old slug's missing lookup settles", async () => {
		let oldLookup: Deferred | undefined;
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			const slug = operation.variables.slug as string;
			if (slug === "old") {
				oldLookup = {
					next: (result) => observer.next(result),
					complete: () => observer.complete(),
				};
				return;
			}
			queueMicrotask(() => {
				observer.next(response("new", [app("new-app", "new app")], 1, 1, 1));
				observer.complete();
			});
		}));
		const { router } = renderWithLink(link);
		await waitFor(() => expect(oldLookup).toBeDefined());

		await act(async () => {
			await router.navigate("/alice/apps/new");
		});
		expect(await screen.findByText("new app")).toBeVisible();
		act(() => {
			oldLookup!.next({ data: {
				appLists: [],
				recommendedApps_connection: {
					nodes: [],
					pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 },
				},
			} });
			oldLookup!.complete();
		});

		await waitFor(() => expect(router.state.location.pathname).toBe("/alice/apps/new"));
		expect(screen.getByText("new app")).toBeVisible();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("cannot redirect a new cross-family route when an old App missing lookup settles", async () => {
		let oldLookup: Deferred | undefined;
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			if (operation.variables.slug === "old") {
				oldLookup = {
					next: (result) => observer.next(result),
					complete: () => observer.complete(),
				};
			}
		}));
		const { router } = renderWithLink(link);
		await waitFor(() => expect(oldLookup).toBeDefined());

		await act(async () => {
			await router.navigate("/alice/products/current");
		});
		expect(await screen.findByText("Current products leaf")).toBeVisible();
		act(() => {
			oldLookup!.next({ data: {
				appLists: [],
				recommendedApps_connection: {
					nodes: [],
					pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 },
				},
			} });
			oldLookup!.complete();
		});

		await waitFor(() => expect(router.state.location.pathname).toBe("/alice/products/current"));
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});
});
