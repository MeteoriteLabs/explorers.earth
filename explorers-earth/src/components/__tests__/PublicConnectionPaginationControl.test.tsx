import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, { label }: { label?: string } = {}) => ({
			"sections.productCategories.categories.7.label": "Applications et outils",
			"common.loadMore": `Charger plus de ${label}`,
			"common.loadingMore": `Chargement de plus de ${label}…`,
			"common.retryLoadingMore": `Réessayer de charger plus de ${label}`,
		}[key] ?? key),
	}),
}));

import { PublicConnectionPaginationControl } from "../PublicConnectionPaginationControl";

const baseProps = {
	hasNextPage: true,
	error: undefined,
	onLoadMore: vi.fn(),
	onRetry: vi.fn(),
	labelKey: "sections.productCategories.categories.7.label",
};

describe("PublicConnectionPaginationControl", () => {
	it("uses one visible localized loading label plus a sibling polite live region", () => {
		const { container } = render(
			<PublicConnectionPaginationControl {...baseProps} isLoading />,
		);

		const button = screen.getByRole("button", { name: "Chargement de plus de Applications et outils…" });
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute("aria-busy", "true");
		expect(button).toHaveClass("min-h-11");
		expect(button.textContent).toBe("Chargement de plus de Applications et outils…");

		const status = screen.getByRole("status");
		expect(status).toHaveAttribute("aria-live", "polite");
		expect(status).toHaveClass("sr-only");
		expect(button.contains(status)).toBe(false);
		expect(button.nextElementSibling).toBe(status);
		expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
	});

	it("keeps the localized retry action at least 44px high without a duplicate aria-label", () => {
		render(
			<PublicConnectionPaginationControl {...baseProps} isLoading={false} error={new Error("later page")} />,
		);

		const retry = screen.getByRole("button", { name: "Réessayer de charger plus de Applications et outils" });
		expect(retry).toHaveClass("min-h-11");
		expect(retry).not.toHaveAttribute("aria-label");
	});
});
