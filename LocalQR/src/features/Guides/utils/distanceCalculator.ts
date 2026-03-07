/**
 * Calculate distance between two geographic coordinates using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Format distance to a human-readable string
 * @param distanceKm - Distance in kilometers
 * @returns Formatted distance string (e.g., "1.2 km" or "450 m")
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Estimate travel time based on distance
 * Assumes average walking speed of 5 km/h for distances < 2km, driving for longer distances
 * @param distanceKm - Distance in kilometers
 * @returns Formatted travel time string (e.g., "5 min walk" or "10 min drive")
 */
export const estimateTravelTime = (distanceKm: number): string => {
  if (distanceKm < 2) {
    // Walking speed: ~5 km/h
    const minutes = Math.round((distanceKm / 5) * 60);
    return `${minutes} min walk`;
  } else {
    // Driving speed: ~30 km/h (city average)
    const minutes = Math.round((distanceKm / 30) * 60);
    return `${minutes} min drive`;
  }
};

/**
 * Get distance info between two places
 * @param place1 - First place with geometry
 * @param place2 - Second place with geometry
 * @returns Object with distance and travel time, or null if coordinates missing
 */
export const getDistanceInfo = (
  place1: { geometry?: { location: { lat: number; lng: number } } },
  place2: { geometry?: { location: { lat: number; lng: number } } }
): { distance: string; travelTime: string; distanceKm: number } | null => {
  if (!place1.geometry?.location || !place2.geometry?.location) {
    return null;
  }

  const distanceKm = calculateDistance(
    place1.geometry.location.lat,
    place1.geometry.location.lng,
    place2.geometry.location.lat,
    place2.geometry.location.lng
  );

  return {
    distance: formatDistance(distanceKm),
    travelTime: estimateTravelTime(distanceKm),
    distanceKm,
  };
};
