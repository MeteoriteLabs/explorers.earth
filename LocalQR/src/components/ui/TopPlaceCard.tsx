import { FC, memo } from "react";
import { motion } from "framer-motion";
import Card from "./Card";
import { AddIcon } from "../../assets/icons/AddIcon";
import { useTranslation } from "react-i18next";

interface TopPlaceCardProps {
  title?: string;
  image?: string;
  rating?: number;
  reviews?: number;
  onClickhandler?: () => void;
  cardType?: "default" | "menuCard" | "map" | "suggestion";
  showAddButton?: boolean;
  onAddClick?: () => void;
}

const TopPlaceCard: FC<TopPlaceCardProps> = memo(
  ({
    onClickhandler,
    title,
    image,
    rating,
    reviews,
    cardType = "suggestion",
    showAddButton = true,
    onAddClick,
  }) => {
    const { t } = useTranslation();

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
        <Card
          title={title}
          image={image}
          rating={rating}
          reviews={reviews}
          onClickhandler={onClickhandler}
          cardType={cardType}
          hasBottomButton={showAddButton && cardType === "suggestion"}
        />

        {showAddButton && cardType === "suggestion" && (
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
            <span>
              {t("dashboard.recommendations.exploreSection.addButton")}
            </span>
            <AddIcon size="4" />
          </motion.button>
        )}
      </motion.div>
    );
  }
);

export default TopPlaceCard;
