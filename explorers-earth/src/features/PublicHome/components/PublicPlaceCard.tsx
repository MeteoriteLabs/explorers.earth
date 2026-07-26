import { FC, memo, useMemo } from "react";
import { isDisplayableNumber, toDisplayNumber } from "../../../utils/rating";

interface PublicPlaceCardProps {
  title: string;
  image?: string | null;
  previewImages?: string[];
  subtitle?: string;
  rating?: number;
  reviews?: number;
  onClickhandler: () => void;
  className?: string;
}

const PublicPlaceCard: FC<PublicPlaceCardProps> = memo(
  ({ title, image, previewImages, subtitle, rating, reviews, onClickhandler, className }) => {
    const validPreviews = useMemo(() => {
      return (previewImages || []).filter((url) => !!url);
    }, [previewImages]);

    const hasPreviewCollage = !image && validPreviews.length > 0;

    return (
      <div
        onClick={onClickhandler}
        className={`place-rec-card relative flex-shrink-0 rounded-[16px] overflow-hidden flex flex-col justify-between p-2.5 border border-white/[0.08] cursor-pointer shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.02] hover:border-white/25 select-none ${className || "w-[135px] h-[155px] md:w-[155px] md:h-[180px]"}`}
        style={
          !hasPreviewCollage && image
            ? {
                backgroundImage: `url('${image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: "linear-gradient(135deg, #181c2b 0%, #0d0e15 50%, #050608 100%)",
              }
        }
      >
        {/* Collage Background */}
        {hasPreviewCollage && (
          <div className="absolute inset-0 z-0 grid gap-[1px] bg-black pointer-events-none">
            {validPreviews.length === 1 && (
              <img src={validPreviews[0]} alt="" className="w-full h-full object-cover" />
            )}
            {validPreviews.length === 2 && (
              <div className="grid grid-cols-2 h-full w-full gap-[1px]">
                <img src={validPreviews[0]} alt="" className="w-full h-full object-cover" />
                <img src={validPreviews[1]} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {validPreviews.length === 3 && (
              <div className="grid grid-cols-2 h-full w-full gap-[1px]">
                <img src={validPreviews[0]} alt="" className="w-full h-full object-cover" />
                <div className="grid grid-rows-2 gap-[1px] h-full">
                  <img src={validPreviews[1]} alt="" className="w-full h-full object-cover" />
                  <img src={validPreviews[2]} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
            {validPreviews.length >= 4 && (
              <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-[1px]">
                <img src={validPreviews[0]} alt="" className="w-full h-full object-cover" />
                <img src={validPreviews[1]} alt="" className="w-full h-full object-cover" />
                <img src={validPreviews[2]} alt="" className="w-full h-full object-cover" />
                <img src={validPreviews[3]} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        {/* Shading overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/85 z-10 pointer-events-none" />

        {/* Top left direction arrow icon */}
        <div className="relative z-20 flex justify-between items-center w-full">
          <div className="w-[26px] h-[26px] rounded-full bg-[#0f1624]/65 backdrop-blur-[3px] border border-white/20 flex items-center justify-center">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
            >
              <path
                d="M7 17L17 7M17 7H7M17 7V17"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Bottom Title, Subtitle, & Rating */}
        <div className="relative z-20 flex flex-col gap-0.5 w-full">
          <h4 className="text-[0.75rem] md:text-[0.82rem] font-bold text-white tracking-wide truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] font-poppins">
            {title}
          </h4>
          {subtitle && (
            <div className="mt-0.5">
              <span className="inline-block bg-white/10 backdrop-blur-[2px] px-1.5 py-0.5 rounded-[4px] text-[0.56rem] md:text-[0.6rem] font-semibold text-white/85 tracking-wide font-poppins">
                {subtitle}
              </span>
            </div>
          )}
          {(() => {
            const showRating = isDisplayableNumber(rating);
            const showReviews =
              isDisplayableNumber(reviews) && toDisplayNumber(reviews) > 0;
            if (!showRating && !showReviews) return null;
            return (
              <div className="flex items-center gap-1 text-[0.58rem] md:text-[0.62rem] font-semibold text-white/90 font-poppins mt-0.5">
                {showRating && (
                  <span className="text-[#fbbf24] flex items-center gap-0.5">
                    ★ {toDisplayNumber(rating).toFixed(1)}
                  </span>
                )}
                {showReviews && (
                  <span className="text-white/70">({toDisplayNumber(reviews)})</span>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }
);

PublicPlaceCard.displayName = "PublicPlaceCard";

export default PublicPlaceCard;
