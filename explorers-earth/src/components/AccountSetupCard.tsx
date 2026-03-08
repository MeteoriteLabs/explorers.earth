import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";
import Profile from "../assets/icons/Profile";
import DirectionBoard from "../assets/icons/DirectionBoard";

interface AccountSetupCardProps {
  isProfileComplete: boolean;
  isRecommendationsComplete: boolean;
}

const AccountSetupCard = ({
  isProfileComplete,
  isRecommendationsComplete,
}: AccountSetupCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate("/profile", { state: { startTour: true } });
  };

  const handleRecommendationsClick = () => {
    navigate("/recommendations", { state: { startTour: true } });
  };

  // Calculate progress - explicitly handle all cases: 0/2, 1/2, or 2/2
  const completedSteps = (isProfileComplete ? 1 : 0) + (isRecommendationsComplete ? 1 : 0);
  // Ensure completedSteps is always between 0 and 2
  const validCompletedSteps = Math.max(0, Math.min(2, completedSteps));
  const progressPercentage = (validCompletedSteps / 2) * 100;

  return (
    <div className="w-full mb-6">
      <div className="bg-dashboard-sidebar backdrop-blur-sm border border-dashboard rounded-3xl p-5 md:p-6 relative overflow-hidden">
        {/* Subtle accent gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--dash-accent))]/5 via-transparent to-transparent pointer-events-none"></div>
        
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-5">
            <h2 className="text-xl md:text-2xl font-bold font-poppins text-white leading-tight">
              {t("dashboard.profile.accountSetup.title")}
            </h2>
          </div>

          {/* Progress Bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-poppins text-[hsl(var(--text-light))] opacity-70">
                {t("dashboard.profile.accountSetup.progress")}
              </span>
              <span className="text-xs font-poppins font-semibold text-dashboard-accent">
                {validCompletedSteps}/2 {t("dashboard.profile.accountSetup.complete")}
              </span>
            </div>
            <div className="w-full h-1.5 bg-dashboard rounded-full overflow-hidden">
              <div
                className="h-full bg-dashboard-accent transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        
          {/* Setup Items */}
          <div className="flex flex-col gap-3 mb-5">
            {/* Profile Setup Item */}
            <div
              className={`group flex items-center justify-between p-3.5 md:p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                isProfileComplete
                  ? "bg-dashboard-sidebar/50 border-[hsl(var(--status-published))]/30"
                  : "bg-dashboard-sidebar border-dashboard hover:border-dashboard-accent/50 hover:bg-dashboard-sidebar/90 hover:shadow-md hover:shadow-dashboard-accent/10"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleProfileClick();
              }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Tick Mark Box */}
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isProfileComplete
                      ? "bg-[hsl(var(--status-published))] text-white"
                      : "bg-dashboard border border-dashboard-accent text-dashboard-accent"
                  }`}
                >
                  {isProfileComplete ? "✓" : "☐"}
                </div>

                {/* Icon Container */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isProfileComplete
                      ? "bg-[hsl(var(--status-published))]/20"
                      : "bg-dashboard-accent/10 group-hover:bg-dashboard-accent/20"
                  }`}
                >
                  <Profile
                    fill={
                      isProfileComplete
                        ? "hsl(var(--status-published))"
                        : "hsl(var(--dash-accent))"
                    }
                  />
                </div>

                {/* Text Section */}
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-white font-poppins text-sm md:text-base font-semibold">
                    {t("dashboard.profile.tabs.publicProfile")}
                  </span>
                  <span className="text-[hsl(var(--text-light))] font-poppins text-xs opacity-70 mt-0.5">
                    {isProfileComplete
                      ? t("dashboard.profile.accountSetup.profileSetupCompleted")
                      : t("dashboard.profile.accountSetup.profileSetupIncomplete")}
                  </span>
                </div>
              </div>

              {/* Setup Button - Styled like share button */}
              {!isProfileComplete && (
                <div 
                  className="flex-shrink-0 ml-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    btnText={t("dashboard.profile.accountSetup.setupButton")}
                    variant="primary"
                    size="small"
                    onClickHandler={handleProfileClick}
                    className="bg-[hsl(var(--blue-cta))] backdrop-blur-sm rounded-lg px-4 md:px-5 py-2 border-2 border-[hsl(var(--blue-cta))]/50 hover:bg-[hsl(var(--blue-final))] hover:border-[hsl(var(--blue-final))]/50 transition-all duration-200 hover:scale-105 active:scale-95 font-semibold text-sm shadow-md shadow-[hsl(var(--blue-cta))]/20"
                  />
                </div>
              )}
            </div>

            {/* Recommendations Setup Item */}
            <div
              className={`group flex items-center justify-between p-3.5 md:p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                isRecommendationsComplete
                  ? "bg-dashboard-sidebar/50 border-[hsl(var(--status-published))]/30"
                  : "bg-dashboard-sidebar border-dashboard hover:border-dashboard-accent/50 hover:bg-dashboard-sidebar/90 hover:shadow-md hover:shadow-dashboard-accent/10"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleRecommendationsClick();
              }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Tick Mark Box */}
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isRecommendationsComplete
                      ? "bg-[hsl(var(--status-published))] text-white"
                      : "bg-dashboard border border-dashboard-accent text-dashboard-accent"
                  }`}
                >
                  {isRecommendationsComplete ? "✓" : "☐"}
                </div>

                {/* Icon Container */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isRecommendationsComplete
                      ? "bg-[hsl(var(--status-published))]/20"
                      : "bg-dashboard-accent/10 group-hover:bg-dashboard-accent/20"
                  }`}
                >
                  <DirectionBoard
                    fill={
                      isRecommendationsComplete
                        ? "hsl(var(--status-published))"
                        : "hsl(var(--dash-accent))"
                    }
                  />
                </div>

                {/* Text Section */}
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-white font-poppins text-sm md:text-base font-semibold">
                    {t("dashboard.recommendations.recommendationsTab")}
                  </span>
                  <span className="text-[hsl(var(--text-light))] font-poppins text-xs opacity-70 mt-0.5">
                    {isRecommendationsComplete
                      ? t("dashboard.profile.accountSetup.recommendationsSetupCompleted")
                      : t("dashboard.profile.accountSetup.recommendationsSetupIncomplete")}
                  </span>
                </div>
              </div>

              {/* Setup Button - Styled like share button */}
              {!isRecommendationsComplete && (
                <div 
                  className="flex-shrink-0 ml-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    btnText={t("dashboard.profile.accountSetup.setupButton")}
                    variant="primary"
                    size="small"
                    onClickHandler={handleRecommendationsClick}
                    className="bg-[hsl(var(--blue-cta))] backdrop-blur-sm rounded-lg px-4 md:px-5 py-2 border-2 border-[hsl(var(--blue-cta))]/50 hover:bg-[hsl(var(--blue-final))] hover:border-[hsl(var(--blue-final))]/50 transition-all duration-200 hover:scale-105 active:scale-95 font-semibold text-sm shadow-md shadow-[hsl(var(--blue-cta))]/20"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer Message */}
          <p className="text-[hsl(var(--text-light))] font-poppins text-xs text-center opacity-70">
            {t("dashboard.profile.accountSetup.footerMessage")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountSetupCard;
