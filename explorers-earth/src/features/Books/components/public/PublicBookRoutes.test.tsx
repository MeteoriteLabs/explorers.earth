import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));

vi.mock("@apollo/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@apollo/client")>()),
	useQuery: () => ({ data: queryState.data, loading: false, error: undefined, refetch: vi.fn().mockResolvedValue(undefined), fetchMore: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../../../../layouts/PublicProfileBootstrapContext", () => ({ usePublicProfileBootstrapAccount: () => ({ documentId: "account-1" }) }));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));

import PublicBookSubject from "./PublicBookSubject";
import PublicBookList from "./PublicBookList";

const connection = { nodes: [], pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 } };

function renderSubject() {
	return render(
		<MemoryRouter initialEntries={["/alice/books/subject/science"]}>
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
	beforeEach(() => { queryState.data = undefined; });

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
});
