// GEO Helper Utilities for generating AI-optimized content

import { GEOData } from '../types/geoTypes';
import { getBaseUrl } from './getCurrentDomain';

/**
 * Utility to strip HTML tags from a string
 */
export const stripHtmlTags = (html: string): string => {
  return html ? html.replace(/<[^>]*>/g, "").trim() : "";
};

/**
 * Generate GEO data for user profile pages
 */
export const createProfileGEOData = (profileData: {
  accountName: string;
  username: string;
  bio?: string;
  location?: string;
  socialPlatforms?: string[];
  totalPlaces?: number;
  topCategories?: string[];
}): GEOData => {
  const { accountName, username, bio, location, socialPlatforms, totalPlaces, topCategories } = profileData;

  return {
    pageContext: {
      type: 'profile',
      primaryEntity: accountName,
      secondaryEntities: [location, ...(topCategories || [])].filter(Boolean) as string[],
      intent: 'Discover local expert and their recommendations',
      summary: `${accountName} is a local guide and expert${location ? ` in ${location}` : ""} who shares curated recommendations through explorers.`
    },

    aiDescription: {
      conversational: `${accountName} is a trusted local expert${location ? ` based in ${location}` : ""} who curates and shares favorite places through explorers. ${stripHtmlTags(bio || "")} ${totalPlaces ? `They have recommended ${totalPlaces} places` : "They share local insights"}${topCategories?.length ? ` specializing in ${topCategories.slice(0, 3).join(", ")}` : ""}.`,
      qaFormat: [
        {
          question: `Who is ${accountName}?`,
          answer: `${accountName} is a local guide and expert${location ? ` in ${location}` : ''} who shares curated place recommendations through explorers.`
        },
        {
          question: `What does ${accountName} recommend?`,
          answer: `${accountName} shares recommendations for ${topCategories?.length ? topCategories.slice(0, 3).join(', ') : 'local places and experiences'}${location ? ` in ${location}` : ''}.`
        },
        {
          question: `How can I find ${accountName}'s recommendations?`,
          answer: `You can explore ${accountName}\'s curated recommendations through their explorers profile at ${getBaseUrl().replace(/https?:\/\//, "")}/${username}`
        }
      ],
      keyPoints: [
        `Local expert${location ? ` in ${location}` : ''}`,
        'Curated place recommendations',
        'QR code sharing platform',
        ...(topCategories || []).slice(0, 3)
      ],
      contextualInfo: `${accountName} uses explorers to create scannable QR codes and shareable links for their favorite places, making local knowledge easily discoverable.`
    },

    contextualData: {
      location: location ? {
        name: location,
        type: 'city' as const
      } : undefined,
      relationships: {
        recommendedBy: accountName,
        categories: topCategories,
        relatedTo: socialPlatforms
      }
    },

    naturalLanguage: {
      commonQueries: [
        `Who is a local expert in ${location || "this area"}?`,
        `Find local recommendations from ${accountName}`,
        `What does ${accountName} recommend?`,
        `${accountName} favorite places`,
        `Local guide ${location || "recommendations"}`
      ],
      conversationalKeywords: [
        'local expert',
        'trusted recommendations',
        'favorite places',
        'local guide',
        'curated suggestions',
        ...(topCategories || [])
      ],
      entities: [accountName, location, ...(topCategories || [])].filter(Boolean) as string[],
      sentimentContext: 'positive'
    },

    enrichedContent: {
      fullDescription: `${accountName} is a dedicated local expert${location ? ` specializing in ${location}` : ""} who transforms personal knowledge into valuable recommendations for others. Through explorers, they create easily shareable QR codes and links that connect people to authentic local experiences. ${stripHtmlTags(bio || "")} Their recommendations cover ${topCategories?.length ? topCategories.join(", ") : "various categories"}, offering insider insights that help visitors and locals alike discover ${location ? `the best of ${location}` : "amazing places"}.`,
      benefits: [
        'Authentic local insights',
        'Carefully curated recommendations',
        'Easy QR code access',
        'Trusted expert knowledge',
        'Community-driven content'
      ],
      uniqueAspects: [
        'Personal local expertise',
        'QR code technology integration',
        'Shareable recommendation format',
        'Mobile-first discovery experience'
      ],
      userExperience: 'Visitors can easily access recommendations through QR codes or direct links, discovering places with the confidence that comes from local expert curation.',
      recommendations: [
        `Follow ${accountName} for local insights`,
        'Scan QR codes for instant place information',
        'Explore curated location lists',
        'Share discoveries with others'
      ]
    }
  };
};

