import { FC, memo } from "react";

/** Controls which colour palette the skeleton uses */
export type SkeletonVariant = "public" | "dashboard";

interface RecommendationCardSkeletonProps {
    /** Number of skeleton cards to render */
    count?: number;
    /**
     * "public"    – dark (#1a1a1a) cards for the black-background public pages (default)
     * "dashboard" – uses dashboard CSS-token colours so the card blends into the green sidebar bg
     */
    variant?: SkeletonVariant;
}

interface SkeletonCardProps {
    variant: SkeletonVariant;
}

/**
 * A single skeleton card that mimics the Card component layout.
 * Uses a subtle shimmer animation for a premium loading feel.
 */
const SkeletonCard = memo(({ variant }: SkeletonCardProps) => {
    const isDashboard = variant === "dashboard";

    return (
        <div
            className="relative w-full aspect-square md:aspect-[4/3] max-w-[200px] md:max-w-none mx-auto rounded-xl overflow-hidden"
            style={{
                background: isDashboard
                    ? "var(--dash-muted, #3C4E40)"
                    : "#1a1a1a",
            }}
        >
            {/* Shimmer overlay */}
            <div className="absolute inset-0 skeleton-shimmer" />

            {/* Recommendation type icon placeholder */}
            <div
                className="absolute z-10 left-2 top-2 w-8 h-8 rounded-full"
                style={{
                    background: isDashboard
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.05)",
                }}
            />

            {/* Bottom content area – mimics gradient + text */}
            <div
                className="absolute bottom-0 left-0 right-0 p-3"
                style={{
                    background: isDashboard
                        ? "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)"
                        : "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
                }}
            >
                {/* Title placeholder */}
                <div
                    className="h-3.5 w-3/4 rounded mb-2"
                    style={{
                        background: isDashboard
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(255,255,255,0.10)",
                    }}
                />
                {/* Rating row placeholder */}
                <div className="flex items-center gap-1.5">
                    {[3, 8, 10].map((w, i) => (
                        <div
                            key={i}
                            className="h-3 rounded"
                            style={{
                                width: `${w * 4}px`,
                                background: isDashboard
                                    ? "rgba(255,255,255,0.12)"
                                    : "rgba(255,255,255,0.10)",
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});

SkeletonCard.displayName = "SkeletonCard";

/**
 * Grid of skeleton cards used as a placeholder while recommendations load.
 * Drop-in replacement for `<EarthLoader />` in recommendation grids.
 */
const RecommendationCardSkeleton: FC<RecommendationCardSkeletonProps> = memo(
    ({ count = 6, variant = "public" }) => (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={`skeleton-${i}`} variant={variant} />
            ))}
        </>
    )
);

RecommendationCardSkeleton.displayName = "RecommendationCardSkeleton";

export default RecommendationCardSkeleton;
