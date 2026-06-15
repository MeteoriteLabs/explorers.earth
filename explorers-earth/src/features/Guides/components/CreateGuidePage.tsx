import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "sonner";
import BackIcon from "../../../assets/icons/BackIcon";
import Button from "../../../components/ui/Button";
import CreateGuideStep1 from "./CreateGuideStep1";
import CreateGuideStep2 from "./CreateGuideStep2";
import CreateGuideStep3 from "./CreateGuideStep3";
import { GET_GUIDE_BY_ID_QUERY, GET_USER_ACCOUNT_QUERY } from "../api/queries";
import { CREATE_GUIDE_MUTATION, UPDATE_GUIDE_MUTATION, CREATE_GUIDE_SECTION_MUTATION, UPDATE_GUIDE_SECTION_MUTATION } from "../api/mutations";
import useAuthStore from "../../../store/store";
import { uploadGuideMedia } from "../guideService";
import {
  htmlToBlocks,
  blocksToHtml,
} from "../../../utils/strapiBlocksConverter";
import type { AIGeneratedGuide } from "../../../services/geminiService";
import {
  fetchSingleCityLocationImage,
  fetchMultiCityLocationImage,
  type LocationImageResult
} from "../services/locationImageService";
import { enrichAIPlaces, extractLocationContext } from "../services/placeEnrichmentService";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface CreateGuidePageProps {
  type?: "create" | "edit";
  isModal?: boolean;
  onClose?: () => void;
  onCreated?: (newId?: string) => void;
}

// Location mode type
type LocationMode = "single" | "multi";

// Intermediate city interface
interface IntermediateCity {
  id: string;
  place: google.maps.places.PlaceResult | null;
  displayValue: string;
  hasDate?: boolean;
  date?: string; // ISO date string (YYYY-MM-DD)
}

// Form data interface
interface GuideFormData {
  guideType: string;
  // Single city location (backward compatible)
  selectedPlace: google.maps.places.PlaceResult | null;
  locationDisplayValue: string;
  // Multi city locations
  fromLocation: google.maps.places.PlaceResult | null;
  fromLocationDisplayValue: string;
  toLocation: google.maps.places.PlaceResult | null;
  toLocationDisplayValue: string;
  intermediateCities: IntermediateCity[];
  // Location mode indicator
  locationMode: LocationMode;
  // Number of days for itinerary guides
  numberOfDays: number | null;
  // Categories for itinerary guides
  categories: string[];
  // Best time to visit (months)
  bestTimeToVisit: string[];
  // Budget type
  budgetType: string | null;
  title: string;
  description: string;
  guideMedia: File | null;
}

