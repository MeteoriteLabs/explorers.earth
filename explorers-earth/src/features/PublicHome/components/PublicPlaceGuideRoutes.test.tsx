import { render, screen } from "@testing-library/react";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryStates = vi.hoisted(() => new Map<string, { data?: any }>());

function operationName(query: DocumentNode): string {
	const operation = query.definitions.find(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === "OperationDefinition",
	);
	return operation?.name?.value ?? "anonymous";
}

vi.mock("@apollo/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@apollo/client")>()),
	useQuery: (query: DocumentNode) => ({
		data: queryStates.get(operationName(query))?.data,
		loading: false,
		error: undefined,
		refetch: vi.fn().mockResolvedValue(undefined),
	}),
}));
vi.mock("../../../layouts/PublicProfileBootstrapContext", () => ({
	usePublicProfileBootstrapAccount: () => ({ documentId: "account-1" }),
}));
vi.mock("../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../services/analyticsService", () => ({
	useTrackAnalytics: () => ({ trackClick: vi.fn(), trackEvent: vi.fn() }),
}));
vi.mock("../../../hooks/useQRActions", () => ({
	useQRActions: () => ({ handleCopyLink: vi.fn() }),
}));
vi.mock("@vis.gl/react-google-maps", () => ({
	AdvancedMarker: ({ children }: { children?: ReactNode }) => <>{children}</>,
	Map: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	Pin: () => null,
	useMap: () => null,
}));

import PublicGuideDetailPage from "./PublicGuideDetailPage";
import PublicHome from "./PublicHome";

const connection = {
	nodes: [],
	pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 },
};

function renderGuide() {
	return render(
		<MemoryRouter initialEntries={["/alice/guides/empty-guide"]}>
			<Routes>
				<Route path="/:username/guides/:guideSlug" element={<PublicGuideDetailPage />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

function renderPlace() {
	return render(
		<MemoryRouter initialEntries={["/alice/places/empty-places"]}>
			<Routes>
				<Route path="/:username/places/:placeSlug" element={<PublicHome />} />
				<Route path="/:username" element={<div>Profile fallback</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("public place and guide child routes", () => {
	beforeEach(() => {
		queryStates.clear();
		Object.defineProperty(globalThis, "IntersectionObserver", {
			configurable: true,
			value: class { observe() {} unobserve() {} disconnect() {} },
		});
	});

	it("keeps a published empty place list on its URL after its connection settles", async () => {
		queryStates.set("PublicPlaceListBySlug", {
			data: {
				recommendationLists: [{
					documentId: "place-list-1",
					List_Name: "Empty Places",
					slug: "empty-places",
					Visibility: true,
				}],
				recommendedPeople_connection: connection,
				recommendedProducts_connection: connection,
			},
		});
		queryStates.set("PublicRecommendedPlacesConnection", {
			data: { recommendedPlaces_connection: connection },
		});
		renderPlace();
		expect(await screen.findAllByText("Empty Places")).not.toHaveLength(0);
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing place list", async () => {
		queryStates.set("PublicPlaceListBySlug", {
			data: {
				recommendationLists: [],
				recommendedPeople_connection: connection,
				recommendedProducts_connection: connection,
			},
		});
		renderPlace();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});

	it("keeps a published guide with no sections on its URL", () => {
		queryStates.set("GetPublicGuideBySlug", {
			data: {
				guides: [{
					documentId: "guide-1",
					Title: "Empty Guide",
					slug: "empty-guide",
					Visibility: true,
					Guide_Media: [],
					guide_sections: [],
				}],
			},
		});
		renderGuide();
		expect(screen.getByRole("heading", { name: "Empty Guide" })).toBeInTheDocument();
		expect(screen.queryByText("Profile fallback")).toBeNull();
	});

	it("redirects a settled missing guide", async () => {
		queryStates.set("GetPublicGuideBySlug", { data: { guides: [] } });
		renderGuide();
		expect(await screen.findByText("Profile fallback")).toBeInTheDocument();
	});
});
