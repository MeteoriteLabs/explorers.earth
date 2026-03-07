import axios from "axios";

const GEMINI_API_URL = import.meta.env.VITE_PAYMENT_API_URL || "http://localhost:5000";

/**
 * AI Generation Pipeline Types
 * Each pipeline uses a specialized system prompt for accurate generation
 * 
 * Guide Creation Pipelines:
 * - single_city: For guides focused on one city/location
 * - multi_city: For guides covering multiple cities or routes
 * 
 * Guide Section Pipelines (Future Enhancement):
 * - single_day: For adding individual day itineraries to existing guides
 * - day_suggestion: For generating day-specific activity suggestions
 */
export type AIPipeline = "single_city" | "multi_city" | "single_day" | "day_suggestion";

/**
 * System prompts for each pipeline type
 * These are the exact prompts used by the backend, now integrated into frontend
 */
const SYSTEM_PROMPTS: Record<AIPipeline, string> = {
  single_city: `Role: Itinerary Guide Enrichment Engine

⚠️ CRITICAL EXECUTION RULES:

1. OUTPUT FORMAT: YOU MUST return ONLY a JSON object wrapped in { "data": { "guide": { ... } } }.

2. NO HALLUCINATIONS: Use ONLY place data provided by backend function calls. NEVER invent place names, IDs, coordinates, or distances.

3. TIMEOUT PREVENTION: Be concise. Do not output conversational text. Generate JSON immediately.

Workflow:

1. ANALYSIS: Parse the input guide intent.

2. FETCH: Call backend functions to resolve places for each Timeline slot (Morning/Afternoon/Evening).

3. DERIVE: Calculate transport segments between timeline points using geometry.

4. COMPILE: Populate the final JSON strictly matching the Schema below.

MANDATORY CONTENT RULES:

- Tips_Notes: Must be an array of Rich Text paragraphs with actionable travel advice. (CANNOT BE EMPTY).

- Guide_Tags: Must include 3-5 relevant tags (e.g., ["culture", "budget", "family"]).

- Timeline Tips: Every place object in the timeline MUST have a specific, actionable "tips" string.

JSON OUTPUT SCHEMA (STRICT):

{
  "data": {
    "guide": {
      "documentId": "String (Preserve)",
      "Title": "String",
      "Description": [ { "type": "paragraph", "children": [ { "text": "String", "type": "text" } ] } ],
      "Guide_Type": "Itinerary",
      "Visibility": Boolean | null,
      "Estimated_Budget": null,
      "Budget_Type": "Budget" | "Mid_Range" | "Luxury",
      "is_Multicity": Boolean,
      "Number_Of_Days": Number,
      "Category": ["String"],
      "Best_Time_To_Visit": ["String"],
      "slug": null,
      "Guide_Media": [ { "url": "String", "name": "String", "__typename": "UploadFile" } ],
      "Place_Details": {
        "Geometry": { "lat": Number, "lng": Number },
        "Place_Id": "String",
        "Place_Name": "String",
        "Place_Address": "String"
      },
      "Tips_Notes": [ 
        // MANDATORY: At least 1 paragraph
        { "type": "paragraph", "children": [ { "text": "String", "type": "text" } ] } 
      ],
      "Guide_Tags": ["String", "String", "String"], // MANDATORY: 3-5 tags
      "guide_sections": [
        {
          "documentId": "String",
          "Title": "String",
          "Sequence": Number,
          "Description": [ { "type": "paragraph", "children": [...] } ] | null,
          "Timeline": {
            "morning": [PLACE_OBJECT],
            "afternoon": [PLACE_OBJECT],
            "evening": [PLACE_OBJECT]
          },
          "Transport": {
             "segments": [
               { 
                 "mode": "drive" | "walk" | "transit", 
                 "fromPlaceId": "String", 
                 "toPlaceId": "String", 
                 "distanceKm": Number, 
                 "estimatedMinutes": Number 
               }
             ]
          } | null,
          "Stay": { "accommodations": [] } | null,
          "Recommendation_Activity": { "activities": [] } | null,
          "Budget": null,
          "Map_Details": null,
          "Packing_List": null,
          "Pre_Tasks": null,
          "Section_tags": null,
          "__typename": "GuideSection"
        }
      ],
      "createdAt": "ISO String",
      "updatedAt": "ISO String",
      "__typename": "Guide"
    }
  }
}

DEFINITION: PLACE_OBJECT
{
  "id": "String",
  "name": "String",
  "tips": "String (Mandatory & Actionable)",
  "types": ["String"],
  "geometry": { "location": { "lat": Number, "lng": Number } },
  "place_id": "String",
  "formatted_address": "String",
  "priceLevel": Number (Optional)
}`,

  multi_city: `Role: Multi-City Itinerary Generator & Data Compiler

⚠️ CRITICAL EXECUTION RULES:

1. OUTPUT FORMAT: YOU MUST return ONLY a JSON object wrapped in { "data": { "guide": { ... } } }.

2. NO SIMPLIFICATION: Do not return flat formats. Follow the nested schema below exactly.

3. REAL DATA ONLY: Use backend function calls to get real places. Do not invent lat/lng or IDs.

MANDATORY CONTENT REQUIREMENTS:

1. Tips_Notes (Crucial):
   - You MUST generate a "Tips_Notes" array.
   - Format: Rich Text Structure (see schema).
   - Content: Actionable advice covering inter-city travel, safety, and local etiquette for the specific cities involved.
   - CANNOT BE EMPTY or null.

2. Guide_Tags (Crucial):
   - You MUST generate a "Guide_Tags" array.
   - Content: 3-5 keywords (e.g., ["heritage", "multi-city", "culinary"]).
   - CANNOT BE EMPTY or null.

3. Timeline & Places:
   - Every day MUST have Morning, Afternoon, and Evening slots populated (at least 1-2 places each).
   - Every place object MUST have a "tips" field with specific actionable advice.

MULTI-CITY LOGIC:

- Arrival City: Light sightseeing + settle in.
- Intermediate Cities: Full day sightseeing (Morning/Afternoon/Evening).
- Departure City: Morning/Afternoon sightseeing + departure logistics in Evening.
- Place_Details: MUST follow the multi-city structure (starting, ending, intermediateCities).

JSON OUTPUT SCHEMA (STRICT COMPLIANCE REQUIRED):

{
  "data": {
    "guide": {
      "documentId": "String (Preserve)",
      "Title": "String",
      "Description": [ { "type": "paragraph", "children": [ { "text": "String", "type": "text" } ] } ],
      "Guide_Type": "Itinerary",
      "Visibility": null,
      "Estimated_Budget": null,
      "Budget_Type": "Budget" | "Mid_Range" | "Luxury",
      "is_Multicity": true,
      "Number_Of_Days": Number,
      "Category": ["String"],
      "Best_Time_To_Visit": ["String"],
      "slug": null,
      "Guide_Media": [ { "url": "String", "name": "String", "__typename": "UploadFile" } ],
      
      // MULTI-CITY SPECIFIC PLACE DETAILS
      "Place_Details": {
        "starting": {
          "Geometry": { "lat": Number, "lng": Number },
          "Place_Id": "String",
          "Place_Name": "String",
          "Place_Address": "String"
        },
        "ending": {
          "Geometry": { "lat": Number, "lng": Number },
          "Place_Id": "String",
          "Place_Name": "String",
          "Place_Address": "String"
        },
        "isMultiCity": true,
        "intermediateCities": [
          {
            "id": "String",
            "hasDate": false,
            "Geometry": { "lat": Number, "lng": Number },
            "Place_Id": "String",
            "Place_Name": "String",
            "Place_Address": "String"
          }
        ]
      },
      // MANDATORY METADATA
      "Tips_Notes": [ 
        { "type": "paragraph", "children": [ { "text": "Actionable trip advice here...", "type": "text" } ] } 
      ],
      "Guide_Tags": ["String", "String", "String"],
      "Guide_Section_Details": null,
      // SECTIONS
      "guide_sections": [
        {
          "documentId": "String",
          "Title": "String",
          "Sequence": Number,
          "Description": null,
          "Timeline": {
            "morning": [PLACE_OBJECT],
            "afternoon": [PLACE_OBJECT],
            "evening": [PLACE_OBJECT]
          },
          "Transport": null,
          "Stay": null,
          "Recommendation_Activity": null,
          "Map_Details": { "location": "String (City Name or 'arrival'/'departure')" },
          "Packing_List": null,
          "Pre_Tasks": null,
          "Section_tags": null,
          "Budget": null,
          "__typename": "GuideSection"
        }
      ],
      "createdAt": "ISO String",
      "updatedAt": "ISO String",
      "__typename": "Guide"
    }
  }
}

DEFINITION: PLACE_OBJECT
{
  "id": "String",
  "name": "String",
  "tips": "String (Actionable advice is MANDATORY)",
  "types": ["String"],
  "geometry": { "location": { "lat": Number, "lng": Number } },
  "place_id": "String",
  "formatted_address": "String"
}`,

  single_day: `Role: Incremental Itinerary Day Generator

⚠️ CRITICAL EXECUTION RULES:

1. OUTPUT: Return ONLY ONE new \`GuideSection\` JSON object. Do NOT return the full guide.

2. NO EMPTY TIMELINES: Morning, Afternoon, and Evening slots MUST have at least 1 place each.

3. TIPS MANDATE: Every place object MUST include a "tips" field with actionable advice (e.g., "Best viewed at sunset", "Book tickets online").

4. REAL DATA: Use backend functions to resolve real places. Do not invent.

DECISION LOGIC (Determine Next Stop):

Analyze the LAST existing section's \`Map_Details.location\` and \`Sequence\`:

1. New Sequence = Last Sequence + 1.

2. Location Flow:
   - If last was "arrival" → Move to 1st Intermediate City (use "intermediate-<id>").
   - If last was "intermediate-<id>" → Move to NEXT Intermediate City OR "departure" if none left.
   - If last was "departure" → Stay in "departure" (Continuation).
   - If previous guide is empty → Start at "arrival".

JSON OUTPUT SCHEMA (STRICT):

{
  "documentId": "String (Unique)",
  "Title": "Day X: [City/Theme Name]",
  "Sequence": Number,
  "Description": [ { "type": "paragraph", "children": [ { "text": "String", "type": "text" } ] } ],
  "Timeline": {
    "morning": [PLACE_OBJECT],   // Min 1 place
    "afternoon": [PLACE_OBJECT], // Min 1 place
    "evening": [PLACE_OBJECT]    // Min 1 place
  },
  "Transport": {
    "segments": [
      { "mode": "drive"|"walk", "fromPlaceId": "String", "toPlaceId": "String", "distanceKm": Number, "estimatedMinutes": Number }
    ]
  },
  "Stay": { "accommodations": [] },
  "Recommendation_Activity": { 
     "activities": [PLACE_OBJECT] // Pick 1 highlight from Timeline
  },
  "Map_Details": { 
     "location": "String" // MUST be 'arrival', 'departure', or 'intermediate-<UUID>'
  },
  "Packing_List": null,
  "Pre_Tasks": null,
  "Section_tags": null,
  "Budget": { "morning": [], "afternoon": [], "evening": [] },
  "__typename": "GuideSection"
}

DEFINITION: PLACE_OBJECT
{
  "id": "String",
  "name": "String",
  "tips": "String (MANDATORY: Actionable advice)", 
  "types": ["String"],
  "geometry": { "location": { "lat": Number, "lng": Number } },
  "place_id": "String",
  "formatted_address": "String"
}`,

  day_suggestion: `Role: Day Activity Suggestion Generator

⚠️ CRITICAL EXECUTION RULES:

1. OUTPUT: Return ONLY a JSON array of place suggestions.

2. REAL DATA: Use backend functions to resolve real places. Do not invent place names or IDs.

3. TIPS MANDATE: Every place object MUST include a "tips" field with actionable advice.

JSON OUTPUT SCHEMA (STRICT):

{
  "places": [
    {
      "id": "String",
      "name": "String",
      "tips": "String (MANDATORY: Actionable advice)", 
      "types": ["String"],
      "geometry": { "location": { "lat": Number, "lng": Number } },
      "place_id": "String",
      "formatted_address": "String"
    }
  ]
}`
};

