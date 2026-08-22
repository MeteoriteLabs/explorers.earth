import { describe, expect, it } from "vitest";

const resourceModules = import.meta.glob(
	"../../i18n/resources/*.json",
	{ eager: true, import: "default" },
);

type PaginationMessages = {
	loadMore: string;
	loadingMore: string;
	retryLoadingMore: string;
	paginationLabels: {
		guideDays: string;
	};
};

type LocaleResource = {
	common: PaginationMessages;
	sections: { productCategories: { categories: Array<{ label: string }> } };
};

const localeFromPath = (path: string) => path.match(/\/([^/]+)\.json$/)?.[1] ?? path;
const placeholders = (value: string) => [...value.matchAll(/{{([^}]+)}}/g)].map((match) => match[1]).sort();

describe("public pagination translations", () => {
	it("ships localized phrases and category nouns in every non-English resource", () => {
		const resources = Object.fromEntries(
			Object.entries(resourceModules).map(([path, resource]) => [localeFromPath(path), resource as LocaleResource]),
		);
		const english = resources.en;
		expect(Object.keys(resources)).toHaveLength(47);

		for (const [locale, resource] of Object.entries(resources)) {
			if (locale === "en") continue;
			for (const key of ["loadMore", "loadingMore", "retryLoadingMore"] as const) {
				expect(resource.common[key], `${locale}.${key} must be localized`).not.toBe(english.common[key]);
				expect(placeholders(resource.common[key]), `${locale}.${key} placeholders`).toEqual(placeholders(english.common[key]));
			}
			expect(
				resource.common.paginationLabels.guideDays,
				`${locale}.paginationLabels.guideDays must be localized`,
			).not.toBe(english.common.paginationLabels.guideDays);
			for (const index of [0, 1, 2, 3, 4, 6, 7]) {
				expect(
					resource.sections.productCategories.categories[index]?.label,
					`${locale}.category.${index} must be localized`,
				).not.toBe(english.sections.productCategories.categories[index]?.label);
			}
		}
	});
});
