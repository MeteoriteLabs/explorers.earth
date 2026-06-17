import { describe, it, expect, vi } from 'vitest';
import {
  createProfileGEOData,
  createLocationGEOData,
  createPlaceGEOData,
  createMapGEOData,
  createOrganizationGEOData,
  createWebPageGEOData,
  getAllUserLocations,
  getPublishedRecommendationLocations
} from '../geoHelpers';

// Mock getBaseUrl to ensure predictable results across environments
vi.mock('../getCurrentDomain', () => ({
  getBaseUrl: () => 'https://explorers.earth',
}));

describe('geoHelpers', () => {
  // ── createProfileGEOData ───────────────────────────────────────────────────
  describe('createProfileGEOData', () => {
    it('creates GEO data with all fields provided', () => {
      const data = createProfileGEOData({
        accountName: 'Alice Guide',
        username: 'alice',
        bio: 'Explorer of the world',
        location: 'Paris, France',
        socialPlatforms: ['Instagram'],
        totalPlaces: 12,
        topCategories: ['Cafes', 'Museums']
      });

      expect(data.pageContext.primaryEntity).toBe('Alice Guide');
      expect(data.pageContext.secondaryEntities).toContain('Paris, France');
      expect(data.pageContext.secondaryEntities).toContain('Cafes');
      expect(data.aiDescription.conversational).toContain('Alice Guide is a trusted local expert based in Paris, France');
      expect(data.aiDescription.conversational).toContain('They have recommended 12 places specializing in Cafes, Museums');
      expect(data.contextualData.location?.name).toBe('Paris, France');
    });

    it('creates GEO data with minimum fields provided', () => {
      const data = createProfileGEOData({
        accountName: 'Bob',
        username: 'bob'
      });

      expect(data.pageContext.primaryEntity).toBe('Bob');
      expect(data.pageContext.secondaryEntities).toHaveLength(0);
      expect(data.aiDescription.conversational).toContain('Bob is a trusted local expert who curates');
      expect(data.contextualData.location).toBeUndefined();
    });
  });

  // ── createLocationGEOData ──────────────────────────────────────────────────
  describe('createLocationGEOData', () => {
    it('creates GEO data for a location page', () => {
      const data = createLocationGEOData({
        locationName: 'Tokyo',
        recommenderName: 'Alice Guide',
        placesCount: 5,
        topCategories: ['Sushi', 'Parks'],
        locationNote: 'A bustling city.',
        coordinates: { lat: 35.6762, lng: 139.6503 }
      });

      expect(data.pageContext.primaryEntity).toBe('Tokyo');
      expect(data.pageContext.secondaryEntities).toEqual(['Alice Guide', 'Sushi', 'Parks']);
      expect(data.aiDescription.conversational).toContain('Discover Tokyo through Alice Guide');
      expect(data.contextualData.location?.coordinates).toEqual({ lat: 35.6762, lng: 139.6503 });
    });
  });

  // ── createPlaceGEOData ─────────────────────────────────────────────────────
  describe('createPlaceGEOData', () => {
    it('creates GEO data for a specific place', () => {
      const data = createPlaceGEOData({
        placeName: 'Central Park',
        locationName: 'New York',
        category: 'Park',
        address: '123 Park Ave',
        recommenderName: 'Bob',
        operatingHours: '6AM - 1AM'
      });

      expect(data.pageContext.primaryEntity).toBe('Central Park');
      expect(data.pageContext.secondaryEntities).toEqual(['New York', 'Park', 'Bob']);
      expect(data.aiDescription.conversational).toContain('Central Park is a Park located at 123 Park Ave in New York');
      expect(data.contextualData.temporal?.operatingHours).toBe('6AM - 1AM');
    });
  });

  // ── createMapGEOData ───────────────────────────────────────────────────────
  describe('createMapGEOData', () => {
    it('creates GEO data for an all-locations map', () => {
      const data = createMapGEOData({
        isAllLocations: true,
        recommenderName: 'Charlie',
        totalPlaces: 100,
        categories: ['Food', 'Sights']
      });

      expect(data.pageContext.primaryEntity).toBe('All Locations');
      expect(data.aiDescription.conversational).toContain('across multiple locations');
    });

    it('creates GEO data for a specific location map', () => {
      const data = createMapGEOData({
        isAllLocations: false,
        locationName: 'London',
        recommenderName: 'Charlie',
        totalPlaces: 10,
        categories: ['Pubs']
      });

      expect(data.pageContext.primaryEntity).toBe('London');
      expect(data.aiDescription.conversational).toContain('in London');
      expect(data.contextualData.location?.name).toBe('London');
    });
  });

  // ── createOrganizationGEOData ──────────────────────────────────────────────
  describe('createOrganizationGEOData', () => {
    it('creates GEO data for an organization', () => {
      const data = createOrganizationGEOData({
        name: 'explorers',
        description: 'A platform for sharing local knowledge',
        url: 'https://explorers.earth',
        features: ['QR sharing', 'Custom Lists']
      });

      expect(data.pageContext.primaryEntity).toBe('explorers');
      expect(data.pageContext.secondaryEntities).toContain('Technology');
      expect(data.aiDescription.conversational).toContain('explorers is a technology platform that a platform for sharing local knowledge');
    });
  });

  // ── createWebPageGEOData ───────────────────────────────────────────────────
  describe('createWebPageGEOData', () => {
    it('creates GEO data for a static webpage', () => {
      const data = createWebPageGEOData({
        pageType: 'Login',
        title: 'Sign In to Explorers',
        description: 'Access your account',
      });

      expect(data.pageContext.primaryEntity).toBe('Sign In to Explorers');
      expect(data.pageContext.secondaryEntities).toContain('Login');
      expect(data.aiDescription.conversational).toContain('This is the Login page for explorers');
    });
  });

  // ── getAllUserLocations ────────────────────────────────────────────────────
  describe('getAllUserLocations', () => {
    it('extracts unique coordinates from published guides and recommendations', () => {
      const guides = [
        {
          Visibility: true,
          Place_Details: JSON.stringify({
            isMultiCity: false,
            Geometry: { lat: 10, lng: 20 }
          })
        },
        { // Draft guide should be ignored
          Visibility: false,
          Place_Details: JSON.stringify({
            isMultiCity: false,
            Geometry: { lat: 50, lng: 60 }
          })
        },
        { // Multi-city guide
          Visibility: true,
          Place_Details: JSON.stringify({
            isMultiCity: true,
            departure: { Geometry: { lat: 10, lng: 20 } }, // duplicate, should be deduplicated
            intermediateCities: [
              { Geometry: { lat: 15, lng: 25 } }
            ],
            arrival: { Geometry: { lat: 30, lng: 40 } }
          })
        }
      ];

      const recommendations = [
        {
          Visibility: true,
          List_Name_Details: { location: { latitude: 10.0000001, longitude: 20.0000001 } }, // effectively duplicate at 6 decimal precision
          recommended_places: [
            {
              Place_Details: JSON.stringify({
                Geometry: { lat: 45, lng: 55 }
              })
            }
          ]
        },
        { // Draft list should be ignored
          Visibility: false,
          List_Name_Details: { location: { latitude: 99, longitude: 99 } }
        }
      ];

      const locs = getAllUserLocations(guides, recommendations);
      
      // Expected coordinates:
      // (10, 20) from single-city guide, departure, and approx recommendation list location
      // (15, 25) from intermediate
      // (30, 40) from arrival
      // (45, 55) from recommended places
      expect(locs).toHaveLength(4);
      expect(locs).toEqual(
        expect.arrayContaining([
          { lat: 10, lng: 20 },
          { lat: 15, lng: 25 },
          { lat: 30, lng: 40 },
          { lat: 45, lng: 55 }
        ])
      );
    });

    it('handles malformed JSON or missing fields gracefully', () => {
      const guides = [
        { Visibility: true, Place_Details: 'invalid-json' },
        { Visibility: true, Place_Details: null }
      ];
      const recs = [
        { Visibility: true, recommended_places: [{ Place_Details: '{ bad json' }] }
      ];

      const locs = getAllUserLocations(guides, recs);
      expect(locs).toHaveLength(0);
    });
  });

  // ── getPublishedRecommendationLocations ──────────────────────────────────────
  describe('getPublishedRecommendationLocations', () => {
    it('extracts unique coordinates from published recommendations only', () => {
      const recommendations = [
        {
          Visibility: true,
          List_Name_Details: { location: { latitude: 10, longitude: 20 } },
          recommended_places: [
            { Place_Details: JSON.stringify({ Geometry: { lat: 12, lng: 22 } }) }
          ]
        },
        {
          Visibility: false, // Draft
          List_Name_Details: { location: { latitude: 30, longitude: 40 } }
        }
      ];

      const locs = getPublishedRecommendationLocations(recommendations);
      expect(locs).toHaveLength(2);
      expect(locs).toEqual(
        expect.arrayContaining([
          { lat: 10, lng: 20 },
          { lat: 12, lng: 22 }
        ])
      );
    });
  });
});