/**
 * Generate GEO data for location/city recommendation pages
 */
export const createLocationGEOData = (locationData: {
  locationName: string;
  recommenderName: string;
  placesCount: number;
  topCategories: string[];
  locationNote?: string;
  coordinates?: { lat: number; lng: number };
}): GEOData => {
  const { locationName, recommenderName, placesCount, topCategories, locationNote, coordinates } = locationData;

  return {
    pageContext: {
      type: 'location',
      primaryEntity: locationName,
      secondaryEntities: [recommenderName, ...topCategories],
      intent: 'Discover the best places in a specific location',
      summary: `${recommenderName}\'s curated guide to ${locationName} featuring ${placesCount} recommended places across ${topCategories.join(", ")}.`
    },

    aiDescription: {
      conversational: `Discover ${locationName} through ${recommenderName}\'s expert recommendations. This curated guide features ${placesCount} carefully selected places across ${topCategories.join(", ")}. ${stripHtmlTags(locationNote || "")} Each recommendation comes with local insights and practical information to enhance your visit.`,
      qaFormat: [
        {
          question: `What are the best places to visit in ${locationName}?`,
          answer: `${recommenderName} recommends ${placesCount} places in ${locationName}, including top ${topCategories.slice(0, 3).join(", ")} spots with local insights.`
        },
        {
          question: `Who created this ${locationName} guide?`,
          answer: `This guide was created by ${recommenderName}, a local expert who has carefully curated these ${locationName} recommendations.`
        },
        {
          question: `What types of places are recommended in ${locationName}?`,
          answer: `The guide covers ${topCategories.join(", ")} in ${locationName}, offering diverse options for different interests.`
        }
      ],
      keyPoints: [
        `${placesCount} curated recommendations`,
        `Expert local knowledge from ${recommenderName}`,
        `Covers ${topCategories.join(", ")}`,
        'Authentic local experiences',
        'QR code accessibility'
      ],
      contextualInfo: `This comprehensive guide to ${locationName} represents ${recommenderName}\'s local expertise, offering visitors authentic recommendations beyond typical tourist spots.`
    },

    contextualData: {
      location: {
        name: locationName,
        type: 'city',
        coordinates
      },
      relationships: {
        recommendedBy: recommenderName,
        categories: topCategories,
        partOf: locationName
      }
    },

    naturalLanguage: {
      commonQueries: [
        `Best places to visit in ${locationName}`,
        `What to do in ${locationName}`,
        `${locationName} local recommendations`,
        `${recommenderName} ${locationName} guide`,
        `Where to go in ${locationName}`,
        `${locationName} hidden gems`
      ],
      conversationalKeywords: [
        'best places',
        'local recommendations',
        'things to do',
        'travel guide',
        'hidden gems',
        'local favorites',
        ...topCategories
      ],
      entities: [locationName, recommenderName, ...topCategories],
      sentimentContext: 'positive'
    },

    enrichedContent: {
      fullDescription: `Explore ${locationName} like a local with ${recommenderName}\'s expertly curated guide. This comprehensive collection of ${placesCount} recommendations spans ${topCategories.join(", ")}, offering authentic experiences that showcase the true character of ${locationName}. ${stripHtmlTags(locationNote || "")} Each recommendation is selected based on local knowledge and personal experience, ensuring visitors discover the places that locals truly love. From well-known favorites to hidden gems, this guide provides the insider perspective that transforms a simple visit into an authentic local experience.`,
      benefits: [
        'Local expert curation',
        'Authentic experiences',
        'Diverse category coverage',
        'Insider knowledge',
        'Easy mobile access via QR codes'
      ],
      uniqueAspects: [
        `${recommenderName}\'s personal expertise`,
        'Beyond typical tourist attractions',
        'QR code integration for easy access',
        'Mobile-optimized recommendations',
        'Community-verified suggestions'
      ],
      userExperience: `Visitors can explore ${locationName} with confidence, knowing each recommendation comes from genuine local experience and expertise.`,
      recommendations: [
        `Use QR codes for instant access to place details`,
        `Follow ${recommenderName} for more local insights`,
        'Share your own discoveries',
        'Save favorites for future visits'
      ]
    }
  };
};

