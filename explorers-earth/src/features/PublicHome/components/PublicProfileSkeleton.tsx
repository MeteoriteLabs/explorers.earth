import { memo } from "react";

export const PublicProfileSkeleton = memo(() => {
  return (
    <div
      className="min-h-screen bg-black text-white pb-20 select-none pointer-events-none"
      data-testid="public-profile-shell"
      aria-hidden="true"
    >
      {/* Cover Photo Shimmer */}
      <div className="relative h-[380px] md:h-[420px] bg-white/5 skeleton-shimmer w-full rounded-b-[2rem] md:rounded-none overflow-hidden motion-reduce:animate-none" />

      {/* Profile Pic, Name, Bio Skeletons */}
      <div className="relative z-10 -mt-20 text-center px-4">
        {/* Avatar Circle */}
        <div className="w-[7.5rem] h-[7.5rem] mx-auto rounded-full border-4 border-gray-800 bg-white/10 skeleton-shimmer overflow-hidden shadow-xl motion-reduce:animate-none" />

        {/* Name */}
        <div className="mt-4 h-6 w-48 bg-white/10 skeleton-shimmer rounded mx-auto motion-reduce:animate-none" />

        {/* Location */}
        <div className="mt-2 h-4 w-32 bg-white/5 skeleton-shimmer rounded mx-auto motion-reduce:animate-none" />

        {/* Social Icons */}
        <div className="flex justify-center gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-white/5 skeleton-shimmer motion-reduce:animate-none"
            />
          ))}
        </div>

        {/* Bio */}
        <div className="max-w-md mx-auto mt-8 px-6 space-y-2">
          <div className="h-3 w-full bg-white/5 skeleton-shimmer rounded motion-reduce:animate-none" />
          <div className="h-3 w-5/6 bg-white/5 skeleton-shimmer rounded mx-auto motion-reduce:animate-none" />
          <div className="h-3 w-2/3 bg-white/5 skeleton-shimmer rounded mx-auto motion-reduce:animate-none" />
        </div>

        {/* Tabs Skeleton */}
        <div className="flex justify-center gap-6 mt-10 border-b border-white/10 pb-3 max-w-md mx-auto">
          <div className="h-4 w-28 bg-white/10 skeleton-shimmer rounded motion-reduce:animate-none" />
          <div className="h-4 w-20 bg-white/5 skeleton-shimmer rounded motion-reduce:animate-none" />
          <div className="h-4 w-28 bg-white/5 skeleton-shimmer rounded motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
});

PublicProfileSkeleton.displayName = "PublicProfileSkeleton";

export default PublicProfileSkeleton;
