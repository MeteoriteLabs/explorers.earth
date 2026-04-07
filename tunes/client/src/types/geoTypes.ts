// GEO (Generative Engine Optimization) Types for AI/LLM Enhancement
// Matches explorers-earth GEOData interface for consistency

export interface GEOData {
  pageContext?: {
    type: 'venue' | 'playlist' | 'landing' | 'webpage';
    primaryEntity?: string;
    secondaryEntities?: string[];
    intent?: string;
    summary?: string;
  };

  aiDescription?: {
    conversational?: string;
    qaFormat?: { question: string; answer: string }[];
    keyPoints?: string[];
    contextualInfo?: string;
  };

  contextualData?: {
    location?: {
      name: string;
      type: 'city' | 'neighborhood' | 'landmark' | 'business';
      coordinates?: { lat: number; lng: number };
      address?: string;
    };
    temporal?: {
      relevantTimes?: string[];
      operatingHours?: string;
    };
    relationships?: {
      categories?: string[];
      targetAudience?: string[];
    };
  };

  naturalLanguage?: {
    commonQueries?: string[];
    conversationalKeywords?: string[];
    entities?: string[];
    sentimentContext?: 'positive' | 'neutral' | 'informative';
  };

  enrichedContent?: {
    fullDescription?: string;
    benefits?: string[];
    uniqueAspects?: string[];
    userExperience?: string;
    recommendations?: string[];
  };
}