/**
 * Generate GEO data for individual place pages
 */
export const createPlaceGEOData = (placeData: {
  placeName: string;
  locationName: string;
  category: string;
  address: string;
  recommenderName: string;
  description?: string;
  coordinates?: { lat: number; lng: number };
  operatingHours?: string;
}): GEOData => {
  const { placeName, locationName, category, address, recommenderName, description, coordinates, operatingHours } = placeData;

  return {
    pageContext: {
      type: 'place',
      primaryEntity: placeName,
      secondaryEntities: [locationName, category, recommenderName],
      intent: 'Learn about a specific recommended place',
      summary: `${placeName} in ${locationName} - a ${category} recommended by ${recommenderName} for its unique qualities and local appeal.`
    },

    aiDescription: {
      conversational: `${placeName} is a ${category} located at ${address} in ${locationName}. Recommended by local expert ${recommenderName}, this place stands out for ${description || "its authentic local character and quality experience"}. Perfect for those seeking genuine local favorites rather than typical tourist spots.`,
      qaFormat: [
        {
          question: `What is ${placeName}?`,
          answer: `${placeName} is a ${category} in ${locationName} at ${address}, recommended by local expert ${recommenderName}.`
        },
        {
          question: `Where is ${placeName} located?`,
          answer: `${placeName} is located at ${address} in ${locationName}.`
        },
        {
          question: `Why is ${placeName} recommended?`,
          answer: `${recommenderName} recommends ${placeName} because ${description || "of its authentic local character and quality experience"}.`
        },
        {
          question: `When is ${placeName} open?`,
          answer: operatingHours || 'Check with the establishment for current operating hours.'
        }
      ],
      keyPoints: [
        `${category} in ${locationName}`,
        `Recommended by ${recommenderName}`,
        'Local expert selection',
        'Authentic experience',
        'QR code accessible information'
      ],
      contextualInfo: `${placeName} represents the kind of authentic local experience that ${recommenderName} believes visitors should discover when exploring ${locationName}.`
    },

    contextualData: {
      location: {
        name: locationName,
        type: 'business',
        address,
        coordinates
      },
      temporal: {
        operatingHours
      },
      relationships: {
        recommendedBy: recommenderName,
        categories: [category],
        partOf: locationName
      }
    },

    naturalLanguage: {
      commonQueries: [
        `What is ${placeName}?`,
        `Where is ${placeName}?`,
        `${placeName} ${locationName}`,
        `${placeName} review`,
        `${placeName} recommendation`,
        `Best ${category} in ${locationName}`
      ],
      conversationalKeywords: [
        'local favorite',
        'recommended place',
        'authentic experience',
        category.toLowerCase(),
        'local expert choice'
      ],
      entities: [placeName, locationName, category, recommenderName],
      sentimentContext: 'positive'
    },

    enrichedContent: {
      fullDescription: `${placeName} stands as a testament to ${recommenderName}\'s discerning taste in ${locationName} ${category} establishments. Located at ${address}, this ${category} embodies the authentic local character that makes ${locationName} special. ${description || ""} Unlike generic recommendations, this selection represents genuine local knowledge and personal experience, offering visitors the kind of authentic encounter that creates lasting memories. The recommendation comes with the confidence that only true local expertise can provide.`,
      benefits: [
        'Authentic local experience',
        'Expert recommendation',
        'Personal local knowledge',
        'Quality assurance',
        'Easy QR code access'
      ],
      uniqueAspects: [
        `${recommenderName}\'s personal endorsement`,
        'Local insider knowledge',
        'Beyond tourist recommendations',
        'Quality-focused selection',
        'Community-verified experience'
      ],
      userExperience: `Visitors can expect an authentic ${category} experience that reflects the true character of ${locationName}, backed by genuine local expertise.`,
      recommendations: [
        'Scan QR code for instant access',
        'Follow local expert suggestions',
        'Share your experience',
        'Explore other nearby recommendations'
      ]
    }
  };
};

