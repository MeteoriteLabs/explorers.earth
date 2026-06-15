import { memo, useMemo, useState, useEffect } from "react";
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
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Play, Star } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeHeroIndex, setActiveHeroIndex] = useState<number>(0);

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

  // Helper function to extract plain text from Description (which can be a string or rich text block array)
  const getDescriptionText = (description: any): string => {
    if (!description) return "";
    if (typeof description === "string") return description;
    if (Array.isArray(description)) {
      return description
        .map((block: any) => block.children?.map((child: any) => child.text).join(" ") || "")
        .join(" ");
    }
    return "";
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

  // Extract and sort pinned guides for slideshow
  const pinnedGuides = useMemo(() => {
    return allGuides
      .filter((guide) => guide.is_pinned === true)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allGuides]);

  // Slideshow auto-rotation timer (6 seconds)
  useEffect(() => {
    if (pinnedGuides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % pinnedGuides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [pinnedGuides.length]);

  // Guard activeHeroIndex range on slides update
  useEffect(() => {
    if (activeHeroIndex >= pinnedGuides.length) {
      setActiveHeroIndex(0);
    }
  }, [pinnedGuides.length, activeHeroIndex]);

  // Filter guides based on selected filters and text search query
  const guides = useMemo(() => {
    const filteredGuides = allGuides.filter((guide) => {
      // Text Search Query filter (matches title, description, location names, and tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = guide.Title?.toLowerCase().includes(query);
        const descriptionText = getDescriptionText(guide.Description);
        const descMatch = descriptionText.toLowerCase().includes(query);
        const locations = extractLocationNames(guide);
        const locationMatch = locations.some((loc) =>
          loc.toLowerCase().includes(query)
        );
        const tagMatch = guide.Guide_Tags?.some((tag) =>
          tag.toLowerCase().includes(query)
        );

        if (!titleMatch && !descMatch && !locationMatch && !tagMatch) {
          return false;
        }
      }

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

      // Location tag filter
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
  }, [allGuides, filters, isMultiCityFilter, selectedLocation, searchQuery]);

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
    setSearchQuery("");
  };

  // Check if any filter is active
  const hasActiveFilters =
    Object.values(filters).some((value) => value !== null) ||
    isMultiCityFilter ||
    selectedLocation !== "" ||
    searchQuery !== "";

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
    // Track guide card click for analytics
    analytics.trackClick('guide-card', {
      id: guide.documentId,
      title: guide.Title,
      guideType: guide.Guide_Type,
      category: Array.isArray(guide.Category) ? guide.Category[0] : guide.Category,
    });
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

      <div className="h-full bg-black min-h-screen overflow-auto preview-scroll pb-20 pt-14">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
          <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
            <span
              className="text-white font-bold text-2xl cursor-pointer font-poppins"
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
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center cursor-pointer"
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
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center cursor-pointer"
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
        <div className="md:max-w-5xl md:mx-auto">
          
          {/* Featured Guides Slideshow Hero (only shown if pinned guides exist) */}
          {!error && !loading && pinnedGuides.length > 0 && (
            <>
              {/* Carousel Hero Section - Desktop Layout */}
              <div className="hidden md:block w-full mb-6 mt-4 px-4">
                <div className="relative w-full h-[60vh] min-h-[500px] max-h-[700px] rounded-2xl overflow-hidden bg-black shadow-2xl group/hero max-w-4xl mx-auto">
                  {/* Background Presentation */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={pinnedGuides[activeHeroIndex].documentId}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="absolute inset-0 cursor-pointer"
                      onClick={() => handleGuideClick(pinnedGuides[activeHeroIndex])}
                    >
                      <img
                        src={pinnedGuides[activeHeroIndex].Guide_Media?.[0]?.url || "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200"}
                        alt={pinnedGuides[activeHeroIndex].Title}
                        className="w-full h-full object-cover opacity-90"
                      />
                      {/* Gradients to fade bottom and left */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[7] pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[7] pointer-events-none" />
                    </motion.div>
                  </AnimatePresence>

                  {/* Featured Heading */}
                  <div className="absolute top-8 left-8 md:top-12 md:left-12 z-[15] pointer-events-none flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center drop-shadow-lg">
                      <span className="w-1.5 h-6 bg-yellow-400 mr-2.5 rounded-full inline-block"></span>
                      Featured
                    </h2>
                  </div>

                  {/* Main Content Area */}
                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 z-[10] pointer-events-none">
                    <div className="flex justify-between items-end w-full">
                      {/* Left Text Detail Section */}
                      <div className="w-full lg:w-1/2 flex flex-col gap-4">
                        <motion.h1
                          key={`title-${pinnedGuides[activeHeroIndex].documentId}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight font-poppins"
                        >
                          {pinnedGuides[activeHeroIndex].Title}
                        </motion.h1>

                        {(() => {
                          const guide = pinnedGuides[activeHeroIndex];
                          let placeDetails: any = {};
                          if (guide.Place_Details) {
                            if (typeof guide.Place_Details === "string") {
                              try { placeDetails = JSON.parse(guide.Place_Details); } catch (e) {}
                            } else { placeDetails = guide.Place_Details; }
                          }
                          const rating = placeDetails.Rating || 5.0;

                          return (
                            <motion.div
                              key={`meta-${guide.documentId}`}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                              className="flex items-center gap-3 text-sm md:text-base text-white/80 font-semibold"
                            >
                              <span>★ {rating.toFixed(1)}</span>
                              <span className="text-white/40">•</span>
                              <span>{guide.Number_Of_Days || 0} {guide.Number_Of_Days === 1 ? "Day" : "Days"}</span>
                              {guide.Guide_Type && (
                                <>
                                  <span className="text-white/40">•</span>
                                  <span>{guide.Guide_Type}</span>
                                </>
                              )}
                              {guide.Budget_Type && (
                                <>
                                  <span className="text-white/40">•</span>
                                  <span>{getBudgetTypeLabel(guide.Budget_Type)}</span>
                                </>
                              )}
                            </motion.div>
                          );
                        })()}

                        <motion.p
                          key={`desc-${pinnedGuides[activeHeroIndex].documentId}`}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                          className="text-white/70 text-sm md:text-base leading-relaxed line-clamp-3 max-w-xl"
                        >
                          {getDescriptionText(pinnedGuides[activeHeroIndex].Description)}
                        </motion.p>

                        <motion.div
                          key={`btns-${pinnedGuides[activeHeroIndex].documentId}`}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                          className="flex items-center gap-4 mt-2 pointer-events-auto"
                        >
                          <button
                            onClick={() => handleGuideClick(pinnedGuides[activeHeroIndex])}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-xl shadow-blue-500/20 transition-all hover:scale-105 cursor-pointer border-none"
                          >
                            Read Guide ➔
                          </button>
                        </motion.div>
                      </div>

                      {/* Right Bottom Featured Thumbnail Row */}
                      {pinnedGuides.length > 1 && (
                        <div className="hidden lg:flex flex-col items-end max-w-[50%] z-20 pointer-events-auto">
                          <div className="flex gap-3 py-4 px-2">
                            {pinnedGuides.map((guide, index) => {
                              const isSelected = index === activeHeroIndex;
                              return (
                                <button
                                  key={`thumb-${guide.documentId}`}
                                  onClick={() => setActiveHeroIndex(index)}
                                  className={`relative flex-shrink-0 w-32 aspect-video rounded-md overflow-hidden transition-all duration-300 cursor-pointer ${isSelected ? 'ring-2 ring-white scale-110 z-10 shadow-xl' : 'opacity-60 hover:opacity-100 hover:scale-105 filter brightness-75 hover:brightness-100'}`}
                                >
                                  <img
                                    src={guide.Guide_Media?.[0]?.url || "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200"}
                                    alt={guide.Title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/20" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Carousel Hero Section - Mobile Layout */}
              <div className="md:hidden w-full mb-4 touch-pan-y px-0">
                <div className="relative w-full h-[65vh] min-h-[480px] max-h-[650px] overflow-x-hidden flex items-center justify-start py-8">
                  <div className="absolute inset-y-4 left-4 right-14">
                    {pinnedGuides.map((guide, i) => {
                      const diff = (i - activeHeroIndex + pinnedGuides.length) % pinnedGuides.length;

                      let position = "hiddenRight";
                      if (diff === 0) position = "active";
                      else if (diff === 1) position = "next";
                      else if (diff === 2) position = "nextNext";
                      else if (diff === pinnedGuides.length - 1) position = "hiddenLeft";

                      const variants = {
                        active: { x: 0, scale: 1, zIndex: 10, opacity: 1 },
                        next: { x: "12%", scale: 0.9, zIndex: 5, opacity: 1 },
                        nextNext: { x: "24%", scale: 0.8, zIndex: 4, opacity: 1 },
                        hiddenRight: { x: "40%", scale: 0.7, zIndex: 1, opacity: 0 },
                        hiddenLeft: { x: "-110%", scale: 1, zIndex: 11, opacity: 0 }
                      };

                      const handleDragEnd = (_e: any, { offset, velocity }: PanInfo) => {
                        if (offset.x < -50 || velocity.x < -300) {
                          setActiveHeroIndex((prev) => (prev + 1) % pinnedGuides.length);
                        } else if (offset.x > 50 || velocity.x > 300) {
                          setActiveHeroIndex((prev) => (prev - 1 + pinnedGuides.length) % pinnedGuides.length);
                        }
                      };

                      let placeDetails: any = {};
                      if (guide.Place_Details) {
                        if (typeof guide.Place_Details === "string") {
                          try { placeDetails = JSON.parse(guide.Place_Details); } catch (e) {}
                        } else { placeDetails = guide.Place_Details; }
                      }
                      const rating = placeDetails.Rating || 5.0;

                      return (
                        <motion.div
                          key={guide.documentId}
                          variants={variants}
                          initial={false}
                          animate={position}
                          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                          drag={diff === 0 ? "x" : false}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.8}
                          onDragEnd={handleDragEnd}
                          className={`absolute inset-0 h-full rounded-2xl overflow-hidden shadow-2xl bg-[#1a2332] border border-white/10 ${diff === 0 ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                          onClick={() => {
                            if (diff === 0) {
                              handleGuideClick(guide);
                            }
                          }}
                        >
                          <img
                            src={guide.Guide_Media?.[0]?.url || "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200"}
                            alt={guide.Title}
                            className="w-full h-full object-cover select-none pointer-events-none filter contrast-125"
                          />

                          {/* Gradient dark overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10 pointer-events-none" />

                          {/* Featured Tag Banner */}
                          <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-auto z-20">
                            <div className="flex items-center pointer-events-none drop-shadow-md">
                              <span className="w-1 h-5 bg-yellow-400 mr-2 rounded-full inline-block"></span>
                              <h2 className="text-lg font-bold text-white tracking-tight">Featured</h2>
                            </div>
                          </div>

                          {/* Title & Metadata */}
                          <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-1.5 pointer-events-none z-20">
                            <h2 className="text-3xl font-poppins font-black text-white leading-tight drop-shadow-xl select-none">
                              {guide.Title}
                            </h2>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/80 font-semibold tracking-wide mt-1">
                              <span>★ {rating.toFixed(1)}</span>
                              <span className="text-white/40">•</span>
                              <span>{guide.Number_Of_Days || 0} {guide.Number_Of_Days === 1 ? "Day" : "Days"}</span>
                              {guide.Guide_Type && (
                                <>
                                  <span className="text-white/40">•</span>
                                  <span>{guide.Guide_Type}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-4 pointer-events-auto">
                              <button
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl border-none cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGuideClick(guide);
                                }}
                              >
                                Read Guide ➔
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="bg-black rounded-lg p-4 mx-4 mb-2">
            
            {/* Header Title & Side-by-side search row */}
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">
                  Travel Guides
                </h1>
                <p className="text-gray-400 font-poppins text-xs md:text-sm">
                  {hasActiveFilters
                    ? `${guidesCount} of ${totalGuidesCount} guide${totalGuidesCount !== 1 ? 's' : ''}`
                    : guidesCount > 0
                      ? `${guidesCount} guide${guidesCount !== 1 ? 's' : ''} available`
                      : "No guides available yet"}
                </p>
              </div>

              {/* Search Box & Filters Toggle Button */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 h-9">
                  <svg className="w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    className="bg-transparent border-none text-white text-xs font-poppins w-full outline-none placeholder:text-white/45"
                    placeholder="Search guides, cities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/85 hover:bg-white/[0.08] transition-colors cursor-pointer`}
                  aria-label="Filters"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {hasActiveFilters && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Desktop Filter Panel - Inline */}
            {showFilters && (
              <div className="hidden md:block bg-[#1a2332] border border-white/[0.08] rounded-[14px] p-4 mb-4 mt-1">
                <div className="grid grid-cols-4 gap-3">
                  {/* Guide Type Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                      Guide Type
                    </label>
                    <select
                      value={filters.guideType || ""}
                      onChange={(e) => handleFilterChange("guideType", e.target.value || null)}
                      className="w-full bg-black/20 border border-white/[0.08] rounded px-2 py-1.5 text-white text-[0.72rem] font-poppins outline-none cursor-pointer"
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
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                      Category
                    </label>
                    <select
                      value={filters.category || ""}
                      onChange={(e) => handleFilterChange("category", e.target.value || null)}
                      className="w-full bg-black/20 border border-white/[0.08] rounded px-2 py-1.5 text-white text-[0.72rem] font-poppins outline-none cursor-pointer"
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
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                      Duration
                    </label>
                    <select
                      value={filters.numberOfDays !== null ? filters.numberOfDays.toString() : ""}
                      onChange={(e) => handleFilterChange("numberOfDays", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full bg-black/20 border border-white/[0.08] rounded px-2 py-1.5 text-white text-[0.72rem] font-poppins outline-none cursor-pointer"
                    >
                      <option value="">All Durations</option>
                      {filterOptions.numberOfDays.map((days) => (
                        <option key={days} value={days.toString()}>
                          {days} {days === 1 ? 'Day' : 'Days'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Budget Type Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                      Budget
                    </label>
                    <select
                      value={filters.budgetType || ""}
                      onChange={(e) => handleFilterChange("budgetType", e.target.value || null)}
                      className="w-full bg-black/20 border border-white/[0.08] rounded px-2 py-1.5 text-white text-[0.72rem] font-poppins outline-none cursor-pointer"
                    >
                      <option value="">All Budget Types</option>
                      {filterOptions.budgetTypes.map((budgetType) => (
                        <option key={budgetType} value={budgetType}>
                          {getBudgetTypeLabel(budgetType)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Additional Inline Controls */}
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
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
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-lg text-white font-poppins text-xs transition-colors cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Filter Sidebar Drawer */}
          <>
            {/* Backdrop Shroud */}
            <div
              className={`md:hidden fixed inset-0 bg-black/60 z-[10000] transition-all duration-300 ease-out ${
                showFilters ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
              }`}
              onClick={() => setShowFilters(false)}
            />

            {/* Slide-out Drawer Panel */}
            <div
              className={`md:hidden fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-[#111622] z-[10001] shadow-2xl border-r border-white/10 transform transition-transform duration-300 ease-out flex flex-col ${
                showFilters ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-white font-poppins font-semibold text-lg">Filters</h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 text-white/60 hover:text-white rounded-lg transition-colors text-xl font-light cursor-pointer"
                  aria-label="Close filters"
                >
                  &times;
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Guide Type Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                    Guide Type
                  </label>
                  <select
                    value={filters.guideType || ""}
                    onChange={(e) => handleFilterChange("guideType", e.target.value || null)}
                    className="w-full px-3 py-2 bg-black/20 border border-white/[0.08] rounded-lg text-white font-poppins text-sm focus:outline-none cursor-pointer"
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                    Category
                  </label>
                  <select
                    value={filters.category || ""}
                    onChange={(e) => handleFilterChange("category", e.target.value || null)}
                    className="w-full px-3 py-2 bg-black/20 border border-white/[0.08] rounded-lg text-white font-poppins text-sm focus:outline-none cursor-pointer"
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                    Duration
                  </label>
                  <select
                    value={filters.numberOfDays !== null ? filters.numberOfDays.toString() : ""}
                    onChange={(e) => handleFilterChange("numberOfDays", e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 bg-black/20 border border-white/[0.08] rounded-lg text-white font-poppins text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="">All Durations</option>
                    {filterOptions.numberOfDays.map((days) => (
                      <option key={days} value={days.toString()}>
                        {days} {days === 1 ? 'Day' : 'Days'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Budget Type Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                    Budget
                  </label>
                  <select
                    value={filters.budgetType || ""}
                    onChange={(e) => handleFilterChange("budgetType", e.target.value || null)}
                    className="w-full px-3 py-2 bg-black/20 border border-white/[0.08] rounded-lg text-white font-poppins text-sm focus:outline-none cursor-pointer"
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
                <div className="flex flex-col gap-2 pt-2">
                  <label className="text-[0.62rem] text-white/50 font-bold uppercase tracking-wider font-poppins">
                    Multi City
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
              <div className="p-4 border-t border-white/10 space-y-3 bg-black/20">
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-poppins text-sm transition-colors cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-poppins text-sm font-medium transition-colors cursor-pointer"
                >
                  Apply Filters
                </button>
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

          {/* Location Tags */}
          {!error && filterOptions.locations.length > 0 && (
            <div className="px-4 mb-2">
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
              <div className="bg-black rounded-lg py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 overflow-visible">
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
                    <div className="col-span-2 md:col-span-3 flex flex-col items-center justify-center min-h-[30vh] py-10 text-center">
                      <h1 className="text-white font-poppins font-semibold text-lg md:text-xl mb-2">
                        No Guides Yet
                      </h1>
                      <p className="text-gray-400 font-poppins text-sm md:text-base max-w-md">
                        {account?.Account_Name} has no guides matching these filters. Check back later for amazing travel insights!
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

