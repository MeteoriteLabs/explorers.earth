/**
 * EditStayModal Component
 * Modal for editing a single stay/accommodation from the Stay tab
 * 
 * SINGLE SOURCE OF TRUTH ENFORCEMENT:
 * When a stay is edited, this component updates ALL related fields to maintain perfect sync:
 * 
 * 1. Stay Field: Updates the accommodation in the Stay.accommodations array (matched by id)
 * 2. Timeline Field: Updates all occurrences in morning/afternoon/evening arrays (matched by id)
 * 3. Budget Field: Updates budget entries in corresponding periods (matched by place_id)
 * 
 * This ensures that:
 * - Editing from Stay tab updates Timeline tab (and vice versa)
 * - All views reflect the most recent data
 * - No duplicate or stale data exists
 * - ID-based matching ensures correct object updates everywhere
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useApolloClient } from "@apollo/client";
import { UPDATE_GUIDE_SECTION_MUTATION } from "../../api/mutations";
import { GET_GUIDE_BY_ID_QUERY } from "../../api/queries";
import { toast } from "sonner";
import AddressInput from "../../../Profile/components/AddressInput";
import Button from "../../../../components/ui/Button";
import { DayPlace, StayData, TimelineData, BudgetData, BudgetPlace } from "../../types/guideSectionTypes";
import { parseStay, parseTimeline, parseBudget } from "../../utils/guideDataParser";
import StayIcon from "../../../../assets/icons/StayIcon";

interface EditStayModalProps {
  isOpen: boolean;
  onClose: () => void;
  stay: DayPlace;
  sectionId: string;
  sectionTitle: string;
  guideId: string;
  onSuccess?: () => void;
}

const EditStayModal: React.FC<EditStayModalProps> = ({
  isOpen,
  onClose,
  stay,
  sectionId,
  sectionTitle,
  guideId,
  onSuccess,
}) => {
  const [stayPlace, setStayPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [stayDisplay, setStayDisplay] = useState("");
  const [loading, setLoading] = useState(false);
  const apolloClient = useApolloClient();

  const [updateSection] = useMutation(UPDATE_GUIDE_SECTION_MUTATION);

  // Initialize form with current stay data
  useEffect(() => {
    if (isOpen && stay) {
      // Convert DayPlace to PlaceResult format for AddressInput
      const placeObj: google.maps.places.PlaceResult = {
        name: stay.name,
        formatted_address: stay.formatted_address,
        place_id: stay.place_id,
        geometry: stay.geometry
          ? ({
              location: {
                lat: () => stay.geometry!.location.lat,
                lng: () => stay.geometry!.location.lng,
              } as google.maps.LatLng,
            } as google.maps.places.PlaceGeometry)
          : undefined,
        types: stay.types || [],
      } as google.maps.places.PlaceResult;

      setStayPlace(placeObj);
      setStayDisplay(stay.name || stay.formatted_address || "");
    }
  }, [isOpen, stay]);

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place || !place.geometry) {
      toast.error("Please select a valid place");
      return;
    }

    setStayPlace(place);
    setStayDisplay(place.name || place.formatted_address || "");
  };

  // Wrapper to convert Google Maps PlaceResult to Places interface format
  const handlePlaceSelectFromInput = (place: any) => {
    // Convert to google.maps.places.PlaceResult format
    const placeResult: google.maps.places.PlaceResult = {
      ...place,
      geometry: place.geometry ? {
        location: {
          lat: typeof place.geometry.location.lat === "function" 
            ? place.geometry.location.lat 
            : () => place.geometry.location.lat,
          lng: typeof place.geometry.location.lng === "function"
            ? place.geometry.location.lng
            : () => place.geometry.location.lng,
        } as any,
      } : undefined,
    };
    handlePlaceSelect(placeResult);
  };

  const handleSubmit = async () => {
    if (!stayPlace || !stayPlace.geometry) {
      toast.error("Please select a valid accommodation");
      return;
    }

    setLoading(true);

    try {
      // Fetch current section data to preserve other fields
      const { data: guideData } = await apolloClient.query({
        query: GET_GUIDE_BY_ID_QUERY,
        variables: { documentId: guideId },
        fetchPolicy: "network-only",
      });

      const section = guideData?.guide?.guide_sections?.find(
        (s: any) => s.documentId === sectionId
      );

      if (!section) {
        throw new Error("Section not found");
      }

      // Create updated DayPlace from selected place
      const location = stayPlace.geometry?.location;
      
      if (!location) {
        toast.error("Selected place has no location data");
        return;
      }
      
      const updatedStay: DayPlace = {
        id: stay.id, // Preserve the original id - this is the key for syncing
        name: stayPlace.name || "",
        formatted_address: stayPlace.formatted_address || "",
        place_id: stayPlace.place_id || "",
        geometry: {
          location: {
            lat: typeof location.lat === "function" ? location.lat() : Number(location.lat),
            lng: typeof location.lng === "function" ? location.lng() : Number(location.lng),
          },
        },
        types: stayPlace.types || [],
        // Preserve optional fields from original stay
        tips: stay.tips,
        priceLevel: stay.priceLevel,
        priceRange: stay.priceRange,
        customBudget: stay.customBudget,
      };

      // ============================================
      // UPDATE STAY FIELD (Single Source of Truth)
      // ============================================
      const currentStayData = parseStay(section.Stay);
      const accommodations = Array.isArray(currentStayData.accommodations)
        ? [...currentStayData.accommodations]
        : [];

      // Find and update the specific stay by id in Stay field
      const stayIndex = accommodations.findIndex((acc) => acc.id === stay.id);
      if (stayIndex === -1) {
        throw new Error("Stay not found in section");
      }

      // Update the accommodation in the Stay array
      accommodations[stayIndex] = updatedStay;

      // Create updated Stay data
      const updatedStayData: StayData = {
        accommodations,
      };

      const stayString = JSON.stringify(updatedStayData);

      // ============================================
      // UPDATE TIMELINE FIELD (Sync with Timeline arrays)
      // ============================================
      // Parse current Timeline data
      const currentTimelineData = parseTimeline(section.Timeline);
      
      // Helper function to update all occurrences of a stay by ID in an array
      const updateStayInArray = (places: DayPlace[]): DayPlace[] => {
        return places.map((place) => {
          // If this place has the same ID as the stay being edited, update it
          if (place.id === stay.id) {
            return updatedStay;
          }
          return place;
        });
      };

      // Update all timeline arrays (morning, afternoon, evening)
      const updatedTimeline: TimelineData = {
        morning: updateStayInArray(currentTimelineData.morning || []),
        afternoon: updateStayInArray(currentTimelineData.afternoon || []),
        evening: updateStayInArray(currentTimelineData.evening || []),
      };

      const timelineString = JSON.stringify(updatedTimeline);

      // ============================================
      // UPDATE BUDGET FIELD (Sync budget entries)
      // ============================================
      // Budget stores BudgetPlace objects keyed by place_id (not id)
      // Budget entries correspond to Timeline entries, so we update Budget in periods
      // where the stay appears in Timeline
      const currentBudgetData = parseBudget(section.Budget);
      const oldPlaceId = stay.place_id;
      const newPlaceId = updatedStay.place_id;

      // Determine which periods contain this stay (by checking updated Timeline)
      const stayInMorning = updatedTimeline.morning.some((p) => p.id === stay.id);
      const stayInAfternoon = updatedTimeline.afternoon.some((p) => p.id === stay.id);
      const stayInEvening = updatedTimeline.evening.some((p) => p.id === stay.id);

      // Helper to update budget entries in a specific period
      const updateBudgetInPeriod = (
        budgetPlaces: BudgetPlace[],
        hasStayInPeriod: boolean
      ): BudgetPlace[] => {
        if (!hasStayInPeriod) {
          // Stay doesn't appear in this period, remove old entry if it exists
          return budgetPlaces.filter((bp) => bp.place_id !== oldPlaceId);
        }

        // Stay appears in this period, update budget entry
        let updated = budgetPlaces.filter((bp) => bp.place_id !== oldPlaceId);

        // If the new place has price information, add/update it
        if (newPlaceId && (updatedStay.priceLevel !== undefined || updatedStay.priceRange || updatedStay.customBudget)) {
          const existingIndex = updated.findIndex((bp) => bp.place_id === newPlaceId);
          const newBudgetPlace: BudgetPlace = {
            place_id: newPlaceId,
            name: updatedStay.name,
            priceLevel: updatedStay.priceLevel,
            priceRange: updatedStay.priceRange,
            customBudget: updatedStay.customBudget,
          };

          if (existingIndex >= 0) {
            // Update existing entry
            updated[existingIndex] = newBudgetPlace;
          } else {
            // Add new entry
            updated.push(newBudgetPlace);
          }
        }

        return updated;
      };

      const updatedBudget: BudgetData = {
        morning: updateBudgetInPeriod(currentBudgetData.morning || [], stayInMorning),
        afternoon: updateBudgetInPeriod(currentBudgetData.afternoon || [], stayInAfternoon),
        evening: updateBudgetInPeriod(currentBudgetData.evening || [], stayInEvening),
      };

      const budgetString = JSON.stringify(updatedBudget);

      // Update the section - preserve all other fields
      // Stay, Timeline, and Budget fields are all updated to maintain perfect sync
      await updateSection({
        variables: {
          documentId: sectionId,
          data: {
            Title: section.Title,
            Description: section.Description,
            Sequence: section.Sequence,
            Timeline: timelineString, // Updated Timeline field (synced with Stay)
            Transport: section.Transport,
            Stay: stayString, // Updated Stay field
            Recommendation_Activity: section.Recommendation_Activity,
            Map_Details: section.Map_Details,
            Budget: budgetString, // Updated Budget field (synced with Stay and Timeline)
          },
        },
      });

      // Refetch guide data to update UI
      await apolloClient.refetchQueries({
        include: [GET_GUIDE_BY_ID_QUERY],
      });

      toast.success("Stay updated successfully!");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error updating stay:", error);
      toast.error(error.message || "Failed to update stay. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-dashboard-sidebar rounded-2xl shadow-2xl border border-dashboard-muted w-full max-w-md max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-dashboard-sidebar border-b border-dashboard-muted p-6 rounded-t-2xl z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-400 flex items-center justify-center ring-1 ring-blue-400/20">
                    <StayIcon size="5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-dashboard font-poppins font-bold text-lg">
                      Edit Accommodation
                    </h2>
                    <p className="text-dashboard-light text-xs font-poppins truncate">
                      {sectionTitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-dashboard font-poppins font-medium text-sm mb-2">
                    Accommodation Location
                  </label>
                  <AddressInput
                    value={stayDisplay}
                    onChange={(value) => setStayDisplay(value)}
                    setPlaces={handlePlaceSelectFromInput}
                    label="Search for accommodation"
                    placeHolder="Search for hotels, lodges, or accommodations"
                    className="w-full"
                  />
                  {stayPlace && (
                    <p className="mt-2 text-xs text-dashboard-light font-poppins">
                      Selected: {stayPlace.name || stayPlace.formatted_address}
                    </p>
                  )}
                </div>

                {/* Current stay info */}
                {stay && (
                  <div className="p-3 bg-dashboard-bg/50 rounded-lg border border-dashboard-muted/30">
                    <p className="text-xs text-dashboard-light font-poppins mb-1">
                      Current:
                    </p>
                    <p className="text-sm text-dashboard font-poppins font-medium">
                      {stay.name}
                    </p>
                    {stay.formatted_address && (
                      <p className="text-xs text-dashboard-light font-poppins mt-1">
                        {stay.formatted_address}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-dashboard-sidebar border-t border-dashboard-muted p-6 rounded-b-2xl flex gap-3">
                <Button
                  variant="ghost"
                  onClickHandler={onClose}
                  btnText="Cancel"
                  className="flex-1"
                />
                <Button
                  variant="primary"
                  onClickHandler={handleSubmit}
                  btnText={loading ? "Saving..." : "Save Changes"}
                  className="flex-1"
                  disabled={loading || !stayPlace}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EditStayModal;

