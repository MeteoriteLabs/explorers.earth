/**
 * AI Section Generation Service
 * Reusable utilities for generating single guide sections with AI
 */

import axios from "axios";
import { enrichAIPlaces, extractLocationContext } from "./placeEnrichmentService";
import { htmlToBlocks } from "../../../utils/strapiBlocksConverter";
import type { AIGeneratedSection } from "../../../services/geminiService";
import { getSystemPrompt } from "../../../services/geminiService";

const GEMINI_API_URL = import.meta.env.VITE_PAYMENT_API_URL || "http://localhost:5000";

/**
 * Helper: Extract valid JSON from AI response that may contain extra text
 * Handles cases where backend appends explanatory text after JSON
 */
function extractValidJSON(content: string): string {
  const jsonContent = content.trim();

  // Handle markdown code blocks
  if (jsonContent.startsWith("```")) {
    const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }
  }

  // Find first opening brace
  const firstBrace = jsonContent.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("No JSON object found in response");
  }

  // Find the matching closing brace by counting braces
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = firstBrace; i < jsonContent.length; i++) {
    const char = jsonContent[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;

      // Found matching closing brace
      if (braceCount === 0) {
        return jsonContent.substring(firstBrace, i + 1);
      }
    }
  }

  // Fallback to lastIndexOf if brace counting fails
  const lastBrace = jsonContent.lastIndexOf("}");
  if (lastBrace !== -1) {
    return jsonContent.substring(firstBrace, lastBrace + 1);
  }

  throw new Error("Could not extract valid JSON from response");
}

/**
 * Helper: Determine which city a new day should be in for multi-city guides
 * Analyzes existing sections to maintain logical city distribution
 */
function determineMultiCityLocation(
  guide: any,
  existingSections: any[],
  dayNumber: number
): { targetCity: string; locationKey: string; cityName: string } | null {
  if (!guide.is_Multicity) return null;

  let placeDetails = guide.Place_Details;
  if (typeof placeDetails === "string") {
    try {
      placeDetails = JSON.parse(placeDetails);
    } catch {
      return null;
    }
  }

  // Support both new (starting/ending) and legacy (departure/arrival, from/to) keys
  const starting = placeDetails?.starting || placeDetails?.departure || placeDetails?.from;
  const ending = placeDetails?.ending || placeDetails?.arrival || placeDetails?.to;

  const fromCity = starting?.Place_Name || starting?.Place_Address;
  const toCity = ending?.Place_Name || ending?.Place_Address;

  if (!fromCity || !toCity) return null;

  // Analyze existing sections to see city distribution
  const cityDistribution: { [key: string]: number } = {
    starting: 0,
    ending: 0,
  };

  existingSections.forEach((section: any) => {
    let mapDetails = section.Map_Details;
    if (typeof mapDetails === "string") {
      try {
        mapDetails = JSON.parse(mapDetails);
      } catch {
        return;
      }
    }

    const location = mapDetails?.location;
    if (location) {
      cityDistribution[location] = (cityDistribution[location] || 0) + 1;
    }
  });

  // Determine logical next city based on day progression
  const totalDays = guide.Number_Of_Days || dayNumber;

  // Simple logic: first half at starting point, second half at ending point
  if (dayNumber <= Math.ceil(totalDays / 2)) {
    return {
      targetCity: fromCity,
      locationKey: "starting",  // Use 'starting' for starting point
      cityName: fromCity,
    };
  } else {
    return {
      targetCity: toCity,
      locationKey: "ending",  // Use 'ending' for ending point
      cityName: toCity,
    };
  }
}

interface GenerateSingleSectionOptions {
  guide: any;  // Full guide object
  dayNumber: number;  // Next sequence number
}

/**
 * Generate a single AI section for an existing guide
 * Uses the single_day pipeline specifically for adding individual days
 * 
 * @param options - Guide data and day number for the new section
 * @returns Promise resolving to a single AI-generated section
 */
