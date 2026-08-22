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
		expect(loadPage).toHaveBeenNthCalledWith(1, 2, expect.any(Object));
		expect(loadPage).toHaveBeenNthCalledWith(2, 2, expect.any(Object));
		expect(result.current.nextPageError).toBeUndefined();
	});

	it("invalidates an old-key page request before its Apollo merge callback runs", async () => {
		let request:
			| { resetKey: string; isCurrent: () => boolean }
			| undefined;
		let release!: () => void;
		const pending = new Promise<void>((resolve) => {
			release = resolve;
		});
		const loadPage = vi.fn(async (_page: number, nextRequest: NonNullable<typeof request>) => {
			request = nextRequest;
			await pending;
		});
		const { result, rerender } = renderHook(
			({ resetKey }) =>
				usePublicConnectionPagination({
					pageInfo: { page: 1, pageSize: 200, pageCount: 2, total: 201 },
					loadPage,
					resetKey,
				}),
			{ initialProps: { resetKey: "account:old-list" } },
		);

		let loading!: Promise<void>;
		act(() => {
			loading = result.current.loadNextPage();
		});
		expect(request?.isCurrent()).toBe(true);

		rerender({ resetKey: "account:new-list" });
		expect(request?.resetKey).toBe("account:old-list");
		expect(request?.isCurrent()).toBe(false);

		release();
		await act(() => loading);
	});

	it("invalidates the first A request across an A to B to A reset cycle", async () => {
		let firstARequest:
			| { resetKey: string; isCurrent: () => boolean }
			| undefined;
		let releaseFirstA!: () => void;
		const firstAPending = new Promise<void>((resolve) => {
			releaseFirstA = resolve;
		});
		const loadPage = vi.fn(async (_page: number, request: NonNullable<typeof firstARequest>) => {
			if (!firstARequest) {
				firstARequest = request;
				await firstAPending;
			}
		});
		const { result, rerender } = renderHook(
			({ resetKey }) =>
				usePublicConnectionPagination({
					pageInfo: { page: 1, pageSize: 200, pageCount: 2, total: 201 },
					loadPage,
					resetKey,
				}),
			{ initialProps: { resetKey: "account:list-a" } },
		);

		let firstALoad!: Promise<void>;
		act(() => {
			firstALoad = result.current.loadNextPage();
		});
		expect(firstARequest?.isCurrent()).toBe(true);

		rerender({ resetKey: "account:list-b" });
		rerender({ resetKey: "account:list-a" });

		expect(firstARequest?.resetKey).toBe("account:list-a");
		expect(firstARequest?.isCurrent()).toBe(false);

		releaseFirstA();
		await act(() => firstALoad);
	});
});
