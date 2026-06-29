import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { EarthLoader } from "../../../components/EarthLoader";
import SEO from "../../../components/SEO";
import { createCanonicalUrl } from "../../../utils/getCurrentDomain";
import { GET_GUIDE_BY_ID_QUERY, GET_USER_ACCOUNT_QUERY } from "../api/queries";
import {
  DELETE_GUIDE_SECTION_MUTATION,
  UPDATE_GUIDE_MUTATION,
  CREATE_GUIDE_SECTION_MUTATION,
} from "../api/mutations";
import {
  generateSingleSectionWithAI,
  enrichAndFormatSection,
} from "../services/aiSectionGenerationService";
import { useAIGuideQuota } from "../../../hooks/useAIGuideQuota";
import { toast } from "sonner";
import Button from "../../../components/ui/Button";
// SectionFormModal no longer used – all section editing navigates to GuideSectionFormPage
import ItineraryView from "../components/GuideDetails/ItineraryView";
import CircularTabs from "../../../components/ui/CircularTabs";
import JourneyIcon from "../../../assets/icons/JourneyIcon";
import TransportationIcon from "../../../assets/icons/TransportationIcon";
import StayIcon from "../../../assets/icons/StayIcon";
import BudgetIcon from "../../../assets/icons/BudgetIcon";
import TipsIcon from "../../../assets/icons/TipsIcon";
import BackIcon from "../../../assets/icons/BackIcon";
import GuideHeader from "../components/GuideDetails/GuideHeader";

import TipsTagsTab from "../components/GuideDetails/TipsTagsTab";
import SectionDetailModal from "../components/GuideDetails/SectionDetailModal/SectionDetailModal";
import TransportationTimeline from "../components/GuideDetails/TransportationTimeline";
import StayTimeline from "../components/GuideDetails/StayTimeline";
import BudgetTable from "../components/GuideDetails/BudgetTable";
import TipsTimeline from "../components/GuideDetails/TipsTimeline";
import GooglePlaceModal from "../../PublicHome/components/PublicGuideViews/GooglePlaceModal";
import ConfirmationModal from "../../../components/ui/ConfirmationModal";
import useAuthStore from "../../../store/store";
import { CategoryVisibilityModal } from "../../../components/CategoryVisibilityModal";

