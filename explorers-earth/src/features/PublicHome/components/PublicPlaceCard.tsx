import { FC, memo } from "react";

interface PublicPlaceCardProps {
  title: string;
  image: string;
  rating?: number;
  reviews?: number;
  onClickhandler: () => void;
  className?: string;
}

const PublicPlaceCard: FC<PublicPlaceCardProps> = memo(
  ({ title, image, rating, reviews, onClickhandler, className }) => {
    return (
      <div
        onClick={onClickhandler}
        className={`place-rec-card relative flex-shrink-0 rounded-[16px] overflow-hidden flex flex-col justify-between p-2.5 border border-white/[0.08] cursor-pointer shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.02] hover:border-white/25 select-none ${className || "w-[135px] h-[155px] md:w-[155px] md:h-[180px]"}`}
        style={{
          backgroundImage: `url('${image}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
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

        {/* Bottom Title & Rating */}
        <div className="relative z-20 flex flex-col gap-0.5 w-full">
          <h4 className="text-[0.75rem] md:text-[0.82rem] font-bold text-white tracking-wide truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] font-poppins">
            {title}
          </h4>
          {(rating !== undefined || reviews !== undefined) && (
            <div className="flex items-center gap-1 text-[0.58rem] md:text-[0.62rem] font-semibold text-white/90 font-poppins">
              {rating !== undefined && (
                <span className="text-[#fbbf24] flex items-center gap-0.5">
                  ★ {rating.toFixed(1)}
                </span>
              )}
              {reviews !== undefined && reviews > 0 && (
                <span className="text-white/70">({reviews})</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PublicPlaceCard.displayName = "PublicPlaceCard";

export default PublicPlaceCard;
