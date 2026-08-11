import { FC, memo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { isDisplayableNumber, toDisplayNumber } from "../../utils/rating";

interface NoImagePlaceCardProps {
  title: string;
  rating?: number;
  reviews?: number;
  category: string;
  onClickhandler?: () => void;
  onAddClick?: () => void;
}

// Category-specific icons using dashboard theme colors
const CATEGORY_STYLES = {
  "Food & Drinks": {
    icon: "🍽️",
    bgGradient: "from-[hsl(var(--amber))] to-[hsl(var(--destructive))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--amber))] to-[hsl(var(--destructive))]",
  },
  Lodging: {
    icon: "🏨",
    bgGradient: "from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
  },
  Entertainment: {
    icon: "🎭",
    bgGradient: "from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
  },
  Tourism: {
    icon: "🗺️",
    bgGradient: "from-dashboard-sidebar to-dashboard-accent",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-dashboard-sidebar to-dashboard-accent",
  },
  Shopping: {
    icon: "🛍️",
    bgGradient: "from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
  },
  "Health & Wellness": {
    icon: "⚕️",
    bgGradient: "from-dashboard-sidebar to-dashboard-accent",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-dashboard-sidebar to-dashboard-accent",
  },
  Transportation: {
    icon: "🚗",
    bgGradient: "from-[hsl(var(--charcoal))] to-[hsl(var(--deep-charcoal))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--charcoal))] to-[hsl(var(--deep-charcoal))]",
  },
  Services: {
    icon: "🔧",
    bgGradient: "from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))]",
  },
  default: {
    icon: "📍",
    bgGradient: "from-[hsl(var(--charcoal))] to-[hsl(var(--deep-charcoal))]",
    textColor: "text-white",
    bgStyle: "bg-gradient-to-br from-[hsl(var(--charcoal))] to-[hsl(var(--deep-charcoal))]",
  },
};

const NoImagePlaceCard: FC<NoImagePlaceCardProps> = memo(
  ({ title, rating, reviews, category, onClickhandler, onAddClick }) => {
    const { t } = useTranslation();
    const categoryStyle =
      CATEGORY_STYLES[category as keyof typeof CATEGORY_STYLES] ||
      CATEGORY_STYLES.default;

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
        {/* Custom Card for places without images */}
        <motion.div
          className={`w-32 h-20 md:h-24 md:w-40 relative overflow-hidden rounded-t-lg cursor-pointer ${categoryStyle.bgStyle}`}
          onClick={onClickhandler}
        >
          {/* Category Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl md:text-3xl mb-1 opacity-80">
                {categoryStyle.icon}
              </div>
              <div className="text-xs font-medium opacity-75 px-2">
                No Image Available
              </div>
            </div>
          </div>

          {/* Gradient Overlay similar to regular cards */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          {/* Place Info */}
          <div
            className={`absolute bottom-0 ${categoryStyle.textColor} w-32 md:w-40 px-1.5 py-1.5`}
          >
            <h3 className="font-poppins font-medium text-xs leading-tight truncate">
              {title}
            </h3>
            {(rating !== undefined || reviews !== undefined) && (
              <div className="flex items-center gap-1 mt-0.5">
                {isDisplayableNumber(rating) && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-[hsl(var(--amber))] text-xs">★</span>
                    <span className="font-poppins text-xs">
                      {toDisplayNumber(rating).toFixed(1)}
                    </span>
                  </div>
                )}
                {reviews !== undefined && reviews > 0 && (
                  <span className="text-[hsl(var(--text-light))] font-poppins text-xs truncate max-w-16">
                    (
                    {reviews > 999 ? `${Math.floor(reviews / 1000)}k` : reviews}
                    )
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Add Button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddClick?.();
          }}
          className="w-32 md:w-40 bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] transition-colors duration-200 text-white font-poppins text-xs font-medium py-2 px-3 rounded-b-lg shadow-lg -mt-px flex items-center justify-center gap-1.5"
        >
          <span>{t("dashboard.recommendations.exploreSection.addButton")}</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </motion.button>
      </motion.div>
    );
  }
);

export default NoImagePlaceCard;
