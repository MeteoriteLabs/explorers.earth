import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Tab from "../components/ui/Tab";
import Recommendations from "../features/Favorites/components/Recommendations";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { AddIcon } from "../assets/icons/AddIcon";
import LinksAndQR from "../features/Favorites/components/LinksAndQR";
import AddLocationModal from "../components/ui/AddLocationModal";
import { Plus } from "lucide-react";
import { useMutation, useQuery } from "@apollo/client";
import { toast } from "sonner";
import {
  accountDataQuery,
  recommendationListQuery,
} from "../features/Favorites/api/query";
import { EarthLoader } from "../components/EarthLoader";
import { useCreateLocation } from "../features/Favorites/hooks/useCreateLocation";
import { useMenuItems } from "../features/Favorites/hooks/useMenuItems";
import { KeyValuePair } from "../features/Favorites/components/RecommendForm";
import { updateRecommendedListMutation, updateAccountVisibility } from "../features/Favorites/api/mutation";
import SwitchButton from "../components/ui/SwitchButton";
import useAuthStore from "../store/store";
import { useCityStore } from "../store/useCityStore";
import axios from "axios";
import { GOOGLE_PLACES_API_BASE_URL } from "../config";
import { motion } from "framer-motion";
import CircularPlacesModal from "../components/CircularPlacesModal";
import WorldIcon from "../assets/icons/WorldIcon";
import { useNavigate, useLocation } from "react-router-dom";
import SEO from "../components/SEO";
import ImageWithFallback from "../components/ui/ImageWithFallback";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { useRecommendationsWalkthrough } from "../hooks/useRecommendationsWalkthrough";
import Joyride from "react-joyride";
import useSetupStore from "../store/useSetupStore";
import { calculateIsRecommendationsComplete } from "../utils/setupStatusCalculations";


export interface Recommendation {
  title: string;
  image: string;
  rating: number;
  reviews: number;
}

export interface City {
  imageUrl: string;
  alt: string;
  recommendations: Recommendation[];
}

export interface selectedCity {
  account?: {
    documentId: string;
  };
  slug?: string;
  List_Name?: string;
  documentId?: string;
  Visibility?: boolean;
  createdAt?: string;
  List_Name_Details?: {
    note?: string;
  };
  Instagram_Media_URL?: string;
  recommended_places?: {
    documentId: string;
  }[];
  recommendations?: Recommendation[];
}