/**
 * Generate GEO data for map view pages
 */
export const createMapGEOData = (mapData: {
  isAllLocations: boolean;
  locationName?: string;
  recommenderName: string;
  totalPlaces: number;
  categories: string[];
}): GEOData => {
  const { isAllLocations, locationName, recommenderName, totalPlaces, categories } = mapData;

  return {
    pageContext: {
      type: 'map',
      primaryEntity: isAllLocations ? 'All Locations' : locationName,
      secondaryEntities: [recommenderName, ...categories],
      intent: 'Visually explore recommended places on an interactive map',
      summary: `Interactive map showing ${totalPlaces} places recommended by ${recommenderName}${isAllLocations ? " across all locations" : ` in ${locationName}`}.`
    },

    aiDescription: {
      conversational: `Explore ${recommenderName}\'s recommendations through this interactive map featuring ${totalPlaces} carefully selected places${isAllLocations ? " across multiple locations" : ` in ${locationName}`}. Each pin represents a local expert\'s choice, covering ${categories.join(", ")} to help you discover authentic experiences through geographic exploration.`,
      qaFormat: [
        {
          question: `What can I find on this map?`,
          answer: `This interactive map shows ${totalPlaces} places recommended by ${recommenderName}, covering ${categories.join(", ")}${isAllLocations ? " across multiple locations" : ` in ${locationName}`}.`
        },
        {
          question: `How do I use the recommendation map?`,
          answer: 'Click on any pin to see details about that place, including why it\'s recommended and how to get there.'
        },
        {
          question: `Who created this map?`,
          answer: `This map was created by ${recommenderName}, a local expert who has personally visited and recommends each place shown.`
        }
      ],
      keyPoints: [
        'Interactive map exploration',
        `${totalPlaces} expert recommendations`,
        'Geographic discovery',
        'Local expert curation',
        'Mobile-friendly navigation'
      ],
      contextualInfo: `This map transforms ${recommenderName}\'s local knowledge into a visual exploration tool, making it easy to discover places geographically and plan routes efficiently.`
    },

    contextualData: {
      location: locationName ? {
        name: locationName,
        type: 'city' as const
      } : undefined,
      relationships: {
        recommendedBy: recommenderName,
        categories: categories
      }
    },

    naturalLanguage: {
      commonQueries: [
        `Map of recommended places${locationName ? ` in ${locationName}` : ""}`,
        `${recommenderName} recommendation map`,
        'Interactive place discovery',
        'Visual guide to local favorites',
        'Geographic exploration tool'
      ],
      conversationalKeywords: [
        'interactive map',
        'place discovery',
        'visual exploration',
        'geographic guide',
        'location finder',
        'recommendation visualization'
      ],
      entities: [recommenderName, ...(locationName ? [locationName] : []), ...categories],
      sentimentContext: 'positive'
    },

    enrichedContent: {
      fullDescription: `Experience local discovery through ${recommenderName}\'s interactive recommendation map. This visual guide transforms local expertise into an explorable geographic experience, featuring ${totalPlaces} carefully curated places${isAllLocations ? " spanning multiple locations" : ` throughout ${locationName}`}. Each map pin represents not just a location, but a piece of local knowledge and personal experience. The map covers ${categories.join(", ")}, offering diverse options for different interests and helping visitors understand the geographic relationships between recommended places. This tool bridges the gap between local knowledge and visitor exploration, making authentic discoveries as simple as clicking a pin.`,
      benefits: [
        'Visual place discovery',
        'Geographic relationship understanding',
        'Efficient route planning',
        'Expert-curated selections',
        'Mobile-optimized exploration'
      ],
      uniqueAspects: [
        'Local expert geographic knowledge',
        'Interactive exploration experience',
        'Relationship-based place discovery',
        'Mobile-first design',
        'Community-driven content'
      ],
      userExperience: 'Users can visually explore recommendations, understand geographic relationships, and efficiently plan visits while benefiting from local expert knowledge.',
      recommendations: [
        'Click pins for detailed information',
        'Use map for route planning',
        'Explore nearby recommendations',
        'Save interesting places for later'
      ]
    }
  };
};

