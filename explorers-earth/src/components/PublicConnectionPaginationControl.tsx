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
	if (error) {
		return (
			<button
				type="button"
				onClick={onRetry}
				className="mt-6 text-sm text-blue-300 underline"
			>
				Retry loading more {label}
			</button>
		);
	}

	if (!hasNextPage) return null;

	return (
		<button
			type="button"
			disabled={isLoading}
			onClick={onLoadMore}
			className="mt-6 rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
		>
			{isLoading ? `Loading more ${label}…` : `Load more ${label}`}
		</button>
	);
}
