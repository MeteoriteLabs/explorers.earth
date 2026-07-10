

import {
  FC,
  memo,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactElement,
} from "react";
import { useTranslation } from "react-i18next";
import Button from "../../../components/ui/Button";
import { AddIcon } from "../../../assets/icons/AddIcon";
import { useMutation, useQuery } from "@apollo/client";
import { toast } from "sonner";
import {
  recommendedPlacesQuery,
  allRecommendedPlacesQuery,
  recommendationListQuery,
  recommendedListByIdQuery,
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
import EditIcon from "../../../assets/icons/EditIcon";
import axios from "axios";
import useAuthStore from "../../../store/store";
import { useCityStore } from "../../../store/useCityStore";
import useSetupStore from "../../../store/useSetupStore";
import TopPlacesByCategory from "./TopPlacesByCategory";
import { motion, AnimatePresence } from "framer-motion";
import { useMenuItems } from "../hooks/useMenuItems";
// ⭐ Walkthrough Hook
import { useRecommendationsWalkthrough } from "../../../hooks/useRecommendationsWalkthrough";
import InstagramPostImport from "./InstagramPostImport";
import AddPlaceOverlay from "./AddPlaceOverlay";
import { IMAGE_CONFIG } from "../../../config";
import { ChevronDown, Users, ShoppingBag } from "lucide-react";
import ProductDetailModal from "../../Products/components/public/ProductDetailModal";
import PersonDetailModal from "../../People/components/public/PersonDetailModal";
import { deduplicatePeople, buildImageUrl, PlatformIcon } from "../../People";
import { deduplicateProducts, formatPrice } from "../../Products/utils/productHelpers";

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
  const imageUrl = data?.avatar_url || data?.avatar_path || data?.media_details?.thumbnail?.url || data?.media_details?.imageDetails?.[0]?.url;
  if (imageUrl) return buildImageUrl(imageUrl);

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
  user_rating?: number | null;
  google_rating?: number | null;
  documentId: string;
};