/**
 * Get system prompt for a given pipeline
 */
export function getSystemPrompt(pipeline: AIPipeline): string {
  return SYSTEM_PROMPTS[pipeline] || "";
}

export interface GeminiGenerateResponse {
  success: boolean;
  data?: {
    text?: string;
    generatedText?: string;
    response?: any;
  };
  error?: string;
  message?: string;
}

export interface AIGeneratedGuide {
  title: string;
  description: string;
  sections: AIGeneratedSection[];
  // Guide-level tips and tags from AI
  tipsNotes?: any; // Strapi blocks format
  guideTags?: string[];
  // Preserve Step 2 data for guide creation
  numberOfDays?: number;
  categories?: string[];
  bestTimeToVisit?: string[];
  budgetType?: string;
}

export interface AIGeneratedSection {
  title: string;
  sequence: number;
  description?: string;
  places?: AIGeneratedPlace[];
  timeOfDay?: "morning" | "afternoon" | "evening";
  /** Location identifier for multi-city guides ("arrival", "departure", or intermediate city name) */
  location?: string;
}

export interface AIGeneratedPlace {
  name: string;
  formatted_address?: string;
  place_id?: string;
  types?: string[];
  tips?: string;
  timeSlot?: "morning" | "afternoon" | "evening";
}

