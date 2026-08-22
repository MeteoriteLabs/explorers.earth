import { render, screen } from "@testing-library/react";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
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

import PublicGuideDetailPage from "./PublicGuideDetailPage";

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

describe("public place and guide child routes", () => {
	beforeEach(() => { queryStates.clear(); });

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
