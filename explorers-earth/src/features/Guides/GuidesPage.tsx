import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import Button from "../../components/ui/Button";
import GuideCard from "./components/GuideCard";
import { GET_GUIDES_QUERY, GET_USER_ACCOUNT_QUERY } from "./api/queries";
import { DELETE_GUIDE_MUTATION, UPDATE_GUIDE_MUTATION } from "./api/mutations";
import GuideCardSkeleton from "../../components/ui/GuideCardSkeleton";
import Modal from "../../components/ui/Modal";
import { toast } from "sonner";
import SEO from "../../components/SEO";
import { createCanonicalUrl } from "../../utils/getCurrentDomain";
import useAuthStore from "../../store/store";
import type { Guide } from "./types";
import { AddIcon } from "../../assets/icons/AddIcon";
import SwitchButton from "../../components/ui/SwitchButton";

interface FilterState {
  guideType: string | null;
  category: string | null;
  numberOfDays: number | null;
  bestTimeToVisit: string | null;
  budgetType: string | null;
}

const GuidesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deletingGuideId, setDeletingGuideId] = useState<string>("");
  const [filters, setFilters] = useState<FilterState>({
    guideType: null,
    category: null,
    numberOfDays: null,
    bestTimeToVisit: null,
    budgetType: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isMultiCityFilter, setIsMultiCityFilter] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  // Get account documentId
  const { data: accountData, loading: accountLoading } = useQuery(GET_USER_ACCOUNT_QUERY, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });

  const accountDocumentId =
    accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  // Fetch guides with account filter
  const {
    data: guidesData,
    loading,
    error,
    refetch,
  } = useQuery(GET_GUIDES_QUERY, {
    variables: {
      filters: {
        account: {
          documentId: {
            eq: accountDocumentId,
          },
        },
      },
      pagination: {
        limit: 100,
      },
    },
    fetchPolicy: "network-only",
    skip: !accountDocumentId,
  });

  // Delete guide mutation
  const [deleteGuide, { loading: isDeleting }] = useMutation(
    DELETE_GUIDE_MUTATION,
    {
      onCompleted: () => {
        toast.success("Guide deleted successfully");
        refetch();
        setShowDeleteModal(false);
        setDeletingGuideId("");
      },
      onError: (error) => {
        toast.error(`Failed to delete guide: ${error.message}`);
        setShowDeleteModal(false);
        setDeletingGuideId("");
      },
    }
  );

  const allGuides: Guide[] = guidesData?.guides || [];

  // True when data is still being fetched (either account or guides query)
  const isLoading = accountLoading || loading || (!accountDocumentId && !accountData);

  // Helper function to extract location names from Place_Details
  const extractLocationNames = (guide: Guide): string[] => {
    const locations: string[] = [];

    if (!guide.Place_Details) return locations;

    try {
      let placeDetails: any = guide.Place_Details;
      if (typeof guide.Place_Details === "string") {
        placeDetails = JSON.parse(guide.Place_Details);
      }

      // Check if it's multi-city format
      if (placeDetails.isMultiCity === true) {
        // Multi-city: extract all cities
        const starting = placeDetails.starting || placeDetails.departure || placeDetails.from;
        if (starting?.Place_Name) {
          locations.push(starting.Place_Name);
        } else if (starting?.Place_Address) {
          locations.push(starting.Place_Address);
        }

        // Intermediate cities
        const intermediateCities = placeDetails.intermediateCities || [];
        intermediateCities.forEach((city: any) => {
          if (city.Place_Name) {
            locations.push(city.Place_Name);
          } else if (city.Place_Address) {
            locations.push(city.Place_Address);
          }
        });

        // Ending city
        const ending = placeDetails.ending || placeDetails.arrival || placeDetails.to;
        if (ending?.Place_Name) {
          locations.push(ending.Place_Name);
        } else if (ending?.Place_Address) {
          locations.push(ending.Place_Address);
        }
      } else {
        // Single city format
        if (placeDetails.Place_Name) {
          locations.push(placeDetails.Place_Name);
        } else if (placeDetails.Place_Address) {
          locations.push(placeDetails.Place_Address);
        }
      }
    } catch (error) {
      // Silently handle parsing errors
    }

    return locations.filter(loc => loc && loc.trim() !== "");
  };

  // Extract unique filter values from guides
  const filterOptions = useMemo(() => {
    const guideTypes = new Set<string>();
    const categories = new Set<string>();
    const numberOfDays = new Set<number>();
    const months = new Set<string>();
    const budgetTypes = new Set<string>();
    const locations = new Set<string>();

    allGuides.forEach((guide) => {
      // Guide Type
      if (guide.Guide_Type) {
        guideTypes.add(guide.Guide_Type);
      }

      // Categories
      if (guide.Category) {
        let categoryArray: string[] = [];
        if (Array.isArray(guide.Category)) {
          categoryArray = guide.Category;
        } else if (typeof guide.Category === "string") {
          try {
            categoryArray = JSON.parse(guide.Category);
          } catch {
            categoryArray = [guide.Category];
          }
        }
        categoryArray.forEach((cat: string) => {
          if (cat && typeof cat === "string") {
            categories.add(cat.trim());
          }
        });
      }

      // Number of Days
      if (guide.Number_Of_Days !== null && guide.Number_Of_Days !== undefined) {
        numberOfDays.add(guide.Number_Of_Days);
      }

      // Best Time to Visit (months)
      if (guide.Best_Time_To_Visit) {
        let monthsArray: string[] = [];
        if (Array.isArray(guide.Best_Time_To_Visit)) {
          monthsArray = guide.Best_Time_To_Visit;
        } else if (typeof guide.Best_Time_To_Visit === "string") {
          try {
            monthsArray = JSON.parse(guide.Best_Time_To_Visit);
          } catch {
            monthsArray = [guide.Best_Time_To_Visit];
          }
        }
        monthsArray.forEach((month: string) => {
          if (month && typeof month === "string") {
            months.add(month.trim());
          }
        });
      }

      // Budget Type
      if (guide.Budget_Type) {
        budgetTypes.add(guide.Budget_Type);
      }

      // Locations - extract from Place_Details
      const guideLocations = extractLocationNames(guide);
      guideLocations.forEach((location: string) => {
        if (location && typeof location === "string") {
          locations.add(location.trim());
        }
      });
    });

    return {
      guideTypes: Array.from(guideTypes).sort(),
      categories: Array.from(categories).sort(),
      numberOfDays: Array.from(numberOfDays).sort((a, b) => a - b),
      months: Array.from(months).sort(),
      budgetTypes: Array.from(budgetTypes).sort(),
      locations: Array.from(locations).sort(),
    };
  }, [allGuides]);

  // Filter guides based on selected filters
  const guides = useMemo(() => {
    const filteredGuides = allGuides.filter((guide) => {
      // Guide Type filter
      if (filters.guideType && guide.Guide_Type !== filters.guideType) {
        return false;
      }

      // Category filter
      if (filters.category) {
        let guideCategories: string[] = [];
        if (guide.Category) {
          if (Array.isArray(guide.Category)) {
            guideCategories = guide.Category;
          } else if (typeof guide.Category === "string") {
            try {
              guideCategories = JSON.parse(guide.Category);
            } catch {
              guideCategories = [guide.Category];
            }
          }
        }
        if (!guideCategories.some((cat: string) => cat?.trim() === filters.category)) {
          return false;
        }
      }

      // Number of Days filter
      if (filters.numberOfDays !== null && guide.Number_Of_Days !== filters.numberOfDays) {
        return false;
      }

      // Best Time to Visit filter
      if (filters.bestTimeToVisit) {
        let guideMonths: string[] = [];
        if (guide.Best_Time_To_Visit) {
          if (Array.isArray(guide.Best_Time_To_Visit)) {
            guideMonths = guide.Best_Time_To_Visit;
          } else if (typeof guide.Best_Time_To_Visit === "string") {
            try {
              guideMonths = JSON.parse(guide.Best_Time_To_Visit);
            } catch {
              guideMonths = [guide.Best_Time_To_Visit];
            }
          }
        }
        if (!guideMonths.some((month: string) => month?.trim() === filters.bestTimeToVisit)) {
          return false;
        }
      }

      // Budget Type filter
      if (filters.budgetType && guide.Budget_Type !== filters.budgetType) {
        return false;
      }

      // Multi-city filter: when toggle is ON, show only multi-city guides
      if (isMultiCityFilter && !guide.is_Multicity) {
        return false;
      }

      // Location filter
      if (selectedLocation) {
        const guideLocations = extractLocationNames(guide);
        const locationMatches = guideLocations.some(
          (loc: string) => loc?.trim() === selectedLocation
        );
        if (!locationMatches) {
          return false;
        }
      }

      return true;
    });

    return filteredGuides;
  }, [allGuides, filters, isMultiCityFilter, selectedLocation]);

  // Handle filter changes
  const handleFilterChange = (filterKey: keyof FilterState, value: string | number | null) => {
    setFilters((prev) => ({
      ...prev,
      [filterKey]: value,
    }));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      guideType: null,
      category: null,
      numberOfDays: null,
      bestTimeToVisit: null,
      budgetType: null,
    });
    setIsMultiCityFilter(false);
    setSelectedLocation("");
  };

  // Check if any filter is active
  const hasActiveFilters = Object.values(filters).some((value) => value !== null) || isMultiCityFilter || selectedLocation !== "";

  // Helper function to get display label for budget type (convert enum to display format)
  const getBudgetTypeLabel = (value: string | null): string => {
    if (!value) return "";
    // Map enum values to display labels
    const budgetTypeMap: Record<string, string> = {
      "Budget": "Budget",
      "Mid_Range": "Mid-Range",
      "Luxury": "Luxury",
      "Backpacker": "Backpacker",
      "Ultra_Luxury": "Ultra-Luxury",
    };
    return budgetTypeMap[value] || value;
  };

  const handleGuideClick = (documentId: string) => {
    navigate(`/guides/${documentId}`);
  };

  const handleEditGuide = (documentId: string) => {
    navigate(`/guides/${documentId}/edit`);
  };

  const handleDeleteGuide = (documentId: string) => {
    setDeletingGuideId(documentId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (deletingGuideId) {
      deleteGuide({
        variables: { documentId: deletingGuideId },
      });
    }
  };

  const [updateGuide] = useMutation(UPDATE_GUIDE_MUTATION, {
    onCompleted: (data) => {
      const isPublic = data.updateGuide.Visibility;
      toast.success(`Guide is now ${isPublic ? 'Public' : 'Draft'}`);
    },
    onError: (error) => {
      toast.error(`Failed to update guide status: ${error.message}`);
    }
  });

  const handleToggleVisibility = (documentId: string, currentVisibility: boolean) => {
    updateGuide({
      variables: {
        documentId,
        data: {
          Visibility: !currentVisibility
        }
      },
      optimisticResponse: {
        updateGuide: {
          __typename: "Guide",
          documentId,
          Visibility: !currentVisibility,
        }
      }
    });
  };

  const guidesCount = guides.length;
  const username = user?.username || "User";

  return (
    <>
      <SEO
        title={`My Travel Guides - Manage & Create Guides | explorers`}
        description={`Manage and create your travel guides with explorers. ${guidesCount > 0 ? `You have ${guidesCount} travel guide${guidesCount > 1 ? 's' : ''} ready to share. ` : 'Start creating itinerary-based or theme-based travel guides to share your journey experiences.'} Organize your travel recommendations, create detailed itineraries, and share your exploration stories.`}
        keywords={[
          "travel guides dashboard",
          "manage travel guides",
          "create travel guides",
          "itinerary guides",
          "theme-based guides",
          "travel planning",
          "explorers guides",
          "travel guide creation",
          "journey planning",
          "destination guides",
          "travel recommendations",
          "curated travel guides",
          "travel exploration",
          "guide management",
          "travel itinerary creation"
        ]}
        canonical={createCanonicalUrl("/guides")}
        type="website"
        noIndex={true}
        siteName="explorers"
        author={username}
      />
      <div className="dashboard-theme bg-dashboard-bg min-h-screen">
        <div className="w-full h-full mx-auto max-w-5xl px-4 md:px-6 pt-12 md:pt-10 pb-16 md:pb-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-dashboard text-3xl font-poppins font-bold">
                  My Guides
                </h1>
                <p className="text-dashboard-light font-poppins text-sm mt-1">
                  Create and manage your personalized guides
                </p>
              </div>
              <div className="flex items-center justify-between w-full">
                {/* Filter button - only show when there are guides */}
                {!isLoading && allGuides.length > 0 ? (
                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`relative p-2 md:px-4 md:py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${hasActiveFilters
                        ? "bg-dashboard-accent hover:bg-dashboard-accent/90 text-white"
                        : "bg-dashboard-sidebar hover:bg-dashboard-card text-dashboard border border-dashboard"
                        }`}
                      title="Filters"
                    >
                      <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      <span className="hidden md:inline font-poppins text-sm">Filters</span>
                      {hasActiveFilters && (
                        <>
                          <span className="md:hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                            {Object.values(filters).filter(v => v !== null).length + (isMultiCityFilter ? 1 : 0) + (selectedLocation !== "" ? 1 : 0)}
                          </span>
                          <span className="hidden md:inline bg-dashboard-accent text-white text-xs px-2 py-0.5 rounded-full">
                            {Object.values(filters).filter(v => v !== null).length + (isMultiCityFilter ? 1 : 0) + (selectedLocation !== "" ? 1 : 0)}
                          </span>
                        </>
                      )}
                    </button>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="px-3 py-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-poppins text-xs md:text-sm transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                {/* Create Guide Button */}
                <Button
                  onClickHandler={() => navigate("/guides/new")}
                  variant="primary"
                  btnText="Create Guide"
                  endIcon={<AddIcon size="5" />}
                />
              </div>
            </div>

            {/* Desktop Filter Panel - Inline */}
            {showFilters && allGuides.length > 0 && (
              <div className="hidden md:block border-t border-dashboard mt-2 pt-2">
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                  {/* Guide Type Filter */}
                  <div>
                    <label className="block text-dashboard font-poppins text-xs font-medium mb-1">
                      Guide Type
                    </label>
                    <select
                      value={filters.guideType || ""}
                      onChange={(e) => handleFilterChange("guideType", e.target.value || null)}
                      className="w-full px-2 py-1 bg-dashboard-sidebar border border-dashboard rounded-lg text-dashboard font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                    >
                      <option value="">All Types</option>
                      {filterOptions.guideTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-dashboard font-poppins text-xs font-medium mb-1">
                      Category
                    </label>
                    <select
                      value={filters.category || ""}
                      onChange={(e) => handleFilterChange("category", e.target.value || null)}
                      className="w-full px-2 py-1 bg-dashboard-sidebar border border-dashboard rounded-lg text-dashboard font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                    >
                      <option value="">All Categories</option>
                      {filterOptions.categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Number of Days Filter */}
                  <div>
                    <label className="block text-dashboard font-poppins text-xs font-medium mb-1">
                      Number of Days
                    </label>
                    <select
                      value={filters.numberOfDays !== null ? filters.numberOfDays.toString() : ""}
                      onChange={(e) => handleFilterChange("numberOfDays", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 py-1 bg-dashboard-sidebar border border-dashboard rounded-lg text-dashboard font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                    >
                      <option value="">All Durations</option>
                      {filterOptions.numberOfDays.map((days) => (
                        <option key={days} value={days.toString()}>
                          {days} {days === 1 ? 'Day' : 'Days'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Best Time to Visit Filter */}
                  <div>
                    <label className="block text-dashboard font-poppins text-xs font-medium mb-1">
                      Best Time to Visit
                    </label>
                    <select
                      value={filters.bestTimeToVisit || ""}
                      onChange={(e) => handleFilterChange("bestTimeToVisit", e.target.value || null)}
                      className="w-full px-2 py-1 bg-dashboard-sidebar border border-dashboard rounded-lg text-dashboard font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                    >
                      <option value="">All Months</option>
                      {filterOptions.months.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Budget Type Filter */}
                  <div>
                    <label className="block text-dashboard font-poppins text-xs font-medium mb-1">
                      Budget Type
                    </label>
                    <select
                      value={filters.budgetType || ""}
                      onChange={(e) => handleFilterChange("budgetType", e.target.value || null)}
                      className="w-full px-2 py-1 bg-dashboard-sidebar border border-dashboard rounded-lg text-dashboard font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                    >
                      <option value="">All Budget Types</option>
                      {filterOptions.budgetTypes.map((budgetType) => (
                        <option key={budgetType} value={budgetType}>
                          {getBudgetTypeLabel(budgetType)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Multi-City Filter */}
                  <div>
                    <label className="block text-dashboard font-poppins text-xs font-medium mb-1">
                      Multi city
                    </label>
                    <div className="flex items-center gap-2">
                      <SwitchButton
                        isChecked={isMultiCityFilter}
                        onChange={() => setIsMultiCityFilter(!isMultiCityFilter)}
                        variant="dark"
                      />
                      <span className="text-dashboard-light font-poppins text-xs">
                        {isMultiCityFilter ? "Multi-City Only" : "All Guides"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="bg-dashboard-modal p-6 rounded-lg border border-red-500 shadow-dashboard-elevated text-center">
                <h1 className="text-red-400 font-poppins font-semibold text-lg md:text-xl mb-2">
                  Error Loading Guides
                </h1>
                <p className="text-gray-300 font-poppins text-sm md:text-base">
                  {error.message}
                </p>
              </div>
            </div>
          )}

          {/* Mobile Filter Sidebar */}
          {allGuides.length > 0 && (
            <React.Fragment>
              {/* Backdrop/Overlay */}
              <div
                className={`md:hidden fixed inset-0 bg-black/60 z-[10000] transition-all duration-300 ease-out ${showFilters ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                  }`}
                onClick={() => setShowFilters(false)}
              />

              {/* Sidebar */}
              <div
                className={`md:hidden fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-dashboard-sidebar z-[10001] shadow-dashboard-elevated transform transition-transform duration-300 ease-out border-r border-dashboard ${showFilters ? "translate-x-0" : "-translate-x-full"
                  }`}
              >
                <div className="flex flex-col h-full">
                  {/* Sidebar Header */}
                  <div className="flex items-center justify-between p-4 border-b border-dashboard">
                    <h2 className="text-dashboard font-poppins font-semibold text-lg">Filters</h2>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="p-2 hover:bg-dashboard-card rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-dashboard" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Sidebar Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Guide Type Filter */}
                    <div>
                      <label className="block text-dashboard font-poppins text-sm font-medium mb-2">
                        Guide Type
                      </label>
                      <select
                        value={filters.guideType || ""}
                        onChange={(e) => handleFilterChange("guideType", e.target.value || null)}
                        className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard rounded-lg text-dashboard font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                      >
                        <option value="">All Types</option>
                        {filterOptions.guideTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-dashboard font-poppins text-sm font-medium mb-2">
                        Category
                      </label>
                      <select
                        value={filters.category || ""}
                        onChange={(e) => handleFilterChange("category", e.target.value || null)}
                        className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard rounded-lg text-dashboard font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                      >
                        <option value="">All Categories</option>
                        {filterOptions.categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Number of Days Filter */}
                    <div>
                      <label className="block text-dashboard font-poppins text-sm font-medium mb-2">
                        Number of Days
                      </label>
                      <select
                        value={filters.numberOfDays !== null ? filters.numberOfDays.toString() : ""}
                        onChange={(e) => handleFilterChange("numberOfDays", e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard rounded-lg text-dashboard font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                      >
                        <option value="">All Durations</option>
                        {filterOptions.numberOfDays.map((days) => (
                          <option key={days} value={days.toString()}>
                            {days} {days === 1 ? 'Day' : 'Days'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Best Time to Visit Filter */}
                    <div>
                      <label className="block text-dashboard font-poppins text-sm font-medium mb-2">
                        Best Time to Visit
                      </label>
                      <select
                        value={filters.bestTimeToVisit || ""}
                        onChange={(e) => handleFilterChange("bestTimeToVisit", e.target.value || null)}
                        className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard rounded-lg text-dashboard font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                      >
                        <option value="">All Months</option>
                        {filterOptions.months.map((month) => (
                          <option key={month} value={month}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Budget Type Filter */}
                    <div>
                      <label className="block text-dashboard font-poppins text-sm font-medium mb-2">
                        Budget Type
                      </label>
                      <select
                        value={filters.budgetType || ""}
                        onChange={(e) => handleFilterChange("budgetType", e.target.value || null)}
                        className="w-full px-3 py-2.5 bg-dashboard-bg border border-dashboard rounded-lg text-dashboard font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                      >
                        <option value="">All Budget Types</option>
                        {filterOptions.budgetTypes.map((budgetType) => (
                          <option key={budgetType} value={budgetType}>
                            {getBudgetTypeLabel(budgetType)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Multi-City Filter */}
                    <div>
                      <label className="block text-dashboard font-poppins text-sm font-medium mb-2">
                        Multi city
                      </label>
                      <div className="flex items-center gap-3">
                        <SwitchButton
                          isChecked={isMultiCityFilter}
                          onChange={() => setIsMultiCityFilter(!isMultiCityFilter)}
                          variant="dark"
                        />
                        <span className="text-dashboard-light font-poppins text-sm">
                          {isMultiCityFilter ? "Multi-City Only" : "All Guides"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Footer */}
                  <div className="p-4 border-t border-dashboard space-y-3">
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 font-poppins text-sm font-medium transition-colors"
                      >
                        Clear All Filters
                      </button>
                    )}
                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-full px-4 py-2.5 bg-dashboard-accent hover:bg-dashboard-accent/90 rounded-lg text-white font-poppins text-sm font-medium transition-colors"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            </React.Fragment>
          )}

          {/* Location Tags */}
          {!isLoading && !error && filterOptions.locations.length > 0 && (
            <div className="mb-4">
              <div className="overflow-x-auto scrollbar-hide whitespace-nowrap py-3">
                <div className="flex gap-3">
                  <Button
                    btnText="All Locations"
                    type="button"
                    variant={selectedLocation === "" ? "tagSelected" : "tag"}
                    onClickHandler={() => setSelectedLocation("")}
                    size="xsmall"
                  />
                  {filterOptions.locations.map((location: string, index: number) => (
                    <Button
                      key={`${location}-${index}`}
                      btnText={location}
                      type="button"
                      variant={selectedLocation === location ? "tagSelected" : "tag"}
                      onClickHandler={() => setSelectedLocation(location)}
                      size="xsmall"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Guides Grid */}
          {!error && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-16 md:mb-0">
              {isLoading ? (
                // Skeleton cards — sit directly in the grid, match guide card proportions
                <GuideCardSkeleton count={6} variant="dashboard" />
              ) : guides.length > 0 ? (
                guides.map((guide) => (
                  <GuideCard
                    key={guide.documentId}
                    guide={guide}
                    onClickHandler={handleGuideClick}
                    onEdit={handleEditGuide}
                    onDelete={handleDeleteGuide}
                    onToggleVisibility={handleToggleVisibility}
                  />
                ))
              ) : (
                <div className="col-span-1 md:col-span-3 flex flex-col items-center justify-center min-h-[50vh]">
                  <div className="bg-dashboard-modal p-6 rounded-lg border border-dashboard-accent shadow-dashboard-elevated text-center">
                    <h1 className="text-white font-poppins font-semibold text-lg md:text-xl mb-2">
                      No Guides Yet
                    </h1>
                    <p className="text-gray-300 font-poppins text-sm md:text-base mb-4">
                      Create your first travel guide to get started!
                    </p>
                    <div className="flex justify-center">
                      <Button
                        onClickHandler={() => navigate("/guides/new")}
                        variant="primary"
                        btnText="Create Your First Guide"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <Modal
              isOpen={showDeleteModal}
              onClose={() => !isDeleting && setShowDeleteModal(false)}
            >
              <div className="p-4">
                <h2 className="text-md font-poppins font-medium text-dashboard-light">
                  Confirm Deletion
                </h2>
                <p className="font-poppins text-sm text-[hsl(var(--muted-foreground))] mt-2">
                  Are you sure you want to delete this guide? This action cannot
                  be undone and will also delete all sections associated with this
                  guide.
                </p>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    btnText="Cancel"
                    onClickHandler={() => setShowDeleteModal(false)}
                    size="small"
                    variant="google"
                    disabled={isDeleting}
                  />
                  <Button
                    btnText={isDeleting ? "Deleting..." : "Delete Guide"}
                    onClickHandler={handleConfirmDelete}
                    size="small"
                    variant="danger"
                    isLoading={isDeleting}
                    disabled={isDeleting}
                  />
                </div>
              </div>
            </Modal>
          )}
        </div >
      </div >
    </>
  );
};

export default GuidesPage;
