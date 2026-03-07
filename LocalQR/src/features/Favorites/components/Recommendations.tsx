

import {
  FC,
  memo,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import Button from "../../../components/ui/Button";
import { AddIcon } from "../../../assets/icons/AddIcon";
import Card from "../../../components/ui/Card";
import { useMutation, useQuery } from "@apollo/client";
import { toast } from "sonner";
import {
  recommendedPlacesQuery,
  allRecommendedPlacesQuery,
  recommendationListQuery,
} from "../api/query";
import { useNavigate } from "react-router-dom";
import DeleteIcon from "../../../assets/icons/DeleteIcon";
import Modal from "../../../components/ui/Modal";
import {
  deleteRecommendedPlaceMutation,
  updateRecommendationListVisiblity,
} from "../api/mutation";
import { EarthLoader } from "../../../components/EarthLoader";
import RecommendationCardSkeleton from "../../../components/ui/RecommendationCardSkeleton";
import PlaceOverview from "../../PublicHome/components/PlaceDetails/PlaceOverview";
import PersonOverview from "../../PublicHome/components/PlaceDetails/PersonOverview";
import EditIcon from "../../../assets/icons/EditIcon";
import axios from "axios";
import useAuthStore from "../../../store/store";
import { useCityStore } from "../../../store/useCityStore";
import useSetupStore from "../../../store/useSetupStore";
import TopPlacesByCategory from "./TopPlacesByCategory";
import { motion, AnimatePresence } from "framer-motion";
import SwitchButton from "../../../components/ui/SwitchButton";
import { useMenuItems } from "../hooks/useMenuItems";
// ⭐ Walkthrough Hook
import { useRecommendationsWalkthrough } from "../../../hooks/useRecommendationsWalkthrough";
import InstagramPostImport from "./InstagramPostImport";
import AddPlaceOverlay from "./AddPlaceOverlay";
import { IMAGE_CONFIG } from "../../../config";

// ⭐ TS declaration for window.__walkthrough
declare global {
  interface Window {
    __walkthrough?: {
      advanceToNextStepRef?: { current: (() => void) | null };
      markProcessingCompleteRef?: () => void;
    };
  }
}


// type interface for Recommendations
interface Recommendation {
  title: string;
  image: string;
  rating: number;
  reviews: number;
}

// type interface for Selected city (Recommendation List)
export interface SelectedCity {
  documentId?: string;
  List_name?: string;
  recommendations?: Recommendation[] | undefined;
}

// type for categories
type RecommendedPlaceCategory = {
  Place_Details: { Place_Name: string; Place_Id: string };
  recommendation_category: { Category_Name: string };
  documentId?: string;
};

// Helper function to get person image with avatar fallback
const getPersonImageUrl = (data: any): string => {
  const imageUrl = data?.media_details?.thumbnail?.url || data?.media_details?.imageDetails?.[0]?.url;
  if (imageUrl) return imageUrl;

  // Return data URL for inline SVG avatar
  const svgString = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="400" fill="#1a1a1a"/><circle cx="200" cy="160" r="70" fill="#2a2a2a"/><circle cx="200" cy="160" r="50" fill="#3a3a3a"/><ellipse cx="200" cy="320" rx="100" ry="80" fill="#3a3a3a"/><circle cx="200" cy="200" r="120" fill="none" stroke="#2a2a2a" stroke-width="2" opacity="0.3"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

// type for card data utems
type CardDataItem = {
  Media?: {
    url?: string;
  }[];
  media_details: {
    scalarId: string;
    thumbnail: {
      id?: string;
      url?: string;
    };
    imageDetails: {
      id: string;
      url: string;
    }[];
  };
  Place_Details?: {
    Photos: string[];
    Place_Address: string;
    Place_Id: string;
    Place_Name: string;
    Rating: number;
    Rating_Count: number;
    Title: string;
  };
  Recommendation_Type?: "place" | "person";
  Contact_Name?: string;
  documentId: string;
};

interface RecommendationsProps {
  refetchCities?: () => Promise<any>;
}

const Recommendations: FC<RecommendationsProps> = memo(({ refetchCities }) => {
  const { t } = useTranslation();
  const { selectedCity, setSelectedCity } = useCityStore();
  const navigate = useNavigate();
  const { isProfileComplete, isRecommendationsComplete } = useSetupStore();
  // local state for handling loading state of deleting recommended places
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  // local state for handling the place details modal
  const [isExpanded, setIsExpanded] = useState<{
    visible: boolean;
    documentId: string | null;
  }>({
    visible: false,
    documentId: null,
  });
  // local state for handling delete recommended Place
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  // mutatio for deleting recommendedPlace (reminder: segregate this logic to reduce the complexity)
  const [deleteRecommendedPlace] = useMutation(deleteRecommendedPlaceMutation);
  const [updateRecommendationListVisibility] = useMutation(
    updateRecommendationListVisiblity,
    {
      refetchQueries: [recommendationListQuery],
      fetchPolicy: "network-only",
    }
  );
  // local state for handle catgeories
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  // local state for handling the deleting of place
  const [deletedPlaceId, setDeletedPlaceId] = useState<string>("");
  // local state for handling the imagesId
  const [imageIds, setImageIds] = useState<string[]>([]);
  // local state for TopPlaces visibility
  const [showTopPlaces, setShowTopPlaces] = useState<boolean>(false);
  // local state to trigger TopPlaces refresh when a place is added
  const [topPlacesKey, setTopPlacesKey] = useState<number>(0);
  // local state to track if there are more items to load
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  // local state for Instagram import modal
  const [showInstagramModal, setShowInstagramModal] = useState<boolean>(false);
  // local state for Add Place overlay
  const [showAddPlaceOverlay, setShowAddPlaceOverlay] = useState<boolean>(false);
  // fetching data from global state
  const { token } = useAuthStore();

  const observerTarget = useRef<HTMLDivElement>(null);
  // ref for TopPlaces container to detect outside clicks
  const topPlacesRef = useRef<HTMLDivElement>(null);
  // ref for the entire suggestions section (button + content)
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch paginated places
  const {
    data: placesData,
    loading,
    fetchMore,
    refetch: refetchPlaces,
  } = useQuery(recommendedPlacesQuery, {
    variables: {
      pagination: {
        page: 1,
        pageSize: 10,
      },
      filters: {
        recommendation_list: {
          documentId: {
            eq: selectedCity?.documentId,
          },
        },
      },
    },
    fetchPolicy: "network-only",
    skip: !selectedCity?.documentId,
  });

  // Fetch ALL recommended places for comparison with top places (to avoid duplicates)
  const { data: allPlacesData, refetch: refetchAllPlaces } = useQuery(
    allRecommendedPlacesQuery,
    {
      variables: {
        documentId: selectedCity?.documentId,
      },
      fetchPolicy: "network-only",
      skip: !selectedCity?.documentId,
    }
  );

  // Create a proper refetch function that updates the useCityStore
  const refetchCitiesInternal = useCallback(async () => {
    try {
      // Refetch the recommendation list query to get fresh data
      const result = await refetchPlaces();


      // Find the updated city in the fetched data
      if (result.data?.recommendationList) {
        const updatedCity = {
          ...selectedCity,
          Visibility: result.data.recommendationList.Visibility,
        };


        // Update the useCityStore with the latest Visibility value
        setSelectedCity(updatedCity);
      }


      // Call the parent refetchCities if provided
      if (refetchCities) {
        await refetchCities();
      }


      return result;
    } catch (error) {
      console.error("Error refetching cities:", error);
      throw error;
    }
  }, [refetchPlaces, selectedCity, setSelectedCity, refetchCities]);

  // ⭐ Walkthrough Hook Initialization (must come AFTER showTopPlaces + useQuery)
  const {
    run,
    stepIndex,
    advanceToNextStepRef,
    setRun,
  } = useRecommendationsWalkthrough(
    {
      hasPlaces: placesData?.recommendedPlaces?.length > 0,
      isPublished: !!selectedCity?.Visibility,
      placesCount: placesData?.recommendedPlaces?.length || 0,
    },
    isExpanded.visible || showTopPlaces,   // pause when place modal OR suggestions modal is open
    (tabName: string) => {
      // When user reaches Step 4 (Manage tab) the hook will call this
      navigate(`/${selectedCity?.documentId}/${tabName.toLowerCase()}`);
    },
    "Manage"
  );

  // Use the existing menu items hook for draft/publish functionality
  // Must be called AFTER walkthrough hook to access advanceToNextStepRef
  const { handleRecommendationListVisibility, isPublished } = useMenuItems({
    refetchCities: refetchCitiesInternal,
    setShowConfirmDeleteModal: () => { }, // Not needed in this component
    advanceToNextStepRef: advanceToNextStepRef,
  });

  // Pause walkthrough when suggestions modal opens to prevent overlap
  // CRITICAL: Don't resume if profile setup is already complete
  useEffect(() => {
    if (showTopPlaces && run) {
      console.log('⏸️ Pausing walkthrough - suggestions modal opened (step:', stepIndex, ')');
      setRun(false);
      // Save current step only if setup is not complete
      if (!isProfileComplete || !isRecommendationsComplete) {
        sessionStorage.setItem('recommendations_walkthrough_step_index', String(stepIndex));
      }
    } else if (!showTopPlaces && !run) {
      // Don't resume if setup is complete
      if (isProfileComplete && isRecommendationsComplete) {
        console.log('⏭️ Skipping walkthrough resume - profile setup is already complete');
        sessionStorage.removeItem('recommendations_walkthrough_step_index');
        return;
      }
      // Resume walkthrough when suggestions modal closes
      const savedStepIndex = sessionStorage.getItem('recommendations_walkthrough_step_index');
      if (savedStepIndex !== null && savedStepIndex === String(stepIndex)) {
        console.log('▶️ Resuming walkthrough after suggestions modal closed');
        setTimeout(() => {
          setRun(true);
        }, 300);
      }
    }
  }, [showTopPlaces, run, stepIndex, setRun, isProfileComplete, isRecommendationsComplete]);

  // Detect when Manage tab is clicked during step 3 (real action) and advance to step 5
  useEffect(() => {
    if (stepIndex === 3 && run) {
      const handleManageTabClick = () => {
        console.log('🖱️ Manage tab clicked during step 3 - advancing to step 5');
        // Small delay to ensure route has changed
        setTimeout(() => {
          advanceToNextStepRef.current?.();
        }, 300);
      };

      // Listen for clicks on the Manage tab button
      const manageTabButton = document.querySelector('[data-walkthrough="manage-tab"]') as HTMLElement;
      if (manageTabButton) {
        manageTabButton.addEventListener('click', handleManageTabClick, { once: true });
        return () => {
          manageTabButton.removeEventListener('click', handleManageTabClick);
        };
      }
    }
  }, [stepIndex, run, advanceToNextStepRef]);

  // ⭐ Expose walkthrough control globally for other components


  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          hasMoreData &&
          placesData?.recommendedPlaces?.length > 0
        ) {
          // Check if we have more than 0 items and current length is divisible by page size
          // This indicates we might have more pages to load
          const currentLength = placesData.recommendedPlaces.length;
          if (currentLength % 10 === 0) {
            fetchMore({
              variables: {
                pagination: {
                  page: Math.ceil(currentLength / 10) + 1,
                  pageSize: 10,
                },
                filters: {
                  recommendation_list: {
                    documentId: {
                      eq: selectedCity?.documentId,
                    },
                  },
                },
              },
              updateQuery: (prev, { fetchMoreResult }) => {
                if (
                  !fetchMoreResult ||
                  !fetchMoreResult.recommendedPlaces?.length
                ) {
                  setHasMoreData(false);
                  return prev;
                }
                // If we get less than the page size, we've reached the end
                if (fetchMoreResult.recommendedPlaces.length < 10) {
                  setHasMoreData(false);
                }
                return {
                  recommendedPlaces: [
                    ...prev.recommendedPlaces,
                    ...fetchMoreResult.recommendedPlaces,
                  ],
                };
              },
            }).catch((error) => {
              console.error("Error fetching more places:", error);
              setHasMoreData(false);
            });
          }
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loading, placesData, fetchMore, selectedCity?.documentId, hasMoreData]);

  // Handle outside click/touch detection for TopPlaces component
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      // Only trigger if TopPlaces is expanded
      if (!showTopPlaces) return;

      // Check if the click/touch is outside the suggestions container (button + content)
      if (
        suggestionsContainerRef.current &&
        !suggestionsContainerRef.current.contains(event.target as Node)
      ) {
        setShowTopPlaces(false);
      }
    };

    // Add event listeners for both mouse and touch events
    if (showTopPlaces) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }

    // Cleanup event listeners
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showTopPlaces]);

  // Get categories from the paginated data - memoized to prevent unnecessary recalculations
  const categories: string[] = useMemo(() => {
    if (!placesData?.recommendedPlaces) return [];


    return Array.from(
      new Set(
        placesData.recommendedPlaces
          .map(
            (place: RecommendedPlaceCategory) =>
              place?.recommendation_category?.Category_Name
          )
          .filter(Boolean) // Filter out any undefined/null values
      )
    );
  }, [placesData?.recommendedPlaces]);

  // Function to get translated category name
  const getTranslatedCategoryName = (categoryName: string): string => {
    // Debug logging to see exact category names
    console.log('Category name from DB:', categoryName);

    const categoryMap: { [key: string]: string } = {
      "Food & Drinks": "dashboard.recommendations.categories.foodDrinks",
      Lodging: "dashboard.recommendations.categories.lodging",
      "Health & Wellness":
        "dashboard.recommendations.categories.healthWellness",
      Shopping: "dashboard.recommendations.categories.shopping",
      Entertainment: "dashboard.recommendations.categories.entertainment",
      Transportation: "dashboard.recommendations.categories.transportation",
      Services: "dashboard.recommendations.categories.services",
      Tourism: "dashboard.recommendations.categories.tourism",
      "Natural Features":
        "dashboard.recommendations.categories.naturalFeatures",
      "Food and Drink": "dashboard.recommendations.categories.foodDrinks",
      "Health and Wellness":
        "dashboard.recommendations.categories.healthWellness",
      "Natural Feature": "dashboard.recommendations.categories.naturalFeatures",
    };


    const translationKey = categoryMap[categoryName];
    if (translationKey) {
      return t(translationKey);
    }


    // Fallback to original category name
    return categoryName;
  };

  // Filter places by category and split by recommendation type
  const allFilteredPlaces = selectedCategory
    ? placesData?.recommendedPlaces?.filter(
      (place: RecommendedPlaceCategory) =>
        place?.recommendation_category?.Category_Name === selectedCategory
    )
    : placesData?.recommendedPlaces;

  // Split into places and persons - only show items with explicit Recommendation_Type
  const filteredPlaces = allFilteredPlaces?.filter(
    (item: any) => item?.Recommendation_Type === "place"
  );

  const filteredPersons = allFilteredPlaces?.filter(
    (item: any) => item?.Recommendation_Type === "person"
  );

  // Calculate center coordinates for TopPlaces component
  const selectedCityCoordinates = useMemo(() => {
    // First, check if the location itself has coordinates stored (for draft locations)
    if (selectedCity?.List_Name_Details?.location) {
      const locationCoords = selectedCity.List_Name_Details.location;
      if (locationCoords.latitude && locationCoords.longitude) {
        return {
          lat: parseFloat(locationCoords.latitude.toString()),
          lng: parseFloat(locationCoords.longitude.toString()),
        };
      }
    }

    // Fallback to calculating from existing recommendations (for published locations)
    if (placesData?.recommendedPlaces) {
      const validCoordinates = placesData.recommendedPlaces
        .map((place: any) => place.Place_Details?.Geometry)
        .filter((geometry: any) => geometry && geometry.lat && geometry.lng);

      if (validCoordinates.length === 0) {
        return null;
      }

      const lats = validCoordinates.map((coord: any) => coord.lat);
      const lngs = validCoordinates.map((coord: any) => coord.lng);

      const avgLat =
        lats.reduce((sum: number, lat: number) => sum + lat, 0) / lats.length;
      const avgLng =
        lngs.reduce((sum: number, lng: number) => sum + lng, 0) / lngs.length;

      return { lat: avgLat, lng: avgLng };
    }
    return null;
  }, [placesData, selectedCity?.List_Name_Details?.location]);

  // Handle place added from TopPlaces
  const handlePlaceAdded = useCallback(() => {
    // Increment key to force TopPlaces re-render and refresh
    setTopPlacesKey((prev) => prev + 1);
    // Also refetch all places to update the comparison list
    refetchAllPlaces();
  }, [refetchAllPlaces]);

  // Effect to refresh TopPlaces when recommendations data changes
  useEffect(() => {
    setTopPlacesKey((prev) => prev + 1);
  }, [allPlacesData?.recommendationList?.recommended_places?.length]);

  // Reset hasMoreData when selectedCity changes
  useEffect(() => {
    setHasMoreData(true);
  }, [selectedCity?.documentId]);

  // Effect to preserve selectedCategory when categories change
  useEffect(() => {
    // If selectedCategory is set but the category no longer exists in the new categories list,
    // reset to "View All" (empty string)
    if (
      selectedCategory &&
      categories.length > 0 &&
      !categories.includes(selectedCategory)
    ) {
      setSelectedCategory("");
    }
  }, [categories, selectedCategory]);

  // Effect to refresh data when returning to the page (useful for when coming back from AddRecommendation)
  useEffect(() => {
    const handleFocus = () => {
      if (selectedCity?.documentId) {
        refetchPlaces();
        refetchAllPlaces();
        setHasMoreData(true);
        setTopPlacesKey((prev) => prev + 1);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && selectedCity?.documentId) {
        refetchPlaces();
        refetchAllPlaces();
        setHasMoreData(true);
        setTopPlacesKey((prev) => prev + 1);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedCity?.documentId, refetchPlaces, refetchAllPlaces]);

  // function to delete the place
  const handleConfirmPlaceDelete = async (
    documentId: string,
    imageIds: string[]
  ) => {
    try {
      setIsDeleting(true);

      // Delete the recommended place
      await deleteRecommendedPlace({
        variables: { documentId },
      });

      try {
        // Delete the images from the media library
        await Promise.all(
          imageIds.map((id) =>
            axios.delete(
              `${import.meta.env.VITE_REST_API_URL}/upload/files/${id}`,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            )
          )
        );
      } catch (error) {
        console.error("Error deleting images:", error);
      }

      // Use refetch instead of fetchMore to properly reset pagination state
      const { data } = await refetchPlaces({
        pagination: {
          page: 1,
          pageSize: 10,
        },
        filters: {
          recommendation_list: {
            documentId: {
              eq: selectedCity?.documentId,
            },
          },
        },
      });

      // Update visibility if no places left
      if (data?.recommendedPlaces?.length === 0) {
        const visibilityResponse = await updateRecommendationListVisibility({
          variables: {
            documentId: selectedCity?.documentId,
            data: {
              Visibility: false,
            },
          },
        });

        // Update the selected city state with the new visibility status
        if (visibilityResponse?.data?.updateRecommendationList) {
          setSelectedCity({
            ...selectedCity,
            Visibility: false,
            recommended_places: [],
          });

          // Refetch cities to update the UI
          if (refetchCities) {
            await refetchCities();
            // Refetch cities to get fresh data from Strapi
            let refetchedCitiesData = null;
            if (refetchCities) {
              const refetchResult = await refetchCities();
              refetchedCitiesData = refetchResult?.data;
            }

            // Find the updated city from the refetched data
            const updatedCity = refetchedCitiesData?.recommendationLists?.find(
              (city: any) => city.documentId === selectedCity?.documentId
            );

            // Update selectedCity with fresh data from Strapi (includes correct Visibility)
            if (updatedCity) {
              setSelectedCity({
                ...updatedCity,
                recommended_places: [],
              });
            } else {
              // Fallback: update with local state if refetch didn't work
              setSelectedCity({
                ...selectedCity,
                Visibility: false,
                recommended_places: [],
              });
            }
          }
        } else {
          // Update the selected city state with the latest data
          setSelectedCity({
            ...selectedCity,
            recommended_places: data?.recommendedPlaces || [],
          });
        }

        // Refetch all places to update the comparison list
        await refetchAllPlaces();

        // Reset pagination state
        setHasMoreData(true);

        setIsDeleting(false);
      } else {
        // Update the selected city state with the latest data
        setSelectedCity({
          ...selectedCity,
          recommended_places: data?.recommendedPlaces || [],
        });

        // Refetch all places to update the comparison list
        await refetchAllPlaces();

        // Reset pagination state
        setHasMoreData(true);

        setIsDeleting(false);
      }

      // Show appropriate toast message
      if (data?.recommendedPlaces?.length === 0) {
        toast(
          t("dashboard.recommendations.deleteSuccess.unpublished")
        );
      } else {
        toast(t("dashboard.recommendations.deleteSuccess.success"));
      }

      // Refresh TopPlaces after deletion
      setTopPlacesKey((prev) => prev + 1);

      // Refresh the page to update the UI and close any open modals/tabs
      setTimeout(() => {
        window.location.reload();
      }, 1000); // Small delay to show the toast message

      // Close any open modals/expanded views
      setShowDeleteModal(false);
      setIsExpanded({ visible: false, documentId: null });
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
    }
  };

  // side effect for place
  if (isDeleting) {
    return (
      <div className="flex items-center justify-center backdrop-blur-md min-h-screen bg-dashboard-bg">
        <EarthLoader context="general" size="small" />
      </div>
    );
  }

  return (
    <div className="bg-dashboard-bg mb-6 md:p-4">
      {/* Suggestions Container - wraps both button and content */}
      <div ref={suggestionsContainerRef}>
        {/* Recommend Button and Suggestions Button */}
        <div className="flex flex-col gap-2 py-2">
          {/* Row 1: Published toggle (left) + Add Place button (right) */}
          <div className="flex flex-row items-center justify-between gap-4">
            {/* Toggle Switch - Left aligned */}
            <div className="flex items-center gap-3" data-walkthrough="togglePublish">
              <SwitchButton
                data-switch="published"
                isChecked={isPublished}
                onChange={() => {
                  handleRecommendationListVisibility();
                  setTimeout(() => {
                    window.__walkthrough?.markProcessingCompleteRef?.();
                  }, 150);
                }}
                variant="green"
                disabled={!selectedCity?.recommended_places?.length}
              />
              <span className="text-sm font-medium text-dashboard">
                {isPublished
                  ? t("dashboard.recommendations.publishedStatus")
                  : t("dashboard.recommendations.draftStatus")}
              </span>
            </div>

            {/* Add Place button - right aligned */}
            <Button
              btnText={t("dashboard.recommendations.recommendButton")}
              variant="primary"
              type="button"
              size="xsmall"
              endIcon={<AddIcon size="6" />}
              onClickHandler={() => setShowAddPlaceOverlay(true)}
              data-walkthrough="add-place"
            />
          </div>

        </div>

        {/* Collapsible TopPlaces Section */}
        <AnimatePresence>
          {showTopPlaces && (
            <motion.div
              ref={topPlacesRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative mb-4"
            >
              <div className="bg-dashboard-bg py-4">
                {/* TopPlaces Content */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <TopPlacesByCategory
                    key={`${selectedCity?.documentId || "current-location"
                      }-${topPlacesKey}`}
                    selectedLocationName={selectedCity?.List_Name}
                    selectedLocationCoords={selectedCityCoordinates}
                    existingRecommendations={
                      allPlacesData?.recommendationList?.recommended_places ||
                      []
                    }
                    onPlaceAdded={handlePlaceAdded}
                    selectedCityVisibility={selectedCity?.Visibility}
                  />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* My Recommendations Header - Show when there are any recommendations */}
      {(allFilteredPlaces?.length > 0) && (
        <div className="flex items-center gap-3 mb-2 mt-8">
          <div>
            <h3 className="text-white font-poppins font-semibold text-lg">
              {t("dashboard.recommendations.myRecommendationsHeading")}
            </h3>
            <p className="text-white font-poppins text-sm">
              {selectedCity?.List_Name ||
                t("dashboard.recommendations.locationButton")}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto whitespace-nowrap py-4 scrollbar-hide">
        {categories && categories.length >= 1 && (
          <div className="flex gap-3">
            <Button
              btnText={t("dashboard.recommendations.viewAll")}
              type="button"
              variant={selectedCategory === "" ? "tagSelected" : "tag"}
              onClickHandler={() => setSelectedCategory("")}
              size="xsmall"
            />
            {categories?.map((tag: string, index: number) => (
              <Button
                key={index}
                btnText={getTranslatedCategoryName(tag)}
                type="button"
                variant={selectedCategory === tag ? "tagSelected" : "tag"}
                onClickHandler={() => setSelectedCategory(tag)}
                size="xsmall"
              />
            ))}
          </div>
        )}
      </div>

      {/* Combined Recommendations Grid - All cards in one section */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 items-center justify-center mt-2 mb-20 md:mb-0">
        {loading && !placesData?.recommendedPlaces?.data?.length ? (
          // Skeleton cards while loading — sit directly in the grid
          <RecommendationCardSkeleton count={6} variant="dashboard" />
        ) : allFilteredPlaces?.length > 0 ? (
          <>
            {allFilteredPlaces?.map((data: CardDataItem, index: number) => {
              const isPersonType = data?.Recommendation_Type === "person";

              return (
                <Card
                  key={data.documentId || `recommendation-${index}`}
                  cardType="menuCard"
                  recommendationType={isPersonType ? "person" : "place"}
                  menuItems={[
                    {
                      icon: <DeleteIcon stroke="var(--dash-danger)" />,
                      action: () => {
                        setShowDeleteModal(true);
                        setDeletedPlaceId(data.documentId);
                        setImageIds(
                          data?.media_details?.imageDetails?.map(
                            (img) => img.id
                          ) || []
                        );
                      },
                    },
                    {
                      icon: <EditIcon />,
                      action: () => navigate(`/${data.documentId}/edit`),
                    },
                  ]}
                  onClickhandler={() =>
                    setIsExpanded({
                      visible: true,
                      documentId: data.documentId,
                    })
                  }
                  image={
                    isPersonType
                      ? getPersonImageUrl(data)
                      : (data?.media_details?.thumbnail?.url ||
                        data?.media_details?.imageDetails?.[0]?.url ||
                        IMAGE_CONFIG.defaultImages.place)
                  }
                  title={isPersonType ? data.Contact_Name : data.Place_Details?.Title}
                  rating={!isPersonType ? data?.Place_Details?.Rating : undefined}
                  reviews={!isPersonType ? data?.Place_Details?.Rating_Count : undefined}
                />
              );
            })}
            <div ref={observerTarget} className="h-10 w-full" />
            {/* Loading indicator for infinite scroll */}
            {loading && hasMoreData && (
              <div className="col-span-2 md:col-span-3 flex justify-center py-4">
                <EarthLoader context="general" size="small" />
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Empty State - Show only when no recommendations */}
      {!loading && !allFilteredPlaces?.length && placesData?.recommendedPlaces && (
        <div className="col-span-2 md:col-span-3 flex flex-col items-center justify-center py-6">
          <div className="bg-dashboard-modal p-6 rounded-lg border border-dashboard-accent shadow-dashboard-elevated text-center">
            <h1 className="text-white font-poppins font-semibold text-lg md:text-xl mb-2">
              {t("dashboard.recommendations.emptyState.title")}
            </h1>
            <p className="text-gray-300 font-poppins text-sm md:text-base">
              {t("dashboard.recommendations.emptyState.subtitle")}
            </p>
          </div>
        </div>
      )}

      {isExpanded.visible && (
        <div className="fixed inset-0 bg-dashboard-overlay backdrop-blur-md z-[60]"></div>
      )}
      <div
        className={`fixed md:max-w-4xl md:mx-auto inset-x-0 bottom-0 top-24 md:top-12 z-[70] transition-transform duration-300 ease-in-out ${isExpanded.visible ? "translate-y-0" : "translate-y-full"
          }`}
        style={{ height: "100%" }}
      >
        {isExpanded.visible && (() => {
          // Find the clicked item to determine its type
          const clickedItem = [...(filteredPlaces || []), ...(filteredPersons || [])].find(
            item => item.documentId === isExpanded.documentId
          );
          const isPersonType = clickedItem?.Recommendation_Type === "person";

          return isPersonType ? (
            <PersonOverview
              personId={isExpanded.documentId}
              onClose={() => setIsExpanded({ visible: false, documentId: null })}
            />
          ) : (
            <PlaceOverview
              placeId={isExpanded.documentId}
              onClose={() => setIsExpanded({ visible: false, documentId: null })}
            />
          );
        })()}
      </div>

      {showDeleteModal && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        >
          <div className="p-4">
            <h2 className="text-md font-poppins font-medium text-dashboard-light mb-2">
              {t("dashboard.recommendations.addRecommendationForm.deleteRecommendationModal.title")}
            </h2>
            <p className="font-poppins text-sm text-[hsl(var(--muted-foreground))] mb-4">
              {t("dashboard.recommendations.addRecommendationForm.deleteRecommendationModal.message")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                btnText={t("dashboard.recommendations.addRecommendationForm.deleteRecommendationModal.cancel")}
                onClickHandler={() => setShowDeleteModal(false)}
                size="small"
                variant="google"
              />
              <Button
                btnText={t("dashboard.recommendations.addRecommendationForm.deleteRecommendation")}
                onClickHandler={() => {
                  handleConfirmPlaceDelete(deletedPlaceId, imageIds);
                  setShowDeleteModal(false);
                }}
                size="small"
                variant="danger"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Instagram Post Import Modal */}
      <InstagramPostImport
        isOpen={showInstagramModal}
        onClose={() => setShowInstagramModal(false)}
        listId={selectedCity?.documentId}
      />

      {/* Add Place Overlay */}
      <AddPlaceOverlay
        isOpen={showAddPlaceOverlay}
        onClose={() => setShowAddPlaceOverlay(false)}
        existingRecommendations={allPlacesData?.recommendationList?.recommended_places || []}
        selectedLocationCoords={selectedCityCoordinates}
        onPlaceAdded={handlePlaceAdded}
        topPlacesKey={topPlacesKey}
      />
    </div>
  );
});

export default Recommendations;