const Favorites = memo(() => {
  const { t } = useTranslation();
  const { selectedCity, setSelectedCity } = useCityStore();
  const [showAllPlaces, setShowAllPlaces] = useState<boolean>(false);
  // local state for handling modal
  const [isLocationModalOpen, setIsLocationModalOpen] =
    useState<boolean>(false);
  // local state for handling active tab
  const [activeTab, setActiveTab] = useState<string>(
    t("dashboard.recommendations.recommendationsTab")
  );
  // fetching the user details from the global state
  const { user } = useAuthStore();
  // Check if profile setup is complete
  const { isProfileComplete, isRecommendationsComplete, setSetupStatus } = useSetupStore();
  // account data by Id
  const { data: accountById } = useQuery(accountDataQuery, {
    variables: {
      documentId: user?.documentId,
    },
    skip: !user?.documentId,
  });

  const cityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  // local state for handling edit state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const navigate = useNavigate();
  // local state for handling the confirm delete modal
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] =
    useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] =
    useState<string>("");
  // local state for handling the loading state for adding the list name
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // fetching the cities data from the query
  const {
    data: cities,
    loading,
    refetch: refetchCities,
  } = useQuery(recommendationListQuery, {
    variables: {
      filters: {
        account: {
          documentId: {
            eq: accountById?.usersPermissionsUser?.accounts?.[0]?.documentId,
          },
        },
      },
    },
    skip: !accountById?.usersPermissionsUser?.accounts?.[0]?.documentId,
    fetchPolicy: "network-only",
  });

  // // local state for handling current list displayed on the carousel
  // const [selectedCity, setSelectedCity] = useState<selectedCity>(
  //   recommendationLists// );

  // mutation for updating the recommended list
  const [updateRecommendedList] = useMutation(updateRecommendedListMutation, {
    refetchQueries: [recommendationListQuery],
    fetchPolicy: "network-only",
  });

  const [updateVisibility] = useMutation(updateAccountVisibility);

  const handleVisibilityToggle = async () => {
    const accountData = accountById?.usersPermissionsUser?.accounts?.[0];
    if (!accountData?.documentId) return;

    const currentValue = accountData.public_recommendations;
    const newValue = currentValue === "Yes" ? "No" : "Yes";

    try {
      await updateVisibility({
        variables: {
          documentId: accountData.documentId,
          data: { public_recommendations: newValue }
        },
        optimisticResponse: {
          updateAccount: {
            __typename: 'Account',
            documentId: accountData.documentId,
            public_recommendations: newValue
          }
        },
        refetchQueries: [{ query: accountDataQuery, variables: { documentId: user?.documentId } }]
      });
      toast.success(`Public visibility updated to ${newValue === "Yes" ? "Public" : "Private"}`);
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error("Failed to update visibility");
    }
  };

  useEffect(() => {
    if (selectedCity?.documentId) {
      setTimeout(() => {
        const selectedRef = cityRefs.current[selectedCity.documentId ?? ""];
        if (selectedRef) {
          selectedRef.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }
      }, 100);
    }
  }, [selectedCity]);

  // Sync setup status with store
  const currentIsRecommendationsComplete = useMemo(() => {
    return calculateIsRecommendationsComplete(cities?.recommendationLists);
  }, [cities]);

  useEffect(() => {
    // Only update if we have data and it's different from store
    if (cities?.recommendationLists && currentIsRecommendationsComplete !== isRecommendationsComplete) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Syncing recommendations completion status:', currentIsRecommendationsComplete);
      }
      setSetupStatus(isProfileComplete, currentIsRecommendationsComplete);
    }
  }, [currentIsRecommendationsComplete, isRecommendationsComplete, isProfileComplete, setSetupStatus, cities]);


  // Track route changes for better modal detection
  const location = useLocation();

  // Track if place modal/page is open (when navigating to /new route)
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);

  // Prepare recommendations data for walkthrough
  const recommendationsData = useMemo(() => {
    const hasPlaces = selectedCity?.recommended_places && selectedCity.recommended_places.length > 0;
    const isPublished = selectedCity?.Visibility === true;

    return {
      hasPlaces,
      isPublished,
    };
  }, [selectedCity]);

  // Initialize walkthrough hook
  const {
    run,
    steps,
    stepIndex,
    setRun,
    setStepIndex,
    handleJoyrideCallback,
    advanceToNextStep,
    markProcessingComplete,
    isWalkthroughComplete,
  } = useRecommendationsWalkthrough(
    recommendationsData,
    isPlaceModalOpen,
    (tabName: string) => {
      setActiveTab(tabName);
      if (tabName === t("dashboard.recommendations.manageTab")) {
        refetchCities();
      }
    },
    t("dashboard.recommendations.manageTab")
  );

  // Expose walkthrough control globally for other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__walkthrough = {
        advanceToNextStepRef: { current: advanceToNextStep },
        markProcessingCompleteRef: markProcessingComplete,
      };
      return () => {
        delete (window as any).__walkthrough;
      };
    }
  }, [advanceToNextStep, markProcessingComplete]);

  // Resume walkthrough after Manage tab navigation (actual-action flow only)
  useEffect(() => {
    // Only run when Manage tab becomes active
    if (activeTab !== t("dashboard.recommendations.manageTab")) {
      return;
    }

    // Check if walkthrough was paused at step 4 (index 3) or ready for step 5 (index 4)
    // This happens when user clicks Manage tab - advanceToNextStep sets stepIndex to 4 and pauses
    const savedStep = sessionStorage.getItem('recommendationStep');
    const isPausedAtStep4Or5 = (stepIndex === 3 || stepIndex === 4) && !run && !isWalkthroughComplete;
    const savedStepIndicatesStep4 = savedStep === '3' || savedStep === '4';

    if (isPausedAtStep4Or5 && savedStepIndicatesStep4) {
      console.log("🔄 Detected Manage tab active with paused walkthrough - resuming to step 5");

      // Helper to get completed steps
      const getCompletedSteps = (): number[] => {
        try {
          const completed = sessionStorage.getItem('recommendationCompletedSteps');
          if (completed) {
            const parsed = JSON.parse(completed);
            return Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === 'number' && !isNaN(s)) : [];
          }
        } catch (e) {
          console.warn('Failed to parse completed steps:', e);
        }
        return [];
      };

      // Helper to save completed steps
      const saveCompletedSteps = (completedSteps: number[]): void => {
        try {
          sessionStorage.setItem('recommendationCompletedSteps', JSON.stringify(completedSteps));
          console.log('💾 Saved completed steps:', completedSteps);
        } catch (e) {
          console.warn('Failed to save completed steps:', e);
        }
      };

      // Helper to find first incomplete step
      const findFirstIncompleteStep = (): number => {
        const completedSteps = getCompletedSteps();
        const firstIncomplete = steps.findIndex((_, index) => !completedSteps.includes(index));
        return firstIncomplete !== -1 ? firstIncomplete : steps.length;
      };

      // Mark step 4 (index 3) as completed if not already marked
      const completedSteps = getCompletedSteps();
      if (!completedSteps.includes(3)) {
        completedSteps.push(3);
        saveCompletedSteps(completedSteps);
        console.log('✅ Marked step 4 as completed');
      }

      // Find next incomplete step (should be step 5, index 4)
      const nextStep = findFirstIncompleteStep();
      console.log(`➡️ Next incomplete step: ${nextStep}`);

      if (nextStep < steps.length && nextStep === 4) {
        // Resume walkthrough at step 5 (index 4)
        setStepIndex(4);
        sessionStorage.setItem('recommendationStep', '4');
        console.log(`▶️ Resuming walkthrough at step 5 (index 4) - adding 2s delay for real-action mode`);

        // Add 2-second delay for real-action Step 5 tooltip (preview mode unaffected)
        setTimeout(() => {
          setRun(true);
        }, 2000);
      } else if (nextStep >= steps.length) {
        console.log('🎉 All steps completed');
      } else {
        console.log(`⚠️ Unexpected next step: ${nextStep}, expected 4`);
      }
    }
  }, [activeTab, stepIndex, run, isWalkthroughComplete, steps, setStepIndex, setRun, t]);

  // custom hook for handling the carousel menu logic (after walkthrough hook to access advanceToNextStep)
  const { handleDeleteRecommendedList } = useMenuItems({
    refetchCities,
    setShowConfirmDeleteModal,
    advanceToNextStep,
  });

  // a custom hook to create the recommendation link (City)
  const { handleLocationSubmit, accountData } = useCreateLocation({
    setIsLocationModalOpen,
    refetchCities,
    setIsLoading,
    cities,
  });

  useEffect(() => {
    // Set the default city when data is available
    if (cities?.recommendationLists?.length && !selectedCity) {
      setSelectedCity(cities?.recommendationLists?.[0]);
    }
  }, [
    cities,
    selectedCity,
    handleLocationSubmit,
    refetchCities,
    setSelectedCity,
  ]);

  // filtering the cities based on the account documentId
  const filteredCities = useMemo(() => {
    // Since we're already sorting in the GraphQL query with sort: ["createdAt:asc"],
    // we just need to filter without changing the order
    return (
      cities?.recommendationLists?.filter(
        (item: selectedCity) =>
          item.account?.documentId === accountData?.documentId
      ) || []
    );
  }, [cities, accountData?.documentId]);

  // Track route changes for better modal detection - AFTER walkthrough hook initialization
  useEffect(() => {
    const isOnAddPlaceRoute = location.pathname.includes('/new');
    const wasOnAddPlaceRoute = isPlaceModalOpen;
    setIsPlaceModalOpen(isOnAddPlaceRoute);

    // Save stepIndex to sessionStorage when navigating TO /new route (pausing)
    if (isOnAddPlaceRoute && !wasOnAddPlaceRoute && run && stepIndex >= 0) {
      console.log(`💾 Saving walkthrough state before route change: step ${stepIndex}`);
      sessionStorage.setItem('recommendations_walkthrough_step_index', String(stepIndex));
    }

    // Restore walkthrough when returning FROM /new route (resuming)
    // CRITICAL: Don't restore if profile setup is already complete
    if (!isOnAddPlaceRoute && wasOnAddPlaceRoute && !run && !isWalkthroughComplete) {
      // Check if profile setup is complete - if so, don't restore walkthrough
      if (isProfileComplete && isRecommendationsComplete) {
        console.log('⏭️ Skipping walkthrough restore - profile setup is already complete');
        // Clear any saved walkthrough state
        sessionStorage.removeItem('recommendations_walkthrough_step_index');
        return;
      }

      const savedStepIndex = sessionStorage.getItem('recommendations_walkthrough_step_index');
      if (savedStepIndex !== null) {
        const index = parseInt(savedStepIndex, 10);
        if (!isNaN(index) && index >= 0 && index < steps.length) {
          console.log(`🔄 Restoring walkthrough after route change: step ${index}`);
          setTimeout(() => {
            setStepIndex(index);
            setRun(true);
          }, 500);
        }
      }
    }
  }, [location.pathname, run, stepIndex, steps.length, isWalkthroughComplete, isPlaceModalOpen, setStepIndex, setRun, isProfileComplete, isRecommendationsComplete]);

  // Debug logging for walkthrough state
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Recommendations Walkthrough Debug:', {
        run,
        stepsCount: steps.length,
        stepIndex,
        recommendationsData,
        steps: steps.map(s => ({
          target: s.target,
          content: typeof s.content === 'string' ? s.content.substring(0, 50) : String(s.content || '').substring(0, 50)
        })),
      });
    }
  }, [run, steps, stepIndex, recommendationsData]);
  // NEW useEffect #1: Auto-advance after place is added
  // CRITICAL: Detect when place count increases (place was added)
  // This effect watches for changes in selectedCity.recommended_places to detect new place additions


  // Note: Auto-advancement is handled by useRecommendationsWalkthrough hook
  // No need for duplicate logic here
  // MANUAL RESURRECTION: Auto-resume walkthrough after place is added - Step 1 to Step 2 (INSTANTANEOUS)

  // Auto-advance after publish toggle - Step 3 to Step 4 (INSTANTANEOUS)

  const handleCitySelect = (index: {
    List_Name?: string;
    imageUrl: string;
    documentId?: string;
  }) => {
    setSelectedCity(index);
  };

  const handleConfirmDeleteModal = () => {
    setShowConfirmDeleteModal(true);
    setDeleteConfirmationText("");
  };

  // tabs with data
  const tabs = {
    [t("dashboard.recommendations.recommendationsTab")]: <Recommendations refetchCities={refetchCities} />,
    [t("dashboard.recommendations.manageTab")]: (
      <LinksAndQR
        refetchCities={refetchCities}
        setIsEditing={setIsEditing}
        setShowConfirmDeleteModal={setShowConfirmDeleteModal}
        setIsLocationModalOpen={setIsLocationModalOpen}
        handleConfirmDeleteModal={handleConfirmDeleteModal}
      />
    ),
  };

  const handleUpdateRecommendedList = async (values: KeyValuePair) => {
    if (
      values.placeUrl !== selectedCity?.slug &&
      cities?.account?.recommendation_lists.some(
        (list: { slug: string }) => list.slug === values.placeUrl
      )
    ) {
      toast.error(t("toast.error.conflictError"));
      return;
    }

    // Skip Google Places API call when editing since we're only updating social link and notes
    let photoUrl = selectedCity?.List_Name_Details?.thumbnail || "";

    // Only fetch place details if we have a placeId (for new locations)
    if (values.placeId) {
      const placeDetails = await axios.get(
        `${GOOGLE_PLACES_API_BASE_URL}/${values.placeId
        }?fields=id,displayName,primaryType,primaryTypeDisplayName,priceRange,rating,userRatingCount,photos&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        }`
      );

      const photoReferences = placeDetails.data.photos.map(
        (photo: { name: string }) => photo.name.split(`${values.placeId}/`)[1]
      );

      const response = await fetch(
        `${GOOGLE_PLACES_API_BASE_URL}/${values.placeId}/${photoReferences[0]
        }/media?maxWidthPx=400&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`,
        { redirect: "follow" }
      );
      photoUrl = response.url;
    }

    try {
      // Preserve existing place_id from List_Name_Details or use new one if provided
      let existingPlaceId = null;
      if (selectedCity?.List_Name_Details) {
        try {
          const details = typeof selectedCity.List_Name_Details === 'string'
            ? JSON.parse(selectedCity.List_Name_Details)
            : selectedCity.List_Name_Details;
          existingPlaceId = (details as any)?.place_id || null;
        } catch (e) {
          existingPlaceId = (selectedCity.List_Name_Details as any)?.place_id || null;
        }
      }
      const placeIdToStore = values.placeId || existingPlaceId;

      const response = await updateRecommendedList({
        variables: {
          documentId: selectedCity?.documentId,
          data: {
            Instagram_Media_URL: values.recommendationSocialLink,
            List_Name: values.listName,
            List_Name_Details: {
              note: values.note,
              thumbnail: photoUrl,
              place_id: placeIdToStore, // Preserve or update place_id
            },
            slug: values.placeUrl,
          },
        },
      });

      if (response.data) {
        // Show success toast first
        toast.success(t("toast.success.recommendedListUpdated"));

        // Update selectedCity immediately with the response data to ensure UI reflects changes
        if (response.data.updateRecommendationList) {
          const updatedData = response.data.updateRecommendationList;
          setSelectedCity({
            ...selectedCity,
            List_Name: updatedData.List_Name,
            Instagram_Media_URL: updatedData.Instagram_Media_URL,
            List_Name_Details: updatedData.List_Name_Details,
            slug: updatedData.slug,
            Visibility: updatedData.Visibility,
          });
        }

        // get the refetched data to ensure cache is updated
        await refetchCities();

        // Close modal after updating state
        setTimeout(() => {
          setIsEditing(false);
          setIsLocationModalOpen(false);
        }, 100); // Small delay to ensure toast is visible
      }
    } catch (error) {
      toast.error(t("toast.error.recommendedListUpdateFailed"));
      setIsEditing(false);
      setIsLocationModalOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dashboard-bg">
        <EarthLoader context="recommendations" size="small" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="My Recommendations - Manage & Share explorers Favorites"
        description="Manage your local recommendations and favorite places with explorers. Create, edit and share personalized QR code lists to connect with your community and discover new spots."
        keywords={[
          "manage local recommendations",
          "explorers favorites",
          "recommendations dashboard",
          "QR code recommendation lists",
          "favorite places management",
          "share local places",
          "personalized location lists",
          "curated recommendations",
          "local places organizer",
          "location-based recommendations",
          "travel recommendations management",
          "user-generated recommendations",
          "share QR code lists",
          "discover favorite spots",
          t("dashboard.recommendations.seo.keywords.recommendationManagementDashboard"),
          t("dashboard.recommendations.seo.keywords.recommendationsManagement"),
          t("dashboard.recommendations.seo.keywords.manageRecommendations"),
          t("dashboard.recommendations.seo.keywords.favoritePlaces"),
          t("dashboard.recommendations.seo.keywords.recommendationDashboard"),
          t("dashboard.recommendations.seo.keywords.localRecommendations"),
          t("dashboard.recommendations.seo.keywords.locationLists"),
        ]}
        canonical={createCanonicalUrl("/recommendations")}
        type="website"
        noIndex={true}
      />

      <div className="bg-dashboard-bg">
        <div className="bg-dashboard-bg min-h-screen max-w-6xl mx-auto px-4 pt-0 md:pt-4 pb-4">
          {(loading || !accountById) ? (
            <div className="flex items-center justify-center min-h-screen">
              <EarthLoader context="recommendations" size="small" />
            </div>
          ) : (
            <>
              {filteredCities.length > 0 ? (
                <>
                  {/* Section 1: Top Row with Add Button and Visibility Toggle */}
                  <div className="pt-2 px-2 md:px-0">
                    <div className="flex items-center justify-between bg-dashboard-sidebar/40 px-3 py-3 rounded-2xl mb-2">
                      <div className="flex flex-col items-start gap-1.5 bg-dashboard-muted/50 px-3 py-2 rounded-xl">
                        <span className="text-[10px] md:text-xs font-bold text-white leading-tight whitespace-nowrap">Public Visibility</span>
                        <SwitchButton
                          isChecked={accountById?.usersPermissionsUser?.accounts?.[0]?.public_recommendations === "Yes"}
                          onChange={handleVisibilityToggle}
                          variant="blue"
                        />
                      </div>

                      <button
                        onClick={() => setIsLocationModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-all shadow-lg shadow-blue-900/30"
                      >
                         <Plus size={18} />
                         <span>{t("dashboard.recommendations.locationButton")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Recommendation List - Becomes sticky at top on mobile only */}
                  <div className="md:static sticky top-0 p-2 z-30 bg-dashboard-bg">
                    <div className="flex items-center pl-0 pr-2 md:px-4">
                      {/* Scrollable Cities Container - Only cities scroll */}
                      <motion.div
                        className="overflow-x-auto whitespace-nowrap flex gap-7 md:gap-14 flex-1 pt-4 pb-4 pl-4 pr-4"
                        style={{ scrollbarWidth: "none", overflowY: "hidden" }}
                        initial={{ x: 0 }}
                        animate={{ x: [0, -40, 0] }}
                        transition={{
                          delay: 1.5,
                          duration: 1.2,
                          ease: "easeInOut",
                          times: [0, 0.5, 1]
                        }}
                      >
                        {filteredCities?.map(
                          (
                            city: {
                              List_Name?: string;
                              List_Name_Details?: {
                                thumbnail?: string;
                              };
                              Visibility: boolean;
                              imageUrl: string;
                              documentId?: string;
                            },
                            index: number
                          ) => (
                            <motion.div
                              key={city.documentId || index}
                              ref={(el) =>
                                (cityRefs.current[city.documentId || ""] = el)
                              }
                              className="flex flex-col flex-shrink-0 items-center justify-center cursor-pointer"
                              onClick={() => handleCitySelect(city)}
                              whileHover={{ scale: 1.1 }}
                              animate={{
                                y:
                                  selectedCity?.documentId === city.documentId
                                    ? -15
                                    : 0,
                              }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              <ImageWithFallback
                                referrerPolicy="no-referrer"
                                src={city?.List_Name_Details?.thumbnail}
                                alt={city.List_Name || ""}
                                className={`w-14 p-[0.1rem] h-14 md:w-20 md:h-20 rounded-full aspect-square object-cover ${selectedCity?.documentId === city.documentId
                                  ? city.Visibility
                                    ? "border-[hsl(var(--status-published))] border-[3px]"
                                    : "border-[hsl(var(--status-draft))] border-[3px]"
                                  : ""
                                  }`}
                              />
                              <p
                                className={`text-[11px] md:text-sm text-white font-poppins mt-2 ${selectedCity?.documentId === city.documentId
                                  ? "text-center font-semibold"
                                  : "truncate w-20 text-center opacity-70"
                                  }`}
                              >
                                {city.List_Name}
                              </p>
                              {city?.Visibility === false &&
                                selectedCity?.documentId === city.documentId && (
                                  <span className="font-poppins text-[9px] md:text-xs text-[hsl(var(--blue-cta))] bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 rounded-2xl px-2 py-1 mt-1">
                                    {t("dashboard.recommendations.draftLabel")}
                                  </span>
                                )}
                            </motion.div>
                          )
                        )}
                      </motion.div>
                    </div>
                    <div className="flex items-center justify-end w-full px-4 pt-1 pb-1 md:pt-0 md:pb-2 relative z-40">
                      <button
                        className="text-white/60 font-poppins text-[10px] md:text-sm transition-all duration-300 flex items-center justify-center gap-2 font-normal md:font-medium hover:text-white px-1 relative z-50 pointer-events-auto"
                        onClick={() => setShowAllPlaces(true)}
                      >
                        {t("dashboard.recommendations.viewAll")}
                      </button>
                    </div>
                  </div>

                  {/* CircularPlacesModal - Moved outside sticky container */}
                  {showAllPlaces && (
                    <CircularPlacesModal
                      handleCitySelect={handleCitySelect}
                      isOpen={showAllPlaces}
                      onClose={() => setShowAllPlaces(false)}
                      places={filteredCities}
                    />
                  )}

                  {/* Section 3: Tab Content - Scrolls normally underneath sticky header */}
                  <div className="flex mx-auto items-center justify-center mt-2 md:mt-6">
                    <Tab
                      tabs={tabs}
                      activeTab={activeTab}
                      onTabChange={(tabName) => {
                        setActiveTab(tabName);
                        // Refresh data when switching to Manage tab to ensure latest publish status
                        if (
                          tabName === t("dashboard.recommendations.manageTab")
                        ) {
                          refetchCities();
                        }
                      }}
                      data-walkthrough="manage-tab"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center  justify-center min-h-screen overflow-hidden text-center md:gap-10">
                  <WorldIcon height="100" width="100" />
                  <div className="text-center flex flex-col items-center justify-center gap-2">
                    <h1 className="text-white font-poppins md:text-md">
                      {t("dashboard.recommendations.noRecommendationsYet")}
                    </h1>
                    <p className="w-3/4 font-poppins text-white md:text-md">
                      {!accountData?.documentId
                        ? t("dashboard.recommendations.setupProfileBeforeRecommendations")
                        : t("dashboard.recommendations.startAddingPlaces")}
                    </p>
                    {!accountData?.documentId ? (
                      <Button
                        btnText={t("dashboard.recommendations.profileButton")}
                        variant="primary"
                        size="small"
                        startIcon={<AddIcon size="5" />}
                        onClickHandler={() => navigate("/profile")}
                      />
                    ) : (
                      <Button
                        btnText={t("dashboard.recommendations.startRecommending")}
                        variant="primary"
                        size="small"
                        startIcon={<AddIcon size="5" />}
                        onClickHandler={() => setIsLocationModalOpen(true)}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {showConfirmDeleteModal && (
          <Modal
            isOpen={showConfirmDeleteModal}
            onClose={() => {
              setShowConfirmDeleteModal(false);
              setDeleteConfirmationText("");
            }}
          >
            <div className="dashboard-theme p-6">
              <h2 className="dt-heading mb-4">{t("dashboard.recommendations.confirmDeletion")}</h2>
              <p className="dt-text mb-2">
                {t("dashboard.recommendations.deleteListConfirmation")}{" "}
                <b className="text-dashboard-danger">
                  {selectedCity?.recommended_places?.length}
                </b>{" "}
                {t("dashboard.recommendations.deleteListConfirmationPlaces")}
              </p>
              <p className="dt-text mb-4">
                {t("dashboard.recommendations.deleteListConfirmationType")}{" "}
                <span className="text-dashboard-danger font-semibold">
                  {t("dashboard.recommendations.deleteListConfirmationDelete")}
                </span>{" "}
                {t("dashboard.recommendations.deleteListConfirmationBelow")}
              </p>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder={t("dashboard.recommendations.typeDeleteToConfirm")}
                className="w-full dt-input mb-6"
              />
              <div className="flex justify-end gap-3">
                <Button
                  btnText={t("dashboard.recommendations.cancel")}
                  onClickHandler={() => {
                    setShowConfirmDeleteModal(false);
                    setDeleteConfirmationText("");
                  }}
                  size="small"
                  variant="google"
                />
                <Button
                  btnText={t("dashboard.recommendations.confirm")}
                  onClickHandler={() => {
                    if (deleteConfirmationText.toLowerCase() === "delete") {
                      handleDeleteRecommendedList();
                      setDeleteConfirmationText("");
                    }
                  }}
                  size="small"
                  variant="danger"
                  disabled={deleteConfirmationText.toLowerCase() !== "delete"}
                />
              </div>
            </div>
          </Modal>
        )}
        <AddLocationModal
          isOpen={isLocationModalOpen}
          onClose={() => {
            setIsLocationModalOpen(false);
            setIsEditing(false);
          }}
          onSubmit={
            isEditing ? handleUpdateRecommendedList : handleLocationSubmit
          }
          isEditing={isEditing}
          initialValues={
            isEditing
              ? {
                listName: selectedCity?.List_Name || "",
                recommendationSocialLink:
                  selectedCity?.Instagram_Media_URL || "",
                note: selectedCity?.List_Name_Details?.note || "",
                placeUrl: selectedCity?.slug || "",
                placeId: (() => {
                  // Extract place_id from List_Name_Details
                  if (selectedCity?.List_Name_Details) {
                    try {
                      const details = typeof selectedCity.List_Name_Details === 'string'
                        ? JSON.parse(selectedCity.List_Name_Details)
                        : selectedCity.List_Name_Details;
                      return (details as any)?.place_id || null;
                    } catch (e) {
                      return (selectedCity.List_Name_Details as any)?.place_id || null;
                    }
                  }
                  return null;
                })(),
              }
              : {}
          }
          existingPlaces={cities?.recommendationLists || []}
        />

        {/* ⭐ Walkthrough Joyride Component - Moved here so it persists across tab switches */}
        <style>{`
          .react-joyride__tooltip,
          .react-joyride__tooltip > div {
            background-color: rgba(29, 42, 32, 0.98) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
          }
          .react-joyride__tooltip button[data-action="next"],
          .react-joyride__tooltip button[data-action="primary"],
          .react-joyride__tooltip button[data-action="last"] {
            background-color: var(--dash-accent) !important;
            background: #3498DB !important;
            border-radius: 10px !important;
            border: none !important;
            color: white !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            padding: 10px 20px !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 20px rgba(52, 152, 219, 0.5) !important;
            outline: none !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
            display: inline-block !important;
          }
          .react-joyride__tooltip button[data-action="next"]:hover,
          .react-joyride__tooltip button[data-action="primary"]:hover,
          .react-joyride__tooltip button[data-action="last"]:hover {
            background-color: #2980B9 !important;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 25px rgba(52, 152, 219, 0.6) !important;
            transform: translateY(-1px) !important;
          }
        `}</style>
        <Joyride
          run={run}
          steps={steps}
          stepIndex={stepIndex}
          callback={handleJoyrideCallback}
          key={`joyride-${stepIndex}-${run}`}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          spotlightClicks={true}
          disableOverlay={false}
          scrollToFirstStep={true}
          locale={{
            last: "Finish",
          }}
          styles={{
            options: {
              zIndex: 99999,
              primaryColor: "var(--dash-accent)",
              backgroundColor: "transparent",
              textColor: "white",
            },
            tooltip: {
              backgroundColor: "rgba(29, 42, 32, 0.98) !important",
              backdropFilter: "blur(12px) !important",
              WebkitBackdropFilter: "blur(12px) !important",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 6px 25px rgba(0,0,0,0.55)",
              padding: "20px",
              color: "white",
              maxWidth: "320px",
              width: "auto",
              minWidth: "200px",
            },
            tooltipContainer: {
              backgroundColor: "rgba(29, 42, 32, 0.98) !important",
              backdropFilter: "blur(12px) !important",
              WebkitBackdropFilter: "blur(12px) !important",
              color: "white",
            },
            tooltipContent: {
              backgroundColor: "transparent !important",
              color: "white",
              padding: "0",
              paddingBottom: "10px",
            },
            buttonNext: {
              backgroundColor: "#3498DB !important",
              borderRadius: "10px !important",
              border: "none !important",
              color: "white !important",
              fontSize: "14px !important",
              fontWeight: "600 !important",
              padding: "10px 20px !important",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3), 0 0 20px rgba(52, 152, 219, 0.5) !important",
              outline: "none !important",
              transition: "all 0.2s ease !important",
              cursor: "pointer !important",
              display: "inline-block !important",
            },
            buttonBack: {
              color: "white",
              fontSize: "14px",
              marginRight: "10px",
            },
            buttonSkip: {
              color: "rgba(255,255,255,0.7)",
              fontSize: "14px",
            },
            buttonClose: {
              display: "none",
            },
          }}
          disableScrolling={false}
          spotlightPadding={5}
          floaterProps={{
            disableAnimation: false,
            styles: {
              floater: {
                maxWidth: '300px',
              },
            },
          }}
        />
      </div>
    </>
  );
});

export default Favorites;