const KebabDropdown: FC<{
  menuItems: { icon: ReactElement; label: string; action: () => void }[];
}> = ({ menuItems }) => {
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
      >
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2 s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>
      {showMenu && (
        <div className="absolute z-50 right-0 top-full mt-1 bg-dashboard-sidebar shadow-dashboard-elevated rounded-md p-1.5 border border-white/10 min-w-[100px]">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className="flex w-full items-center gap-2 text-xs text-dashboard hover:bg-dashboard-muted rounded px-2.5 py-1.5 whitespace-nowrap text-left text-white"
              onClick={() => {
                item.action();
                setShowMenu(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
    type: "place" | "person" | null;
  }>({
    visible: false,
    documentId: null,
    type: null,
  });
  // local state for inline product detail view
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  // local state for inline person detail view
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
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
  // dropdown for the split Add button
  const [showAddDropdown, setShowAddDropdown] = useState<boolean>(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  // active tab: places | people | products
  const [activeTab, setActiveTab] = useState<"places" | "people" | "products">("places");
  // fetching data from global state
  const { token } = useAuthStore();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    if (showAddDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddDropdown]);

  const observerTarget = useRef<HTMLDivElement>(null);
  // ref for TopPlaces container to detect outside clicks
  const topPlacesRef = useRef<HTMLDivElement>(null);
  // ref for the entire suggestions section (button + content)
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch linked person_lists and product_lists for this location
  const { data: locationLinkedData } = useQuery(recommendedListByIdQuery, {
    variables: {
      documentId: selectedCity?.documentId,
      pagination: { page: 1, pageSize: 1 }, // minimal places — we only need the linked lists
    },
    fetchPolicy: "cache-and-network",
    skip: !selectedCity?.documentId,
  });

  const linkedPersonLists: any[] = locationLinkedData?.recommendationList?.person_lists || [];
  const linkedProductLists: any[] = locationLinkedData?.recommendationList?.product_lists || [];

  // Flatten all linked people and products
  const linkedPeople = useMemo(() => {
    const raw = linkedPersonLists.flatMap((l: any) =>
      (l.recommended_people || []).map((p: any) => ({
        ...p,
        _listName: l.List_Name,
        _listId: l.documentId,
      }))
    );
    return deduplicatePeople(raw);
  }, [linkedPersonLists]);
  const linkedProducts = useMemo(() => {
    const raw = linkedProductLists.flatMap((l: any) =>
      (l.recommended_products || []).map((p: any) => ({
        ...p,
        _listName: l.List_Name,
        _listId: l.documentId,
      }))
    );
    return deduplicateProducts(raw);
  }, [linkedProductLists]);

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
  useMenuItems({
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

  // Auto-open AddPlaceOverlay for Walkthrough Step 2 (Suggestions)
  useEffect(() => {
    const handleOpen = () => setShowAddPlaceOverlay(true);
    const handleClose = () => setShowAddPlaceOverlay(false);

    window.addEventListener('openWalkthroughModal', handleOpen);
    window.addEventListener('closeWalkthroughModal', handleClose);

    return () => {
      window.removeEventListener('openWalkthroughModal', handleOpen);
      window.removeEventListener('closeWalkthroughModal', handleClose);
    };
  }, []);

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
      setIsExpanded({ visible: false, documentId: null, type: null });
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
        {/* Split Add Curation Button */}
        <div className="flex flex-col gap-2 py-2">
          <div ref={addDropdownRef} className="relative w-full">
            {/* Main button + chevron */}
            <div className="flex w-full rounded-xl overflow-hidden shadow-lg shadow-blue-900/30">
              <button
                onClick={() => setShowAddPlaceOverlay(true)}
                className="flex-1 bg-dashboard-accent hover:opacity-90 text-sm text-white font-bold py-3 flex items-center justify-center gap-2 transition-all cursor-pointer"
                data-walkthrough="add-place"
              >
                <AddIcon size="5" />
                <span>Add Place</span>
              </button>
              <button
                onClick={() => setShowAddDropdown((v) => !v)}
                className="bg-dashboard-accent border-l border-white/20 px-3.5 flex items-center justify-center hover:opacity-90 transition-all cursor-pointer"
                aria-label="More add options"
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${showAddDropdown ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* Dropdown menu */}
            <AnimatePresence>
              {showAddDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-[calc(100%+6px)] left-0 right-0 bg-dashboard-sidebar border border-dashboard-border rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <button
                    onClick={() => { setShowAddDropdown(false); setShowAddPlaceOverlay(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-dashboard hover:bg-dashboard-muted transition-colors text-left border-b border-white/5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" className="text-blue-400">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Add Place</p>
                      <p className="text-xs text-dashboard-muted">Restaurant, hotel, or attraction</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowAddDropdown(false); navigate(`/recommendations/places/${selectedCity?.documentId}/add-people`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-dashboard hover:bg-dashboard-muted transition-colors text-left border-b border-white/5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                      <Users size={14} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="font-semibold">Add People</p>
                      <p className="text-xs text-dashboard-muted">Local creators, founders, artists</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowAddDropdown(false); navigate(`/recommendations/places/${selectedCity?.documentId}/add-products`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-dashboard hover:bg-dashboard-muted transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={14} className="text-orange-400" />
                    </div>
                    <div>
                      <p className="font-semibold">Add Products</p>
                      <p className="text-xs text-dashboard-muted">Gear, essentials, recommendations</p>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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

      {/* My Recommendations Header + Tab Switcher */}
      {(allFilteredPlaces?.length > 0 || linkedPeople.length > 0 || linkedProducts.length > 0) && (
        <div className="mt-8 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h3 className="text-white font-poppins font-semibold text-lg">
                {t("dashboard.recommendations.myRecommendationsHeading")}
              </h3>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 p-1 bg-dashboard-muted rounded-xl w-fit">
            {([
              { key: "places", label: "Places", count: allFilteredPlaces?.length || 0 },
              { key: "people", label: "People", count: linkedPeople.length },
              { key: "products", label: "Products", count: linkedProducts.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === key
                    ? "bg-dashboard-accent text-white shadow-lg shadow-blue-900/30"
                    : "text-dashboard-muted hover:text-dashboard"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === key ? "bg-white/20" : "bg-white/10"
                  }`}>{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories filters only visible on Places tab */}
      {activeTab === "places" && categories && categories.length >= 1 && (
        <div className="overflow-x-auto whitespace-nowrap py-4 scrollbar-hide">
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
        </div>
      )}

      {/* ── People Tab ── */}
      {activeTab === "people" && (
        <div className="mb-20 md:mb-0">
          {!linkedPersonLists.some((list: any) => list.recommended_people && list.recommended_people.length > 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-900/20 border border-violet-800/30 flex items-center justify-center mb-4">
                <Users size={28} className="text-violet-500/60" />
              </div>
              <h3 className="text-base font-semibold text-dashboard mb-1">No people linked yet</h3>
              <p className="text-sm text-dashboard-muted mb-4">Click the chevron on the Add button and select "Add People"</p>
              <button
                onClick={() => navigate(`/recommendations/places/${selectedCity?.documentId}/add-people`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 text-sm text-violet-300 font-medium transition-colors cursor-pointer"
              >
                <Users size={14} /> Add People
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {linkedPersonLists.map((list: any) => {
                const people = deduplicatePeople(list.recommended_people ?? []);
                if (people.length === 0) return null;

                return (
                  <div key={list.documentId} className="px-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-white">{list.List_Name}</h4>
                        {list.list_description && (
                          <p className="text-xs text-dashboard-muted mt-0.5 line-clamp-1">{list.list_description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/recommendations/people/${list.documentId}`)}
                        className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {people.map((person: any) => {
                        const avatarSrc = person.avatar_url || person.avatar_path || person.media_details?.thumbnail?.url || person.media_details?.imageDetails?.[0]?.url || null;
                        return (
                          <button
                            key={person.documentId}
                            onClick={() => setSelectedPerson(person)}
                            className="flex-shrink-0 w-[110px] flex flex-col items-center gap-2 text-center group cursor-pointer bg-transparent border-0 outline-none p-0"
                          >
                            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10 group-hover:ring-violet-500/50 transition-all shadow-lg group-hover:scale-105 duration-200">
                              {avatarSrc ? (
                                <img src={buildImageUrl(avatarSrc)} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-violet-950/40">
                                  <Users size={24} className="text-violet-400/40" />
                                </div>
                              )}
                              {person.platform && (
                                <div className="absolute bottom-1 right-1 p-1 bg-black/60 rounded-full border border-white/10 flex items-center justify-center shadow-md z-10">
                                  <PlatformIcon platform={person.platform} size={10} />
                                </div>
                              )}
                            </div>
                            <div className="w-full">
                              <p className="text-xs font-semibold text-white line-clamp-1">{person.name}</p>
                              {person.handle && (
                                <p className="text-[10px] text-white/40 truncate">@{person.handle}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Products Tab ── */}
      {activeTab === "products" && (
        <div className="mb-20 md:mb-0">
          {!linkedProductLists.some((list: any) => list.recommended_products && list.recommended_products.length > 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-900/20 border border-orange-800/30 flex items-center justify-center mb-4">
                <ShoppingBag size={28} className="text-orange-500/60" />
              </div>
              <h3 className="text-base font-semibold text-dashboard mb-1">No products linked yet</h3>
              <p className="text-sm text-dashboard-muted mb-4">Click the chevron on the Add button and select "Add Products"</p>
              <button
                onClick={() => navigate(`/recommendations/places/${selectedCity?.documentId}/add-products`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600/30 hover:bg-orange-600/50 text-sm text-orange-300 font-medium transition-colors cursor-pointer"
              >
                <ShoppingBag size={14} /> Add Products
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {linkedProductLists.map((list: any) => {
                const products = deduplicateProducts(list.recommended_products ?? []);
                if (products.length === 0) return null;

                return (
                  <div key={list.documentId} className="px-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-white">{list.List_Name}</h4>
                        {list.list_description && (
                          <p className="text-xs text-dashboard-muted mt-0.5 line-clamp-1">{list.list_description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/recommendations/products/${list.documentId}`)}
                        className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                      {products.map((product: any) => (
                        <button
                          key={product.documentId}
                          onClick={() => setSelectedProduct(product)}
                          className="flex-shrink-0 w-[140px] rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-orange-500/40 hover:bg-white/[0.07] p-3 text-left transition-all cursor-pointer outline-none"
                        >
                          <div className="w-full h-24 rounded-xl overflow-hidden bg-white/5 mb-2 shadow-md">
                            {product.logo_url ? (
                              <img src={buildImageUrl(product.logo_url)} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag size={20} className="text-white/20" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1.5">{product.title}</p>
                          {product.brand && (
                            <p className="text-[10px] text-white/40 truncate mb-1">{product.brand}</p>
                          )}
                          {product.price != null && (
                            <p className="text-xs font-bold text-orange-400">
                              {formatPrice(product.price, product.currency)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Places Tab ── */}
      {activeTab === "places" && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-2 mb-20 md:mb-0">
        {loading && !placesData?.recommendedPlaces?.length ? (
          // Skeleton cards while loading — sit directly in the grid
          <RecommendationCardSkeleton count={6} variant="dashboard" />
        ) : allFilteredPlaces?.length > 0 ? (
          <>
            {allFilteredPlaces?.map((data: CardDataItem, index: number) => {
              const isPersonType = data?.Recommendation_Type === "person";
              const title = isPersonType ? data.Contact_Name : data.Place_Details?.Title;
              const rating = !isPersonType
                ? (data.user_rating ?? (data.google_rating ? data.google_rating * 2 : (data.Place_Details?.Rating ? data.Place_Details.Rating * 2 : undefined)))
                : undefined;
              const reviews = !isPersonType ? data?.Place_Details?.Rating_Count : undefined;
              const image = isPersonType
                ? getPersonImageUrl(data)
                : (data?.media_details?.thumbnail?.url ||
                  data?.media_details?.imageDetails?.[0]?.url ||
                  IMAGE_CONFIG.defaultImages.place);

              return (
                <div
                  key={data.documentId || `recommendation-${index}`}
                  onClick={() =>
                    setIsExpanded({
                      visible: true,
                      documentId: data.documentId,
                      type: "place",
                    })
                  }
                  className="places-grid-card relative rounded-xl overflow-hidden cursor-pointer shadow-lg transition-transform hover:-translate-y-1 aspect-[4/3] md:aspect-[4/3]"
                  style={{
                    background: `linear-gradient(180deg, rgba(13,15,18,0.1) 0%, rgba(13,15,18,0.85) 90%), url('${image}') center/cover no-repeat`,
                    border: "1px solid var(--dash-border, #3C4E40)",
                  }}
                >
                  {/* Top action row */}
                  <div className="flex justify-between items-center p-3 relative z-10 w-full">
                    {/* Direction icon */}
                    <div className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
                      <svg width="10" height="10" fill="white" viewBox="0 0 24 24" className="transform rotate-45">
                        <path d="M12 2L2 22l10-6 10 6L12 2z" fill="white" />
                      </svg>
                    </div>
                    
                    {/* Kebab trigger menu */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="relative"
                    >
                      <KebabDropdown
                        menuItems={[
                          {
                            icon: <DeleteIcon stroke="var(--dash-danger)" />,
                            label: "Delete",
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
                            label: "Edit",
                            action: () => navigate(`/${data.documentId}/edit`),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Bottom Title & Meta info */}
                  <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col gap-0.5">
                    <span className="places-grid-card-title font-poppins font-bold text-white text-xs md:text-sm line-clamp-1 leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                      {title}
                    </span>
                    {!isPersonType && (rating !== undefined || reviews !== undefined) && (
                      <div className="places-grid-card-meta flex items-center gap-1 text-[10px] md:text-xs text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                        <span className="text-dashboard-accent">★</span>
                        <span>{rating?.toFixed(1) || "0.0"}</span>
                        <span className="text-white/60 font-medium">({reviews || 0})</span>
                      </div>
                    )}
                  </div>
                </div>
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
      )}

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
        <div className="fixed inset-0 bg-dashboard-overlay backdrop-blur-md z-[150]"></div>
      )}
      <div
        className={`fixed md:max-w-4xl md:mx-auto inset-x-0 bottom-0 top-24 md:top-12 z-[150] transition-transform duration-300 ease-in-out ${isExpanded.visible ? "translate-y-0" : "translate-y-full"
          }`}
        style={{ height: "100%" }}
      >
        {isExpanded.visible && (
          <PlaceOverview
            placeId={isExpanded.documentId}
            onClose={() => setIsExpanded({ visible: false, documentId: null, type: null })}
          />
        )}
      </div>

      {/* Product Detail Modal */}
      <ProductDetailModal
        open={!!selectedProduct}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Person Detail Modal */}
      <PersonDetailModal
        open={!!selectedPerson}
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
      />

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
