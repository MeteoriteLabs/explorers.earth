import { gql } from "@apollo/client";

/**
 * GraphQL query to fetch public page analytics data from Strapi
 * Fetches analytics events with pagination support
 */
export const GET_PUBLIC_PAGE_ANALYTICS = gql`
  query GetPublicPageAnalytics {
    publicPageAnalytics(pagination: { limit: -1 }) {
      Account_Id
      Location_Id
      Recommendation_Id
      Stats
    }
  }
`;

/**
 * TypeScript interface for analytics event structure
 * Matches the Stats field structure from Strapi
 */
export interface AnalyticsEvent {
  type: 'view' | 'click' | 'interaction';
  timestamp: string; // ISO 8601 format
  page: 'public-profile' | 'public-home' | 'public-guides' | 'public-music' | 'public-movies' | 'public-books' | 'public-games' | 'recommendation-detail';
  element?: string;
  ipAddress?: string;
  country?: string; // Resolved from IP address using geolocation service
  utmParams?: {
    utm_source?: string;
    utm_medium?: string;
  };
  metadata?: Record<string, any>; // Additional event metadata
}

/**
 * TypeScript interface for Strapi analytics data structure
 */
export interface PublicPageAnalyticsData {
  Account_Id: string;
  Location_Id?: string;
  Recommendation_Id?: string;
  Stats: AnalyticsEvent[];
}