/**
 * Generate GEO data for organization/landing pages
 */
export const createOrganizationGEOData = (orgData: {
  name: string;
  description: string;
  url: string;
  features?: string[];
  industry?: string;
}): GEOData => {
  const { name, description, features = [], industry = 'Technology' } = orgData;

  return {
    pageContext: {
      type: 'organization',
      primaryEntity: name,
      secondaryEntities: [...features, industry, 'QR codes', 'local recommendations'],
      intent: 'Learn about explorers platform and services',
      summary: `${name} - ${description}. Features include ${features.join(", ")}.`
    },

    aiDescription: {
      conversational: `${name} is a ${industry.toLowerCase()} platform that ${description.toLowerCase()}. Our key features include ${features.join(", ")}. Perfect for businesses, content creators, and individuals who want to share their local knowledge and favorite places through QR codes and digital links.`,
      qaFormat: [
        {
          question: `What is ${name}?`,
          answer: `${name} is a platform that ${description.toLowerCase()}. It helps users create QR codes and shareable links for their favorite places and recommendations.`
        },
        {
          question: `How does ${name} work?`,
          answer: `${name} allows you to create personalized QR codes for your favorite places, build recommendation lists, and share them with others through digital links.`
        },
        {
          question: `Who can use ${name}?`,
          answer: `${name} is perfect for local businesses, content creators, travel enthusiasts, and anyone who wants to share their local knowledge and favorite places.`
        },
        {
          question: `What are the main features of ${name}?`,
          answer: `Key features include ${features.join(", ")}, making it easy to digitize and share local recommendations.`
        }
      ],
      keyPoints: [
        'QR code generation platform',
        'Local recommendation sharing',
        'Digital place discovery',
        'Community-driven content',
        'Business and personal use'
      ],
      contextualInfo: `${name} transforms how people discover and share local places by combining QR technology with personalized recommendations.`
    },

    contextualData: {
      temporal: {
        availability: '24/7 online platform'
      },
      relationships: {
        targetAudience: ['local businesses', 'content creators', 'travelers', 'local experts'],
        industries: [industry, 'Hospitality', 'Tourism', 'Local Business'],
        serviceArea: 'Global'
      }
    },

    naturalLanguage: {
      commonQueries: [
        'how to create QR codes for places',
        'share local recommendations',
        'digital place sharing platform',
        'QR code generator for businesses',
        'local discovery app',
        'recommendation platform'
      ],
      conversationalKeywords: [
        'discover local places',
        'share recommendations',
        'QR code sharing',
        'digital place cards',
        'local knowledge',
        'community recommendations',
        'business promotion',
        'place discovery'
      ],
      entities: [
        name,
        'QR codes',
        'local recommendations',
        'place sharing',
        'digital discovery',
        industry
      ]
    },

    enrichedContent: {
      fullDescription: `${description} ${name} empowers users to digitize their local knowledge through QR codes and shareable links. Whether you're a business owner wanting to promote your location, a content creator sharing hidden gems, or a local expert with insider knowledge, our platform makes it easy to create beautiful, scannable QR codes that lead to personalized recommendation pages.`,
      benefits: [
        'Easy QR code generation',
        'Personalized recommendation pages',
        'Analytics and insights',
        'Mobile-optimized sharing',
        'Community discovery'
      ],
      uniqueAspects: [
        'Combines QR technology with local recommendations',
        'Mobile-first design',
        'Community-driven content',
        'Analytics tracking',
        'Multi-platform sharing'
      ],
      userExperience: 'Simple, intuitive interface for creating and sharing local recommendations through QR codes',
      recommendations: features
    }
  };
};

/**
 * Generate GEO data for simple web pages (auth, static pages)
 */
