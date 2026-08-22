import { useCallback, useEffect, useRef, useState } from "react";

export interface PublicPageInfo {
	page: number;
	pageSize: number;
	pageCount: number;
	total: number;
}

export interface PublicConnectionNode {
	documentId: string;
}

export interface PublicConnection<TNode extends PublicConnectionNode> {
	nodes: TNode[];
	pageInfo: PublicPageInfo;
}

export function mergePublicConnectionPage<TNode extends PublicConnectionNode>(
	previous: PublicConnection<TNode>,
	next: PublicConnection<TNode>,
): PublicConnection<TNode> {
	const seen = new Set(previous.nodes.map(({ documentId }) => documentId));
	const appendedNodes = next.nodes.filter(({ documentId }) => {
		if (seen.has(documentId)) return false;
		seen.add(documentId);
		return true;
	});

	return {
		nodes: [...previous.nodes, ...appendedNodes],
		pageInfo: next.pageInfo,
	};
}

export interface PublicPageRequest {
	resetKey: string;
	isCurrent: () => boolean;
}

interface UsePublicConnectionPaginationInput {
	pageInfo: PublicPageInfo | undefined;
	loadPage: (page: number, request: PublicPageRequest) => Promise<unknown>;
	resetKey: string;
}

interface UsePublicConnectionPaginationResult {
	hasNextPage: boolean;
	isLoadingNextPage: boolean;
	nextPageError: unknown;
	loadNextPage: () => Promise<void>;
	retryNextPage: () => Promise<void>;
}

export function usePublicConnectionPagination({
	pageInfo,
	loadPage,
	resetKey,
}: UsePublicConnectionPaginationInput): UsePublicConnectionPaginationResult {
	const [isLoadingNextPage, setIsLoadingNextPage] = useState(false);
	const [nextPageError, setNextPageError] = useState<unknown>();
	const requestInFlight = useRef(false);
	const generation = useRef(0);
	const currentResetKey = useRef(resetKey);
	currentResetKey.current = resetKey;

	useEffect(() => {
		generation.current += 1;
		requestInFlight.current = false;
		setIsLoadingNextPage(false);
		setNextPageError(undefined);
	}, [resetKey]);

	const hasNextPage = Boolean(
		pageInfo && pageInfo.page < pageInfo.pageCount,
	);

	const loadNextPage = useCallback(async () => {
		if (!pageInfo || pageInfo.page >= pageInfo.pageCount || requestInFlight.current) {
			return;
		}

		const requestGeneration = generation.current;
		const requestResetKey = resetKey;
		const request: PublicPageRequest = {
			resetKey: requestResetKey,
			isCurrent: () => currentResetKey.current === requestResetKey,
		};
		requestInFlight.current = true;
		setIsLoadingNextPage(true);
		setNextPageError(undefined);

		try {
			await loadPage(pageInfo.page + 1, request);
		} catch (error) {
			if (requestGeneration === generation.current) {
				setNextPageError(error);
			}
		} finally {
			if (requestGeneration === generation.current) {
				requestInFlight.current = false;
				setIsLoadingNextPage(false);
			}
		}
	}, [loadPage, pageInfo, resetKey]);

	return {
		hasNextPage,
		isLoadingNextPage,
		nextPageError,
		loadNextPage,
		retryNextPage: loadNextPage,
	};
}