const GuideDetailsPage = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [deletingSection, setDeletingSection] = useState<string | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [activeTab, setActiveTab] = useState("journey");
  const [viewMode, setViewMode] = useState<"timeline" | "list">("list");
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedGooglePlace, setSelectedGooglePlace] = useState<{ visible: boolean; place: any }>({
    visible: false,
    place: null,
  });
  const kebabRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isMainTabsSticky, setIsMainTabsSticky] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState('256px');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mainTabsRef = useRef<HTMLDivElement>(null);
  const guideHeaderRef = useRef<HTMLDivElement>(null);

  // Check AI guide quota
  const { shouldDisableGeneration, disableReason, refetch: refetchQuota } = useAIGuideQuota();

  const { user } = useAuthStore();
  const [visibilityPrompt, setVisibilityPrompt] = useState<{
    isOpen: boolean;
    categoryName: string;
    visibilityField: string;
    defaultValue: boolean;
  } | null>(null);

  const { data: accountData, refetch: refetchAccount } = useQuery(GET_USER_ACCOUNT_QUERY, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });

  const accountDocumentId = accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  useEffect(() => {
    if (location.state?.justCreatedGuide && accountData) {
      const acc = accountData?.usersPermissionsUser?.accounts?.[0];
      const isPublic = acc?.public_guides === "Yes";
      if (!isPublic) {
        setVisibilityPrompt({
          isOpen: true,
          categoryName: "Guides",
          visibilityField: "public_guides",
          defaultValue: false,
        });
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, accountData]);

  // Get sidebar width from CSS variable
  useEffect(() => {
    const updateSidebarWidth = () => {
      const width = getComputedStyle(document.documentElement)
        .getPropertyValue('--sidebar-width')
        .trim() || '256px';
      setSidebarWidth(width);
    };

    updateSidebarWidth();

    // Watch for changes to the CSS variable
    const observer = new MutationObserver(updateSidebarWidth);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });

    // Also listen for resize events
    window.addEventListener('resize', updateSidebarWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSidebarWidth);
    };
  }, []);

  const { data, loading, error, refetch } = useQuery(GET_GUIDE_BY_ID_QUERY, {
    variables: { documentId: guideId },
    skip: !guideId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const [deleteSection] = useMutation(DELETE_GUIDE_SECTION_MUTATION, {
    refetchQueries: [
      {
        query: GET_GUIDE_BY_ID_QUERY,
        variables: { documentId: guideId },
      },
    ],
    awaitRefetchQueries: true,
  });

  const [updateGuide] = useMutation(UPDATE_GUIDE_MUTATION);

  const [_createGuideSectionMutation] = useMutation(
    CREATE_GUIDE_SECTION_MUTATION,
    {
      refetchQueries: [
        {
          query: GET_GUIDE_BY_ID_QUERY,
          variables: { documentId: guideId },
        },
      ],
      awaitRefetchQueries: true,
    }
  );

  // Refetch when returning from edit page
  useEffect(() => {
    if (location.state?.refetch) {
      refetch();
    }
  }, [location.state, refetch]);

  // Scroll detection for sticky tabs
  useEffect(() => {
    if (loading || !data?.guide) return;

    let cleanup: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout;

    const initializeScroll = () => {
      const mainTabs = mainTabsRef.current;
      const guideHeader = guideHeaderRef.current;
      
      // Find the scrollable parent container (DashboardLayout flex-1 overflow-auto)
      let scrollableParent: HTMLElement | null = null;
      if (scrollContainerRef.current) {
        let parent = scrollContainerRef.current.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll') {
            scrollableParent = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }

      if (!mainTabs || !scrollableParent) {
        timeoutId = setTimeout(initializeScroll, 100);
        return;
      }

      let ticking = false;

      const handleScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            if (!scrollableParent) return;

            // Tabs should stick when we've scrolled past the guide header banner
            // We use 0 as the threshold because the header hides itself during scroll
            if (guideHeader) {
              const guideHeaderRect = guideHeader.getBoundingClientRect();
              setIsMainTabsSticky(guideHeaderRect.top <= 0);
            }

            ticking = false;
          });
          ticking = true;
        }
      };

      scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
      
      // Initial check
      setTimeout(handleScroll, 100);

      cleanup = () => {
        if (scrollableParent) {
          scrollableParent.removeEventListener('scroll', handleScroll);
        }
      };
    };

    timeoutId = setTimeout(initializeScroll, 50);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, [loading, data?.guide]);

  /**
   * Kebab Menu Click Outside Handler
   * Closes any open kebab menu when user clicks outside the menu container
   * Uses kebabRefs to track all menu containers (timeline and list views)
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside all kebab menus and buttons
      const clickedOutside = !Object.values(kebabRefs.current).some(
        (ref) => ref && ref.contains(event.target as Node)
      );

      if (clickedOutside && openMenuId) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  if (loading) {
    return (
      <div className="dashboard-theme flex justify-center items-center min-h-screen bg-dashboard-bg">
        <EarthLoader context="general" size="small" />
      </div>
    );
  }

  if (error || !data?.guide) {
    return (
      <div className="dashboard-theme flex flex-col justify-center items-center min-h-screen bg-dashboard-bg gap-4">
        <p className="text-dashboard font-poppins text-red-500">
          Failed to load guide
        </p>
        <Button
          variant="primary"
          onClickHandler={() => navigate("/guides")}
          btnText="Back to Guides"
        />
      </div>
    );
  }

  const guide = data.guide;
  const allSections = guide.guide_sections || [];

  // Remove duplicates based on documentId (in case of cache issues)
  const sections = allSections.filter(
    (section: any, index: number, self: any[]) =>
      index === self.findIndex((s: any) => s.documentId === section.documentId)
  );

  // SEO data for guide page
  const guideTitle = guide.Title || "Travel Guide";
  
  // Convert description to string if it is Strapi rich text block format
  const guideDescriptionText = (() => {
    if (!guide.Description) return "";
    if (typeof guide.Description === "string") return guide.Description;
    if (Array.isArray(guide.Description)) {
      return guide.Description
        .map((block: any) => block.children?.map((child: any) => child.text).join(" ") || "")
        .join(" ");
    }
    return "";
  })();

  const guideType = guide.Guide_Type || "";
  const guideCategory = guide.Category || "";
  const bestTimeToVisit = guide.Best_Time_To_Visit || "";
  const sectionsCount = sections.length;
  const isItineraryBased = guideType?.toLowerCase().includes("itinerary") || sections.some((s: any) => s.Section_Type === "itinerary");

  // Extract cities from Place_Details if available
  let citiesText = "";
  if (guide.Place_Details) {
    try {
      const placeDetails = typeof guide.Place_Details === "string"
        ? JSON.parse(guide.Place_Details)
        : guide.Place_Details;
      if (placeDetails?.isMultiCity && placeDetails?.cities) {
        citiesText = placeDetails.cities.map((c: any) => c.name || c).join(", ");
      } else if (placeDetails?.city) {
        citiesText = placeDetails.city;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  const pageTitle = `${guideTitle}${citiesText ? ` - ${citiesText}` : ""} | Travel Guide | explorers`;
  const metaDescription = guideDescriptionText || `Explore ${guideTitle}, ${isItineraryBased ? "an itinerary-based" : "a"} travel guide${citiesText ? ` covering ${citiesText}` : ""}${guideCategory ? ` in ${guideCategory} category` : ""}. Discover curated travel recommendations, ${sectionsCount > 0 ? `${sectionsCount} detailed sections including ` : ""}journey plans, accommodations, transportation, budget tips${bestTimeToVisit ? `, and best time to visit: ${bestTimeToVisit}` : ""}, and local insights.`;

  const guideKeywords = [
    guideTitle,
    "travel guide",
    "itinerary guide",
    "travel recommendations",
    "explorers guide",
    "travel planning",
    "destination guide",
    ...(citiesText ? citiesText.split(", ") : []),
    ...(guideCategory ? [guideCategory, `${guideCategory} travel`] : []),
    ...(guideType ? [guideType] : []),
    ...(bestTimeToVisit ? [`best time to visit ${citiesText || ""}`.trim()] : []),
    "journey planning",
    "travel itinerary",
    "destination recommendations",
    "travel tips",
    "local travel guide",
    "curated travel guide",
    "theme-based travel",
    "city guide",
    "travel exploration"
  ].filter(Boolean);

  const handleDeleteSection = (
    sectionDocumentId: string,
    sectionTitle: string
  ) => {
    setSectionToDelete({ id: sectionDocumentId, title: sectionTitle });
  };

  const confirmDeleteSection = async () => {
    if (!sectionToDelete) return;

    setDeletingSection(sectionToDelete.id);
    try {
      await deleteSection({
        variables: {
          documentId: sectionToDelete.id,
        },
      });
      toast.success("Removed from guide!");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove. Please try again.");
    } finally {
      setDeletingSection(null);
      setSectionToDelete(null);
    }
  };


  /**
   * Generate a single AI section and open in editable form modal
   * Uses the single_day pipeline for focused content generation
   */
  const handleGenerateAISection = async () => {
    if (isGeneratingAI) return;

    // Check quota before proceeding
    if (shouldDisableGeneration) {
      toast.error(disableReason || "AI generation is currently unavailable");
      return;
    }

    // Calculate next day number
    const maxSequence =
      sections.length > 0
        ? Math.max(...sections.map((s: any) => s.Sequence || 0))
        : 0;
    const nextDayNumber = maxSequence + 1;

    setIsGeneratingAI(true);

    try {
      // Generate AI section
      const aiSection = await generateSingleSectionWithAI({
        guide: guide,
        dayNumber: nextDayNumber,
      });

      // Enrich and format for database
      const sectionData = await enrichAndFormatSection(
        aiSection,
        guide,
        guideId!
      );

      // Format as initialData for the form
      const formInitialData = {
        Title: sectionData.Title,
        Sequence: sectionData.Sequence,
        Description: sectionData.Description,
        Timeline: sectionData.Timeline,
        Map_Details: sectionData.Map_Details,
        _isAIGenerated: true,
      };

      // Navigate to the section form page with AI-generated data
      // AI sections still use the page (not modal) with the AI tip banner visible
      navigate(`/guides/${guideId}/sections/new`, {
        state: { editingSection: formInitialData },
      });

      toast.success("✨ AI content generated! Review and edit as needed, then save.");
      await refetchQuota();
    } catch (error: any) {
      const errorMessage =
        error.message || "Failed to generate section with AI. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Journey Tab Content (Itinerary)
  function renderJourneyTab() {
    return (
      <>
        <SectionDetailModal
          section={selectedSection}
          guide={guide}
          isOpen={!!selectedSection}
          onClose={() => setSelectedSection(null)}
          onEdit={(section) => {
            setSelectedSection(null);
            // Navigate to the section edit page
            navigate(`/guides/${guideId}/sections/${section.documentId}/edit`, {
              state: { editingSection: section },
            });
          }}
        />

        <ItineraryView
          sections={sections}
          guide={guide}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddSection={() =>
            navigate(`/guides/${guideId}/sections/new`)
          }
          onGenerateAISection={handleGenerateAISection}
          isGeneratingAI={isGeneratingAI}
          shouldDisableAI={shouldDisableGeneration}
          disableAIReason={disableReason}
          onSectionSelect={(section) => {
            setSelectedSection(section);
          }}
          onSectionEdit={(section) => {
            // Navigate to the section edit page
            navigate(`/guides/${guideId}/sections/${section.documentId}/edit`, {
              state: { editingSection: section },
            });
          }}
          onSectionDelete={handleDeleteSection}
          openMenuId={openMenuId}
          deletingSection={deletingSection}
          kebabRefs={kebabRefs}
          onMenuToggle={(sectionId) =>
            setOpenMenuId(openMenuId === sectionId ? null : sectionId)
          }
          onGuideUpdate={refetch}
          onPlaceClick={(place) => {
            setSelectedGooglePlace({ visible: true, place });
          }}
        />
      </>
    );
  }

  // Stay Tab Content
  function renderStayTab() {
    return (
      <StayTimeline guide={guide} />
    );
  }

  // Transportation Tab Content
  function renderTransportationTab() {
    return (
      <TransportationTimeline
        guide={guide}
      />
    );
  }

  // Budget Tab Content
  function renderBudgetTab() {
    return (
      <BudgetTable guide={guide} />
    );
  }

  return (
    <>
      <SEO
        title={pageTitle}
        description={metaDescription}
        keywords={guideKeywords}
        canonical={createCanonicalUrl(`/guides/${guideId}`)}
        type="article"
        noIndex={!guide.Visibility}
        siteName="explorers"
        author={guide.users_permissions_user?.username || guide.users_permissions_user?.email || "explorers User"}
      />
      <div ref={scrollContainerRef} className="dashboard-theme min-h-screen bg-dashboard-bg text-dashboard-light pb-20 md:pb-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Top Bar - Back Button and Visibility Toggle */}
          <div className="mb-6 flex justify-between items-center gap-4">
            {/* Back Button - Top Left */}
            <button
              onClick={() => navigate("/guides")}
              className="flex items-center gap-2 text-dashboard-light hover:text-dashboard-accent transition-colors duration-200 group"
              aria-label="Back to Guides"
            >
              <div className="p-2 rounded-lg bg-dashboard-bg hover:bg-dashboard-muted transition-colors duration-200 group-hover:scale-105">
                <BackIcon />
              </div>
              <span className="text-sm font-medium font-poppins hidden sm:inline">
                Back to Guides
              </span>
            </button>
          </div>

          {/* Guide Header Banner */}
          <div ref={guideHeaderRef} className="mb-8">
            <GuideHeader guide={guide} guideId={guideId!} onVisibilityChange={refetch} />
          </div>

          {/* Circular Tabs - Sticky when scrolled */}
          <div
            ref={mainTabsRef}
            className={`mb-8 z-40 bg-dashboard-bg border-b border-dashboard transition-all duration-200 ${isMainTabsSticky
              ? `fixed right-0 top-0`
              : 'relative'
              }`}
            style={isMainTabsSticky ? {
              left: window.innerWidth >= 768 ? sidebarWidth : '0px'
            } : undefined}
          >
            <div className={`${isMainTabsSticky ? 'container mx-auto px-0 sm:px-2 lg:px-8' : ''}`}>
              <CircularTabs
                tabs={[
                  { id: "journey", icon: <JourneyIcon />, label: "Journey" },
                  {
                    id: "transportation",
                    icon: <TransportationIcon />,
                    label: "Transport",
                  },
                  { id: "stay", icon: <StayIcon />, label: "Stay" },
                  { id: "budget", icon: <BudgetIcon />, label: "Budget" },
                  { id: "tips", icon: <TipsIcon />, label: "Tips" },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
          </div>

          {/* Spacer to prevent layout shift when tabs become sticky */}
          {isMainTabsSticky && (
            <div className="h-[120px] sm:h-[140px] md:h-[160px] lg:h-[200px] xl:h-[220px]" />
          )}

          {/* Tab Content */}
          <div className="mb-8">
            <AnimatePresence mode="wait">
              {activeTab === "journey" && (
                <motion.div
                  key="journey"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderJourneyTab()}
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
                  {renderTransportationTab()}
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
                  {renderStayTab()}
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
                  {renderBudgetTab()}
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
                  <div className="space-y-6">
                    <TipsTagsTab
                      guide={guide}
                      guideId={guideId!}
                      updateGuide={updateGuide}
                      onUpdate={refetch}
                    />
                    <TipsTimeline guide={guide} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Google Place Modal (for guide places) */}
      {selectedGooglePlace.visible && selectedGooglePlace.place && (
        <>
          <div className="fixed inset-0 bg-black md:bg-opacity-40 md:backdrop-blur-md z-[150]"></div>
          <div
            className={`fixed md:max-w-4xl md:mx-auto inset-x-0 bottom-0 top-12 z-[150] transition-transform duration-300 ease-in-out overflow-x-hidden ${selectedGooglePlace.visible ? "translate-y-0" : "translate-y-full"
              }`}
            style={{ height: "100%" }}
          >
            <GooglePlaceModal
              place={selectedGooglePlace.place}
              isOpen={selectedGooglePlace.visible}
              onClose={() => setSelectedGooglePlace({ visible: false, place: null })}
              sections={sections}
            />
          </div>
        </>
      )}

      {/* Delete Section Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!sectionToDelete}
        onClose={() => setSectionToDelete(null)}
        onConfirm={confirmDeleteSection}
        title="Delete Section"
        message={
          sectionToDelete
            ? `Are you sure you want to delete the section "${sectionToDelete.title}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        isDanger={true}
        isLoading={!!deletingSection}
      />
      {visibilityPrompt && accountDocumentId && (
        <CategoryVisibilityModal
          isOpen={visibilityPrompt.isOpen}
          onClose={() => setVisibilityPrompt(null)}
          categoryName={visibilityPrompt.categoryName}
          visibilityField={visibilityPrompt.visibilityField}
          accountDocumentId={accountDocumentId}
          onSuccess={() => {
            refetchAccount();
          }}
        />
      )}
    </>
  );

};

export default GuideDetailsPage;
