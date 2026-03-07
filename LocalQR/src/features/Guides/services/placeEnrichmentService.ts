/**
 * Place Enrichment Service
 * Enriches AI-generated place names with complete Google Places data
 * 
 * Purpose:
 * - Resolves AI place names to Google Places IDs
 * - Fetches geometry, types, and metadata
 * - Ensures data parity between manual and AI-generated guides
 * 
 * Use Case:
 * - AI generates "Rock Garden" → Enrichment finds "ChIJXYZ..." with lat/lng, types, etc.
 * - Enables "Get Directions" to work accurately
 * - Enables correct place icons and categorization
 */

import axios from "axios";
import type { DayPlace } from "../types/guideSectionTypes";
import type { AIGeneratedPlace } from "../../../services/geminiService";

export interface EnrichedPlace extends DayPlace {
  /** Flag indicating if place was verified via Google Places API */
  isVerified: boolean;
  /** Source of place data */
  source: "google" | "ai-unverified";
}

/**
 * Enrich a single AI-generated place with Google Places data
 * @param aiPlace - AI-generated place with name and tips
 * @param locationContext - City/region for search accuracy (e.g., "Chandigarh, India")
 * @returns Enriched place with complete data, or unverified fallback
 */
export const enrichAIPlace = async (
  aiPlace: AIGeneratedPlace,
  locationContext?: string
): Promise<EnrichedPlace | null> => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error("Google Maps API key not configured");
    return createUnverifiedPlace(aiPlace);
  }

  try {
    // Construct search query with location context for better accuracy
    const query = locationContext 
      ? `${aiPlace.name}, ${locationContext}`
      : aiPlace.name;

    // Use Google Places API (New) Text Search
    const response = await axios.post(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        textQuery: query,
        maxResultCount: 1,  // Only need the best match
      },
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.priceLevel'
        }
      }
    );

    const place = response.data?.places?.[0];

    if (!place || !place.id) {
      console.warn(`No Google Places match found for "${aiPlace.name}"`);
      return createUnverifiedPlace(aiPlace);
    }

    // Merge AI data (tips) with Google Places data
    const enrichedPlace: EnrichedPlace = {
      id: `ai-place-${Date.now()}-${Math.random()}`,
      name: place.displayName?.text || aiPlace.name,
      formatted_address: place.formattedAddress || "",
      place_id: place.id || "",
      geometry: place.location ? {
        location: {
          lat: place.location.latitude,
          lng: place.location.longitude,
        }
      } : undefined,
      types: place.types || [],
      tips: aiPlace.tips || "",
      priceLevel: place.priceLevel !== undefined ? place.priceLevel : undefined,
      isVerified: true,
      source: "google",
    };

    return enrichedPlace;
  } catch (error: any) {
    console.error(`Error enriching place "${aiPlace.name}":`, error.response?.data || error.message);
    
    // Check for specific error types
    if (error.response?.status === 429) {
      console.warn("Google Places API rate limit exceeded");
    } else if (error.response?.status === 403) {
      console.error("Google Places API authentication failed");
    }
    
    return createUnverifiedPlace(aiPlace);
  }
};

/**
 * Create unverified place when Google Places API fails or returns no results
 * Preserves AI-generated data but flags as unverified
 * @param aiPlace - Original AI-generated place
 * @returns Unverified place object
 */
const createUnverifiedPlace = (aiPlace: AIGeneratedPlace): EnrichedPlace => {
  return {
    id: `ai-place-${Date.now()}-${Math.random()}`,
    name: aiPlace.name,
    formatted_address: aiPlace.formatted_address || "",
    place_id: aiPlace.place_id || "",
    types: aiPlace.types || [],
    tips: aiPlace.tips || "",
    isVerified: false,
    source: "ai-unverified",
  };
};

/**
 * Batch enrich multiple AI-generated places
 * Processes places in parallel for better performance
 * @param aiPlaces - Array of AI-generated places
 * @param locationContext - City/region context for all places
 * @returns Array of enriched places (guaranteed to return same length)
 */
export const enrichAIPlaces = async (
  aiPlaces: AIGeneratedPlace[],
  locationContext?: string
): Promise<EnrichedPlace[]> => {
  if (!aiPlaces || aiPlaces.length === 0) {
    return [];
  }

  // Enrich all places in parallel for performance
  const enrichmentPromises = aiPlaces.map(place => 
    enrichAIPlace(place, locationContext).catch(error => {
      console.error(`Failed to enrich place "${place.name}":`, error);
      return createUnverifiedPlace(place);
    })
  );

  const results = await Promise.all(enrichmentPromises);

  // Filter out null results (shouldn't happen with catch above, but safety check)
  const enrichedPlaces = results.filter((place): place is EnrichedPlace => place !== null);

  // Log enrichment statistics
  const verified = enrichedPlaces.filter(p => p.isVerified).length;
  const unverified = enrichedPlaces.length - verified;
  
  console.info(`Place enrichment complete: ${verified} verified, ${unverified} unverified`);

  return enrichedPlaces;
};

/**
 * Extract location context from guide form data
 * Helper for determining which location to use for place enrichment
 * @param formData - Guide form data
 * @returns Location string for search context
 */
export const extractLocationContext = (formData: {
  locationMode: "single" | "multi";
  locationDisplayValue?: string;
  toLocationDisplayValue?: string;
}): string | undefined => {
  if (formData.locationMode === "single") {
    return formData.locationDisplayValue;
  } else if (formData.locationMode === "multi") {
    // For multi-city, use destination as context (most relevant)
    return formData.toLocationDisplayValue;
  }
  return undefined;
};

const placeEnrichmentService = {
  enrichAIPlace,
  enrichAIPlaces,
  extractLocationContext,
};

export default placeEnrichmentService;
