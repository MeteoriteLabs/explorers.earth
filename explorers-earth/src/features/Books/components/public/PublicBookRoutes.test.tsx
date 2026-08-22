import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));
const analyticsHarness = vi.hoisted(() => {
	const trackClick = vi.fn();
	const useTrackAnalytics = vi.fn(() => ({ trackClick }));
	const books = vi.fn((accountId, pageUsername, locationId, recommendationId, route) => ({ accountId, pageUsername, locationId, recommendationId, routeVariant: route?.variant, routePath: route?.path }));
	return { books, trackClick, useTrackAnalytics };
});

vi.mock("@apollo/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@apollo/client")>()),
	useQuery: () => ({ data: queryState.data, loading: false, error: undefined, refetch: vi.fn().mockResolvedValue(undefined), fetchMore: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../../../../layouts/PublicProfileBootstrapContext", () => ({ usePublicProfileBootstrapAccount: () => ({ documentId: "account-1" }) }));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../../services/analyticsService", () => ({ createAnalyticsOptions: { books: analyticsHarness.books }, useTrackAnalytics: analyticsHarness.useTrackAnalytics }));
vi.mock("./BookCoverCard", () => ({ default: ({ book, onClick }: any) => <button type="button" onClick={() => onClick(book)}>{book.title}</button> }));
vi.mock("./BookDetailModal", () => ({ default: ({ book, onShare }: any) => book ? <button type="button" onClick={() => onShare?.(book.documentId)}>Share {book.title} detail</button> : null }));

import PublicBookSubject from "./PublicBookSubject";
import PublicBookList from "./PublicBookList";

const connection = { nodes: [], pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 } };

function renderSubject() {
	return render(
		<MemoryRouter initialEntries={["/alice/books/subject/subject-1"]}>
			<Routes>
				<Route path="/:username/books/subject/:subjectSlug" element={<PublicBookSubject />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

function renderList() {
	return render(
		<MemoryRouter initialEntries={["/alice/books/favorites"]}>
			<Routes>
				<Route path="/:username/books/:listSlug" element={<PublicBookList />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicBookSubject", () => {
	beforeEach(() => {
		queryState.data = undefined;
		analyticsHarness.books.mockClear();
		analyticsHarness.trackClick.mockClear();
		analyticsHarness.useTrackAnalytics.mockClear();
		Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
	});

	it("keeps a published empty subject on its URL", () => {
		queryState.data = {
			bookCategories: [{ documentId: "subject-1", subject_name: "Science" }],
			recommendedBooks_connection: connection,
		};
		renderSubject();
		expect(screen.getByRole("heading", { name: "Science" })).toBeInTheDocument();
		expect(screen.getByText("No books found for this subject.")).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing subject", async () => {
		queryState.data = { bookCategories: [], recommendedBooks_connection: connection };
		renderSubject();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("keeps a published empty book list on its URL", () => {
		queryState.data = {
			bookLists: [{ documentId: "book-list-1", List_Name: "Favorites", slug: "favorites" }],
			recommendedBooks_connection: connection,
		};
		renderList();
		expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing book list", async () => {
		queryState.data = { bookLists: [], recommendedBooks_connection: connection };
		renderList();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("tracks list views, stable book cards, and share with document IDs", async () => {
		queryState.data = {
			bookLists: [{ documentId: "book-list-1", List_Name: "Favorites", slug: "favorites" }],
			recommendedBooks_connection: { ...connection, nodes: [{ documentId: "book-doc-1", title: "Kindred", is_pinned: false }] },
		};
		renderList();

		expect(analyticsHarness.books).toHaveBeenCalledWith("account-1", "alice", "book-list-1", undefined, { variant: "list", path: "/alice/books/favorites" });
		fireEvent.click(screen.getByRole("button", { name: "Kindred" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("book-card", expect.objectContaining({ id: "book-doc-1", listId: "book-list-1" }));
		fireEvent.click(screen.getByRole("button", { name: "Share Kindred detail" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", { context: "books-list-detail", id: "book-doc-1" });
		fireEvent.click(screen.getByRole("button", { name: "Share" }));
		await waitFor(() => expect(analyticsHarness.trackClick).toHaveBeenCalledWith("share-button", expect.objectContaining({ context: "books-list" })));
	});

	it("tracks subject views and cards with the stable taxonomy document ID", () => {
		queryState.data = {
			bookCategories: [{ documentId: "subject-1", subject_name: "Science" }],
			recommendedBooks_connection: { ...connection, nodes: [{ documentId: "book-doc-2", title: "Cosmos", is_pinned: false }] },
		};
		renderSubject();

		expect(analyticsHarness.books).toHaveBeenCalledWith("account-1", "alice", "subject-1", undefined, { variant: "filter", path: "/alice/books/subject/subject-1" });
		fireEvent.click(screen.getByRole("button", { name: "Cosmos" }));
		expect(analyticsHarness.trackClick).toHaveBeenCalledWith("book-card", expect.objectContaining({ id: "book-doc-2", filterId: "subject-1" }));
	});
});
