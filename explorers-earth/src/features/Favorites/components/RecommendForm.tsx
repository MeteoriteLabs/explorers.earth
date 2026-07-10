import { Formik, Form, Field, ErrorMessage, useFormikContext } from "formik";
import {
  memo,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";

import * as Yup from "yup";
import Button from "../../../components/ui/Button";
import AddressInput from "../../Profile/components/AddressInput";
import { Places, AddressComponent } from "../../Profile/types/types";
import Dropdown from "../../../components/ui/Dropdown";
import TiptapEditor from "./TiptapEditor";
import { AddIcon } from "../../../assets/icons/AddIcon";
import CrossIcon from "../../../assets/icons/CrossIcon";
import StarIcon from "../../../assets/icons/StarIcon";
import { AdvancedMarker, Map, MapCameraChangedEvent, Pin } from "@vis.gl/react-google-maps";
import Modal from "../../../components/ui/Modal";
import { useTaggableFields } from "../hooks/useTaggableFields";
import axios from "axios";
import Down from "../../../assets/icons/Down";
import { toast } from "sonner";
import { useCityStore } from "../../../store/useCityStore";
import { useDistanceValidation } from "../../../hooks/useDistanceValidation";
import {
  LocationValidationCoords,
  getDistanceLimitText,
} from "../../../config/locationValidationConfig";
import { EarthLoader } from "../../../components/EarthLoader";
import { useTranslation } from "react-i18next";



// Variant that also auto-activates hidden taggable error fields before scrolling.
const ScrollToFirstErrorWithActivation = ({
  handleTagClick,
  activeFields,
}: {
  handleTagClick: (name: string) => void;
  activeFields: string[];
}) => {
  const { errors, submitCount } = useFormikContext<Record<string, string>>();

  const errorsRef = useRef(errors);
  errorsRef.current = errors;
  const prevSubmitCount = useRef(submitCount);

  // Stable refs so the effect never re-runs due to prop identity changes
  const handleTagClickRef = useRef(handleTagClick);
  handleTagClickRef.current = handleTagClick;
  const activeFieldsRef = useRef(activeFields);
  activeFieldsRef.current = activeFields;

  useEffect(() => {
    if (submitCount <= prevSubmitCount.current) return;
    prevSubmitCount.current = submitCount;

    // Utility: perform the actual scrolling to the visually highest error field
    const doScroll = () => {
      // Use requestAnimationFrame to ensure we run after any pending paints
      requestAnimationFrame(() => {
        const errorKeys = Object.keys(errorsRef.current);
        if (!errorKeys.length) return;

        // Find all error elements and sort them by their vertical position in the document
        const errorElements = errorKeys
          .map(key => ({
            key,
            el: document.querySelector<HTMLElement>(`[data-field-id="${key}"]`)
          }))
          .filter(item => item.el !== null) as { key: string, el: HTMLElement }[];

        if (errorElements.length === 0) return;

        // Sort by vertical position (top) to find the first one visually
        errorElements.sort((a, b) => {
          const rectA = a.el.getBoundingClientRect();
          const rectB = b.el.getBoundingClientRect();
          return (rectA.top + window.scrollY) - (rectB.top + window.scrollY);
        });

        const firstError = errorElements[0];
        const el = firstError.el;

        // Primary: native API works across all scroll containers
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // Secondary: manually scroll nearest overflow ancestor (for desktop dashboard)
        let node: HTMLElement | null = el.parentElement;
        let containerScrolled = false;
        while (node && node !== document.documentElement) {
          const { overflowY, overflow } = window.getComputedStyle(node);
          if (
            (overflowY === "auto" || overflowY === "scroll" ||
              overflow === "auto" || overflow === "scroll") &&
            node.scrollHeight > node.clientHeight
          ) {
            const parentRect = node.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            node.scrollTo({
              top: elRect.top - parentRect.top + node.scrollTop
                - node.clientHeight / 2 + el.offsetHeight / 2,
              behavior: "smooth",
            });
            containerScrolled = true;
            break;
          }
          node = node.parentElement;
        }

        // Tertiary: fallback to window scroll (especially for mobile)
        if (!containerScrolled) {
          const elRect = el.getBoundingClientRect();
          const absoluteElementTop = window.scrollY + elRect.top;
          const targetY = absoluteElementTop - (window.innerHeight / 2) + (el.offsetHeight / 2);

          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: "smooth",
          });
        }

        // Focus the first interactive child
        const focusable = el.querySelector<HTMLElement>(
          "input:not([type=hidden]), textarea, select, [tabindex]:not([tabindex='-1'])"
        );
        if (focusable) {
          // Small delay before focus to avoid conflict with keyboard appearance/disappearance
          setTimeout(() => focusable.focus({ preventScroll: true }), 100);
        }
      });
    };

    // pass 1: activate hidden fields, then scroll
    const t1 = setTimeout(() => {
      const errorKeys = Object.keys(errorsRef.current);
      if (!errorKeys.length) return;

      let activatedAny = false;
      for (const key of errorKeys) {
        const el = document.querySelector<HTMLElement>(`[data-field-id="${key}"]`);
        if (!el && !activeFieldsRef.current.includes(key)) {
          // Field is hidden (taggable but inactive) — activate it
          handleTagClickRef.current(key);
          activatedAny = true;
        }
      }

      if (activatedAny) {
        // Wait for React to re-render the newly-activated fields, then scroll
        // Increased delay to ensure rendering and animations settle
        setTimeout(doScroll, 500);
      } else {
        // All fields already visible — scroll immediately but with a tiny delay
        setTimeout(doScroll, 50);
      }
    }, 150);

    return () => clearTimeout(t1);
  }, [submitCount]);

  return null;
};


// Generic type for defining objects
export type KeyValuePair = { [key: string]: string };

// Types for form field
interface FormField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
  as?: string;
  components?: {
    value?: string;
    name?: string;
    label?: string;
    type?: string;
    placeholder?: string;
  }[];
  isRequired?: boolean;
}

// Types for profile form component
interface RecommendationFormProps {
  initialValues: KeyValuePair;
  validationSchema: Yup.AnySchema;
  onSubmit: (values: KeyValuePair) => void;
  setPlaces: (places: Places) => void;
  formFields: FormField[];
  isCustom: boolean;
  categories: KeyValuePair[];
  type?: "edit" | "default";
  places?: Places | null;
  recommendationType?: "place" | "person";
  placeId?: string;
  onInstagramProfileScrape?: (input: string) => Promise<{
    fullName: string;
    profileUrl: string;
    profilePicture: string;
  } | null>;
  isScrapingProfile?: boolean;
}

// Define the interface for the ref handle methods
export interface RecommendFormHandle {
  openMapModal: () => void;
  closeMapModal: () => void;
  setCoordinates: (
    values: KeyValuePair,
    initialValues: KeyValuePair
  ) => Promise<void>;
}