export async function generateSingleSectionWithAI(
  options: GenerateSingleSectionOptions
): Promise<AIGeneratedSection> {
  const { guide, dayNumber } = options;

  // Parse Place_Details (can be string or object)
  let placeDetails: any = guide.Place_Details;
  if (typeof guide.Place_Details === "string") {
    try {
      placeDetails = JSON.parse(guide.Place_Details);
    } catch (e) {
      console.error("Error parsing Place_Details:", e);
      placeDetails = null;
    }
  }

  // Parse categories (can be array, string, or JSON string)
  let categories: string[] = [];
  if (Array.isArray(guide.Category)) {
    categories = guide.Category;
  } else if (typeof guide.Category === "string") {
    try {
      categories = JSON.parse(guide.Category);
    } catch {
      // If not JSON, treat as single category
      categories = [guide.Category];
    }
  }

  // Fallback to default categories if none exist
  if (categories.length === 0) {
    categories = ["Sightseeing", "Culture", "Food", "History"];
  }

  // Parse best time to visit
  let bestTimeToVisit: string[] = [];
  if (Array.isArray(guide.Best_Time_To_Visit)) {
    bestTimeToVisit = guide.Best_Time_To_Visit;
  } else if (typeof guide.Best_Time_To_Visit === "string") {
    try {
      bestTimeToVisit = JSON.parse(guide.Best_Time_To_Visit);
    } catch {
      bestTimeToVisit = [];
    }
  }

  // Determine location information
  const isMultiCity = guide.is_Multicity === true;
  const existingSections = guide.guide_sections || [];
  let locationName = "Unknown Location";
  let locationContext: any = null;
  let locationInstruction = "";

  if (isMultiCity && placeDetails) {
    // Multi-city guide - determine which city this day should be in
    // Support both new (starting/ending) and legacy (departure/arrival, from/to) keys
    const starting = placeDetails.starting || placeDetails.departure || placeDetails.from;
    const ending = placeDetails.ending || placeDetails.arrival || placeDetails.to;

    const fromLocation = starting?.Place_Name || starting?.Place_Address;
    const toLocation = ending?.Place_Name || ending?.Place_Address;

    // Intelligent location determination
    locationContext = determineMultiCityLocation(guide, existingSections, dayNumber);

    if (locationContext) {
      // Focus on specific city for this day
      locationName = locationContext.cityName;

      locationInstruction = `\n\n**IMPORTANT - Location Assignment:**
This is Day ${dayNumber} of a multi-city guide traveling from ${fromLocation} (starting point) to ${toLocation} (ending point).
This day should focus on activities in: **${locationContext.cityName}**

In your JSON response, include a "location" field with value: "${locationContext.locationKey}"

Example:
{
  "title": "Day ${dayNumber}: ...",
  "description": "...",
  "location": "${locationContext.locationKey}",
  "places": [...]
}`;
    } else if (fromLocation && toLocation) {
      // Fallback: mention route but focus on one city
      locationName = fromLocation; // Default to starting city
      locationInstruction = `\n\n**Note:** This is part of a multi-city guide from ${fromLocation} to ${toLocation}. Focus activities in ${fromLocation}.`;
    }
  } else if (placeDetails) {
    // Single-city guide
    locationName = placeDetails.Place_Name || placeDetails.Place_Address || "Unknown Location";
  }

  // Build prompt for single day generation
  const categoriesText = categories.join(", ");
  const bestTimeText = bestTimeToVisit.length > 0
    ? `\nBest time to visit: ${bestTimeToVisit.join(", ")}`
    : "";
  const budgetType = guide.Budget_Type || "Mid_Range";

  // Get system prompt for single_day pipeline
  const systemPrompt = getSystemPrompt("single_day");

  // Build user prompt
  const userPrompt = `Generate a detailed Day ${dayNumber} itinerary for ${locationName}.

**Day Requirements:**
- Budget Type: ${budgetType}
- Categories/Themes: ${categoriesText}${bestTimeText}
- This is Day ${dayNumber} of an existing guide${locationInstruction}

**Instructions:**
1. Create an engaging day title (e.g., "Day ${dayNumber}: Exploring Hidden Gems")
2. Write a brief 1-2 paragraph description for this day
3. Include 3-5 recommended places to visit with:
   - Place name
   - Brief description/tips
   - Suggested time of day (morning, afternoon, or evening)
4. Mix activities covering the selected categories: ${categoriesText}

**Important:**
- Follow the JSON schema provided in the system prompt exactly
- Return ONLY the GuideSection object, not the full guide
- Ensure all timeline slots (morning, afternoon, evening) have at least 1 place each
- Every place must have actionable tips
- Mix morning, afternoon, and evening activities
- Tailor recommendations to ${budgetType} budget
- Focus on categories: ${categoriesText}
- Make it practical and actionable`;

  // Combine system prompt with user prompt
  const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  try {
    const token = localStorage.getItem("qrtoken");

    // Multi-city guides need more time for generation
    const timeoutMs = isMultiCity ? 60000 : 30000; // 60s for multi-city, 30s for single-city

    console.log(`[AI Generation] Starting for Day ${dayNumber} in ${locationName} (${isMultiCity ? 'multi-city' : 'single-city'})`);

    // Use single_day pipeline for individual day generation
    const response = await axios.post(
      `${GEMINI_API_URL}/api/gemini/generate`,
      {
        prompt,
        model: "gemini-2.0-flash",
        pipeline: "single_day",
      },
      {
        withCredentials: true, // Include cookies for user authentication
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        timeout: timeoutMs,
      }
    );

    // Track AI guide request after successful generation
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        const username = authData?.state?.user?.username;
        if (username) {
          // Import and track asynchronously (don't wait)
          import('../../../services/requestTrackingService').then(({ trackAIGuideRequest }) => {
            trackAIGuideRequest(username).catch(err => {
              console.error('[Tracking] Failed to track AI guide request:', err);
            });
          }).catch(err => {
            console.error('[Tracking] Failed to load tracking service:', err);
          });
        }
      }
    } catch (trackingError) {
      console.error('[Tracking] Error in tracking flow:', trackingError);
    }


    if (!response.data.success) {
      throw new Error(response.data.message || response.data.error || "AI generation failed");
    }

    const generatedContent = response.data.data?.text || response.data.data?.generatedText || response.data.data?.response;

    if (!generatedContent) {
      console.error("[AI Generation] No content in response:", response.data);
      throw new Error("No content generated by AI");
    }

    console.log(`[AI Generation] Received ${generatedContent.length} characters`);

    // Parse the response using robust extraction
    let jsonContent: string;
    let parsed: any;

    try {
      jsonContent = extractValidJSON(generatedContent);
      console.log(`[AI Generation] Extracted JSON (${jsonContent.length} chars)`);
      parsed = JSON.parse(jsonContent);
    } catch (parseError: any) {
      console.error("[AI Generation] JSON Parse Error:", parseError.message);
      console.error("[AI Generation] Content preview:", generatedContent.substring(0, 500));
      console.error("[AI Generation] Content end:", generatedContent.substring(Math.max(0, generatedContent.length - 200)));
      throw new Error(`Failed to parse AI response: ${parseError.message}. The AI may have returned invalid JSON format.`);
    }

    // Backend returns full GuideSection structure with Timeline
    // Extract description from blocks format
    let description = "";
    if (Array.isArray(parsed.Description)) {
      description = parsed.Description
        .map((block: any) => {
          if (block.type === "paragraph" && Array.isArray(block.children)) {
            return block.children.map((child: any) => child.text || "").join("");
          }
          return "";
        })
        .filter((text: string) => text)
        .join("\n\n");
    } else if (typeof parsed.Description === "string") {
      description = parsed.Description;
    }

    // Extract places from Timeline structure
    const places: any[] = [];
    if (parsed.Timeline) {
      const timeline = typeof parsed.Timeline === "string"
        ? JSON.parse(parsed.Timeline)
        : parsed.Timeline;

      // Combine all time periods
      ["morning", "afternoon", "evening"].forEach((period) => {
        if (Array.isArray(timeline[period])) {
          timeline[period].forEach((place: any) => {
            places.push({
              ...place,
              timeSlot: period,
            });
          });
        }
      });
    }

    // Extract location for multi-city guides
    let sectionLocation: string | undefined = undefined;
    if (isMultiCity) {
      sectionLocation = parsed.location || parsed.Location;

      // If AI didn't provide location but we determined it, use our determination
      if (!sectionLocation && locationContext) {
        sectionLocation = locationContext.locationKey;
      }

      console.log(`[AI Generation] Multi-city location: ${sectionLocation || 'not specified'}`);
    }

    // Format as AIGeneratedSection
    const section: AIGeneratedSection = {
      title: parsed.Title || parsed.title || `Day ${dayNumber}`,
      sequence: dayNumber,
      description: description,
      places: places,
      location: sectionLocation,
    };

    console.log(`[AI Generation] Success: ${section.title}, ${places.length} places`);
    return section;
  } catch (error: any) {
    console.error("[AI Generation] Error:", error);

    if (error.code === "ECONNABORTED") {
      const timeoutSec = isMultiCity ? 60 : 30;
      throw new Error(`AI generation timed out after ${timeoutSec} seconds. ${isMultiCity ? 'Multi-city generation can take longer. ' : ''}Please try again.`);
    } else if (error.response?.status === 404) {
      throw new Error("AI service endpoint not found. Please ensure the backend is running.");
    } else if (error.response?.status === 400) {
      throw new Error("Invalid request to AI service. Please check your inputs.");
    } else if (error.response?.status === 500) {
      throw new Error("AI service is temporarily unavailable. Please try again later.");
    } else if (error.message) {
      throw error;
    } else {
      throw new Error("Failed to generate day with AI. Please try again.");
    }
  }
}

