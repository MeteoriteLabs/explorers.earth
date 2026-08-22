import type { PublicRouteSkeleton as PublicRouteSkeletonKind } from "../routes/publicRouteContract";
import { useTranslation } from "react-i18next";

const pulse =
  "animate-pulse motion-reduce:animate-none bg-[var(--skeleton-base,var(--border-card))]";

function ProfileRootSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-20 sm:px-6">
      <div className="flex flex-col items-center gap-3">
        <div
          data-testid="public-route-skeleton-profile-avatar"
          className={`${pulse} size-[7.5rem] rounded-full`}
        />
        <div className={`${pulse} h-7 w-48 max-w-full rounded`} />
        <div className={`${pulse} h-4 w-36 max-w-full rounded`} />
      </div>
      <div className="mt-8 space-y-3">
        <div className={`${pulse} h-4 w-full rounded`} />
        <div className={`${pulse} h-4 w-4/5 rounded`} />
      </div>
      <div className="mt-8 flex gap-3 overflow-hidden" aria-hidden="true">
        <div className={`${pulse} h-11 w-36 shrink-0 rounded-full`} />
        <div className={`${pulse} h-11 w-28 shrink-0 rounded-full`} />
        <div className={`${pulse} h-11 w-40 shrink-0 rounded-full`} />
      </div>
      <div data-skeleton-wide-grid className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-3">
            <div className={`${pulse} aspect-[4/3] w-full rounded-lg`} />
            <div className={`${pulse} h-4 w-3/4 rounded`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-20 sm:px-6">
      <div className={`${pulse} h-9 w-56 max-w-full rounded`} />
      <div className={`${pulse} mt-3 h-4 w-80 max-w-full rounded`} />
      <div data-skeleton-wide-grid className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="min-w-0 space-y-3">
            <div className={`${pulse} aspect-[16/10] w-full rounded-lg`} />
            <div className={`${pulse} h-5 w-4/5 rounded`} />
            <div className={`${pulse} h-4 w-2/3 rounded`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-20 sm:px-6">
      <div className={`${pulse} aspect-[16/7] w-full rounded-lg`} />
      <div className={`${pulse} mt-6 h-9 w-2/3 max-w-full rounded`} />
      <div className={`${pulse} mt-3 h-4 w-full rounded`} />
      <div className={`${pulse} mt-2 h-4 w-5/6 rounded`} />
      <div data-skeleton-wide-grid className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${pulse} h-28 min-w-0 rounded-lg`} />
        ))}
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="relative h-dvh min-h-[32rem] w-full">
      <div
        data-testid="public-route-skeleton-map-canvas"
        className={`${pulse} absolute inset-0`}
      />
      <div className="absolute left-4 right-4 top-4 flex items-center gap-3">
        <div className={`${pulse} size-11 shrink-0 rounded-full`} />
        <div className={`${pulse} h-11 min-w-0 flex-1 rounded-full`} />
      </div>
      <div className={`${pulse} absolute bottom-6 right-4 size-11 rounded-full`} />
    </div>
  );
}

const skeletons: Record<PublicRouteSkeletonKind, () => JSX.Element> = {
  "profile-root": ProfileRootSkeleton,
  collection: CollectionSkeleton,
  detail: DetailSkeleton,
  map: MapSkeleton,
};

export function PublicRouteSkeleton({ kind }: { kind: PublicRouteSkeletonKind }) {
  const Skeleton = skeletons[kind];
  const { t } = useTranslation();
  const loadingLabel = t("publicProfile.loading.section", "Loading profile section");

  return (
    <section
      data-public-route-skeleton={kind}
      data-testid={`public-route-skeleton-${kind}`}
      className="min-h-screen w-full max-w-full overflow-x-hidden"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <div role="status" aria-label={loadingLabel} className="sr-only">
        {loadingLabel}
      </div>
      <Skeleton />
    </section>
  );
}
