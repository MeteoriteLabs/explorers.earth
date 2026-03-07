import { memo, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useParams, useNavigate } from "react-router-dom";
import GuideCardSkeleton from "../../../components/ui/GuideCardSkeleton";
import PublicGuideCard from "../../Guides/components/PublicGuideCard";
import { GET_PUBLIC_GUIDES_QUERY } from "../../Guides/api/queries";
import { getPublicAccountBasicQuery } from "../api/query";
import type { Guide } from "../../Guides/types";
import { useTrackAnalytics } from "../../../services/analyticsService";
import SEO from "../../../components/SEO";
import { createCanonicalUrl } from "../../../utils/getCurrentDomain";
import { toUrlSlug } from "../../../utils/formatAddress";
import Button from "../../../components/ui/Button";
import SwitchButton from "../../../components/ui/SwitchButton";
import { toast } from "sonner";

interface FilterState {
  guideType: string | null;
  category: string | null;
  numberOfDays: number | null;
  bestTimeToVisit: string | null;
  budgetType: string | null;
}

const PublicGuides = memo(() => {
  const { username } = useParams();
  const navigate = useNavigate();
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

  // First, get account data to get account documentId
  const { data: accountData, loading: accountLoading } = useQuery(
    getPublicAccountBasicQuery,
    {
      variables: {
        filters: {
          username: {
            eq: username,
          },
        },
      },
      skip: !username,
    }
  );

  const accountDocumentId = accountData?.accounts?.[0]?.documentId;

  // Fetch public guides with account filter and visibility filter
  const {
    data: guidesData,
    loading: guidesLoading,
    error,
  } = useQuery(GET_PUBLIC_GUIDES_QUERY, {
    variables: {
      filters: {
        and: [
          {
            account: {
              documentId: {
                eq: accountDocumentId,
              },
            },
          },
          {
            Visibility: {
              eq: true,
            },
          },
        ],
      },
      pagination: {
        limit: 100,
      },
    },
    skip: !accountDocumentId,
    fetchPolicy: "network-only",
  });

  const allGuides: Guide[] = guidesData?.guides || [];
  const account = accountData?.accounts?.[0];
  const loading = accountLoading || guidesLoading;
  const analytics = useTrackAnalytics({
    accountId: account?.documentId || "",
    pageName: "public-guides",
    pageUsername: username,
    autoTrackView: true,
  });

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
        const departure = placeDetails.departure || placeDetails.from;
        if (departure?.Place_Name) {
          locations.push(departure.Place_Name);
        } else if (departure?.Place_Address) {
          locations.push(departure.Place_Address);
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

        // Arrival city
        const arrival = placeDetails.arrival || placeDetails.to;
        if (arrival?.Place_Name) {
          locations.push(arrival.Place_Name);
        } else if (arrival?.Place_Address) {
          locations.push(arrival.Place_Address);
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
      "Ultra_Luxury": "Ultra-Luxury"
    };
    return budgetTypeMap[value] || value;
  };

  // Handle guide click - navigate to guide detail page
  const handleGuideClick = (guide: Guide) => {
    // Use slug if available, otherwise use documentId as fallback
    const slug = guide.slug || toUrlSlug(guide.Title) || guide.documentId;
    navigate(`/${username}/guides/${slug}`);
  };

  // SEO data
  const profileName = account?.Account_Name || username || "User";
  const guidesCount = guides.length;
  const totalGuidesCount = allGuides.length;
  const pageTitle = `${profileName} | Travel Guides | explorers`;
  const metaDescription = guidesCount > 0
    ? `Explore ${guidesCount} travel guide${guidesCount > 1 ? 's' : ''} by ${profileName} on explorers. Discover curated itineraries, travel tips, and destination insights.`
    : `Browse travel guides by ${profileName} on explorers. Discover curated itineraries and destination insights.`;

  const keywords = useMemo(() => [
    `${profileName} explorers guides`,
    `${username} explorers guides`,
    "explorers travel guides",
    "explorers travel itineraries",
    "explorers destination guides",
    "explorers travel tips",
    "explorers curated guides",
    `${profileName} travel guides`,
    `${username} travel guides`,
    "travel guides",
    "travel itineraries",
    "destination guides",
    "travel recommendations",
  ], [profileName, username]);

  const profileImage = account?.profile_picture?.url || account?.bg_picture?.url;
  const currentUrl = createCanonicalUrl(`/${username}/guides`);


  // Check if account exists after loading is complete
  if (!loading && !account) {
    return (
      <>
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={keywords}
          canonical={currentUrl}
        />
        <div className="flex bg-black items-center justify-center min-h-screen">
          <div className="text-white text-center">
            <h2 className="text-lg font-poppins font-semibold mb-2">
              Profile not found
            </h2>
            <p className="text-gray-400 text-sm">
              This user profile is not available.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={pageTitle}
        description={metaDescription}
        keywords={keywords}
        canonical={currentUrl}
        image={profileImage}
        url={currentUrl}
        type="website"
        author={profileName}
        siteName="explorers"
      />

      <div className="h-full bg-black min-h-screen overflow-auto preview-scroll pb-20">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
          <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
            <span
              className="text-white font-bold text-2xl cursor-pointer"
              onClick={() => navigate("/")}
            >
              explorers.earth
            </span>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/${username}/guides`;
                  if (navigator.share) {
                    navigator.share({
                      title: `${account?.Account_Name || username}'s Guides`,
                      text: "Check out these travel guides!",
                      url: shareUrl,
                    }).catch(() => { });
                  } else {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied!");
                    } catch (error) {
                      console.error("Failed to copy text:", error);
                    }
                  }
                  analytics.trackClick('share-button', { context: 'guides-header' });
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Share"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/${username}/guides`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied!");
                  } catch (error) {
                    console.error("Failed to copy text:", error);
                  }
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Copy Link"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Guides Content */}
        <div className="md:max-w-5xl md:mx-auto mt-14">
          <div className="bg-black rounded-lg p-4 mx-4 mt-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 relative">
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">
                  Travel Guides
                </h1>
                <p className="text-gray-400 font-poppins text-xs md:text-sm">
                  {hasActiveFilters
                    ? `${guidesCount} of ${totalGuidesCount} guide${totalGuidesCount > 1 ? 's' : ''}`
                    : guidesCount > 0
                      ? `${guidesCount} guide${guidesCount > 1 ? 's' : ''} available`
                      : "No guides available yet"}
                </p>
              </div>

              {/* Mobile: Filter button - Right aligned */}
              <div className="md:hidden absolute right-0 top-0">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`relative p-2 rounded-lg transition-colors ${hasActiveFilters
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-white"
                    }`}
                  title="Filters"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                      {Object.values(filters).filter(v => v !== null).length + (isMultiCityFilter ? 1 : 0) + (selectedLocation !== "" ? 1 : 0)}
                    </span>
                  )}
                </button>
              </div>

              {/* Desktop: Filter button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="hidden md:flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white font-poppins text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {Object.values(filters).filter(v => v !== null).length + (isMultiCityFilter ? 1 : 0) + (selectedLocation !== "" ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Desktop Filter Panel - Inline */}
            {showFilters && (
              <div className="hidden md:block border-t border-gray-700 pt-2 mt-2">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  {/* Guide Type Filter */}
                  <div>
                    <label className="block text-white font-poppins text-xs font-medium mb-1">
                      Guide Type
                    </label>
                    <select
                      value={filters.guideType || ""}
                      onChange={(e) => handleFilterChange("guideType", e.target.value || null)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-xs font-medium mb-1">
                      Category
                    </label>
                    <select
                      value={filters.category || ""}
                      onChange={(e) => handleFilterChange("category", e.target.value || null)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-xs font-medium mb-1">
                      Number of Days
                    </label>
                    <select
                      value={filters.numberOfDays !== null ? filters.numberOfDays.toString() : ""}
                      onChange={(e) => handleFilterChange("numberOfDays", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-xs font-medium mb-1">
                      Best Time to Visit
                    </label>
                    <select
                      value={filters.bestTimeToVisit || ""}
                      onChange={(e) => handleFilterChange("bestTimeToVisit", e.target.value || null)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-xs font-medium mb-1">
                      Budget Type
                    </label>
                    <select
                      value={filters.budgetType || ""}
                      onChange={(e) => handleFilterChange("budgetType", e.target.value || null)}
                      className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-xs font-medium mb-1">
                      Multi city
                    </label>
                    <div className="flex items-center gap-2">
                      <SwitchButton
                        isChecked={isMultiCityFilter}
                        onChange={() => setIsMultiCityFilter(!isMultiCityFilter)}
                        variant="purple"
                      />
                      <span className="text-white/70 font-poppins text-xs">
                        {isMultiCityFilter ? "Multi-City Only" : "All Guides"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={handleClearFilters}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-poppins text-xs transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Filter Sidebar */}
          <>
            {/* Backdrop/Overlay */}
            <div
              className={`md:hidden fixed inset-0 bg-black/60 z-40 transition-all duration-300 ease-out ${showFilters ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                }`}
              onClick={() => setShowFilters(false)}
            />

            {/* Sidebar */}
            <div
              className={`md:hidden fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-gray-900 z-50 shadow-2xl transform transition-transform duration-300 ease-out ${showFilters ? "translate-x-0" : "-translate-x-full"
                }`}
            >
              <div className="flex flex-col h-full">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                  <h2 className="text-white font-poppins font-semibold text-lg">Filters</h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sidebar Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Guide Type Filter */}
                  <div>
                    <label className="block text-white font-poppins text-sm font-medium mb-2">
                      Guide Type
                    </label>
                    <select
                      value={filters.guideType || ""}
                      onChange={(e) => handleFilterChange("guideType", e.target.value || null)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-sm font-medium mb-2">
                      Category
                    </label>
                    <select
                      value={filters.category || ""}
                      onChange={(e) => handleFilterChange("category", e.target.value || null)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-sm font-medium mb-2">
                      Number of Days
                    </label>
                    <select
                      value={filters.numberOfDays !== null ? filters.numberOfDays.toString() : ""}
                      onChange={(e) => handleFilterChange("numberOfDays", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-sm font-medium mb-2">
                      Best Time to Visit
                    </label>
                    <select
                      value={filters.bestTimeToVisit || ""}
                      onChange={(e) => handleFilterChange("bestTimeToVisit", e.target.value || null)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-sm font-medium mb-2">
                      Budget Type
                    </label>
                    <select
                      value={filters.budgetType || ""}
                      onChange={(e) => handleFilterChange("budgetType", e.target.value || null)}
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-poppins text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-white font-poppins text-sm font-medium mb-2">
                      Multi city
                    </label>
                    <div className="flex items-center gap-3">
                      <SwitchButton
                        isChecked={isMultiCityFilter}
                        onChange={() => setIsMultiCityFilter(!isMultiCityFilter)}
                        variant="purple"
                      />
                      <span className="text-white/70 font-poppins text-sm">
                        {isMultiCityFilter ? "Multi-City Only" : "All Guides"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-gray-700 space-y-3">
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-poppins text-sm transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-poppins text-sm font-medium transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </>

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
              <div className="bg-black p-6 rounded-lg border border-red-500 text-center">
                <h1 className="text-red-400 font-poppins font-semibold text-lg md:text-xl mb-2">
                  Error Loading Guides
                </h1>
                <p className="text-gray-300 font-poppins text-sm md:text-base">
                  {error.message}
                </p>
              </div>
            </div>
          )}

          {/* Location Tags - Similar to MapView */}
          {!error && filterOptions.locations.length > 0 && (
            <div className="px-4 mb-4">
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
            <div className="px-4 mb-14">
              <div className="bg-black rounded-lg py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 overflow-visible">
                  {loading ? (
                    // Skeleton cards — same grid, public (dark) variant
                    <GuideCardSkeleton count={6} variant="public" />
                  ) : guides.length > 0 ? (
                    guides.map((guide) => (
                      <PublicGuideCard
                        key={guide.documentId}
                        guide={guide}
                        onClickHandler={() => handleGuideClick(guide)}
                      />
                    ))
                  ) : (
                    <div className="col-span-1 md:col-span-3 flex flex-col items-center justify-center min-h-[30vh] py-10 text-center">
                      <h1 className="text-white font-poppins font-semibold text-lg md:text-xl mb-2">
                        No Guides Yet
                      </h1>
                      <p className="text-gray-400 font-poppins text-sm md:text-base max-w-md">
                        {account?.Account_Name} hasn't shared any travel guides yet. Check back later for amazing travel insights!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
});

PublicGuides.displayName = "PublicGuides";

export default PublicGuides;

