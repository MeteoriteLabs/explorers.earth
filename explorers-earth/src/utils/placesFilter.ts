/*
   Nearby Places Filtering & Sorting Logic for explorers
   --------------------------------------------------
   This file contains multiple functions:
   1. Standard filter & sort logic (no fallback)
   2. Enhanced logic with fallback handling for edge cases (e.g., hidden gems with no ratings)
   3. Distance-aware filtering for better location relevance

   Usage:
   - Pass the raw Google Places API response (array of Place objects)
   - Get back a sorted, filtered list of top places for display on dashboard
*/

export interface Place {
  name: string;
  rating?: number;
  user_ratings_total?: number;
  location?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  photos?: any[]; // Add photos array to consider image availability
  hasImage?: boolean; // Flag to indicate if place has a real image
  [key: string]: any; // Keep other Google data
}

export interface LocationCoords {
  lat: number;
  lng: number;
}

/* --------------------------------------------------
   UTILITY: Calculate distance between two points
-------------------------------------------------- */
const calculateDistance = (
  point1: LocationCoords,
  point2: LocationCoords
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.lat - point1.lat) * (Math.PI / 180);
  const dLon = (point2.lng - point1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * (Math.PI / 180)) *
    Math.cos(point2.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

/* --------------------------------------------------
   1. BASIC FILTER & SORT (No Edge Case Handling)
-------------------------------------------------- */
export const filterAndSortPlacesBasic = (
  places: Place[],
  minRating: number = 3.5,
  minReviews: number = 5,
  weight: number = 0.3,
  limit: number = 10
): Place[] => {
  const calculateScore = (rating: number, reviews: number): number => {
    const normalizedReviews = Math.log(1 + reviews);
    return rating * (1 + weight * normalizedReviews);
  };

  return places
    .filter(place =>
      (place.rating ?? 0) >= minRating &&
      (place.user_ratings_total ?? 0) >= minReviews
    )
    .map(place => ({
      ...place,
      score: calculateScore(place.rating ?? 0, place.user_ratings_total ?? 0)
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
};

/* --------------------------------------------------
   2. ENHANCED FILTER & SORT WITH FALLBACK
   - If not enough places meet the criteria, fallback to a looser filter
   - Useful for edge cases (e.g., hidden natural spots with no ratings)
   - Now considers image availability in scoring
-------------------------------------------------- */
export const filterAndSortPlacesWithFallback = (
  places: Place[],
  minRating: number = 3.5,
  minReviews: number = 5,
  weight: number = 0.3,
  limit: number = 10,
  fallbackMinCount: number = 5,
  imageWeight: number = 0.1 // Small bonus for places with images
): Place[] => {
  const calculateScore = (rating: number, reviews: number, hasImage: boolean = false): number => {
    const normalizedReviews = Math.log(1 + reviews);
    const baseScore = rating * (1 + weight * normalizedReviews);
    const imageBonus = hasImage ? (1 + imageWeight) : 1;
    return baseScore * imageBonus;
  };

  // Step 1: Strict filter
  let filtered = places
    .filter(place =>
      (place.rating ?? 0) >= minRating &&
      (place.user_ratings_total ?? 0) >= minReviews
    )
    .map(place => ({
      ...place,
      score: calculateScore(
        place.rating ?? 0,
        place.user_ratings_total ?? 0,
        place.hasImage || (place.photos && place.photos.length > 0)
      )
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // Step 2: Fallback - if not enough results, include unrated ones
  if (filtered.length < fallbackMinCount) {
    filtered = places
      .map(place => ({
        ...place,
        score: place.rating
          ? calculateScore(
            place.rating,
            place.user_ratings_total ?? 0,
            place.hasImage || (place.photos && place.photos.length > 0)
          )
          : (place.hasImage || (place.photos && place.photos.length > 0)) ? 0.5 : 0 // Small base score for unrated places with images
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  return filtered.slice(0, limit);
};

/* --------------------------------------------------
   3. DISTANCE-AWARE FILTERING WITH QUALITY SCORING
   - Balances place quality with proximity
   - Penalizes very distant places even if highly rated
   - Considers image availability in scoring
-------------------------------------------------- */
export const filterAndSortPlacesWithDistance = (
  places: Place[],
  userLocation: LocationCoords,
  minRating: number = 3.5,
  minReviews: number = 5,
  qualityWeight: number = 0.3,
  distanceWeight: number = 0.2,
  maxDistance: number = 15, // Maximum distance in km
  limit: number = 10,
  fallbackMinCount: number = 5,
  imageWeight: number = 0.1 // Small bonus for places with images
): Place[] => {
  const calculateQualityScore = (rating: number, reviews: number, hasImage: boolean = false): number => {
    const normalizedReviews = Math.log(1 + reviews);
    const baseScore = rating * (1 + qualityWeight * normalizedReviews);
    const imageBonus = hasImage ? (1 + imageWeight) : 1;
    return baseScore * imageBonus;
  };

  const calculateDistanceScore = (distance: number): number => {
    // Distance score decreases exponentially with distance
    // Close places (< 2km) get full score, far places get reduced score
    if (distance <= 2) return 1.0;
    if (distance >= maxDistance) return 0.1;
    return Math.exp(-distance / 5); // Exponential decay
  };

  const calculateFinalScore = (
    qualityScore: number,
    distanceScore: number
  ): number => {
    return qualityScore * (1 + distanceWeight * distanceScore);
  };

  // Extract location coordinates safely
  const getPlaceCoords = (place: Place): LocationCoords | null => {
    if (place.location) {
      const lat = place.location.lat ?? place.location.latitude;
      const lng = place.location.lng ?? place.location.longitude;
      if (lat && lng) return { lat, lng };
    }
    return null;
  };

  // Step 1: Strict filter with distance consideration
  let filtered = places
    .map(place => {
      const placeCoords = getPlaceCoords(place);
      const distance = placeCoords
        ? calculateDistance(userLocation, placeCoords)
        : maxDistance; // Assign max distance if coordinates unavailable

      const hasImage = place.hasImage || (place.photos && place.photos.length > 0);
      const qualityScore = calculateQualityScore(
        place.rating ?? 0,
        place.user_ratings_total ?? 0,
        hasImage
      );
      const distanceScore = calculateDistanceScore(distance);
      const finalScore = calculateFinalScore(qualityScore, distanceScore);

      return {
        ...place,
        distance,
        qualityScore,
        distanceScore,
        hasImage,
        score: finalScore
      };
    })
    .filter(place =>
      (place.rating ?? 0) >= minRating &&
      (place.user_ratings_total ?? 0) >= minReviews &&
      place.distance <= maxDistance
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // Step 2: Fallback - if not enough results, include lower-rated places
  if (filtered.length < fallbackMinCount) {
    filtered = places
      .map(place => {
        const placeCoords = getPlaceCoords(place);
        const distance = placeCoords
          ? calculateDistance(userLocation, placeCoords)
          : maxDistance;

        const hasImage = place.hasImage || (place.photos && place.photos.length > 0);
        const qualityScore = place.rating
          ? calculateQualityScore(place.rating, place.user_ratings_total ?? 0, hasImage)
          : hasImage ? 1.2 : 1.0; // Higher base score for unrated places with images
        const distanceScore = calculateDistanceScore(distance);
        const finalScore = calculateFinalScore(qualityScore, distanceScore);

        return {
          ...place,
          distance,
          qualityScore,
          distanceScore,
          hasImage,
          score: finalScore
        };
      })
      .filter(place => place.distance <= maxDistance)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  return filtered.slice(0, limit);
};

/* --------------------------------------------------
USAGE EXAMPLES:

const nearbyPlaces = await fetch('/api/google-places').then(res => res.json());
const userLocation = { lat: 40.7128, lng: -74.0060 }; // NYC coordinates

// Basic filtering
const topPlaces = filterAndSortPlacesBasic(nearbyPlaces.results, 4.0, 20);

// With fallback for edge cases
const topPlacesWithFallback = filterAndSortPlacesWithFallback(nearbyPlaces.results, 4.0, 20);

// Distance-aware filtering (recommended for explorers)
const topPlacesWithDistance = filterAndSortPlacesWithDistance(
  nearbyPlaces.results,
  userLocation,
  3.8, // minRating
  3,   // minReviews
  0.4, // qualityWeight
  0.3, // distanceWeight
  10,  // maxDistance (km)
  5    // limit
);

-------------------------------------------------- */