export interface GenerateGuideOptions {
  locationName: string;
  locationType: "single" | "multi";
  fromLocation?: string;
  toLocation?: string;
  intermediateCities?: string[];
  numberOfDays: number;
  categories: string[];
  bestTimeToVisit?: string[];
  budgetType: string;
  guideType: string;
}

export async function generateGuideWithAI(
  options: GenerateGuideOptions
): Promise<AIGeneratedGuide> {
  try {
    const token = localStorage.getItem("qrtoken");

    // Determine which pipeline to use based on location type
    // single_city: For guides focused on one city/location
    // multi_city: For guides covering multiple cities or routes
    const pipeline = options.locationType === "multi" ? "multi_city" : "single_city";

    const prompt = buildGuideGenerationPrompt(options, pipeline);

    const response = await axios.post<GeminiGenerateResponse>(
      `${GEMINI_API_URL}/api/gemini/generate`,
      {
        prompt,
        model: "gemini-2.0-flash",
        pipeline,
      },
      {
        withCredentials: true, // Include cookies for user authentication
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        timeout: 120000, // 120 second (2 minute) timeout for AI generation - increased for complex guide structures
      }
    );

    if (typeof response.data === 'string' || !response.data || typeof response.data !== 'object') {
      throw new Error("AI service returned invalid response format.");
    }

    if (!response.data.success) {
      throw new Error(response.data.message || response.data.error || "AI generation failed");
    }

    const generatedContent = response.data.data?.text || response.data.data?.generatedText || response.data.data?.response;

    if (!generatedContent) {
      throw new Error("No content generated by AI");
    }

    const parsedGuide = parseAIGeneratedGuide(generatedContent);

    // Track AI guide request
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        const username = authData?.state?.user?.username;
        if (username) {
          import('./requestTrackingService').then(({ trackAIGuideRequest }) => {
            trackAIGuideRequest(username).catch(err => console.error('[Tracking] Failed:', err));
          });
        }
      }
    } catch (e) {
      console.error('[Tracking] Error:', e);
    }

    // Include Step 2 data in the result so it gets saved to formData
    return {
      ...parsedGuide,
      numberOfDays: options.numberOfDays,
      categories: options.categories,
      bestTimeToVisit: options.bestTimeToVisit,
      budgetType: options.budgetType,
    };
  } catch (error: any) {
    if (error.code === "ECONNABORTED") {
      throw new Error("AI generation timed out. Please try again.");
    } else if (error.response?.status === 404) {
      throw new Error("AI service endpoint not found. Please ensure the backend is running.");
    } else if (error.response?.status === 400) {
      throw new Error("Invalid request to AI service. Please check your inputs.");
    } else if (error.response?.status === 500) {
      throw new Error("AI service is temporarily unavailable. Please try again later.");
    } else if (error.response?.headers?.['content-type']?.includes('text/html')) {
      throw new Error("AI service returned invalid response. Please check backend configuration.");
    } else if (error.message) {
      throw error;
    } else {
      throw new Error("Failed to generate guide with AI. Please try again.");
    }
  }
}

