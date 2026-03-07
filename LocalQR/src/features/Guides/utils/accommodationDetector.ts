/**
 * Utility to detect if a Google Place is an accommodation
 * Based on Google Places API types
 */

/**
 * List of Google Place types that indicate accommodation
 */
const ACCOMMODATION_TYPES = [
  'lodging',
  'hotel',
  'motel',
  'hostel',
  'resort',
  'guest_house',
  'bed_and_breakfast',
  'campground',
  'rv_park',
  'apartment',
  'condominium',
];

/**
 * Check if a place is an accommodation based on its types
 * @param types - Array of Google Place types
 * @returns true if the place is an accommodation, false otherwise
 */
export function isAccommodation(types?: string[]): boolean {
  if (!types || !Array.isArray(types)) {
    return false;
  }

  return types.some((type) => 
    ACCOMMODATION_TYPES.includes(type.toLowerCase())
  );
}

