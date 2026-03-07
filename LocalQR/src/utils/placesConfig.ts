/**
 * Configuration for places filtering and scoring
 * Adjust these values to fine-tune the quality and relevance of recommended places
 */

export interface PlacesFilterConfig {
  // Basic filtering thresholds
  minRating: number;
  minReviews: number;

  // Scoring weights
  qualityWeight: number;
  distanceWeight: number;
  imageWeight: number; // Bonus for places with images

  // Distance constraints
  maxDistance: number; // in kilometers

  // Results configuration
  limit: number;
  fallbackMinCount: number;

  // Feature flags
  useDistanceFiltering: boolean;
}

// Default configuration optimized for explorers
export const DEFAULT_PLACES_CONFIG: PlacesFilterConfig = {
  // Quality thresholds
  minRating: 3.8,        // Slightly higher than average for quality
  minReviews: 3,         // Low enough to include hidden gems

  // Scoring weights
  qualityWeight: 0.4,    // Higher weight for review count (popularity)
  distanceWeight: 0.25,  // Moderate preference for closer places
  imageWeight: 0.15,     // Small bonus for places with images (improves visual appeal)

  // Distance constraints
  maxDistance: 12,       // 12km radius - good balance for urban/suburban areas

  // Results
  limit: 5,              // Show top 5 places
  fallbackMinCount: 3,   // Ensure at least 3 results when possible

  // Features
  useDistanceFiltering: true, // Enable distance-aware scoring
};

// Category-specific configurations
export const CATEGORY_CONFIGS: Record<string, Partial<PlacesFilterConfig>> = {
  "Food & Drinks": {
    minRating: 4.0,      // Higher standards for restaurants
    minReviews: 10,      // More reviews needed for food places
    maxDistance: 8,      // Closer radius for dining
  },

  "Lodging": {
    minRating: 4.2,      // High standards for accommodation
    minReviews: 15,      // More reviews for trust
    distanceWeight: 0.1, // Distance less important for hotels
  },

  "Entertainment": {
    minRating: 3.5,      // More lenient for unique experiences
    minReviews: 5,       // Lower threshold for attractions
    maxDistance: 15,     // Willing to travel further for entertainment
  },

  "Tourism": {
    minRating: 3.8,      // Good quality for tourist spots
    minReviews: 8,       // Some reviews for credibility
    maxDistance: 20,     // Willing to travel for tourist attractions
    distanceWeight: 0.15, // Distance less important for sightseeing
  },

  "Shopping": {
    minRating: 3.9,      // Good quality for shopping
    minReviews: 8,       // Some reviews needed
    maxDistance: 10,     // Moderate distance for shopping
  },

  "Health & Wellness": {
    minRating: 4.1,      // High standards for health services
    minReviews: 12,      // More reviews for trust in health services
    maxDistance: 15,     // Willing to travel for quality healthcare
  },

  "Transportation": {
    minRating: 3.5,      // More lenient for utility services
    minReviews: 3,       // Lower review threshold
    maxDistance: 8,      // Closer proximity important
    distanceWeight: 0.4, // Distance very important for transportation
  },

  "Services": {
    minRating: 3.8,      // Good quality for services
    minReviews: 5,       // Some reviews for credibility
    maxDistance: 10,     // Moderate distance for services
  },

  "Natural Features": {
    minRating: 3.5,      // More lenient for natural attractions (many have fewer reviews)
    minReviews: 2,       // Lower threshold as natural places often have fewer reviews
    maxDistance: 25,     // Willing to travel further for natural attractions
    distanceWeight: 0.1, // Distance less important for nature experiences
    imageWeight: 0.25,   // Higher bonus for images (nature is very visual)
    useDistanceFiltering: true, // Keep distance filtering for nature spots
  },
};

/**
 * Get configuration for a specific category
 */
export const getConfigForCategory = (category: string): PlacesFilterConfig => {
  const categoryConfig = CATEGORY_CONFIGS[category] || {};
  return {
    ...DEFAULT_PLACES_CONFIG,
    ...categoryConfig,
  };
};
