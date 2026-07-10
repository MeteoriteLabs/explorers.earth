import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "./ui/Button";
import { IMAGE_CONFIG } from "../config";

interface ProfileSetupAccordionProps {
  account: any;
}

const ProfileSetupAccordion = ({ account }: ProfileSetupAccordionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Helper variables for profile components presence
  const hasProfilePic = !!(account?.profile_picture?.url && account.profile_picture.url.trim() !== "");
  const hasCoverPic = !!(account?.bg_picture?.url && account.bg_picture.url.trim() !== "");
  const hasBio = !!(account?.Bio && account.Bio.trim() !== "");

  const socialMedia = account?.social_media || {};
  const socialLinksCount = Object.values(socialMedia).filter((platform: any) =>
    platform?.link && typeof platform.link === "string" && platform.link.trim() !== ""
  ).length;
  const hasSocialLinks = socialLinksCount >= 2;

  const feedData = account?.Feed_Data || [];
  const hasFeedMedia = Array.isArray(feedData) && feedData.length > 0;

  // Calculate percentage (20% for each of the 5 criteria)
  let percentage = 0;
  if (hasProfilePic) percentage += 20;
  if (hasCoverPic) percentage += 20;
  if (hasBio) percentage += 20;
  if (hasSocialLinks) {
    percentage += 20;
  } else if (socialLinksCount === 1) {
    percentage += 10; // partial progress for 1 link
  }
  if (hasFeedMedia) percentage += 20;

  // Ensure percentage is in [0, 100]
  percentage = Math.max(0, Math.min(100, percentage));

  // Determine if walkthrough is needed
  // Walkthrough should start only if profile picture, cover image, or social links are incomplete
  const isWalkthroughNeeded = !hasProfilePic || !hasCoverPic || !hasSocialLinks;
  const isComplete = percentage === 100;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent toggling accordion
    if (isWalkthroughNeeded) {
      navigate("/profile", { state: { startTour: true } });
    } else {
      navigate("/profile");
    }
  };

  // Click handler for individual checklist items
  const handleItemClick = (itemType: "profile_picture" | "cover_picture" | "bio" | "social_links" | "feed", itemComplete: boolean) => {
    if (itemComplete) return; // Do nothing if already completed
    if (itemType === "profile_picture" || itemType === "cover_picture" || itemType === "social_links") {
      navigate("/profile", { state: { startTour: true } });
    } else {
      navigate("/profile");
    }
  };

  // Helper to resolve profile image URL safely (including local backend server prepends)
  const resolveProfileImageUrl = (url: string | null | undefined): string => {
    if (!url) return IMAGE_CONFIG.defaultImages.profile;
    if (url.startsWith("http")) return url;
    if (url.startsWith("/uploads/")) {
      const backendUrl = import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337";
      return `${backendUrl}${url}`;
    }
    if (url.startsWith("/")) {
      const backendUrl = import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337";
      return `${backendUrl}${url}`;
    }
    return url;
  };

  // Badge, progress stroke, and text color styling based on percentage
  const getProgressColors = (pct: number) => {
    if (pct === 0) {
      return {
        progressBar: "#ef4444",
        textClass: "text-red-400",
        badgeClass: "text-red-400 bg-red-500/10 border-red-500/20",
      };
    }
    if (pct < 50) {
      return {
        progressBar: "#f97316",
        textClass: "text-orange-400",
        badgeClass: "text-orange-400 bg-orange-500/10 border-orange-500/20",
      };
    }
    if (pct < 100) {
      return {
        progressBar: "#eab308",
        textClass: "text-yellow-400",
        badgeClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      };
    }
    return {
      progressBar: "#10b981",
      textClass: "text-green-400",
      badgeClass: "text-green-400 bg-green-500/10 border-green-500/20",
    };
  };

  const colors = getProgressColors(percentage);

  return (
    <div className="w-full mb-6">
      <div className="bg-dashboard-sidebar/60 backdrop-blur-sm border border-dashboard rounded-3xl overflow-hidden transition-all duration-300">
        
        {/* Header (Clickable area with reduced vertical padding) */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-6 cursor-pointer hover:bg-white/5 transition-colors duration-200 select-none"
        >
          <div className="flex items-center gap-4 flex-1 min-w-0 mr-4">
            
            {/* Reduced Circular Progress Avatar */}
            <div className="relative w-[54px] h-[62px] flex-shrink-0">
              <svg width="54" height="62" viewBox="0 0 54 62" className="absolute inset-0">
                {/* Track circle (gray background) with gap at bottom */}
                <circle
                  cx="27"
                  cy="27"
                  r="22"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="115.19 138.23"
                  transform="rotate(120 27 27)"
                />
                {/* Active progress stroke with gap at bottom */}
                <circle
                  cx="27"
                  cy="27"
                  r="22"
                  fill="transparent"
                  stroke={colors.progressBar}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(percentage / 100) * 115.19} 138.23`}
                  transform="rotate(120 27 27)"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              
              {/* Profile Image container */}
              <div className="absolute top-[8px] left-[8px] w-[38px] h-[38px] rounded-full overflow-hidden bg-dashboard-muted border border-white/10">
                <img
                  src={resolveProfileImageUrl(account?.profile_picture?.url)}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Progress Percentage Text at the bottom gap */}
              <div className={`absolute bottom-[1px] left-0 right-0 text-center text-[9px] font-bold font-poppins ${colors.textClass}`}>
                {percentage}%
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-bold font-poppins text-white leading-tight mb-0.5">
                {t("dashboard.profile.accountSetup.accordionTitle", "Public Profile Setup")}
              </h3>
              <p className="text-[11px] text-white/50 font-poppins truncate">
                {isComplete 
                  ? t("dashboard.profile.accountSetup.allComplete", "Your profile is fully set up!") 
                  : t("dashboard.profile.accountSetup.setupDescription", "Complete your profile to build your brand.")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Action Button: "Setup" if walkthrough is needed, "Edit Profile" if incomplete but no walkthrough needed */}
            {!isComplete && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  btnText={isWalkthroughNeeded ? t("dashboard.profile.accountSetup.setupButton", "Setup") : t("dashboard.profile.editProfile", "Edit Profile")}
                  variant="primary"
                  size="small"
                  onClickHandler={handleActionClick}
                  className="bg-[hsl(var(--blue-cta))] backdrop-blur-sm rounded-lg px-3.5 py-1.5 border-2 border-[hsl(var(--blue-cta))]/50 hover:bg-[hsl(var(--blue-final))] hover:border-[hsl(var(--blue-final))]/50 transition-all duration-200 hover:scale-105 active:scale-95 font-semibold text-xs shadow-md shadow-[hsl(var(--blue-cta))]/20 whitespace-nowrap"
                />
              </div>
            )}

            {/* Collapse Arrow */}
            <svg
              className={`w-4 h-4 text-white/50 transition-transform duration-300 ${
                isOpen ? "transform rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Collapsible Checklist Body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="px-5 pb-5 md:px-6 md:pb-6 border-t border-dashboard/30 pt-4 bg-black/10">
                <div className="flex flex-col gap-2.5">
                  
                  {/* Item 1: Profile Picture */}
                  <div
                    onClick={() => handleItemClick("profile_picture", hasProfilePic)}
                    className={`flex items-center p-2.5 rounded-xl transition-all duration-150 border border-transparent ${
                      hasProfilePic 
                        ? "cursor-default" 
                        : "cursor-pointer hover:bg-white/[0.04] hover:border-dashboard/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        hasProfilePic 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                          : "bg-white/5 border border-white/20 text-white/30"
                      }`}>
                        {hasProfilePic ? "✓" : "☐"}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                        <span className={`text-sm font-semibold font-poppins ${hasProfilePic ? "text-white/80" : "text-white/50"}`}>
                          Profile Picture
                        </span>
                        <span className="text-xs text-white/40 font-poppins">
                          Upload a photo to represent your page
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Item 2: Cover Picture */}
                  <div
                    onClick={() => handleItemClick("cover_picture", hasCoverPic)}
                    className={`flex items-center p-2.5 rounded-xl transition-all duration-150 border border-transparent ${
                      hasCoverPic 
                        ? "cursor-default" 
                        : "cursor-pointer hover:bg-white/[0.04] hover:border-dashboard/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        hasCoverPic 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                          : "bg-white/5 border border-white/20 text-white/30"
                      }`}>
                        {hasCoverPic ? "✓" : "☐"}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                        <span className={`text-sm font-semibold font-poppins ${hasCoverPic ? "text-white/80" : "text-white/50"}`}>
                          Cover Picture
                        </span>
                        <span className="text-xs text-white/40 font-poppins">
                          Upload a banner for your public page header
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Item 3: Bio */}
                  <div
                    onClick={() => handleItemClick("bio", hasBio)}
                    className={`flex items-center p-2.5 rounded-xl transition-all duration-150 border border-transparent ${
                      hasBio 
                        ? "cursor-default" 
                        : "cursor-pointer hover:bg-white/[0.04] hover:border-dashboard/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        hasBio 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                          : "bg-white/5 border border-white/20 text-white/30"
                      }`}>
                        {hasBio ? "✓" : "☐"}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                        <span className={`text-sm font-semibold font-poppins ${hasBio ? "text-white/80" : "text-white/50"}`}>
                          Bio
                        </span>
                        <span className="text-xs text-white/40 font-poppins">
                          Tell other explorers about yourself in a short description
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Item 4: Social Links */}
                  <div
                    onClick={() => handleItemClick("social_links", hasSocialLinks)}
                    className={`flex items-center p-2.5 rounded-xl transition-all duration-150 border border-transparent ${
                      hasSocialLinks 
                        ? "cursor-default" 
                        : "cursor-pointer hover:bg-white/[0.04] hover:border-dashboard/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        hasSocialLinks 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                          : "bg-white/5 border border-white/20 text-white/30"
                      }`}>
                        {hasSocialLinks ? "✓" : "☐"}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                        <span className={`text-sm font-semibold font-poppins ${hasSocialLinks ? "text-white/80" : "text-white/50"}`}>
                          Social Links {socialLinksCount > 0 && `(${socialLinksCount}/2)`}
                        </span>
                        <span className="text-xs text-white/40 font-poppins">
                          Connect at least 2 social media accounts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Item 5: Feed Media */}
                  <div
                    onClick={() => handleItemClick("feed", hasFeedMedia)}
                    className={`flex items-center p-2.5 rounded-xl transition-all duration-150 border border-transparent ${
                      hasFeedMedia 
                        ? "cursor-default" 
                        : "cursor-pointer hover:bg-white/[0.04] hover:border-dashboard/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        hasFeedMedia 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                          : "bg-white/5 border border-white/20 text-white/30"
                      }`}>
                        {hasFeedMedia ? "✓" : "☐"}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                        <span className={`text-sm font-semibold font-poppins ${hasFeedMedia ? "text-white/80" : "text-white/50"}`}>
                          Feed Media
                        </span>
                        <span className="text-xs text-white/40 font-poppins">
                          Add at least one photo or media post to your feed
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProfileSetupAccordion;