const CreateGuidePage = ({
  type = "create",
  isModal = false,
  onClose,
  onCreated,
}: CreateGuidePageProps) => {
  const navigate = useNavigate();
  const { guideId } = useParams();
  const { user } = useAuthStore();

  // Step management - support 3 steps for Itinerary, 2 steps for Theme
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data state
  const [formData, setFormData] = useState<GuideFormData>({
    guideType: "",
    selectedPlace: null,
    locationDisplayValue: "",
    fromLocation: null,
    fromLocationDisplayValue: "",
    toLocation: null,
    toLocationDisplayValue: "",
    intermediateCities: [],
    locationMode: "single",
    numberOfDays: null,
    categories: [],
    bestTimeToVisit: [],
    budgetType: null,
    title: "",
    description: "",
    guideMedia: null,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // AI-generated guide sections data
  const [aiGeneratedSections, setAiGeneratedSections] = useState<AIGeneratedGuide["sections"] | null>(null);
  // AI-generated guide-level tips and tags
  const [aiGeneratedTipsNotes, setAiGeneratedTipsNotes] = useState<any>(null);
  const [aiGeneratedGuideTags, setAiGeneratedGuideTags] = useState<string[] | null>(null);

  // Location image pre-fill state

  const [isFetchingLocationImage, setIsFetchingLocationImage] = useState(false);

  // Calculate total steps based on guide type
  const totalSteps = formData.guideType === "Itinerary" ? 3 : 2;

  // Queries and mutations
  const { data: accountData } = useQuery(GET_USER_ACCOUNT_QUERY, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });

  // Fetch existing guide data in edit mode
  const { data: guideData, loading: guideLoading } = useQuery(
    GET_GUIDE_BY_ID_QUERY,
    {
      variables: { documentId: guideId },
      skip: type !== "edit" || !guideId,
    }
  );

  const [createGuideMutation] = useMutation(CREATE_GUIDE_MUTATION);
  const [createGuideSectionMutation] = useMutation(CREATE_GUIDE_SECTION_MUTATION);
  const [updateGuideSectionMutation] = useMutation(UPDATE_GUIDE_SECTION_MUTATION);
  const [updateGuideMutation] = useMutation(UPDATE_GUIDE_MUTATION, {
    refetchQueries: [
      {
        query: GET_GUIDE_BY_ID_QUERY,
        variables: { documentId: guideId },
      },
    ],
    awaitRefetchQueries: true,
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (type === "edit" && guideData?.guide) {
      const guide = guideData.guide;

      // Set preview URL for existing media
      if (guide.Guide_Media?.[0]?.url) {
        setPreviewUrl(guide.Guide_Media[0].url);
      }

      // Convert description blocks to HTML
      let descriptionHtml = "";
      if (guide.Description) {
        if (typeof guide.Description === "string") {
          descriptionHtml = guide.Description;
        } else if (Array.isArray(guide.Description)) {
          descriptionHtml = blocksToHtml(guide.Description);
        }
      }

      // Reconstruct place object(s) if available
      // Handle both single-city (backward compatible) and multi-city formats
      let reconstructedPlace: google.maps.places.PlaceResult | null = null;
      let locationDisplay = "";
      let reconstructedFromPlace: google.maps.places.PlaceResult | null = null;
      let fromLocationDisplay = "";
      let reconstructedToPlace: google.maps.places.PlaceResult | null = null;
      let toLocationDisplay = "";
      let intermediateCities: IntermediateCity[] = [];
      let locationMode: LocationMode = "single";

      if (guide.Place_Details) {
        // Parse Place_Details if it's a string (JSON)
        let placeDetails: any = guide.Place_Details;
        if (typeof guide.Place_Details === "string") {
          try {
            placeDetails = JSON.parse(guide.Place_Details);
          } catch (e) {
            console.error("Error parsing Place_Details JSON:", e);
            placeDetails = null;
          }
        }

        if (!placeDetails) {
          // Invalid or empty place details
          // Fallback: check is_Multicity field from guide
          if (guide.is_Multicity === true) {
            locationMode = "multi";
          }
        } else if (placeDetails.isMultiCity || guide.is_Multicity === true) {
          // Multi-city format - support both new (starting/ending) and legacy (arrival/departure, from/to) keys for backward compatibility
          locationMode = "multi";

          // Reconstruct starting location - support new (starting) and legacy (departure, from) keys
          const startingDetails = placeDetails.starting || placeDetails.departure || placeDetails.from;
          if (startingDetails) {
            fromLocationDisplay = startingDetails.Place_Name || startingDetails.Place_Address || "";
            reconstructedFromPlace = {
              name: startingDetails.Place_Name,
              formatted_address: startingDetails.Place_Address,
              place_id: startingDetails.Place_Id,
              // Rating fields are optional (for backward compatibility with old data)
              rating: startingDetails.Rating || undefined,
              user_ratings_total: startingDetails.Rating_Count || undefined,
              geometry: {
                location: {
                  lat: () => startingDetails.Geometry?.lat || 0,
                  lng: () => startingDetails.Geometry?.lng || 0,
                } as google.maps.LatLng,
              } as google.maps.places.PlaceGeometry,
            };
          }

          // Reconstruct ending location - support new (ending) and legacy (arrival, to) keys
          const endingDetails = placeDetails.ending || placeDetails.arrival || placeDetails.to;
          if (endingDetails) {
            toLocationDisplay = endingDetails.Place_Name || endingDetails.Place_Address || "";
            reconstructedToPlace = {
              name: endingDetails.Place_Name,
              formatted_address: endingDetails.Place_Address,
              place_id: endingDetails.Place_Id,
              // Rating fields are optional (for backward compatibility with old data)
              rating: endingDetails.Rating || undefined,
              user_ratings_total: endingDetails.Rating_Count || undefined,
              geometry: {
                location: {
                  lat: () => endingDetails.Geometry?.lat || 0,
                  lng: () => endingDetails.Geometry?.lng || 0,
                } as google.maps.LatLng,
              } as google.maps.places.PlaceGeometry,
            };
          }

          // Reconstruct intermediate cities
          if (placeDetails.intermediateCities && Array.isArray(placeDetails.intermediateCities)) {
            intermediateCities = placeDetails.intermediateCities.map((city: any, index: number) => ({
              id: city.id || `intermediate-${index}-${Date.now()}`,
              place: {
                name: city.Place_Name,
                formatted_address: city.Place_Address,
                place_id: city.Place_Id,
                rating: city.Rating || undefined,
                user_ratings_total: city.Rating_Count || undefined,
                geometry: {
                  location: {
                    lat: () => city.Geometry?.lat || 0,
                    lng: () => city.Geometry?.lng || 0,
                  } as google.maps.LatLng,
                } as google.maps.places.PlaceGeometry,
              } as google.maps.places.PlaceResult,
              displayValue: city.Place_Name || city.Place_Address || "",
              hasDate: city.hasDate || false,
              date: city.date || undefined,
            }));
          }
        } else {
          // Single-city format (backward compatible)
          locationMode = "single";
          locationDisplay =
            placeDetails.Place_Name ||
            placeDetails.Place_Address ||
            "";

          reconstructedPlace = {
            name: placeDetails.Place_Name,
            formatted_address: placeDetails.Place_Address,
            place_id: placeDetails.Place_Id,
            // Rating fields are optional (for backward compatibility with old data)
            rating: placeDetails.Rating || undefined,
            user_ratings_total: placeDetails.Rating_Count || undefined,
            geometry: {
              location: {
                lat: () => placeDetails.Geometry?.lat || 0,
                lng: () => placeDetails.Geometry?.lng || 0,
              } as google.maps.LatLng,
            } as google.maps.places.PlaceGeometry,
          };
        }
      }

      // Parse categories - handle both array and string formats
      let categories: string[] = [];
      if (guide.Category) {
        if (Array.isArray(guide.Category)) {
          categories = guide.Category;
        } else if (typeof guide.Category === "string") {
          try {
            categories = JSON.parse(guide.Category);
          } catch {
            // If not JSON, treat as single category string
            categories = [guide.Category];
          }
        }
      }

      // Parse best time to visit - handle JSON format
      let bestTimeToVisit: string[] = [];
      if (guide.Best_Time_To_Visit) {
        if (Array.isArray(guide.Best_Time_To_Visit)) {
          bestTimeToVisit = guide.Best_Time_To_Visit;
        } else if (typeof guide.Best_Time_To_Visit === "string") {
          try {
            bestTimeToVisit = JSON.parse(guide.Best_Time_To_Visit);
          } catch {
            // If not JSON, treat as single month string
            bestTimeToVisit = [guide.Best_Time_To_Visit];
          }
        }
      }

      setFormData({
        guideType: guide.Guide_Type || "",
        selectedPlace: reconstructedPlace,
        locationDisplayValue: locationDisplay,
        fromLocation: reconstructedFromPlace,
        fromLocationDisplayValue: fromLocationDisplay,
        toLocation: reconstructedToPlace,
        toLocationDisplayValue: toLocationDisplay,
        intermediateCities: intermediateCities,
        locationMode: locationMode,
        numberOfDays: guide.Number_Of_Days || null,
        categories: categories,
        bestTimeToVisit: bestTimeToVisit,
        budgetType: guide.Budget_Type || null,
        title: guide.Title || "",
        description: descriptionHtml,
        guideMedia: null,
      });
    }
  }, [type, guideData]);

  // Format place details for storage - only essential place information
  const formatPlaceDetails = (place: google.maps.places.PlaceResult) => {
    return {
      Place_Id: place.place_id || "",
      Place_Name: place.name || "",
      Place_Address: place.formatted_address || "",
      Geometry: {
        lat: place.geometry?.location?.lat() || 0,
        lng: place.geometry?.location?.lng() || 0,
      },
    };
  };

  // Handle Step 1 completion - supports both single and multi-city
  const handleStep1Next = async (data: {
    guideType: string;
    // Single city payload (backward compatible)
    selectedPlace?: google.maps.places.PlaceResult;
    locationDisplayValue?: string;
    // Multi city payload
    fromLocation?: google.maps.places.PlaceResult;
    fromLocationDisplayValue?: string;
    toLocation?: google.maps.places.PlaceResult;
    toLocationDisplayValue?: string;
    intermediateCities?: IntermediateCity[];
    // Mode indicator
    locationMode: LocationMode;
  }) => {
    setFormData((prev) => ({
      ...prev,
      guideType: data.guideType,
      locationMode: data.locationMode,
      // Single city data (preserve if provided)
      selectedPlace: data.selectedPlace || prev.selectedPlace,
      locationDisplayValue: data.locationDisplayValue || prev.locationDisplayValue,
      // Multi city data (preserve if provided)
      fromLocation: data.fromLocation || prev.fromLocation,
      fromLocationDisplayValue: data.fromLocationDisplayValue || prev.fromLocationDisplayValue,
      toLocation: data.toLocation || prev.toLocation,
      toLocationDisplayValue: data.toLocationDisplayValue || prev.toLocationDisplayValue,
      intermediateCities: data.intermediateCities || prev.intermediateCities,
    }));

    // Fetch location image in background (only in create mode, not edit)
    if (type === "create") {
      fetchLocationImageInBackground(data);
    }

    // If Itinerary, go to Step 2 (number of days & categories)
    // If Theme, skip to Step 3 (final step - title, description, media)
    if (data.guideType === "Itinerary") {
      setCurrentStep(2);
    } else {
      setCurrentStep(3);
    }
  };

  /**
   * Fetch location image in the background after Step 1
   * Non-blocking - runs async while user proceeds to next step
   */
  const fetchLocationImageInBackground = async (locationData: {
    locationMode: LocationMode;
    selectedPlace?: google.maps.places.PlaceResult;
    toLocation?: google.maps.places.PlaceResult;
  }) => {
    setIsFetchingLocationImage(true);

    try {
      let imageResult: LocationImageResult | null = null;

      // Determine which location to use based on mode
      if (locationData.locationMode === "multi" && locationData.toLocation) {
        // Multi-city: use destination/arrival location
        imageResult = await fetchMultiCityLocationImage(locationData.toLocation);
      } else if (locationData.locationMode === "single" && locationData.selectedPlace) {
        // Single-city: use selected location
        imageResult = await fetchSingleCityLocationImage(locationData.selectedPlace);
      }

      if (imageResult) {
        // Only set if user hasn't manually uploaded an image yet
        setFormData((prev) => {
          if (!prev.guideMedia) {
            return {
              ...prev,
              guideMedia: imageResult.file,
            };
          }
          return prev;
        });

        setPreviewUrl(imageResult.previewUrl);
      }
    } catch (error) {
      console.error("Failed to fetch location image:", error);
      // Silent fail - user can still upload manually
    } finally {
      setIsFetchingLocationImage(false);
    }
  };

  // Handle Step 2 completion (number of days & categories for Itinerary)
  const handleStep2Next = (data: {
    numberOfDays: number | null;
    categories: string[];
    bestTimeToVisit: string[];
    budgetType: string | null;
  }) => {
    setFormData((prev) => ({
      ...prev,
      numberOfDays: data.numberOfDays,
      categories: data.categories,
      bestTimeToVisit: data.bestTimeToVisit,
      budgetType: data.budgetType,
    }));
    setCurrentStep(3);
  };

  /**
   * Handle AI-generated guide data
   */
  const handleAIGeneration = (aiGuideData: AIGeneratedGuide) => {
    // Store AI-generated sections for creating after guide is created
    setAiGeneratedSections(aiGuideData.sections);

    // Store AI-generated guide-level tips and tags
    setAiGeneratedTipsNotes(aiGuideData.tipsNotes || null);
    setAiGeneratedGuideTags(aiGuideData.guideTags || null);

    // Pre-populate title, description AND Step 2 data from AI generation
    setFormData((prev) => ({
      ...prev,
      title: aiGuideData.title,
      description: aiGuideData.description,
      // Preserve Step 2 data that was used for AI generation
      numberOfDays: aiGuideData.numberOfDays || prev.numberOfDays,
      categories: aiGuideData.categories || prev.categories,
      bestTimeToVisit: aiGuideData.bestTimeToVisit || prev.bestTimeToVisit,
      budgetType: aiGuideData.budgetType || prev.budgetType,
    }));

    // Move to Step 3
    setCurrentStep(3);
  };

  // Handle Step 2 back (from Itinerary details)
  const handleStep2Back = () => {
    setCurrentStep(1);
  };

  // Handle Step 3 back (from final step)
  const handleStep3Back = () => {
    // If Itinerary, go back to Step 2, otherwise go back to Step 1
    if (formData.guideType === "Itinerary") {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  };

  // Handle final submission
  const handleStep3Submit = async (data: {
    title: string;
    description: string;
    guideMedia: File | null;
  }) => {
    setIsSubmitting(true);

    try {
      const accountDocumentId =
        accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;
      const descriptionBlocks = htmlToBlocks(data.description);

      let resultDocumentId: string;

      if (type === "edit" && guideId) {
        // Handle media upload first if there's new media
        if (data.guideMedia) {
          try {
            const { getGuideById } = await import("../guideService");
            const guideWithId = await getGuideById(guideId);

            if (guideWithId?.id) {
              const existingMediaIds =
                guideWithId?.Guide_Media?.map((media: any) => media.id).filter(
                  Boolean
                ) || [];

              await uploadGuideMedia(
                guideWithId.id,
                guideId,
                data.guideMedia,
                user?.username || "user",
                existingMediaIds
              );
            }
          } catch (uploadError) {
            console.error("Media upload/deletion failed:", uploadError);
            toast.warning(
              "Media upload failed. The guide data will still be updated."
            );
          }
        }

        // Update existing guide data
        // For single city: store single location (backward compatible)
        // For multi city: store both locations in structured format within Place_Details
        let placeDetails: any;
        if (formData.locationMode === "multi") {
          // Multi-city: store both locations in structured format with starting/ending keys
          placeDetails = {
            ending: formData.toLocation ? formatPlaceDetails(formData.toLocation) : null,
            starting: formData.fromLocation ? formatPlaceDetails(formData.fromLocation) : null,
            intermediateCities: formData.intermediateCities
              .filter((city) => city.place)
              .map((city) => ({
                id: city.id,
                ...formatPlaceDetails(city.place!),
                hasDate: city.hasDate || false,
                date: city.date || undefined,
              })),
            isMultiCity: true,
          };
        } else {
          // Single city: store single location (backward compatible)
          placeDetails = formData.selectedPlace
            ? formatPlaceDetails(formData.selectedPlace)
            : undefined;
        }

        const updateData: any = {
          Title: data.title,
          Description: descriptionBlocks,
          Guide_Type: formData.guideType,
          Place_Details: placeDetails,
          Number_Of_Days: formData.numberOfDays || null,
          Category: formData.categories && formData.categories.length > 0 ? formData.categories : null,
          Best_Time_To_Visit: formData.bestTimeToVisit && formData.bestTimeToVisit.length > 0 ? JSON.stringify(formData.bestTimeToVisit) : null,
          Budget_Type: formData.budgetType || null,
          is_Multicity: formData.locationMode === "multi" ? true : false,
          // Include AI-generated Tips_Notes and Guide_Tags if available
          Tips_Notes: aiGeneratedTipsNotes !== null ? aiGeneratedTipsNotes : undefined,
          Guide_Tags: aiGeneratedGuideTags !== null ? aiGeneratedGuideTags : undefined,
        };

        const result = await updateGuideMutation({
          variables: {
            documentId: guideId,
            data: updateData,
          },
        });

        resultDocumentId = result.data?.updateGuide?.documentId || guideId;
        toast.success("Guide updated successfully!");
      } else {
        // Create new guide
        // For single city: store single location (backward compatible)
        // For multi city: store both locations in structured format within Place_Details
        let placeDetails: any;
        if (formData.locationMode === "multi") {
          // Multi-city: store both locations in structured format with starting/ending keys
          placeDetails = {
            ending: formData.toLocation ? formatPlaceDetails(formData.toLocation) : null,
            starting: formData.fromLocation ? formatPlaceDetails(formData.fromLocation) : null,
            intermediateCities: formData.intermediateCities
              .filter((city) => city.place)
              .map((city) => ({
                id: city.id,
                ...formatPlaceDetails(city.place!),
                hasDate: city.hasDate || false,
                date: city.date || undefined,
              })),
            isMultiCity: true,
          };
        } else {
          // Single city: store single location (backward compatible)
          placeDetails = formData.selectedPlace
            ? formatPlaceDetails(formData.selectedPlace)
            : undefined;
        }

        const createData: any = {
          Title: data.title,
          Description: descriptionBlocks,
          Guide_Type: formData.guideType,
          account: accountDocumentId,
          Place_Details: placeDetails,
          Number_Of_Days: formData.numberOfDays || null,
          Category: formData.categories && formData.categories.length > 0 ? formData.categories : null,
          Best_Time_To_Visit: formData.bestTimeToVisit && formData.bestTimeToVisit.length > 0 ? JSON.stringify(formData.bestTimeToVisit) : null,
          Budget_Type: formData.budgetType || null,
          is_Multicity: formData.locationMode === "multi" ? true : false,
          // Include AI-generated Tips_Notes and Guide_Tags if available
          Tips_Notes: aiGeneratedTipsNotes || null,
          Guide_Tags: aiGeneratedGuideTags || null,
        };

        const result = await createGuideMutation({
          variables: {
            data: createData,
          },
        });

        resultDocumentId = result.data?.createGuide?.documentId;

        // Handle media upload for create
        if (data.guideMedia && resultDocumentId) {
          try {
            const { getGuideById } = await import("../guideService");
            const guideWithId = await getGuideById(resultDocumentId);

            if (guideWithId?.id) {
              await uploadGuideMedia(
                guideWithId.id,
                resultDocumentId,
                data.guideMedia,
                user?.username || "user"
              );
            }
          } catch (uploadError) {
            console.warn("Guide created but media upload failed:", uploadError);
            toast.warning(
              "Guide created, but media upload failed. You can try uploading it later."
            );
          }
        }

        // Create AI-generated guide sections if available
        // NOTE: This uploads Google Place photos for each section — must complete before showing success toast
        if (aiGeneratedSections && aiGeneratedSections.length > 0) {
          await createAIGeneratedSections(resultDocumentId);
        }

        // Show success toast only after ALL uploads (media + section photos) are complete
        toast.success("Guide created successfully!");
      }

      // Navigate to guide details page
      if (type === "create" && resultDocumentId) {
        if (isModal && onCreated) {
          onCreated(resultDocumentId);
        } else {
          navigate(`/guides/${resultDocumentId}`);
        }
      } else if (type === "edit" && guideId) {
        if (isModal && onClose) {
          onClose();
        } else {
          navigate(`/guides/${guideId}`, {
            replace: true,
            state: { refetch: Date.now() },
          });
        }
      }
    } catch (err: any) {
      console.error(
        `Error ${type === "edit" ? "updating" : "creating"} guide:`,
        err
      );
      toast.error(`Failed to ${type === "edit" ? "update" : "create"} guide`);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Create guide sections from AI-generated data
   * Called after guide is successfully created
   * Enriches AI place names with Google Places data before saving
   */
  const createAIGeneratedSections = async (guideDocumentId: string) => {
    if (!aiGeneratedSections || aiGeneratedSections.length === 0) {
      return;
    }

    // Extract location context for place enrichment
    const locationContext = extractLocationContext({
      locationMode: formData.locationMode,
      locationDisplayValue: formData.locationDisplayValue,
      toLocationDisplayValue: formData.toLocationDisplayValue,
    });

    try {
      let successCount = 0;
      const totalSections = aiGeneratedSections.length;

      // Create each section sequentially
      for (const section of aiGeneratedSections) {
        try {
          // Prepare section data
          const sectionData: any = {
            Title: section.title,
            Sequence: section.sequence,
            Description: section.description || "",
            guide: guideDocumentId,
          };

          // Add Map_Details with location for multi-city guides
          // Location identifies which city this section belongs to (starting/ending/intermediate)
          if (formData.locationMode === "multi" && section.location) {
            sectionData.Map_Details = {
              location: section.location,
            };
          }

          // If section has places, enrich them and organize by time slot
          let enrichedPlaces: any[] = [];
          if (section.places && section.places.length > 0) {
            const timeline: any = {
              morning: [],
              afternoon: [],
              evening: [],
            };

            // ENRICHMENT: Resolve AI place names to Google Places data
            enrichedPlaces = await enrichAIPlaces(
              section.places,
              locationContext
            );

            // Distribute enriched places into time slots
            enrichedPlaces.forEach((place, index) => {
              const originalPlace = section.places?.[index];
              const timeSlot = originalPlace?.timeSlot || "morning";

              // Remove enrichment metadata before saving to database
              const { isVerified, source, ...placeData } = place;

              if (timeSlot === "morning" || timeSlot === "afternoon" || timeSlot === "evening") {
                timeline[timeSlot].push(placeData);
              } else {
                // Default to morning if invalid time slot
                timeline.morning.push(placeData);
              }
            });

            // Only add Timeline if there are places
            if (timeline.morning.length > 0 || timeline.afternoon.length > 0 || timeline.evening.length > 0) {
              sectionData.Timeline = timeline;
            }
          }

          // Create the section first to get sectionId
          const createResult = await createGuideSectionMutation({
            variables: {
              data: sectionData,
            },
          });

          const createdSectionId = createResult.data?.createGuideSection?.documentId;

          // Fetch and upload photos for all places, then update section with Recommendation_Activity
          if (createdSectionId && enrichedPlaces.length > 0) {
            try {
              const { fetchGooglePlacePhotos } = await import("../utils/googlePhotosService");
              const { uploadActivityPhotos } = await import("../services/activityPhotoService");

              // Get username for photo uploads
              const username = user?.username || "user";
              const activities: any[] = [];

              // Process each enriched place
              for (const place of enrichedPlaces) {
                const { isVerified, source, ...placeData } = place;

                if (placeData.place_id) {
                  try {
                    // Fetch photos from Google Places
                    const photos = await fetchGooglePlacePhotos(placeData.place_id, 6);

                    if (photos.length > 0) {
                      // Upload photos to S3
                      const uploadedPhotos = await uploadActivityPhotos(
                        photos,
                        username,
                        createdSectionId,
                        placeData.place_id
                      );

                      // Add to activities with uploaded photos
                      activities.push({
                        ...placeData,
                        photos: uploadedPhotos,
                        photosLoading: false,
                      });
                    } else {
                      // No photos found, add place without photos
                      activities.push({
                        ...placeData,
                        photos: [],
                        photosLoading: false,
                      });
                    }
                  } catch (error) {
                    console.error(`Error fetching/uploading photos for place ${placeData.place_id}:`, error);
                    // Add place without photos on error
                    activities.push({
                      ...placeData,
                      photos: [],
                      photosLoading: false,
                    });
                  }
                }
              }

              // Update section with Recommendation_Activity if we have activities
              if (activities.length > 0) {
                await updateGuideSectionMutation({
                  variables: {
                    documentId: createdSectionId,
                    data: {
                      Recommendation_Activity: JSON.stringify({
                        activities: activities,
                      }),
                    },
                  },
                });
              }
            } catch (error) {
              console.error("Error processing photos for section:", error);
              // Continue even if photo upload fails
            }
          }

          successCount++;
        } catch (sectionError) {
          console.error(`Failed to create section "${section.title}":`, sectionError);
          // Continue creating other sections even if one fails
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} of ${totalSections} AI-generated guide sections`);
      } else {
        toast.warning("Guide created, but failed to create AI-generated sections. You can add them manually.");
      }

      // Clear AI-generated sections after creation
      setAiGeneratedSections(null);
    } catch (error) {
      console.error("Error creating AI-generated sections:", error);
      toast.warning("Guide created, but some AI-generated sections may not have been added.");
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (isModal && onClose) {
      onClose();
    } else {
      navigate(type === "edit" && guideId ? `/guides/${guideId}` : "/guides");
    }
  };

  // Show loading state while fetching guide data in edit mode
  if (type === "edit" && guideLoading) {
    return (
      <div className="dashboard-theme bg-dashboard-bg min-h-screen px-4 pb-4 md:pt-10">
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="bg-dashboard-modal p-6 rounded-lg border border-dashboard-accent shadow-dashboard-elevated text-center">
            <p className="text-dashboard-light font-poppins">
              Loading guide data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isModal ? "dashboard-theme w-full" : "dashboard-theme bg-dashboard-bg min-h-screen px-4 pb-4 md:pt-10"}>
      <div className={isModal ? "flex relative flex-col max-w-full gap-4 w-full" : "flex relative flex-col mb-10 items-center justify-center min-h-[calc(100vh-8rem)] max-w-full gap-4"}>
        {/* Header with Back Button */}
        <div className="flex flex-row gap-2 md:gap-4 w-full md:justify-between justify-between items-center mb-4">
          {!isModal && (
            <Button
              size="xsmall"
              variant="ghost"
              onClickHandler={handleCancel}
              startIcon={<BackIcon stroke="var(--dash-accent)" size="size-5 md:size-6" />}
            />
          )}
          <h1 className="text-dashboard text-lg md:text-2xl font-poppins font-bold">
            {type === "edit" ? "Edit Guide" : "Create New Guide"}
          </h1>
          {isModal ? (
            <button onClick={handleCancel} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border-none cursor-pointer">
              <X size={16} />
            </button>
          ) : (
            <div className="w-10"></div>
          )}
        </div>

        {/* Render appropriate step */}
        {currentStep === 1 ? (
          <CreateGuideStep1
            initialGuideType={formData.guideType}
            initialLocation={formData.selectedPlace}
            initialLocationDisplay={formData.locationDisplayValue}
            initialFromLocation={formData.fromLocation}
            initialFromLocationDisplay={formData.fromLocationDisplayValue}
            initialToLocation={formData.toLocation}
            initialToLocationDisplay={formData.toLocationDisplayValue}
            initialIntermediateCities={formData.intermediateCities}
            initialLocationMode={formData.locationMode}
            onNext={handleStep1Next}
            onCancel={handleCancel}
          />
        ) : currentStep === 2 ? (
          <CreateGuideStep2
            initialNumberOfDays={formData.numberOfDays}
            initialCategories={formData.categories}
            initialBestTimeToVisit={formData.bestTimeToVisit}
            initialBudgetType={formData.budgetType}
            guideType={formData.guideType}
            locationName={formData.locationDisplayValue}
            locationType={formData.locationMode}
            fromLocation={formData.fromLocation?.name || formData.fromLocationDisplayValue}
            toLocation={formData.toLocation?.name || formData.toLocationDisplayValue}
            intermediateCities={formData.intermediateCities.map((city) => city.place?.name || city.displayValue)}
            onBack={handleStep2Back}
            onNext={handleStep2Next}
            onAIGenerate={type === "create" ? handleAIGeneration : undefined}
          />
        ) : (
          <CreateGuideStep3
            initialTitle={formData.title}
            initialDescription={formData.description}
            initialMedia={formData.guideMedia}
            initialMediaPreview={previewUrl}
            isAIGenerated={aiGeneratedSections !== null}

            isFetchingLocationImage={isFetchingLocationImage}
            onBack={handleStep3Back}
            onSubmit={handleStep3Submit}
            isSubmitting={isSubmitting}
            isEditMode={type === "edit"}
            totalSteps={totalSteps}
            onImageChange={() => { }}
          />
        )}
      </div>
    </div>
  );
};

export default CreateGuidePage;

export const CreateGuideModal = ({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (newId?: string) => void;
}) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="bg-dashboard-sidebar rounded-xl border border-dashboard-border p-6 md:p-8 w-full max-w-4xl shadow-2xl relative z-10 my-8 text-left overflow-y-auto max-h-[90vh]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CreateGuidePage
              isModal={true}
              onClose={onClose}
              onCreated={onCreated}
              type="create"
            />
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
