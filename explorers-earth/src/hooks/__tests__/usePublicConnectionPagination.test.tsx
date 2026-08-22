import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	mergePublicConnectionPage,
	usePublicConnectionPagination,
} from "../usePublicConnectionPagination";

describe("mergePublicConnectionPage", () => {
	it("appends a later page once, preserving first-seen order", () => {
		const merged = mergePublicConnectionPage(
			{
				nodes: [{ documentId: "one" }, { documentId: "two" }],
				pageInfo: { page: 1, pageSize: 2, pageCount: 2, total: 3 },
			},
			{
				nodes: [{ documentId: "two" }, { documentId: "three" }],
				pageInfo: { page: 2, pageSize: 2, pageCount: 2, total: 3 },
			},
		);

		expect(merged.nodes.map(({ documentId }) => documentId)).toEqual([
			"one",
			"two",
			"three",
		]);
		expect(merged.pageInfo.page).toBe(2);
	});

	it("keeps the 201st published item reachable", () => {
		const firstTwoHundred = Array.from({ length: 200 }, (_, index) => ({
			documentId: `item-${index + 1}`,
		}));
		const merged = mergePublicConnectionPage(
			{
				nodes: firstTwoHundred,
				pageInfo: { page: 1, pageSize: 200, pageCount: 2, total: 201 },
			},
			{
				nodes: [{ documentId: "item-201" }],
				pageInfo: { page: 2, pageSize: 200, pageCount: 2, total: 201 },
			},
		);

		expect(merged.nodes).toHaveLength(201);
		expect(merged.nodes.at(200)?.documentId).toBe("item-201");
	});
});

describe("usePublicConnectionPagination", () => {
	it("retains the current page and retries a failed later page locally", async () => {
		const loadPage = vi
			.fn<(page: number) => Promise<void>>()
			.mockRejectedValueOnce(new Error("page failed"))
			.mockResolvedValueOnce();
		const { result } = renderHook(() =>
			usePublicConnectionPagination({
				pageInfo: { page: 1, pageSize: 200, pageCount: 2, total: 201 },
				loadPage,
				resetKey: "account:list",
			}),
		);

		await act(() => result.current.loadNextPage());
		expect(result.current.nextPageError).toBeInstanceOf(Error);
		expect(result.current.hasNextPage).toBe(true);

		await act(() => result.current.retryNextPage());
		expect(loadPage).toHaveBeenNthCalledWith(1, 2);
		expect(loadPage).toHaveBeenNthCalledWith(2, 2);
		expect(result.current.nextPageError).toBeUndefined();
	});
});
