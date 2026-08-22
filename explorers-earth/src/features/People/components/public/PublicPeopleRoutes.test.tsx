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

import PublicPersonSector from "./PublicPersonSector";

const connection = { nodes: [], pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 } };

function renderSector() {
	return render(
		<MemoryRouter initialEntries={["/alice/people/sector/creators"]}>
			<Routes>
				<Route path="/:username/people/sector/:sectorSlug" element={<PublicPersonSector />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PublicPersonSector", () => {
	beforeEach(() => { queryState.data = undefined; });

	it("keeps a published empty sector on its URL", () => {
		queryState.data = {
			peopleCategories: [{ documentId: "sector-1", Category_name: "Creators" }],
			recommendedPeople_connection: connection,
		};
		renderSector();
		expect(screen.getByRole("heading", { name: "Creators" })).toBeInTheDocument();
		expect(screen.getByText("No people recommended in this sector.")).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing sector", async () => {
		queryState.data = { peopleCategories: [], recommendedPeople_connection: connection };
		renderSector();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});
});