// type for subcategory
export type Subcategory = {
  sub_category: string;
  documentId: string;
};

type Geometry = {
  lat: number;
  lng: number;
};

const RecommendationForm = memo(
  forwardRef<RecommendFormHandle, RecommendationFormProps>(
    (
      {
        initialValues,
        validationSchema,
        onSubmit,
        categories,
        places,
        setPlaces,
        isCustom,
        type,
        formFields: initialFormFields,
        recommendationType = "place",
        placeId,
        onInstagramProfileScrape,
        isScrapingProfile = false,
      },
      ref
    ) => {
      const { t } = useTranslation();
      const { selectedCity } = useCityStore();

      // Track if form has been submitted (to prevent re-initialization after submission)
      const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

      // local state for handling recommendation
      // Initialize with title in edit mode, address for place in create mode
      const [recommendation, setRecommendation] = useState<string>((() => {
        if (type === "edit") {
          return initialValues.title || "";
        }
        // For place type, use address; for person type, use empty string
        return recommendationType === "place" ? (initialValues.address || "") : "";
      })());

      // Update recommendation when initialValues change (for edit mode or when place is selected)
      useEffect(() => {
        if (type === "edit" && initialValues.title) {
          setRecommendation(initialValues.title);
        } else if (type !== "edit" && recommendationType === "place" && initialValues.address) {
          setRecommendation(initialValues.address);
        }
      }, [type, initialValues.title, initialValues.address, recommendationType]);

      // Helper function for geocoding (fallback only - rarely used)
      async function geocodeAddress(address: string) {
        if (!address || address.trim() === '') {
          throw new Error('No address provided for geocoding');
        }
        return await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address
          )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
        );
      }
      // local state for handling the accordian
      const [isOpen, setIsOpen] = useState<boolean>(true);

      // local state for handling selected category
      const [selectedCategory, setSelectedCategory] = useState<string>("");
      // local state for handling selected subcategory
      const [selectedSubcategory, setSelectedsubcategory] =
        useState<string>("");
      // local state for handling subcategories
      const [subcategories, setSubcategories] = useState<KeyValuePair[]>([]);
      // local state for handling recommended reason
      const [recommendedReason, setRecommendedReason] = useState<string>(
        initialValues.reason || ""
      );

      // Update recommendedReason when initialValues change (for edit mode)
      useEffect(() => {
        if (type === "edit" && initialValues.reason) {
          setRecommendedReason(initialValues.reason);
        }
      }, [type, initialValues.reason]);
      // custom hook for handling the taggable logic
      const { activeFields, taggableFields, handleRemoveTag, handleTagClick } =
        useTaggableFields({ type, places, recommendationType });
      // Local state for handling the map modal
      const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);


      // Local state for managing the updated coords
      const [newCoords, setNewCoords] = useState<Geometry>({
        lat: 20.5937,
        lng: 78.9629,
      });


      // Local state for the current coordinates
      const [currentCoords, setCurrentCoords] = useState<Geometry>({
        lat: 20.5937,
        lng: 78.9629,
      });

      // State for map center (only updated programmatically, not by user interaction)
      const [mapCenter, setMapCenter] = useState<Geometry | null>(null);

      // Ref to track if we should update center programmatically
      const shouldUpdateCenter = useRef<boolean>(false);

      // Distance validation hook and state
      const { validateDistance, fallbackDistanceValidation } =
        useDistanceValidation();
      const [isValidatingLocation, setIsValidatingLocation] =
        useState<boolean>(false);

      // Helper function to extract coordinates from places object
      // This handles both function-based (google.maps.LatLng) and object-based coordinates
      const extractCoordinatesFromPlaces = (placesObj: Places | null): Geometry | null => {
        if (!placesObj?.geometry?.location) {
          return null;
        }

        const location = placesObj.geometry.location;

        // Handle both function-based (google.maps.LatLng) and object-based coordinates
        let lat: number;
        let lng: number;

        if (typeof location.lat === 'function' && typeof location.lng === 'function') {
          // Google Maps LatLng object with methods
          lat = location.lat();
          lng = location.lng();
        } else if (typeof location.lat === 'number' && typeof location.lng === 'number') {
          // Plain object with numeric properties
          lat = location.lat;
          lng = location.lng;
        } else {
          return null;
        }

        // Validate coordinates are valid numbers
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
          return null;
        }

        return { lat, lng };
      };

      // Expose methods to the parent component through ref
      useImperativeHandle(ref, () => ({
        openMapModal: () => {
          setIsMapModalOpen(true);
        },
        closeMapModal: () => {
          setIsMapModalOpen(false);
        },
        setCoordinates: async (
          values: KeyValuePair,
          initialVals: KeyValuePair
        ) => {
          // Handle coordinates based on whether we're editing or creating
          if (type === "edit") {
            // When editing, use coordinates from initialValues
            const coords = {
              lat: Number(initialVals.lat),
              lng: Number(initialVals.lng),
            };
            // Validate coordinates before setting
            if (!isNaN(coords.lat) && !isNaN(coords.lng) && coords.lat !== 0 && coords.lng !== 0) {
              setCurrentCoords(coords);
              setNewCoords(coords);
              // Update map center programmatically
              setMapCenter(coords);
              shouldUpdateCenter.current = true;
            }
          } else {
            // When creating new, prioritize exact coordinates from places object
            // This ensures we use the precise coordinates from Google Places API
            const coordsFromPlaces = extractCoordinatesFromPlaces(places ?? null);

            if (coordsFromPlaces) {
              // Use exact coordinates from Google Places API
              setCurrentCoords(coordsFromPlaces);
              setNewCoords(coordsFromPlaces);
              // Update map center programmatically
              setMapCenter(coordsFromPlaces);
              shouldUpdateCenter.current = true;
            } else {
              // Fallback: Only geocode if places object doesn't have coordinates
              // This should rarely happen, but provides a safety net
              try {
                // Determine the address to use - prioritize values.address, fallback to places
                let addressToUse = values.address;
                if (!addressToUse && places?.formatted_address) {
                  addressToUse = places.formatted_address;
                }

                if (!addressToUse && places?.name) {
                  addressToUse = places.name;
                }

                if (!addressToUse) {
                  console.warn("No address available for geocoding");
                  return;
                }

                // Geocode the address as fallback
                const res = await geocodeAddress(addressToUse);
                if (res.data.results && res.data.results[0]?.geometry?.location) {
                  const location = res.data.results[0].geometry.location;
                  const geocodedCoords = {
                    lat: typeof location.lat === 'function' ? location.lat() : location.lat,
                    lng: typeof location.lng === 'function' ? location.lng() : location.lng,
                  };

                  // Validate geocoded coordinates
                  if (!isNaN(geocodedCoords.lat) && !isNaN(geocodedCoords.lng)) {
                    setCurrentCoords(geocodedCoords);
                    setNewCoords(geocodedCoords);
                    // Update map center programmatically
                    setMapCenter(geocodedCoords);
                    shouldUpdateCenter.current = true;
                  } else {
                    console.error("Invalid coordinates from geocoding:", geocodedCoords);
                  }
                }
              } catch (error) {
                console.error("Error in setCoordinates fallback geocoding:", error);
              }
            }
          }
        },
      }));

      // Effect to set map center when modal opens
      // Only centers when modal first opens (when isMapModalOpen changes from false to true)
      // setCoordinates() handles centering when coordinates are set programmatically
      useEffect(() => {
        if (isMapModalOpen && currentCoords) {
          setMapCenter(currentCoords);
          shouldUpdateCenter.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [isMapModalOpen]);

      // effect to update newCoords when places changes
      useEffect(() => {
        const coords = extractCoordinatesFromPlaces(places ?? null);

        if (coords) {
          setNewCoords(coords);
          setCurrentCoords(coords);
        } else if (initialValues.lat && initialValues.lng) {
          // Fallback to initial values if places doesn't have coordinates
          const fallbackCoords = {
            lat: !isNaN(Number(initialValues.lat))
              ? Number(initialValues.lat)
              : 0,
            lng: !isNaN(Number(initialValues.lng))
              ? Number(initialValues.lng)
              : 0,
          };
          // Only set if coordinates are valid
          if (fallbackCoords.lat !== 0 && fallbackCoords.lng !== 0) {
            setCurrentCoords(fallbackCoords);
            setNewCoords(fallbackCoords);
          }
        }
      }, [initialValues.lat, initialValues.lng, places]);

      // Track if modal has been opened for current place to prevent multiple opens
      const [hasOpenedModalForPlace, setHasOpenedModalForPlace] = useState<string | null>(null);

      // Auto-open map modal when a place is selected (only for new recommendations, not edit mode)
      useEffect(() => {
        if (type !== "edit" && places && (places.name || places.formatted_address)) {
          // Use place_id if available, otherwise use name or formatted_address as identifier
          const placeIdentifier = (places as any)?.place_id || places.name || places.formatted_address || "";

          // Only open if we have a valid identifier and haven't opened for this place yet
          if (placeIdentifier && placeIdentifier !== hasOpenedModalForPlace) {
            // Small delay to ensure coordinates are set
            const timer = setTimeout(() => {
              setIsMapModalOpen(true);
              setHasOpenedModalForPlace(placeIdentifier);
              // Update map center when modal opens
              const coords = extractCoordinatesFromPlaces(places ?? null);
              if (coords) {
                setMapCenter(coords);
                shouldUpdateCenter.current = true;
              }
            }, 500);
            return () => clearTimeout(timer);
          }
        } else if (!places) {
          // Reset tracking when places is cleared
          setHasOpenedModalForPlace(null);
        }
      }, [places, type, hasOpenedModalForPlace]);

      // Function to handle marker drag
      const handleDragEnd = (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const updatedCoords = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };
          setCurrentCoords(updatedCoords);
          setNewCoords(updatedCoords);
          // Update map center when marker is dragged
          setMapCenter(updatedCoords);
          shouldUpdateCenter.current = true;
        }
      };

      // Handle camera changes (user panning/zooming)
      const handleCameraChanged = (_event: MapCameraChangedEvent) => {
        // After programmatic center update, clear it to allow free user interaction
        if (shouldUpdateCenter.current) {
          shouldUpdateCenter.current = false;
          // Clear mapCenter to make map uncontrolled, allowing free panning/zooming
          setMapCenter(null);
        }
      };


      // Ref to track if category matching is in progress to prevent duplicate calls
      const categoryMatchingRef = useRef<string | null>(null);
      const categoryMatchInProgressRef = useRef(false);
      const categoryMatchPromiseRef = useRef<Promise<void> | null>(null);

      // Effect to handle Google Places types and match with valid subcategories
      useEffect(() => {
        // For person recommendations, show all subcategories immediately
        if (recommendationType === "person" && Array.isArray(categories) && categories.length > 0) {
          const allSubcategories = categories.flatMap((category) =>
            Array.isArray(category.recommendation_sub_categories)
              ? category.recommendation_sub_categories.map(
                (subcategory: Subcategory) => ({
                  Category_Name: subcategory.sub_category,
                  documentId: subcategory.documentId,
                  parentCategory: category.documentId,
                  parentCategoryName: category.Category_Name,
                })
              )
              : []
          );

          const formattedSubcategories: KeyValuePair[] = Array.isArray(allSubcategories) && allSubcategories.length > 0
            ? allSubcategories.map(
              (sub) => ({
                Category_Name: sub.Category_Name,
                documentId: sub.documentId,
              })
            )
            : [];
          setSubcategories(formattedSubcategories);
          return;
        }

        // For place recommendations, use enhanced category matching
        if (places?.place_id && places?.name && Array.isArray(categories) && categories.length > 0) {
          // Create a unique key for this place to prevent duplicate calls
          const placeKey = `${places.place_id}-${places.name}`;

          // Skip if already processed this exact place
          if (categoryMatchingRef.current === placeKey) {
            return;
          }

          // Skip if already processing
          if (categoryMatchInProgressRef.current) {
            return;
          }

          // Mark as in progress and store the key
          categoryMatchInProgressRef.current = true;
          categoryMatchingRef.current = placeKey;

          // Use async function to handle category matching
          const matchCategory = async () => {
            try {
              const { findPlaceCategory } = await import("../../../utils/categoryMapper");
              const placeCategoryData = {
                placeName: places.name || "",
                types: places.types || [],
                primaryType: places.primaryType,
                primaryTypeDisplayName: places.primaryTypeDisplayName,
                formattedAddress: places.formatted_address,
              };

              // Use LLM as primary method for accurate categorization
              // Cast categories to the expected type (categories actually has the correct structure at runtime)
              const match = await findPlaceCategory(placeCategoryData, categories as unknown as Array<{
                Category_Name: string;
                documentId: string;
                recommendation_sub_categories: Array<{
                  sub_category: string;
                  documentId: string;
                }>;
              }>, {
                useLLMPrimary: true,
                useRuleBasedFallback: true,
                enableCache: true,
              });

              if (match) {
                // Found a match - set category and subcategory IMMEDIATELY
                console.log('Setting category:', match.categoryId, match.subcategoryId, match);

                // Find the category to get its subcategories
                const matchedCategory = categories.find(cat => cat.documentId === match.categoryId);

                // Set state variables FIRST
                setSelectedCategory(match.categoryId);
                setSelectedsubcategory(match.subcategoryId);

                // Update subcategories list for the selected category
                if (matchedCategory && Array.isArray(matchedCategory.recommendation_sub_categories)) {
                  const formattedSubcategories: KeyValuePair[] = matchedCategory.recommendation_sub_categories.map(
                    (subcategory: Subcategory) => ({
                      Category_Name: subcategory.sub_category,
                      documentId: subcategory.documentId,
                    })
                  );
                  setSubcategories(formattedSubcategories);
                  console.log('Subcategories updated for category:', match.categoryName, formattedSubcategories.length);
                }

                // Show success message for LLM matches
                if (match.method === 'llm') {
                  toast.success(
                    `Category detected: ${match.categoryName} > ${match.subcategoryName}`
                  );
                }
              } else {
                // No match found - show all subcategories for manual selection
                const allSubcategories = categories.flatMap((category) =>
                  Array.isArray(category.recommendation_sub_categories)
                    ? category.recommendation_sub_categories.map(
                      (subcategory: Subcategory) => ({
                        Category_Name: subcategory.sub_category,
                        documentId: subcategory.documentId,
                      })
                    )
                    : []
                );

                const formattedSubcategories: KeyValuePair[] = Array.isArray(allSubcategories) && allSubcategories.length > 0
                  ? allSubcategories.map(
                    (sub) => ({
                      Category_Name: sub.Category_Name,
                      documentId: sub.documentId,
                    })
                  )
                  : [];
                setSubcategories(formattedSubcategories);
              }
            } catch (error) {
              console.error("Error in category matching:", error);
              // Fallback to showing all subcategories
              const allSubcategories = categories.flatMap((category) =>
                Array.isArray(category.recommendation_sub_categories)
                  ? category.recommendation_sub_categories.map(
                    (subcategory: Subcategory) => ({
                      Category_Name: subcategory.sub_category,
                      documentId: subcategory.documentId,
                    })
                  )
                  : []
              );

              const formattedSubcategories: KeyValuePair[] = Array.isArray(allSubcategories) && allSubcategories.length > 0
                ? allSubcategories.map(
                  (sub) => ({
                    Category_Name: sub.Category_Name,
                    documentId: sub.documentId,
                  })
                )
                : [];
              setSubcategories(formattedSubcategories);
            } finally {
              // Reset in progress flag
              categoryMatchInProgressRef.current = false;
              categoryMatchPromiseRef.current = null;
            }
          };

          // Store the promise to prevent duplicate calls
          const promise = matchCategory();
          categoryMatchPromiseRef.current = promise;
        } else {
          // Reset refs when places is cleared
          categoryMatchingRef.current = null;
          categoryMatchInProgressRef.current = false;
          categoryMatchPromiseRef.current = null;
        }
      }, [places?.place_id, places?.name, categories, recommendationType]);

      const handleSubCategoryChange = (subcategory: KeyValuePair) => {
        setSelectedsubcategory(subcategory.documentId);
        // Find and set the parent category
        if (Array.isArray(categories) && categories.length > 0) {
          const parentCategory = categories.find(
            (category) =>
              Array.isArray(category.recommendation_sub_categories) &&
              category.recommendation_sub_categories.some(
                (sub: Subcategory) => sub.documentId === subcategory.documentId
              )
          );
          if (parentCategory) {
            setSelectedCategory(parentCategory.documentId);
          }
        }
      };

      // categories for initial values
      useEffect(() => {
        if (initialValues.category && Array.isArray(categories) && categories.length > 0) {
          // In edit mode, initialValues.category is a documentId
          // In create mode, it might be a category name
          const matchedCategory = categories.find(
            (cat) =>
              cat.documentId === initialValues.category ||
              cat.Category_Name.toLowerCase().trim() ===
              initialValues.category.toLowerCase().trim()
          );

          if (matchedCategory) {
            setSelectedCategory(matchedCategory.documentId);
            // Set subcategories based on initial category
            const subcategoryOptions = Array.isArray(
              matchedCategory.recommendation_sub_categories
            )
              ? matchedCategory.recommendation_sub_categories.map(
                (subcategory: Subcategory) => ({
                  Category_Name: subcategory.sub_category,
                  documentId: subcategory.documentId,
                })
              )
              : [];

            setSubcategories(subcategoryOptions);

            // Set initial subcategory if available
            if (initialValues.subcategory) {
              // In edit mode, initialValues.subcategory is a documentId
              // In create mode, it might be a subcategory name
              const matchedSubcategory = subcategoryOptions.find(
                (sub) =>
                  sub.documentId === initialValues.subcategory ||
                  sub.Category_Name.toLowerCase().trim() ===
                  initialValues.subcategory.toLowerCase().trim()
              );

              if (matchedSubcategory) {
                setSelectedsubcategory(matchedSubcategory.documentId);
              } else {
                // If subcategory from initialValues doesn't match, still set it
                // This handles cases where subcategory might be a documentId but not in current options
                if (initialValues.subcategory) {
                  setSelectedsubcategory(initialValues.subcategory);
                }
              }
            } else if (initialValues.subcategory) {
              // If no category match but subcategory exists, still set it
              setSelectedsubcategory(initialValues.subcategory);
            }
          } else if (initialValues.subcategory) {
            // If category doesn't match but subcategory exists, set it anyway
            // This handles edge cases where data might be inconsistent
            setSelectedsubcategory(initialValues.subcategory);
          }
        }
      }, [initialValues.category, initialValues.subcategory, categories]);

      // Use the formFields passed as props (which come from useRecommendationFields hook)
      const formFields = initialFormFields;

      // Enhanced function to validate location with address components and distance validation
      const validateLocation = async (place: Places): Promise<boolean> => {
        if (!selectedCity?.List_Name) {
          return true; // Skip validation if no parent location
        }

        setIsValidatingLocation(true);

        try {
          // Step 1: First run existing address/component validation
          const placeComponents: Record<string, string> = {};

          if (place.address_components && place.address_components.length > 0) {
            place.address_components.forEach((component: AddressComponent) => {
              const types = component.types;
              if (types && Array.isArray(types)) {
                if (types.includes("locality"))
                  placeComponents.city = component.long_name;
                if (types.includes("administrative_area_level_1"))
                  placeComponents.state = component.long_name;
                if (types.includes("country"))
                  placeComponents.country = component.long_name;
                if (types.includes("sublocality_level_1"))
                  placeComponents.neighborhood = component.long_name;
                if (types.includes("sublocality"))
                  placeComponents.sublocality = component.long_name;
              }
            });
          }

          // Get the full formatted address
          const fullAddress = place.formatted_address || "";

          // Extract location components from the parent location name
          const parentLocationParts = selectedCity.List_Name.split(",").map(
            (part: string) => part.trim()
          );

          // Check if any of the place components or full address contains the parent location
          const matchesParentLocation = parentLocationParts.some(
            (part: string) => {
              const normalizedPart = part.toLowerCase();
              return (
                // Check against individual components (if available)
                Object.values(placeComponents).some((value: string) =>
                  value.toLowerCase().includes(normalizedPart)
                ) ||
                // Check against full address (primary fallback for TopPlaces data)
                fullAddress.toLowerCase().includes(normalizedPart) ||
                // Check against place name as additional fallback
                (place.name &&
                  place.name.toLowerCase().includes(normalizedPart))
              );
            }
          );

          // If address validation passes, the place is in the exact location
          if (matchesParentLocation) {
            return true;
          }

          // Step 2: If address validation fails, try distance validation
          // Get coordinates for the place being added
          const placeCoords: LocationValidationCoords = {
            lat:
              typeof place.geometry?.location.lat === "function"
                ? place.geometry.location.lat()
                : place.geometry?.location.lat || 0,
            lng:
              typeof place.geometry?.location.lng === "function"
                ? place.geometry.location.lng()
                : place.geometry?.location.lng || 0,
          };
          // Get coordinates for the parent location (selectedCity)
          let parentCoords: LocationValidationCoords | null = null;

          // First, check if the location itself has coordinates stored (for draft locations)
          if (selectedCity?.List_Name_Details?.location) {
            const locationCoords = selectedCity.List_Name_Details.location;
            if (locationCoords.latitude && locationCoords.longitude) {
              parentCoords = {
                lat: parseFloat(locationCoords.latitude.toString()),
                lng: parseFloat(locationCoords.longitude.toString()),
              };
            }
          }

          // If no coordinates found in List_Name_Details, try to get from place name using geocoding
          if (!parentCoords && selectedCity?.List_Name) {
            try {
              const geocoder = new google.maps.Geocoder();
              const geocodeResult = await new Promise<
                google.maps.GeocoderResult[]
              >((resolve, reject) => {
                geocoder.geocode(
                  { address: selectedCity.List_Name },
                  (results, status) => {
                    if (
                      status === google.maps.GeocoderStatus.OK &&
                      results &&
                      results.length > 0
                    ) {
                      resolve(results);
                    } else {
                      reject(new Error(`Geocoding failed: ${status}`));
                    }
                  }
                );
              });

              if (geocodeResult[0]) {
                const location = geocodeResult[0].geometry.location;
                parentCoords = {
                  lat: location.lat(),
                  lng: location.lng(),
                };
              }
            } catch (geocodeError) {
              console.warn(
                "Geocoding failed for parent location:",
                geocodeError
              );
            }
          }

          // If no parent coordinates found, we cannot perform distance validation
          if (!parentCoords || !placeCoords.lat || !placeCoords.lng) {
            toast.error(
              `This place must be in ${selectedCity.List_Name}. Unable to verify distance - missing location data.`
            );
            return false;
          }

          // Step 3: Perform distance validation using Google Distance Matrix API
          try {
            const distanceResult = await validateDistance(
              parentCoords,
              placeCoords
            );
            if (distanceResult.isValid) {
              // Place is within acceptable distance/time
              toast.success(
                `Place accepted - ${distanceResult.distance?.text || "Distance calculated"
                } from ${selectedCity.List_Name}`
              );
              return true;
            } else {
              // Place is too far or validation failed
              const distanceText =
                distanceResult.distance?.text || "Unknown distance";
              const durationText =
                distanceResult.duration?.text || "Unknown time";
              // If we have error info, show a more helpful message
              if (distanceResult.error) {
                console.warn("Distance validation API error:", {
                  error: distanceResult.error,
                  debugInfo: distanceResult.debugInfo,
                  parentCoords,
                  placeCoords,
                });
                toast.error(
                  `Unable to validate distance to ${selectedCity.List_Name}: ${distanceResult.error}. Please try again or check your connection.`
                );
              } else {
                // This means the place is too far, not an API error
                toast.error(
                  `This place is too far from ${selectedCity.List_Name
                  }. Distance: ${distanceText}, Travel time: ${durationText}. Maximum allowed: ${getDistanceLimitText()}.`
                );
              }
              return false;
            }
          } catch (distanceError) {
            console.error("Distance Matrix API failed:", distanceError);

            // Step 4: Fallback to straight-line distance calculation
            const fallbackResult = fallbackDistanceValidation(
              parentCoords,
              placeCoords
            );

            if (fallbackResult.isValid) {
              toast.success(
                `Place accepted - ${fallbackResult.distance?.text || "Within acceptable range"
                } from ${selectedCity.List_Name} (estimated)`
              );
              return true;
            } else {
              toast.error(
                `This place appears to be too far from ${selectedCity.List_Name
                }. ${fallbackResult.distance?.text || "Distance check failed"
                }. Unable to validate travel time at this time.`
              );
              return false;
            }
          }
        } catch (error) {
          console.error("Error during location validation:", error);
          toast.error(
            "Unable to validate location at this time. Please try again or contact support."
          );
          return false;
        } finally {
          setIsValidatingLocation(false);
        }
      };

      // Generate a key that changes when data loads (for edit mode)
      const formKey = type === "edit"
        ? `edit-${placeId || 'new'}-${initialValues.title ? 'loaded' : 'loading'}`
        : undefined;

      return (
        <Formik
          key={formKey}
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              // Set submitting state immediately to show loader
              setSubmitting(true);

              // Show loading state while validating location (only for places, not persons)
              if (places && recommendationType === "place") {
                const isValidLocation = await validateLocation(places);
                if (!isValidLocation) {
                  setSubmitting(false);
                  return;
                }
              }

              // Ensure address field is populated from places if not already set (only for places)
              let addressForSubmission = values.address;
              let titleForSubmission = values.title;

              if (!addressForSubmission && places && recommendationType === "place") {
                const addressToUse = places.formatted_address || places.name || 'Unknown Address';
                addressForSubmission = addressToUse;
              } else if (recommendationType === "person") {
                // For person, use the address field if provided, otherwise empty string
                addressForSubmission = values.address || '';
                // For person, if title is not provided, use the recommendation (Instagram/LinkedIn) as title
                if (!titleForSubmission) {
                  titleForSubmission = values.recommendation || 'Unknown Person';
                }
              }

              const updatedRecommendationValues = {
                ...values,
                address: addressForSubmission,
                title: titleForSubmission,
                recommendation,
                geoCoords: recommendationType === "place" ? JSON.stringify(newCoords) : JSON.stringify({ lat: 0, lng: 0 }),
                reason: recommendedReason || initialValues.reason,
                category: selectedCategory,
                subcategory: selectedSubcategory,
              };

              try {
                if (type === "edit") {
                  setHasSubmitted(true);
                }
                await onSubmit(updatedRecommendationValues);
              } catch (error) {
                // Error is handled in the onSubmit handler, just prevent form reset
                console.error("Form submission error:", error);
                if (type === "edit") {
                  setHasSubmitted(false); // Allow retry
                }
              } finally {
                setSubmitting(false);
              }
            } catch (error) {
              console.error("Error submitting recommendation:", error);
              // Error handling is done in parent component
              setSubmitting(false);
            }
          }}
          enableReinitialize={type !== "edit" || !hasSubmitted}
        >
          {({ isSubmitting, setFieldValue }) => {
            // Track previous recommendation type to detect changes
            const prevTypeRef = useRef(recommendationType);

            // Effect to clear form fields only when recommendation type changes
            useEffect(() => {
              // Only clear if type actually changed
              if (prevTypeRef.current !== recommendationType && type !== "edit") {
                if (recommendationType === "person") {
                  // Clear all place-related fields when switching to person
                  setFieldValue("title", "");
                  setFieldValue("recommendation", "");
                  setFieldValue("address", "");
                  setFieldValue("subcategory", "");
                  setFieldValue("contactName", "");
                  setFieldValue("contactNumber", "");
                  setFieldValue("socialLink", "");
                  setRecommendation("");
                  setSelectedsubcategory("");
                  setSelectedCategory("");
                } else {
                  // Clear person-specific fields when switching to place
                  setFieldValue("contactName", "");
                  setFieldValue("recommendation", "");
                  setFieldValue("address", "");
                  setFieldValue("subcategory", "");
                  setFieldValue("title", "");
                  setFieldValue("contactNumber", "");
                  setFieldValue("socialLink", "");
                  setRecommendation("");
                  setSelectedsubcategory("");
                  setSelectedCategory("");
                }
                // Update ref to current type
                prevTypeRef.current = recommendationType;
              }
            }, [recommendationType, setFieldValue, type]);

            // Effect to automatically open taggable fields if they have data from initialValues
            // (e.g. when prefilled from Instagram overlay scraping)
            useEffect(() => {
              if (type !== "edit" && initialValues) {
                // Check if contactName has a value and isn't active
                if (initialValues.contactName && !activeFields.includes("contactName")) {
                  handleTagClick("contactName");
                }
                // Check if socialLink has a value and isn't active
                if (initialValues.socialLink && !activeFields.includes("socialLink")) {
                  handleTagClick("socialLink");
                }
                // Check if reason has a value and isn't active
                if (initialValues.reason && !activeFields.includes("reason")) {
                  handleTagClick("reason");
                }
                // Check if recommendationLink has a value and isn't active
                if (initialValues.recommendationLink && !activeFields.includes("recommendationLink")) {
                  handleTagClick("recommendationLink");
                }
              }
            }, [initialValues, activeFields, handleTagClick, type]);

            // Function to handle recommendation change and also set address
            const handleRecommendationChangeWithAddress = (newRecommendation: string) => {
              setRecommendation(newRecommendation);
              // Update Formik's field value
              setFieldValue("recommendation", newRecommendation);
              // Update address from places for place recommendations only
              if (recommendationType === "place" && places) {
                const addressToUse = places.formatted_address || places.name || 'Unknown Address';
                setFieldValue("address", addressToUse);
              }
            };

            return (
              <Form className="font-poppins h-full md:w-full w-full md:max-w-3xl px-2 flex flex-col gap-4">
                <ScrollToFirstErrorWithActivation
                  handleTagClick={handleTagClick}
                  activeFields={activeFields}
                />
                {/* Loading indicator during validation */}
                {(isValidatingLocation || isSubmitting) && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div className="bg-dashboard-sidebar p-6 rounded-lg flex flex-col items-center gap-4 shadow-dashboard-elevated border border-dashboard">
                      <EarthLoader context="general" size="small" />
                      <p className="text-white font-poppins text-sm font-medium">
                        {isValidatingLocation
                          ? "Validating location distance..."
                          : "Adding recommendation..."}
                      </p>
                    </div>
                  </div>
                )}
                {!isCustom && recommendationType === "place" && (
                  <div
                    className="overflow-x-auto w-full my-4"
                    style={{ scrollbarWidth: "none" }}
                  >
                    <div className="flex flex-nowrap py-4 items-center justify-start gap-2">
                      {initialFormFields
                        .filter((field) => taggableFields.includes(field.name))
                        .map((field, index) => (
                          <button
                            key={field.name || index}
                            className={`px-4 flex flex-row items-center gap-2 relative py-2 font-poppins text-xs rounded-md min-w-max ${activeFields.includes(field.name)
                              ? "bg-dashboard-sidebar text-dashboard border-2 border-dashboard-accent"
                              : "bg-dashboard-sidebar text-dashboard"
                              }`}
                            type="button"
                            onClick={() => handleTagClick(field.name)}
                          >
                            {field.label}
                            {activeFields.includes(field.name) ? (
                              <span
                                className="tag-remove-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTag(field.name);
                                }}
                              >
                                <CrossIcon size="4" />
                              </span>
                            ) : (
                              <AddIcon size="5" />
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                {initialFormFields
                  .filter((field) => activeFields.includes(field.name))
                  .map((field, index) => (
                    <div key={field.name || index} data-field-id={field.name}>
                      {field.name !== "recommendationDetails" &&
                        !(field.name === "recommendation" && recommendationType === "person") && (
                          <label className="block text-xs font-poppins text-dashboard font-semibold mb-1">
                            {field.label}
                            {field.isRequired && (
                              <span className="text-white-danger font-poppins text-sm font-medium">
                                *
                              </span>
                            )}
                          </label>
                        )}

                      {field.name === "recommendation" ? (
                        <>
                          {recommendationType === "place" && type !== "edit" ? (
                            <AddressInput
                              setPlaces={setPlaces}
                              type="title"
                              disabled={false}
                              label="Your Recommendation"
                              value={recommendation}
                              onChange={handleRecommendationChangeWithAddress}
                              placeHolder={t(
                                "dashboard.recommendations.addRecommendationForm.mainInput.placeholder"
                              )}
                              showDetectLocation={true}
                            />
                          ) : (
                            <>
                              {recommendationType === "person" && (
                                <label className="block text-xs font-poppins text-dashboard font-semibold mb-1">
                                  Person's Instagram or LinkedIn
                                  <span className="text-white-danger font-poppins text-sm font-medium ml-1">
                                    *
                                  </span>
                                </label>
                              )}
                              <div className="flex gap-2 items-center w-full">
                                {/* Helper: detect if the input looks like a LinkedIn URL */}
                                {(() => {
                                  const isLinkedInInput = /linkedin\.com/i.test(recommendation.trim());
                                  const showFetchButton = recommendationType === "person" && onInstagramProfileScrape && !isLinkedInInput;
                                  return (
                                    <>
                                      <Field
                                        name="recommendation"
                                        type="text"
                                        placeholder={
                                          recommendationType === "person"
                                            ? "instagram.com/username, @username, or linkedin.com/in/username"
                                            : t(
                                              "dashboard.recommendations.addRecommendationForm.mainInput.placeholder"
                                            )
                                        }
                                        className="flex-1 min-w-0 placeholder:text-dashboard-muted outline-none p-3 border border-dashboard bg-dashboard-muted text-dashboard font-poppins rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent"
                                        value={recommendation}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                          handleRecommendationChangeWithAddress(e.target.value);
                                        }}
                                        onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                                          if (e.key === 'Enter' && showFetchButton && recommendation.trim()) {
                                            e.preventDefault();
                                            const result = await onInstagramProfileScrape(recommendation);
                                            if (result) {
                                              setFieldValue('title', result.fullName);
                                              setFieldValue('contactName', result.fullName);
                                              setFieldValue('socialLink', result.profileUrl);
                                              setFieldValue('recommendationLink', result.profileUrl);
                                              // Auto-activate the tag fields so they become visible
                                              handleTagClick('contactName');
                                              handleTagClick('socialLink');
                                            }
                                          }
                                        }}
                                      />
                                      {showFetchButton && (
                                        <Button
                                          variant="primary"
                                          size="medium"
                                          btnText={isScrapingProfile ? "Fetching..." : "Fetch"}
                                          disabled={isScrapingProfile || !recommendation.trim()}
                                          onClickHandler={async () => {
                                            if (recommendation.trim()) {
                                              const result = await onInstagramProfileScrape(recommendation);
                                              if (result) {
                                                setFieldValue('title', result.fullName);
                                                setFieldValue('contactName', result.fullName);
                                                setFieldValue('socialLink', result.profileUrl);
                                                setFieldValue('recommendationLink', result.profileUrl);
                                                // Auto-activate the tag fields so they become visible
                                                handleTagClick('contactName');
                                                handleTagClick('socialLink');
                                              }
                                            }
                                          }}
                                        />
                                      )}
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Inline Loader for Instagram Scraping */}
                              {isScrapingProfile && recommendationType === "person" && (
                                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-dashboard-muted mt-2 overflow-hidden">
                                  <div style={{ height: "160px", width: "100%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <EarthLoader context="general" size="small" showText={false} />
                                  </div>
                                  <div className="flex flex-col items-center gap-1 pb-5">
                                    <span className="text-sm font-poppins font-medium text-white animate-pulse">
                                      Connecting to Instagram...
                                    </span>
                                    <p className="text-xs text-dashboard-light text-center max-w-[80%]">
                                      This usually takes about 30 seconds.
                                    </p>
                                  </div>
                                </div>
                              )}
                              <ErrorMessage
                                name="recommendation"
                                component="span"
                                className="text-sm text-red-400 font-poppins mt-1 block"
                              />
                            </>
                          )}
                          {/* Show taggable fields for both place and person types */}
                          <div
                            className="overflow-x-auto w-full my-4"
                            style={{ scrollbarWidth: "none" }}
                          >
                            <div className="flex flex-nowrap py-4 items-center justify-start gap-2">
                              {formFields
                                .filter((field) =>
                                  taggableFields.includes(field.name)
                                )
                                .map((field, index) => (
                                  <button
                                    key={field.name || index}
                                    className={`px-4 flex flex-row items-center gap-2 relative py-2 font-poppins text-xs rounded-md min-w-max ${activeFields.includes(field.name)
                                      ? "bg-dashboard-sidebar text-dashboard border-2 border-dashboard-accent"
                                      : "bg-dashboard-sidebar text-dashboard"
                                      }`}
                                    type="button"
                                    onClick={() => handleTagClick(field.name)}
                                  >
                                    {field.label}
                                    {activeFields.includes(field.name) ? (
                                      <span
                                        className="tag-remove-icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveTag(field.name);
                                        }}
                                      >
                                        <CrossIcon size="4" />
                                      </span>
                                    ) : (
                                      <AddIcon size="5" />
                                    )}
                                  </button>
                                ))}
                            </div>
                          </div>
                        </>
                      ) : field.name === "category" ? (
                        <Field name="category">
                          {({ form: { setFieldValue } }: { form: { setFieldValue: (field: string, value: any) => void } }) => {
                            // Sync category field when selectedCategory changes - FORCE update
                            useEffect(() => {
                              if (selectedCategory) {
                                console.log('Syncing Formik category to:', selectedCategory);
                                // Use setFieldValue to update the category field
                                setFieldValue("category", selectedCategory);
                              }
                            }, [selectedCategory, setFieldValue]);

                            // Find the category object to display - ensure we always have Category_Name
                            const categoryObj = Array.isArray(categories) && categories.length > 0 && selectedCategory
                              ? categories.find((cat) => cat.documentId === selectedCategory)
                              : null;

                            // Ensure selectedValue has Category_Name for Dropdown to display
                            const displayValue = categoryObj
                              ? categoryObj
                              : (selectedCategory
                                ? { Category_Name: "", documentId: selectedCategory }
                                : { Category_Name: initialValues.category || "", documentId: initialValues.category || "" });

                            // Debug logging
                            if (selectedCategory && categoryObj) {
                              console.log('Category dropdown - Found category:', categoryObj.Category_Name, 'for ID:', selectedCategory);
                            } else if (selectedCategory && !categoryObj) {
                              console.warn('Category dropdown - Category ID not found in options:', selectedCategory, 'Available:', categories.map(c => c.documentId));
                            }

                            // Force update when category changes by using key with Category_Name
                            return (
                              <Dropdown
                                key={`category-${selectedCategory || 'none'}-${categoryObj?.Category_Name || ''}`}
                                initalValue={categoryObj?.Category_Name || initialValues.category || ""}
                                options={Array.isArray(categories) ? categories : []}
                                label={field.placeholder}
                                selectedValue={displayValue}
                                handleChange={(category: KeyValuePair) => {
                                  console.log('Category changed manually:', category);
                                  setSelectedCategory(category.documentId);
                                  setFieldValue("category", category.documentId);
                                  handleSubCategoryChange(category);
                                }}
                              />
                            );
                          }}
                        </Field>
                      ) : field.name === "subcategory" ? (
                        <>
                          <Field name="subcategory">
                            {({ form: { setFieldValue } }: { form: { setFieldValue: (field: string, value: any) => void } }) => {
                              // Sync form field value with state when selectedSubcategory changes
                              useEffect(() => {
                                if (selectedSubcategory) {
                                  setFieldValue("subcategory", selectedSubcategory);
                                }
                              }, [selectedSubcategory, setFieldValue]);

                              // Sync category field when selectedCategory changes
                              useEffect(() => {
                                if (selectedCategory) {
                                  setFieldValue("category", selectedCategory);
                                }
                              }, [selectedCategory, setFieldValue]);

                              return (
                                <Dropdown
                                  initalValue={initialValues.subcategory}
                                  options={subcategories}
                                  label={field.placeholder}
                                  selectedValue={
                                    subcategories.find((sub) => sub.documentId === selectedSubcategory) ||
                                    { Category_Name: "", documentId: selectedSubcategory }
                                  }
                                  handleChange={(subcategory: KeyValuePair) => {
                                    handleSubCategoryChange(subcategory);
                                    setFieldValue("subcategory", subcategory.documentId);
                                  }}
                                />
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            name="subcategory"
                            component="span"
                            className="text-sm text-red-400 font-poppins mt-1 block"
                          />
                        </>

                      ) : field.type === "custom" && field.components ? (
                        <div className="w-full my-4 md:max-w-3xl bg-dashboard-sidebar rounded-md">
                          <div
                            className="flex cursor-pointer items-center w-full justify-between p-4"
                            onClick={() => setIsOpen(!isOpen)}
                          >
                            <h1 className="text-md font-semibold text-dashboard ">
                              {field.label}
                            </h1>
                            <div
                              className={`text-dashboard cursor-pointer transition-transform duration-500 ease-in-out ${isOpen ? "rotate-180 " : "rotate-0"
                                }`}
                            >
                              <Down stroke="currentColor" />
                            </div>
                          </div>
                          {isOpen && (
                            <div className="flex flex-col p-4 w-full gap-4">
                              {/* Instagram Embed Preview */}
                              {(() => {
                                const linkValue = initialValues.recommendationLink || '';
                                const instagramMatch = linkValue.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
                                if (instagramMatch) {
                                  const shortcode = instagramMatch[1];
                                  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
                                  return (
                                    <div className="w-full flex justify-center mb-2">
                                      <div
                                        style={{
                                          width: '100%',
                                          maxWidth: '280px',
                                          borderRadius: '8px',
                                          overflow: 'hidden',
                                          border: '1px solid rgba(255,255,255,0.08)',
                                          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                                        }}
                                      >
                                        <iframe
                                          src={embedUrl}
                                          width="100%"
                                          height="320"
                                          frameBorder="0"
                                          scrolling="no"
                                          allowTransparency={true}
                                          allow="encrypted-media"
                                          style={{
                                            background: '#000',
                                            border: 'none',
                                            display: 'block',
                                          }}
                                          title="Instagram Post Preview"
                                        />
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {field.components.map((item, index) => (
                                <div key={`${field.name}-${item.name}-${index}`} data-field-id={item.name}>
                                  <div className="flex  items-center gap-4 ">
                                    <label className="block text-xs font-poppins text-dashboard font-semibold mb-1">
                                      {item.label}
                                    </label>
                                  </div>
                                  {item.name === "reason" ? (
                                    <TiptapEditor
                                      initalValue={initialValues.reason}
                                      value={recommendedReason}
                                      onChange={setRecommendedReason}
                                    />
                                  ) : (
                                    <Field
                                      name={item.name}
                                      type={item.type}
                                      placeholder={item.placeholder}
                                      className={`w-full placeholder:text-dashboard-muted outline-none p-3 border border-dashboard bg-dashboard-muted text-dashboard font-poppins rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent`}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : field.type === "rating" ? (
                        <Field name={field.name}>
                          {({ form: { setFieldValue, values } }: any) => {
                            const currentRating = values[field.name] ?? 0;
                            return (
                              <div className="flex gap-1.5 flex-wrap items-center mt-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setFieldValue(field.name, star)}
                                    className={`p-1 transition-all hover:scale-110 active:scale-95 ${
                                      currentRating >= star
                                        ? "text-yellow-400"
                                        : "text-white/20 hover:text-white/40"
                                    }`}
                                  >
                                    <StarIcon
                                      size="size-6"
                                      fillColor={currentRating >= star ? "#FFEE58" : "transparent"}
                                    />
                                  </button>
                                ))}
                                {currentRating > 0 && (
                                  <span className="text-dashboard text-sm ml-2 font-medium font-poppins">
                                    {currentRating}/10
                                  </span>
                                )}
                              </div>
                            );
                          }}
                        </Field>
                      ) : (
                        <Field
                          name={field.name}
                          type={field.type}
                          placeholder={field.placeholder}
                          as={field.as}
                          disabled={field.name === "googleRating"}
                          className={`w-full placeholder:text-dashboard-muted ${field.type === "textarea" &&
                            "h-32 overflow-auto modal-scroll resize-none text-xs"
                            } outline-none p-3 border border-dashboard bg-dashboard-muted text-dashboard font-poppins
                      ${field.name === "recommendation" && "hidden"
                            } ${field.name === "googleRating" && "opacity-60 cursor-not-allowed"} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent`}
                        />
                      )}

                      {/* Show ErrorMessage for all fields except 'recommendation' and 'subcategory' (they have their own) */}
                      {field.name !== "recommendation" && field.name !== "subcategory" && (
                        <ErrorMessage
                          name={field.name}
                          component="span"
                          className="text-sm text-red-400 font-poppins mt-1 block"
                        />
                      )}
                    </div>
                  ))}
                <Modal
                  isOpen={isMapModalOpen}
                  onClose={() => setIsMapModalOpen(false)}
                  type="crop"
                >
                  <div className="p-2 sm:p-4">
                    <Map
                      disableDefaultUI={false}
                      scaleControl={true}
                      defaultCenter={currentCoords}
                      center={mapCenter || undefined}
                      defaultZoom={18}
                      mapId={"mapView"}
                      style={{
                        height: "clamp(400px, 60vh, 70vh)",
                        width: "100%"
                      }}
                      scrollwheel={true}
                      gestureHandling={"greedy"}
                      onCameraChanged={handleCameraChanged}
                    >
                      <AdvancedMarker
                        position={currentCoords}
                        draggable={true}
                        onDragEnd={handleDragEnd}
                      >
                        <Pin
                          background={"red"}
                          borderColor={"red"}
                          glyphColor={"white"}
                        />
                      </AdvancedMarker>
                    </Map>
                  </div>
                  <div className="flex justify-end gap-4 p-2 sm:p-4 pt-2">
                    <Button
                      btnText={t(
                        "dashboard.recommendations.addRecommendationForm.mapModal.cancelButton"
                      )}
                      type="button"
                      variant="danger"
                      size="xsmall"
                      onClickHandler={() => setIsMapModalOpen(false)}
                    />
                    <Button
                      btnText={(() => {
                        const translationKey = "dashboard.recommendations.addRecommendationForm.mapModal.setLocationButton";
                        const translated = t(translationKey);
                        // If translation returns the key itself, use fallback
                        return translated === translationKey ? "Set Location" : translated;
                      })()}
                      type="button"
                      variant="primary"
                      size="xsmall"
                      onClickHandler={() => {
                        // Update form fields with current coordinates
                        setFieldValue("lat", currentCoords.lat.toString());
                        setFieldValue("lng", currentCoords.lng.toString());
                        // Close the modal
                        setIsMapModalOpen(false);
                      }}
                    />
                  </div>
                </Modal>
                <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
              </Form>
            );
          }}
        </Formik>
      );
    }
  )
);

export default RecommendationForm;
