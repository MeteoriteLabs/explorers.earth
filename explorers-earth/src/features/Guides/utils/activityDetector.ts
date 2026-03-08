/**
 * Utility to detect if a Google Place is an activity/attraction
 * Based on Google Places API types
 */

/**
 * List of Google Place types that indicate activities and attractions
 * These places are considered tourist activities, entertainment, or experiences
 */
const ACTIVITY_TYPES = [
  // Main tourism & attractions
  'tourist_attraction',
  'amusement_park',
  'aquarium',
  'art_gallery',
  'museum',
  'zoo',
  'park',
  'national_park',
  
  // Adventure & outdoor activities
  'campground',
  'hiking_area',
  'ski_resort',
  'water_park',
  'beach',
  
  // Entertainment & recreation
  'bowling_alley',
  'casino',
  'movie_theater',
  'night_club',
  'stadium',
  'spa',
  
  // Cultural & educational
  'library',
  'performing_arts_theater',
  'place_of_worship',
  'landmark',
  'historical_place',
  
  // Adventure sports
  'rafting',
  'trekking',
  'adventure_sports',
  'theme_park',
  
  // Shopping & markets (can be tourist activities)
  'shopping_mall',
  'market',
  'flea_market',
];

/**
 * Check if a place is an activity/attraction based on its types
 * @param types - Array of Google Place types
 * @returns true if the place is an activity, false otherwise
 */
export function isActivity(types?: string[]): boolean {
  if (!types || !Array.isArray(types)) {
    return false;
  }

  return types.some((type) => 
    ACTIVITY_TYPES.includes(type.toLowerCase())
  );
}


/**
 * Get activity category for display and grouping
 * @param types - Array of Google Place types
 * @returns Category label or 'General Activity'
 */
export function getActivityCategory(types?: string[]): string {
  if (!types || !Array.isArray(types)) {
    return 'General Activity';
  }

  // Priority-based categorization
  if (types.some(t => ['amusement_park', 'theme_park', 'water_park'].includes(t.toLowerCase()))) {
    return 'Theme Parks';
  }
  
  if (types.some(t => ['museum', 'art_gallery', 'library'].includes(t.toLowerCase()))) {
    return 'Museums & Culture';
  }
  
  if (types.some(t => ['aquarium', 'zoo', 'national_park', 'park'].includes(t.toLowerCase()))) {
    return 'Nature & Wildlife';
  }
  
  if (types.some(t => ['hiking_area', 'ski_resort', 'beach', 'campground'].includes(t.toLowerCase()))) {
    return 'Adventure & Outdoor';
  }
  
  if (types.some(t => ['movie_theater', 'casino', 'night_club', 'bowling_alley'].includes(t.toLowerCase()))) {
    return 'Entertainment';
  }
  
  if (types.some(t => ['shopping_mall', 'market', 'flea_market'].includes(t.toLowerCase()))) {
    return 'Shopping';
  }

  return 'Attractions';
}
