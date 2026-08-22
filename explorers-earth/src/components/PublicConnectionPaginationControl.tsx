import { useTranslation } from "react-i18next";

interface PublicConnectionPaginationControlProps {
	hasNextPage: boolean;
	isLoading: boolean;
	error: unknown;
	onLoadMore: () => void;
	onRetry: () => void;
	label: string;
}

export function PublicConnectionPaginationControl({
	hasNextPage,
	isLoading,
	error,
	onLoadMore,
	onRetry,
	label,
}: PublicConnectionPaginationControlProps) {
	const { t } = useTranslation();

	if (error) {
		return (
			<button
				type="button"
				onClick={onRetry}
				className="mt-6 min-h-11 px-3 text-sm text-blue-300 underline"
				aria-label={t("common.retryLoadingMore", { label })}
			>
				{t("common.retryLoadingMore", { label })}
			</button>
		);
	}

	if (!hasNextPage) return null;

	return (
		<button
			type="button"
			disabled={isLoading}
			aria-busy={isLoading}
			onClick={onLoadMore}
			className="mt-6 min-h-11 rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
		>
			{isLoading
				? t("common.loadingMore", { label })
				: t("common.loadMore", { label })}
			{isLoading && (
				<span className="sr-only" role="status" aria-live="polite">
					{t("common.loadingMore", { label })}
				</span>
			)}
		</button>
	);
}
