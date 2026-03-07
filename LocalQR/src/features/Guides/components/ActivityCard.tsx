import { FC, memo, useState } from "react";
import { motion } from "framer-motion";
import { DayPlace } from "../types/guideSectionTypes";
import { getPlaceIcon } from "../utils/placeIconMapper";
import { getActivityCategory } from "../utils/activityDetector";

interface ActivityCardProps {
  activity: DayPlace;
  onClick?: () => void;
}

/**
 * ActivityCard component displays activity/attraction recommendations
 * Shows activity photo thumbnail or gradient fallback
 * Includes loading state while photos are being fetched
 */
const ActivityCard: FC<ActivityCardProps> = memo(({ activity, onClick }) => {
  const category = getActivityCategory(activity.types);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const hasPhotos = activity.photos && activity.photos.length > 0;
  const firstPhoto = hasPhotos && activity.photos ? activity.photos[0] : null;
  const isLoading = activity.photosLoading;

  return (
    <motion.div
      className="white-theme flex flex-col flex-shrink-0"
      whileHover={{
        scale: 1.03,
        zIndex: 10,
      }}
      transition={{ type: "spring", stiffness: 200 }}
      style={{
        transformOrigin: "center center",
      }}
    >
      <motion.div
        className="w-full h-32 md:h-36 relative overflow-hidden rounded-lg cursor-pointer"
        onClick={onClick}
      >
        {/* Background - Always show gradient as fallback */}
        <div className="absolute inset-0 bg-gradient-to-br from-dashboard-sidebar to-dashboard-accent">
          {/* Icon in center (shown when loading or no photo) */}
          {(!hasPhotos || !imageLoaded || imageError) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <div className="text-3xl md:text-4xl opacity-80">
                    {getPlaceIcon(activity.types, "10", "white")}
                  </div>
                </div>
                {isLoading && (
                  <div className="text-xs font-poppins text-white/75">
                    Loading photos...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Photo thumbnail (if available) */}
        {firstPhoto && !imageError && (
          <img
            src={firstPhoto.url}
            alt={activity.name}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Activity info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 text-white px-3 py-2.5">
          <h3 className="font-poppins font-medium text-sm leading-tight line-clamp-2 mb-1">
            {activity.name}
          </h3>

          {/* Category badge */}
          <div className="flex items-center gap-1">
            <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-xs font-poppins font-medium truncate">
              {category}
            </span>
            {hasPhotos && activity.photos && (
              <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-xs font-poppins font-medium">
                +{activity.photos.length}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

export default ActivityCard;
