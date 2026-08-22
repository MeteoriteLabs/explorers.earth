import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ data: undefined as any }));

vi.mock("@apollo/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@apollo/client")>()),
	useQuery: () => ({ data: queryState.data, loading: false, error: undefined, refetch: vi.fn().mockResolvedValue(undefined), fetchMore: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../../../../layouts/PublicProfileBootstrapContext", () => ({
	usePublicProfileBootstrapAccount: () => ({ documentId: "account-1", Account_Name: "Alice" }),
}));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));

import PublicProductList from "./PublicProductList";

const connection = { nodes: [], pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 } };

function renderList() {
	return render(
		<MemoryRouter initialEntries={["/alice/products/useful-products"]}>
			<Routes>
				<Route path="/:username/products/:listSlug" element={<PublicProductList />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicProductList", () => {
	beforeEach(() => { queryState.data = undefined; });

	it("keeps a published empty list on its URL", () => {
		queryState.data = {
			productLists: [{ documentId: "list-1", List_Name: "Useful Products", slug: "useful-products" }],
			recommendedProducts_connection: connection,
		};
		renderList();
		expect(screen.getByRole("heading", { name: "Useful Products" })).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing list", async () => {
		queryState.data = { productLists: [], recommendedProducts_connection: connection };
		renderList();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});
});
