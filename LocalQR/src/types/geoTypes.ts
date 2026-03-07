// GEO (Generative Engine Optimization) Types for AI/LLM Enhancement

export interface GEOData {
  // Content context for AI understanding
  pageContext?: {
    type: 'profile' | 'location' | 'place' | 'map' | 'landing' | 'recommendations' | 'organization' | 'webpage';
    primaryEntity?: string; // Main subject (person, place, location)
    secondaryEntities?: string[]; // Related entities
    intent?: string; // User intent or page purpose
    summary?: string; // Brief content summary for AI
  };

  // AI-friendly content descriptions
  aiDescription?: {
    conversational?: string; // How AI should describe this content
    qaFormat?: { question: string; answer: string }[]; // FAQ-style content
    keyPoints?: string[]; // Main takeaways for AI
    contextualInfo?: string; // Additional context for AI understanding
  };

  // Temporal and location context
  contextualData?: {
    location?: {
      name: string;
      type: 'city' | 'neighborhood' | 'landmark' | 'business';
      coordinates?: { lat: number; lng: number };
      address?: string;
      timezone?: string;
    };
    temporal?: {
      relevantTimes?: string[]; // "weekends", "summer", "evening"
      seasonality?: string; // Seasonal relevance
      operatingHours?: string;
      availability?: string; // For organization pages
    };
    relationships?: {
      recommendedBy?: string;
      relatedTo?: string[];
      partOf?: string;
      categories?: string[];
      targetAudience?: string[]; // For organization pages
      industries?: string[]; // For organization pages
      serviceArea?: string; // For organization pages
      relatedPages?: string[]; // For web pages
      userJourney?: string; // For web pages
    };
  };

  // Natural language content optimization
  naturalLanguage?: {
    commonQueries?: string[]; // Questions people might ask AI
    conversationalKeywords?: string[]; // Natural speech patterns
    entities?: string[]; // Named entities for AI recognition
    sentimentContext?: 'positive' | 'neutral' | 'informative';
  };

  // Rich content for AI comprehension
  enrichedContent?: {
    fullDescription?: string; // Complete, natural description
    benefits?: string[]; // What makes this valuable
    uniqueAspects?: string[]; // What sets it apart
    userExperience?: string; // What to expect
    recommendations?: string[]; // Specific recommendations
  };
}

// Enhanced SEO Props that include GEO data
export interface GEOEnhancedSEOProps {
  // All existing SEO props remain unchanged
  title?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  canonical?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile' | 'product';
  siteName?: string;
  locale?: string;
  twitterHandle?: string;
  noIndex?: boolean;
  noFollow?: boolean;

  // New GEO-specific props (optional to maintain backward compatibility)
  geoData?: GEOData;
  enableGEO?: boolean; // Flag to enable/disable GEO features
}
