import { useTranslation } from "react-i18next";

interface PublicConnectionPaginationControlProps {
	hasNextPage: boolean;
	isLoading: boolean;
	error: unknown;
	onLoadMore: () => void;
	onRetry: () => void;
	labelKey: string;
}

export function PublicConnectionPaginationControl({
	hasNextPage,
	isLoading,
	error,
	onLoadMore,
	onRetry,
	labelKey,
}: PublicConnectionPaginationControlProps) {
	const { t } = useTranslation();
	const label = t(labelKey);

	if (error) {
		return (
			<button
				type="button"
				onClick={onRetry}
				className="mt-6 min-h-11 px-3 text-sm text-blue-300 underline"
			>
				{t("common.retryLoadingMore", { label })}
			</button>
		);
	}

	if (!hasNextPage) return null;

	const message = isLoading
		? t("common.loadingMore", { label })
		: t("common.loadMore", { label });

	return (
		<>
			<button
				type="button"
				disabled={isLoading}
				aria-busy={isLoading}
				onClick={onLoadMore}
				className="mt-6 min-h-11 rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
			>
				{message}
			</button>
			{isLoading && (
				<span className="sr-only" role="status" aria-live="polite">
					{message}
				</span>
			)}
		</>
	);
}
