import { GooglePlace, PlacePhoto } from "../features/Favorites/components/TopPlacesByCategory";

// Type for the transformed place data compatible with AddRecommendation
export interface TransformedPlaceData {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  types: string[];
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  photos?: Array<{
    name: string;
    photo_reference: string;
  }>;
}

/**
 * Transforms Google Places Nearby Search result to format compatible with AddRecommendation
 * This allows seamless integration between TopPlaces and AddRecommendation form
 */
export const transformGooglePlaceForForm = (place: GooglePlace): TransformedPlaceData => {
  // Extract address components from place data if available
  const address = place.displayName?.text || '';
  
  // Transform the place data to match the expected format
  return {
    place_id: place.id,
    name: place.displayName?.text || '',
    formatted_address: address,
    rating: place.rating,
    user_ratings_total: place.userRatingCount,
    formatted_phone_number: '', // Not available in Nearby Search
    website: '', // Not available in Nearby Search
    types: place.primaryType ? [place.primaryType] : [],
    geometry: {
      location: {
        lat: () => place.location.latitude,
        lng: () => place.location.longitude,
      },
    },
    photos: place.photos?.map((photo: PlacePhoto) => ({
      name: photo.name,
      photo_reference: photo.name.split('/').pop() || '',
    })),
  };
};

/**
 * Creates URL-safe query parameters for navigation to AddRecommendation
 */
export const createPlaceQueryParams = (place: GooglePlace) => {
  const transformedPlace = transformGooglePlaceForForm(place);
  
  return {
    placeId: transformedPlace.place_id,
    name: encodeURIComponent(transformedPlace.name),
    address: encodeURIComponent(transformedPlace.formatted_address),
    lat: transformedPlace.geometry.location.lat().toString(),
    lng: transformedPlace.geometry.location.lng().toString(),
    rating: transformedPlace.rating?.toString() || '',
    userRatingsTotal: transformedPlace.user_ratings_total?.toString() || '',
    primaryType: transformedPlace.types[0] || '',
    source: 'suggestion', // Explicitly mark as suggestion source
  };
};
