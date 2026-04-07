// Google Maps API integration
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Function to generate Google Maps script with API key
export const getGoogleMapsScript = () => {
  return `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
};

// Function to get Google Maps API key
export const getGoogleMapsApiKey = () => {
  return GOOGLE_MAPS_API_KEY;
};
