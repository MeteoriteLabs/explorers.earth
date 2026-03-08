import { memo, useState, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { EarthLoader } from "../../../components/EarthLoader";
import { GET_PUBLIC_GUIDE_BY_ID_QUERY } from "../../Guides/api/queries";
import JourneyIcon from "../../../assets/icons/JourneyIcon";
import TransportationIcon from "../../../assets/icons/TransportationIcon";
import StayIcon from "../../../assets/icons/StayIcon";
import BudgetIcon from "../../../assets/icons/BudgetIcon";
import TipsIcon from "../../../assets/icons/TipsIcon";
import CrossIcon from "../../../assets/icons/CrossIcon";
import PublicGuideJourneyView from "./PublicGuideViews/PublicGuideJourneyView";
import PublicGuideTransportView from "./PublicGuideViews/PublicGuideTransportView";
import PublicGuideStayView from "./PublicGuideViews/PublicGuideStayView";
import PublicGuideBudgetView from "./PublicGuideViews/PublicGuideBudgetView";
import PublicGuideTipsView from "./PublicGuideViews/PublicGuideTipsView";

interface PublicGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  guideId: string;
}

const PublicGuideModal = memo(({ isOpen, onClose, guideId }: PublicGuideModalProps) => {
  const [activeTab, setActiveTab] = useState("journey");

  const { data, loading, error } = useQuery(GET_PUBLIC_GUIDE_BY_ID_QUERY, {
    variables: { documentId: guideId },
    skip: !isOpen || !guideId,
    fetchPolicy: "network-only",
  });

  const guide = data?.guide;

  // Parse guide sections and remove duplicates
  const sections = useMemo(() => {
    if (!guide?.guide_sections) return [];
    const allSections = guide.guide_sections || [];
    return allSections.filter(
      (section: any, index: number, self: any[]) =>
        index === self.findIndex((s: any) => s.documentId === section.documentId)
    ).sort((a: any, b: any) => (a.Sequence || 0) - (b.Sequence || 0));
  }, [guide?.guide_sections]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-x-0 bottom-0 top-12 md:top-12 z-[9999] md:max-w-4xl md:mx-auto pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative bg-black rounded-t-2xl border border-gray-700 w-full h-full overflow-y-auto scrollbar-hide flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <EarthLoader context="general" size="small" />
          </div>
        ) : error || !guide ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <p className="text-red-400 font-poppins text-lg mb-4">
              Failed to load guide
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Guide Header */}
            <div
              className="relative w-full h-40 sm:h-48 md:h-64 lg:h-80 bg-cover bg-center flex-shrink-0 rounded-t-2xl overflow-hidden"
              style={{
                backgroundImage: guide.Guide_Media?.[0]?.url
                  ? `url('${guide.Guide_Media[0].url}')`
                  : "linear-gradient(135deg, hsl(var(--blue-cta)) 0%, hsl(var(--blue-final)) 100%)",
              }}
            >
              {/* Close Button - Positioned over image */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 z-30 p-1.5 sm:p-2 rounded-full border border-gray-600 hover:border-gray-400 transition-colors bg-black/80 backdrop-blur-sm"
              >
                <CrossIcon stroke="#ffffff" size="5" />
              </button>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              <div className="relative z-10 p-3 sm:p-4 md:p-6 lg:p-8 text-white h-full flex flex-col justify-end">
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                      {guide.Guide_Type && (
                        <span className="px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium bg-white/20 backdrop-blur-sm rounded-full">
                          {guide.Guide_Type}
                        </span>
                      )}
                    </div>
                    <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 sm:mb-2 line-clamp-2">
                      {guide.Title}
                    </h1>
                    {guide.Description && (
                      <p className="text-xs sm:text-sm md:text-base text-gray-300 line-clamp-2">
                        {typeof guide.Description === "string"
                          ? guide.Description
                          : Array.isArray(guide.Description)
                          ? guide.Description
                              .map((block: any) =>
                                block.children?.map((child: any) => child.text).join(" ")
                              )
                              .join(" ")
                          : ""}
                      </p>
                    )}
                    {guide.Estimated_Budget &&
                      (guide.Estimated_Budget.currency ||
                        guide.Estimated_Budget.amount) && (
                        <p className="text-xs sm:text-sm md:text-base mt-1 sm:mt-2 font-medium">
                          Budget: {guide.Estimated_Budget.currency}{" "}
                          {guide.Estimated_Budget.amount}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs - Sticky when scrolled */}
            <div className="sticky top-0 z-20 bg-black border-b border-gray-700 px-2 sm:px-4 flex-shrink-0">
              <div className="flex justify-center items-center gap-1 sm:gap-2 md:gap-4 lg:gap-6 xl:gap-8 py-2 sm:py-3 md:py-4 lg:py-6 px-1 sm:px-2 md:px-4 overflow-x-auto scrollbar-hide">
                {[
                  { id: "journey", icon: JourneyIcon, label: "Journey" },
                  {
                    id: "transportation",
                    icon: TransportationIcon,
                    label: "Transport",
                  },
                  { id: "stay", icon: StayIcon, label: "Stay" },
                  { id: "budget", icon: BudgetIcon, label: "Budget" },
                  { id: "tips", icon: TipsIcon, label: "Tips" },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const IconComponent = tab.icon;
                  return (
                    <div
                      key={tab.id}
                      className="flex flex-col items-center cursor-pointer group flex-shrink-0"
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <motion.div
                        className={`
                          relative w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 rounded-full 
                          flex items-center justify-center
                          transition-all duration-300
                          ${
                            isActive
                              ? "bg-blue-500 border-2 border-blue-500"
                              : "bg-gray-800 border-2 border-gray-600 group-hover:border-blue-500/60"
                          }
                        `}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{
                          scale: isActive ? 1 : 0.95,
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <motion.div
                          className={`
                            transition-all duration-300
                            ${
                              isActive
                                ? "scale-110"
                                : ""
                            }
                          `}
                        >
                          <IconComponent 
                            size={isActive ? "5" : "4"}
                            color={isActive ? "#ffffff" : "#9CA3AF"} 
                          />
                        </motion.div>
                      </motion.div>
                      <motion.p
                        className={`
                          mt-1 sm:mt-1.5 md:mt-2 lg:mt-2.5 text-[10px] sm:text-xs md:text-sm lg:text-base font-poppins font-semibold
                          transition-all duration-300 text-center whitespace-nowrap
                          ${
                            isActive
                              ? "text-blue-400"
                              : "text-gray-400 group-hover:text-gray-300"
                          }
                        `}
                      >
                        {tab.label}
                      </motion.p>
                      {isActive && (
                        <div className="mt-0.5 sm:mt-0.5 md:mt-1 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-black flex-1">
              <div className="p-2 sm:p-3 md:p-4 lg:p-6">
                <AnimatePresence mode="wait">
                  {activeTab === "journey" && (
                    <motion.div
                      key="journey"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <PublicGuideJourneyView guide={guide} sections={sections} />
                    </motion.div>
                  )}
                  {activeTab === "transportation" && (
                    <motion.div
                      key="transportation"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <PublicGuideTransportView guide={guide} sections={sections} />
                    </motion.div>
                  )}
                  {activeTab === "stay" && (
                    <motion.div
                      key="stay"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <PublicGuideStayView guide={guide} sections={sections} />
                    </motion.div>
                  )}
                  {activeTab === "budget" && (
                    <motion.div
                      key="budget"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <PublicGuideBudgetView guide={guide} sections={sections} />
                    </motion.div>
                  )}
                  {activeTab === "tips" && (
                    <motion.div
                      key="tips"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <PublicGuideTipsView guide={guide} sections={sections} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
});

PublicGuideModal.displayName = "PublicGuideModal";

export default PublicGuideModal;

