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

import PublicAppList from "./PublicAppList";

const connection = { nodes: [], pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 } };

function renderList() {
	return render(
		<MemoryRouter initialEntries={["/alice/apps/useful-apps"]}>
			<Routes>
				<Route path="/:username/apps/:listSlug" element={<PublicAppList />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicAppList", () => {
	beforeEach(() => { queryState.data = undefined; });

	it("keeps a published empty list on its URL", () => {
		queryState.data = {
			appLists: [{ documentId: "list-1", List_Name: "Useful Apps", slug: "useful-apps" }],
			recommendedApps_connection: connection,
		};
		renderList();
		expect(screen.getByRole("heading", { name: "Useful Apps" })).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing list", async () => {
		queryState.data = { appLists: [], recommendedApps_connection: connection };
		renderList();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});
});