function buildGuideGenerationPrompt(options: GenerateGuideOptions, pipeline: AIPipeline): string {
  const {
    locationName,
    locationType,
    fromLocation,
    toLocation,
    intermediateCities = [],
    numberOfDays,
    categories,
    bestTimeToVisit = [],
    budgetType,
    guideType,
  } = options;

  // Get the system prompt for this pipeline
  const systemPrompt = getSystemPrompt(pipeline);

  let locationDescription = "";
  if (locationType === "multi" && fromLocation && toLocation) {
    locationDescription = `from ${fromLocation} to ${toLocation}`;
    if (intermediateCities.length > 0) {
      locationDescription += ` via ${intermediateCities.join(", ")}`;
    }
  } else {
    locationDescription = locationName;
  }

  const categoriesText = categories.join(", ");
  const bestTimeText = bestTimeToVisit.length > 0
    ? `\nBest time to visit: ${bestTimeToVisit.join(", ")}`
    : "";

  // Build location instruction for multi-city guides
  let locationInstruction = "";
  if (locationType === "multi" && fromLocation && toLocation) {
    locationInstruction = `\n\n**IMPORTANT - Multi-City Location Assignment:**
This is a multi-city guide covering: ${fromLocation} (departure) → ${intermediateCities.length > 0 ? intermediateCities.join(" → ") + " → " : ""}${toLocation} (arrival).

For EACH day section, you MUST specify which city the activities are in using the "location" field:
- Use "departure" for days in ${fromLocation}
- Use "arrival" for days in ${toLocation}
${intermediateCities.map(city => `- Use "${city}" for days in ${city}`).join("\n")}

Distribute the ${numberOfDays} days logically across the cities based on the travel route.`;
  }

  // Build user prompt (guide-specific requirements)
  const userPrompt = `Generate a comprehensive ${numberOfDays}-day ${guideType.toLowerCase()} travel guide for ${locationDescription}.

**Guide Requirements:**
- Budget Type: ${budgetType}
- Categories/Themes: ${categoriesText}${bestTimeText}
- Number of Days: ${numberOfDays}${locationInstruction}

**Instructions:**
1. Create an engaging title for this travel guide
2. Write a compelling 2-3 paragraph description highlighting what makes this destination special
3. For each day (${numberOfDays} days total), create a detailed itinerary section with:
   - Day title (e.g., "Day 1: Arrival and City Exploration")
   - Brief day description
   ${locationType === "multi" ? "- Location identifier (departure/arrival/city name)\n   " : ""}- 3-5 recommended places to visit with:
     * Place name
     * Brief description/tips
     * Suggested time of day (morning, afternoon, or evening)
   - Mix of activities covering the selected categories: ${categoriesText}

**Important:**
- Follow the JSON schema provided in the system prompt exactly
- Include all ${numberOfDays} days as separate sections
- Mix morning, afternoon, and evening activities
- Tailor recommendations to ${budgetType} budget
- Focus on categories: ${categoriesText}
- Make it practical and actionable`;

  // Combine system prompt with user prompt
  return `${systemPrompt}\n\n---\n\n${userPrompt}`;
}

