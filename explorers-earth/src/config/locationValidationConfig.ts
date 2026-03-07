/**
 * Configuration for location validation in explorers
 * These constants control the geographic validation behavior for recommendation places
 */

export const LOCATION_VALIDATION_CONFIG = {
  /**
   * Geographic Distance Validation
   * Maximum straight-line distance allowed between parent location and recommended place
   */
  MAX_DISTANCE_KM: 400, // 400 kilometers

  /**
   * Travel Time Validation  
   * Maximum driving time allowed between parent location and recommended place
   */
  MAX_TRAVEL_TIME_HOURS: 4, // 4 hours
  MAX_TRAVEL_TIME_SECONDS: 4 * 60 * 60, // 4 hours in seconds for API comparison

  /**
   * API Configuration
   * Settings for Google Distance Matrix API
   */
  DISTANCE_API: {
    // Travel mode for distance calculation
    MODE: "driving", // Options: driving, walking, bicycling, transit

    // Units for distance measurement
    UNITS: "metric", // Options: metric, imperial

    // Avoid options (optional)
    AVOID: [], // Options: tolls, highways, ferries, indoor
  },

  /**
   * Validation Flow Settings
   * Controls the behavior of the validation process
   */
  VALIDATION: {
    // Whether to run address validation first before distance validation
    ENABLE_ADDRESS_VALIDATION: true,

    // Whether to use fallback straight-line distance if API fails
    ENABLE_FALLBACK_VALIDATION: true,

    // Whether to show detailed validation messages to users
    SHOW_DETAILED_MESSAGES: true,

    // Whether to log validation steps for debugging
    ENABLE_VALIDATION_LOGGING: true,
  },

  /**
   * User Experience Settings
   * Controls how validation feedback is presented
   */
  UX: {
    // Timeout for API requests (milliseconds)
    API_TIMEOUT: 10000, // 10 seconds

    // Whether to show loading spinner during validation
    SHOW_LOADING_INDICATOR: true,

    // Success message duration (milliseconds)
    SUCCESS_MESSAGE_DURATION: 3000, // 3 seconds

    // Error message duration (milliseconds)  
    ERROR_MESSAGE_DURATION: 5000, // 5 seconds
  }
} as const;

/**
 * Helper function to get user-friendly distance text
 */
export const getDistanceLimitText = (): string => {
  return `${LOCATION_VALIDATION_CONFIG.MAX_DISTANCE_KM}km / ${LOCATION_VALIDATION_CONFIG.MAX_TRAVEL_TIME_HOURS}h`;
};

/**
 * Helper function to check if coordinates are valid
 */
export const areCoordinatesValid = (coords: { lat: number; lng: number }): boolean => {
  return (
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180 &&
    coords.lat !== 0 &&
    coords.lng !== 0
  );
};

/**
 * Type definitions for location validation
 */
export interface LocationValidationCoords {
  lat: number;
  lng: number;
}

export interface LocationValidationResult {
  isValid: boolean;
  method: 'address' | 'distance-api' | 'fallback' | 'error';
  distance?: {
    text: string;
    value: number; // in meters
  };
  duration?: {
    text: string;
    value: number; // in seconds
  };
  error?: string;
  debugInfo?: Record<string, any>;
}