/**
 * Enrich and format AI section for database storage
 * Converts AI-generated places to full Google Places data and formats for Strapi
 * 
 * @param section - AI-generated section with place names
 * @param guide - Parent guide object for context
 * @param guideDocumentId - Guide's document ID for relation
 * @returns Formatted section data ready for CREATE_GUIDE_SECTION_MUTATION
 */
export async function enrichAndFormatSection(
  section: AIGeneratedSection,
  guide: any,
  guideDocumentId: string
): Promise<any> {
  // Parse Place_Details for location context
  let placeDetails: any = guide.Place_Details;
  if (typeof guide.Place_Details === "string") {
    try {
      placeDetails = JSON.parse(guide.Place_Details);
    } catch (e) {
      console.error("Error parsing Place_Details:", e);
      placeDetails = null;
    }
  }

  // Extract location context for place enrichment
  const isMultiCity = guide.is_Multicity === true;

  // Support both new (starting/ending) and legacy (departure/arrival, from/to) keys
  const toLocationName = placeDetails?.ending?.Place_Name ||
    placeDetails?.arrival?.Place_Name ||
    placeDetails?.to?.Place_Name ||
    "";

  const locationContext = extractLocationContext({
    locationMode: isMultiCity ? "multi" : "single",
    locationDisplayValue: placeDetails?.Place_Name || placeDetails?.Place_Address || "",
    toLocationDisplayValue: toLocationName,
  });

  // Convert description to Strapi blocks format
  // Description comes as plain text, need to convert to blocks for Strapi
  const descriptionBlocks = section.description
    ? htmlToBlocks(section.description.replace(/\n\n/g, "<br><br>"))
    : [];

  // Build base section data
  const sectionData: any = {
    Title: section.title,
    Sequence: section.sequence,
    Description: descriptionBlocks,
    guide: guideDocumentId,
  };

  // Add Map_Details with location for multi-city guides
  if (isMultiCity) {
    if (section.location) {
      sectionData.Map_Details = {
        location: section.location,
      };
      console.log(`[Enrichment] Multi-city location set to: ${section.location}`);
    } else {
      console.warn(`[Enrichment] Multi-city guide but no location specified for Day ${section.sequence}`);
    }
  }

  // Enrich places if available
  if (section.places && section.places.length > 0) {
    const timeline: any = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    // ENRICHMENT: Resolve AI place names to Google Places data
    const enrichedPlaces = await enrichAIPlaces(section.places, locationContext);

            // Get username from auth store for photo uploads
            const authStoreModule = await import("../../../store/store");
            const authStore = authStoreModule.default.getState();
            const username = authStore.user?.username || "user";

    // Fetch and upload photos for all places, then create Recommendation_Activity
    const activities: any[] = [];
    const sectionIdForPhotos = "temp-section"; // Will be updated after section creation

    // Process each enriched place
    for (const place of enrichedPlaces) {
      const originalPlace = section.places?.[enrichedPlaces.indexOf(place)];
      const timeSlot = originalPlace?.timeSlot || "morning";

      // Remove enrichment metadata before saving to database
      const { isVerified, source, ...placeData } = place;

      // Add to timeline
      if (["morning", "afternoon", "evening"].includes(timeSlot)) {
        timeline[timeSlot as "morning" | "afternoon" | "evening"].push(placeData);
      } else {
        timeline.morning.push(placeData);
      }

      // Fetch and upload photos for this place if it has a place_id
      if (placeData.place_id) {
        try {
          const { fetchGooglePlacePhotos } = await import("../utils/googlePhotosService");
          const { uploadActivityPhotos } = await import("../services/activityPhotoService");
          
          // Fetch photos from Google Places
          const photos = await fetchGooglePlacePhotos(placeData.place_id, 6);
          
          if (photos.length > 0) {
            // Upload photos to S3
            const uploadedPhotos = await uploadActivityPhotos(
              photos,
              username,
              sectionIdForPhotos,
              placeData.place_id
            );

            // Add to activities with uploaded photos
            activities.push({
              ...placeData,
              photos: uploadedPhotos,
              photosLoading: false,
            });
          } else {
            // No photos found, add place without photos
            activities.push({
              ...placeData,
              photos: [],
              photosLoading: false,
            });
          }
        } catch (error) {
          console.error(`Error fetching/uploading photos for place ${placeData.place_id}:`, error);
          // Add place without photos on error
          activities.push({
            ...placeData,
            photos: [],
            photosLoading: false,
          });
        }
      }
    }

    // Only add Timeline if there are places
    if (timeline.morning.length > 0 || timeline.afternoon.length > 0 || timeline.evening.length > 0) {
      sectionData.Timeline = timeline;
    }

    // Add Recommendation_Activity with uploaded photos
    if (activities.length > 0) {
      sectionData.Recommendation_Activity = {
        activities: activities,
      };
    }
  }

  return sectionData;
}