function parseAIGeneratedGuide(
  content: string
): AIGeneratedGuide {
  try {
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```")) {
      const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      } else {
        const firstBrace = jsonContent.indexOf("{");
        const lastBrace = jsonContent.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
        }
      }
    }

    const parsed = JSON.parse(jsonContent);

    // Handle nested structure: data.guide wrapper (new format)
    let guideData = parsed;
    if (parsed.data && parsed.data.guide) {
      guideData = parsed.data.guide;
    }

    // Extract title - handle both camelCase and PascalCase
    const title = guideData.title || guideData.Title || "";
    if (!title) {
      throw new Error("Invalid guide structure from AI: missing title");
    }

    // Extract description - handle both string and blocks format
    let description = "";
    if (guideData.description) {
      if (typeof guideData.description === "string") {
        description = guideData.description;
      } else if (Array.isArray(guideData.description)) {
        // Convert blocks to plain text
        description = guideData.description
          .map((block: any) => {
            if (block.type === "paragraph" && Array.isArray(block.children)) {
              return block.children.map((child: any) => child.text || "").join("");
            }
            return "";
          })
          .filter((text: string) => text)
          .join("\n\n");
      }
    } else if (guideData.Description) {
      if (typeof guideData.Description === "string") {
        description = guideData.Description;
      } else if (Array.isArray(guideData.Description)) {
        description = guideData.Description
          .map((block: any) => {
            if (block.type === "paragraph" && Array.isArray(block.children)) {
              return block.children.map((child: any) => child.text || "").join("");
            }
            return "";
          })
          .filter((text: string) => text)
          .join("\n\n");
      }
    }

    // Extract sections - handle both 'sections' and 'guide_sections'
    const sectionsArray = guideData.sections || guideData.guide_sections || [];
    if (!Array.isArray(sectionsArray) || sectionsArray.length === 0) {
      throw new Error("Invalid guide structure from AI: missing sections");
    }

    // Convert sections to expected format
    const sections = sectionsArray.map((section: any, index: number) => {
      // Extract section title
      const sectionTitle = section.title || section.Title || `Day ${index + 1}`;

      // Extract section description
      let sectionDescription = "";
      if (section.description) {
        sectionDescription = typeof section.description === "string"
          ? section.description
          : "";
      } else if (section.Description) {
        sectionDescription = typeof section.Description === "string"
          ? section.Description
          : "";
      }

      // Extract places from Timeline structure (new format) or places array (old format)
      let places: AIGeneratedPlace[] = [];

      if (section.Timeline) {
        // New format: places are in Timeline.morning/afternoon/evening
        const timeline = typeof section.Timeline === "string"
          ? JSON.parse(section.Timeline)
          : section.Timeline;

        const allTimeSlots = [
          ...(timeline.morning || []),
          ...(timeline.afternoon || []),
          ...(timeline.evening || []),
        ];

        places = allTimeSlots.map((place: any) => ({
          name: place.name || "",
          formatted_address: place.formatted_address || "",
          place_id: place.place_id || "",
          types: Array.isArray(place.types) ? place.types : [],
          tips: place.tips || "",
          timeSlot: place.timeSlot || undefined,
        }));
      } else if (Array.isArray(section.places)) {
        // Old format: places array
        places = section.places.map((place: any) => ({
          name: place.name || "",
          formatted_address: place.formatted_address || "",
          place_id: place.place_id || "",
          types: Array.isArray(place.types) ? place.types : [],
          tips: place.tips || "",
          timeSlot: place.timeSlot || place.timeOfDay || undefined,
        }));
      }

      return {
        title: sectionTitle,
        sequence: section.sequence || section.Sequence || index + 1,
        description: sectionDescription,
        places: places,
        timeOfDay: section.timeOfDay || undefined,
        location: section.location || undefined,
      };
    });

    // Extract Tips_Notes and Guide_Tags if present
    const tipsNotes = guideData.Tips_Notes || guideData.tipsNotes || undefined;
    const guideTags = guideData.Guide_Tags || guideData.guideTags || undefined;

    return {
      title: title.trim(),
      description: description.trim(),
      sections,
      tipsNotes: tipsNotes,
      guideTags: Array.isArray(guideTags) ? guideTags : undefined,
    };
  } catch (error: any) {
    console.error("Parse error details:", error);
    throw new Error(
      `Failed to parse AI response: ${error.message || "The AI may have returned an invalid format. Please try again."}`
    );
  }
}

/**
 * Generate a single day itinerary section with AI
 * Uses the "single_day" pipeline for focused day-specific content
 * 
 * @param options - Options for single day generation
 * @returns AI-generated day section
 * 
 * @future This function is a placeholder for future enhancement
 * when users can add individual AI-generated day sections to existing guides
 */
export async function generateSingleDayWithAI(
  options: {
    locationName: string;
    dayNumber: number;
    categories: string[];
    budgetType: string;
    existingDays?: number; // Total days in the guide
  }
): Promise<AIGeneratedSection> {
  try {
    const token = localStorage.getItem("qrtoken");

    // Get system prompt for single_day pipeline
    const systemPrompt = getSystemPrompt("single_day");

    // Build user prompt
    const userPrompt = `Generate a detailed day ${options.dayNumber} itinerary for ${options.locationName}.
Focus on ${options.categories.join(", ")} activities with a ${options.budgetType} budget.
Include 3-5 places with specific tips and time slots (morning/afternoon/evening).

**Important:**
- Follow the JSON schema provided in the system prompt exactly
- Return ONLY the GuideSection object, not the full guide
- Ensure all timeline slots (morning, afternoon, evening) have at least 1 place each
- Every place must have actionable tips`;

    // Combine system prompt with user prompt
    const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const response = await axios.post<GeminiGenerateResponse>(
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
        timeout: 30000,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || response.data.error || "AI generation failed");
    }

    const generatedContent = response.data.data?.text || response.data.data?.generatedText || response.data.data?.response;

    if (!generatedContent) {
      throw new Error("No content generated by AI");
    }

    // Track AI guide request
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        const username = authData?.state?.user?.username;
        if (username) {
          import('./requestTrackingService').then(({ trackAIGuideRequest }) => {
            trackAIGuideRequest(username).catch(err => console.error('[Tracking] Failed:', err));
          });
        }
      }
    } catch (e) {
      console.error('[Tracking] Error:', e);
    }

    // Parse and return single section
    const parsed = JSON.parse(generatedContent);
    return {
      title: parsed.title || `Day ${options.dayNumber}`,
      sequence: options.dayNumber,
      description: parsed.description || "",
      places: Array.isArray(parsed.places) ? parsed.places : [],
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to generate single day with AI");
  }
}

/**
 * Generate activity suggestions for a specific day
 * Uses the "day_suggestion" pipeline for recommendation-focused content
 * 
 * @param options - Options for day suggestions
 * @returns Array of suggested activities
 * 
 * @future This function is a placeholder for future enhancement
 * when users need AI suggestions while editing day itineraries
 */
export async function generateDaySuggestionsWithAI(
  options: {
    locationName: string;
    timeSlot: "morning" | "afternoon" | "evening";
    categories: string[];
    budgetType: string;
    excludePlaces?: string[]; // Already added places to avoid duplicates
  }
): Promise<AIGeneratedPlace[]> {
  try {
    const token = localStorage.getItem("qrtoken");

    // Get system prompt for day_suggestion pipeline
    const systemPrompt = getSystemPrompt("day_suggestion");

    const excludeText = options.excludePlaces && options.excludePlaces.length > 0
      ? `Avoid suggesting: ${options.excludePlaces.join(", ")}.`
      : "";

    // Build user prompt
    const userPrompt = `Suggest 3-5 ${options.timeSlot} activities in ${options.locationName}.
Focus on ${options.categories.join(", ")} with a ${options.budgetType} budget.
${excludeText}

**Important:**
- Follow the JSON schema provided in the system prompt exactly
- Return only the places array
- Every place must have actionable tips`;

    // Combine system prompt with user prompt
    const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const response = await axios.post<GeminiGenerateResponse>(
      `${GEMINI_API_URL}/api/gemini/generate`,
      {
        prompt,
        model: "gemini-2.0-flash",
        pipeline: "day_suggestion",
      },
      {
        withCredentials: true, // Include cookies for user authentication
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        timeout: 20000, // Shorter timeout for suggestions
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || response.data.error || "AI generation failed");
    }

    const generatedContent = response.data.data?.text || response.data.data?.generatedText || response.data.data?.response;

    if (!generatedContent) {
      throw new Error("No content generated by AI");
    }

    // Parse and return places array
    const parsed = JSON.parse(generatedContent);
    return Array.isArray(parsed.places) ? parsed.places : [];
  } catch (error: any) {
    throw new Error(error.message || "Failed to generate day suggestions with AI");
  }
}

export default {
  generateGuideWithAI,
  generateSingleDayWithAI,
  generateDaySuggestionsWithAI,
};