export const createWebPageGEOData = (pageData: {
  pageType: string;
  title: string;
  description: string;
  keywords?: string[];
  purpose?: string;
}): GEOData => {
  const { pageType, title, description, keywords = [], purpose } = pageData;

  return {
    pageContext: {
      type: 'webpage',
      primaryEntity: title,
      secondaryEntities: [pageType, 'explorers', ...keywords.slice(0, 3)],
      intent: purpose || `Access ${pageType} functionality`,
      summary: `${title} - ${description}`
    },

    aiDescription: {
      conversational: `This is the ${pageType} page for explorers. ${description} Users can ${purpose || `use this page for ${pageType} related actions`}.`,
      qaFormat: [
        {
          question: `What is this ${pageType} page for?`,
          answer: `This ${pageType} page allows users to ${purpose || `access ${pageType} functionality on explorers`}.`
        },
        {
          question: `How do I use the ${pageType} page?`,
          answer: description
        }
      ],
      keyPoints: [
        pageType,
        'explorers platform',
        'User access',
        'Secure authentication',
        'Web application'
      ],
      contextualInfo: `${title} is part of the explorers platform\'s user access system.`
    },

    contextualData: {
      relationships: {
        partOf: 'explorers Platform',
        relatedPages: ['landing', 'dashboard', 'profile'],
        userJourney: pageType
      }
    },

    naturalLanguage: {
      commonQueries: [
        `${pageType} explorers`,
        `how to ${pageType}`,
        `explorers ${pageType} page`,
        `${pageType} account`
      ],
      conversationalKeywords: [
        pageType,
        'user account',
        'access',
        'authentication',
        'explorers',
        'secure'
      ],
      entities: [
        title,
        pageType,
        'explorers',
        'authentication',
        'user access'
      ]
    },

    enrichedContent: {
      fullDescription: description,
      benefits: [
        'Secure access',
        'User-friendly interface',
        'Quick process',
        'Mobile optimized'
      ],
      uniqueAspects: [
        'Part of explorers ecosystem',
        'Seamless user experience',
        'Secure authentication'
      ],
      userExperience: `Simple and secure ${pageType} process`,
      recommendations: [
        `Complete ${pageType} to access explorers features`,
        'Use strong credentials',
        'Keep account information secure'
      ]
    }
  };
};

/**
 * Extracts all unique latitude/longitude coordinates from user's Guides and Recommendations
 * 
 * @param guides - Array of Guide objects from GET_GUIDES_QUERY
 * @param recommendationLists - Array of recommendation lists from recommendationListQuery
 * @returns Array of unique coordinate objects { lat: number, lng: number }
 */
export const getAllUserLocations = (
  guides: any[],
  recommendationLists: any[]
): Array<{ lat: number; lng: number }> => {
  const coordinates: Array<{ lat: number; lng: number }> = [];
  const seenCoordinates = new Set<string>();

  // Helper to add coordinate if not duplicate
  const addCoordinate = (lat: number | string | undefined, lng: number | string | undefined) => {
    if (lat === undefined || lng === undefined) return;

    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;

    if (isNaN(latNum) || isNaN(lngNum)) return;

    // Create unique key for deduplication (rounded to 6 decimal places ≈ 0.1m precision)
    const key = `${latNum.toFixed(6)},${lngNum.toFixed(6)}`;

    if (!seenCoordinates.has(key)) {
      seenCoordinates.add(key);
      coordinates.push({ lat: latNum, lng: lngNum });
    }
  };

  // ============================================
  // EXTRACT FROM GUIDES (ONLY PUBLISHED)
  // ============================================
  // Filter to only published guides (Visibility === true)
  const publishedGuides = guides.filter((guide) => guide.Visibility === true);

  publishedGuides.forEach((guide) => {
    if (!guide.Place_Details) return;

    try {
      let placeDetails: any = guide.Place_Details;
      if (typeof guide.Place_Details === "string") {
        placeDetails = JSON.parse(guide.Place_Details);
      }

      // Single-city guide format
      if (!placeDetails.isMultiCity) {
        if (placeDetails.Geometry?.lat && placeDetails.Geometry?.lng) {
          addCoordinate(placeDetails.Geometry.lat, placeDetails.Geometry.lng);
        }
      }
      // Multi-city guide format
      else {
        // Departure location
        const departure = placeDetails.departure || placeDetails.from;
        if (departure?.Geometry?.lat && departure?.Geometry?.lng) {
          addCoordinate(departure.Geometry.lat, departure.Geometry.lng);
        }

        // Intermediate cities
        const intermediateCities = placeDetails.intermediateCities || [];
        intermediateCities.forEach((city: any) => {
          if (city?.Geometry?.lat && city?.Geometry?.lng) {
            addCoordinate(city.Geometry.lat, city.Geometry.lng);
          }
        });

        // Arrival location
        const arrival = placeDetails.arrival || placeDetails.to;
        if (arrival?.Geometry?.lat && arrival?.Geometry?.lng) {
          addCoordinate(arrival.Geometry.lat, arrival.Geometry.lng);
        }
      }
    } catch (error) {
      // Silently skip invalid Place_Details
      console.warn("Error parsing guide Place_Details:", error);
    }
  });

  // ============================================
  // EXTRACT FROM RECOMMENDATIONS (ONLY PUBLISHED)
  // ============================================
  // Filter to only published recommendation lists (Visibility === true)
  const publishedLists = recommendationLists?.filter((list) => list.Visibility === true) || [];

  publishedLists.forEach((list) => {
    // Extract from recommended_places (individual place coordinates)
    if (list.recommended_places && Array.isArray(list.recommended_places)) {
      list.recommended_places.forEach((place: any) => {
        if (place.Place_Details) {
          try {
            let placeDetails: any = place.Place_Details;
            if (typeof place.Place_Details === "string") {
              placeDetails = JSON.parse(place.Place_Details);
            }

            if (placeDetails.Geometry?.lat && placeDetails.Geometry?.lng) {
              addCoordinate(placeDetails.Geometry.lat, placeDetails.Geometry.lng);
            }
          } catch (error) {
            // Silently skip invalid Place_Details
            console.warn("Error parsing recommendation Place_Details:", error);
          }
        }
      });
    }

    // Extract from List_Name_Details.location (list-level location)
    if (list.List_Name_Details?.location?.latitude && list.List_Name_Details?.location?.longitude) {
      addCoordinate(
        list.List_Name_Details.location.latitude,
        list.List_Name_Details.location.longitude
      );
    }
  });

  return coordinates;
};

