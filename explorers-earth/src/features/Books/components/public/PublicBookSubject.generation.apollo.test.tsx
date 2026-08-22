import { act, render, screen, waitFor } from "@testing-library/react";
import {
	ApolloClient,
	ApolloLink,
	ApolloProvider,
	InMemoryCache,
	Observable,
	type FetchResult,
	type Operation,
} from "@apollo/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../components/PublicNav", () => ({ default: () => <nav>Public nav</nav> }));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../../components/EarthLoader", () => ({ EarthLoader: () => <div>Loading profile</div> }));
vi.mock("./BookCoverCard", () => ({ default: () => null }));
vi.mock("./BookDetailModal", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string | { defaultValue?: string }) =>
			typeof fallback === "string" ? fallback : fallback?.defaultValue ?? _key,
	}),
}));

import PublicLayout from "../../../../layouts/PublicLayout";
import PublicBookSubject from "./PublicBookSubject";

type Deferred = {
	next: (result: FetchResult) => void;
	complete: () => void;
};

const emptyPage = {
	__typename: "Pagination",
	page: 1,
	pageSize: 200,
	pageCount: 1,
	total: 0,
};

function bootstrapResponse() {
	return {
		data: {
			accounts: [{
				__typename: "Account",
				documentId: "account-1",
				Account_Name: "Alice",
				Account_Type: "Personal",
				Primary_Address: null,
				bg_picture: null,
				profile_picture: null,
				social_media: null,
				localtunes_public: false,
				public_profile: "Yes",
				public_recommendations: "No",
				public_music: "No",
				public_movie: "No",
				public_books: "Yes",
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
}

describe("PublicBookSubject route execution generation", () => {
	it("ignores an old same-path lookup and lets the new location-key execution settle", async () => {
		const subjectExecutions: Deferred[] = [];
		const link = new ApolloLink((operation: Operation) => new Observable((observer) => {
			if (operation.operationName === "PublicProfileBootstrap") {
				queueMicrotask(() => {
					observer.next(bootstrapResponse());
					observer.complete();
				});
				return;
			}
			if (operation.operationName === "BooksBySubject") {
				subjectExecutions.push({
					next: (result) => observer.next(result),
					complete: () => observer.complete(),
				});
				return;
			}
			throw new Error(`Unexpected operation ${operation.operationName}`);
		}));
		const client = new ApolloClient({ cache: new InMemoryCache(), link });
		const router = createMemoryRouter([{
			path: "/:username",
			element: <PublicLayout />,
			children: [
				{ path: "books/subject/:subjectSlug", element: <PublicBookSubject /> },
				{ index: true, element: <div>Profile fallback</div> },
			],
		}], { initialEntries: ["/alice/books/subject/subject-1"] });

		render(
			<ApolloProvider client={client}>
				<RouterProvider router={router} />
			</ApolloProvider>,
		);

		await waitFor(() => expect(subjectExecutions).toHaveLength(1));
		const firstLocationKey = router.state.location.key;
		await act(async () => {
			await router.navigate("/alice/books/subject/subject-1");
		});
		expect(router.state.location.key).not.toBe(firstLocationKey);
		await waitFor(() => expect(subjectExecutions).toHaveLength(2));

		act(() => {
			subjectExecutions[0]!.next({ data: {
				bookCategories: [],
				recommendedBooks_connection: { __typename: "BookConnection", nodes: [], pageInfo: emptyPage },
			} });
			subjectExecutions[0]!.complete();
		});
		expect(router.state.location.pathname).toBe("/alice/books/subject/subject-1");
		expect(screen.queryByText("Profile fallback")).toBeNull();

		act(() => {
			subjectExecutions[1]!.next({ data: {
				bookCategories: [{ __typename: "BookCategory", documentId: "subject-1", subject_name: "Science" }],
				recommendedBooks_connection: { __typename: "BookConnection", nodes: [], pageInfo: emptyPage },
			} });
			subjectExecutions[1]!.complete();
		});

		expect(await screen.findByRole("heading", { name: "Science" })).toBeVisible();
		expect(router.state.location.pathname).toBe("/alice/books/subject/subject-1");
	});
});