/**
 * Extracts unique latitude/longitude coordinates from Published Recommendations only (excludes Guides and drafts)
 * 
 * @param recommendationLists - Array of recommendation lists from recommendationListQuery
 * @returns Array of unique coordinate objects { lat: number, lng: number }
 */
export const getPublishedRecommendationLocations = (
  recommendationLists: any[]
): Array<{ lat: number; lng: number }> => {
  const coordinates: Array<{ lat: number; lng: number }> = [];
  const seenCoordinates = new Set<string>();

  // Helper to add coordinate if not duplicate
  const addCoordinate = (lat: number | string | undefined, lng: number | string | undefined) => {
    if (lat === undefined || lng === undefined) return;

    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;

    if (isNaN(latNum) || isNaN(lngNum)) return;

    // Create unique key for deduplication (rounded to 6 decimal places ≈ 0.1m precision)
    const key = `${latNum.toFixed(6)},${lngNum.toFixed(6)}`;

    if (!seenCoordinates.has(key)) {
      seenCoordinates.add(key);
      coordinates.push({ lat: latNum, lng: lngNum });
    }
  };

  // Extract from published recommendations only
  recommendationLists?.forEach((list) => {
    // Only process published lists
    if (list.Visibility !== true) return;

    // Extract from recommended_places (individual place coordinates)
    if (list.recommended_places && Array.isArray(list.recommended_places)) {
      list.recommended_places.forEach((place: any) => {
        if (place.Place_Details) {
          try {
            let placeDetails: any = place.Place_Details;
            if (typeof place.Place_Details === "string") {
              placeDetails = JSON.parse(place.Place_Details);
            }

            if (placeDetails.Geometry?.lat && placeDetails.Geometry?.lng) {
              addCoordinate(placeDetails.Geometry.lat, placeDetails.Geometry.lng);
            }
          } catch (error) {
            // Silently skip invalid Place_Details
            console.warn("Error parsing recommendation Place_Details:", error);
          }
        }
      });
    }

    // Extract from List_Name_Details.location (list-level location)
    if (list.List_Name_Details?.location?.latitude && list.List_Name_Details?.location?.longitude) {
      addCoordinate(
        list.List_Name_Details.location.latitude,
        list.List_Name_Details.location.longitude
      );
    }
  });

  return coordinates;
};