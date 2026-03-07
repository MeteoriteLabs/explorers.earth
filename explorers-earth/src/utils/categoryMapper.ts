/**
 * Enhanced category mapping utility
 * Maps Google Places API data to recommendation categories
 * Uses multiple strategies: rule-based mapping, primaryTypeDisplayName, and LLM fallback
 */

import axios from 'axios';

export interface PlaceCategoryData {
  placeName: string;
  types: string[];
  primaryType?: string;
  primaryTypeDisplayName?: string;
  formattedAddress?: string;
  rating?: number;
}

export interface CategoryMatch {
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  confidence: 'high' | 'medium' | 'low';
  method: 'rule-based' | 'llm';
}

/**
 * Enhanced mapping of Google Places types to category keywords
 * This is more comprehensive than the basic CATEGORY_MAPPINGS
 */
const ENHANCED_TYPE_MAPPINGS: Record<string, string[]> = {
  // Food & Drinks
  'restaurant': ['restaurant', 'dining', 'food', 'eatery', 'bistro', 'diner'],
  'cafe': ['cafe', 'coffee', 'coffee shop', 'espresso'],
  'bar': ['bar', 'pub', 'tavern', 'cocktail', 'lounge', 'brewery'],
  'bakery': ['bakery', 'pastry', 'bread', 'patisserie'],
  'meal_takeaway': ['takeaway', 'fast food', 'food delivery'],
  'food': ['food', 'restaurant', 'dining'],
  
  // Natural Features
  'beach': ['beach', 'shore', 'coast', 'seaside'],
  'park': ['park', 'garden', 'green space'],
  'hiking_area': ['hiking', 'trail', 'mountain', 'nature'],
  'natural_feature': ['nature', 'natural', 'landscape'],
  'campground': ['camping', 'campground', 'outdoor'],
  
  // Tourism & Attractions
  'tourist_attraction': ['attraction', 'tourist', 'landmark', 'sightseeing'],
  'museum': ['museum', 'gallery', 'exhibition', 'art'],
  'zoo': ['zoo', 'wildlife', 'animals'],
  'aquarium': ['aquarium', 'marine', 'fish'],
  'amusement_park': ['amusement', 'theme park', 'entertainment'],
  'art_gallery': ['art', 'gallery', 'exhibition'],
  
  // Lodging
  'lodging': ['hotel', 'accommodation', 'resort', 'inn', 'hostel', 'stay'],
  
  // Entertainment
  'movie_theater': ['cinema', 'movie', 'theater', 'film'],
  'night_club': ['nightclub', 'club', 'nightlife'],
  'casino': ['casino', 'gambling'],
  'bowling_alley': ['bowling'],
  'stadium': ['stadium', 'sports', 'arena'],
  
  // Shopping
  'shopping_mall': ['mall', 'shopping', 'retail'],
  'store': ['store', 'shop', 'retail'],
  'market': ['market', 'bazaar', 'shopping'],
  
  // Health & Wellness
  'gym': ['gym', 'fitness', 'workout', 'exercise'],
  'spa': ['spa', 'wellness', 'massage', 'relaxation'],
  'hospital': ['hospital', 'medical', 'healthcare'],
  'pharmacy': ['pharmacy', 'drugstore', 'medicine'],
  
  // Transportation
  'transit_station': ['station', 'transit', 'transport'],
  'gas_station': ['gas', 'fuel', 'petrol'],
  'parking': ['parking', 'car park'],
  
  // Services
  'bank': ['bank', 'financial'],
  'atm': ['atm', 'cash machine'],
  'post_office': ['post office', 'mail', 'postal'],
  'library': ['library', 'books'],
};

/**
 * Maps a category name to potential Google Places types
 * This is the reverse mapping for better matching
 */
const CATEGORY_TO_TYPES: Record<string, string[]> = {
  'Food & Drinks': ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'food'],
  'Natural Features': ['beach', 'park', 'hiking_area', 'natural_feature', 'campground'],
  'Tourism': ['tourist_attraction', 'museum', 'zoo', 'aquarium', 'amusement_park', 'art_gallery'],
  'Lodging': ['lodging'],
  'Entertainment': ['movie_theater', 'night_club', 'casino', 'bowling_alley', 'stadium', 'amusement_park'],
  'Shopping': ['shopping_mall', 'store', 'market'],
  'Health & Wellness': ['gym', 'spa', 'hospital', 'pharmacy'],
  'Transportation': ['transit_station', 'gas_station', 'parking'],
  'Services': ['bank', 'atm', 'post_office', 'library'],
};

/**
 * Normalizes text for comparison (removes special chars, lowercases)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds matching category using rule-based approach
 * This is fast and free, covers most common cases
 */
export function findCategoryByRules(
  placeData: PlaceCategoryData,
  availableCategories: Array<{
    Category_Name: string;
    documentId: string;
    recommendation_sub_categories: Array<{
      sub_category: string;
      documentId: string;
    }>;
  }>
): CategoryMatch | null {
  const { placeName, types, primaryType, primaryTypeDisplayName } = placeData;
  
  // Combine all searchable text
  const searchTexts = [
    ...types,
    primaryType || '',
    primaryTypeDisplayName || '',
    placeName || '',
  ].filter(Boolean).map(normalizeText);

  // Try to match against subcategories first (more specific)
  for (const category of availableCategories) {
    const categoryName = normalizeText(category.Category_Name);
    
    // Check if any type matches the category
    const categoryMatches = CATEGORY_TO_TYPES[category.Category_Name] || [];
    const hasCategoryMatch = searchTexts.some(text => 
      categoryMatches.some(type => text.includes(normalizeText(type)) || normalizeText(type).includes(text))
    );

    if (hasCategoryMatch || searchTexts.some(text => text.includes(categoryName) || categoryName.includes(text))) {
      // Now try to find the best matching subcategory
      for (const subcategory of category.recommendation_sub_categories || []) {
        const subcategoryName = normalizeText(subcategory.sub_category);
        
        // Check if any search text matches the subcategory
        const hasMatch = searchTexts.some(text => {
          // Direct match
          if (text === subcategoryName || subcategoryName === text) return true;
          
          // Contains match
          if (text.includes(subcategoryName) || subcategoryName.includes(text)) return true;
          
          // Check enhanced mappings
          for (const [key, keywords] of Object.entries(ENHANCED_TYPE_MAPPINGS)) {
            if (keywords.some(keyword => 
              normalizeText(keyword) === text || 
              text.includes(normalizeText(keyword)) ||
              normalizeText(keyword).includes(text)
            )) {
              // Check if this keyword matches the subcategory
              if (subcategoryName.includes(normalizeText(key)) || 
                  normalizeText(key).includes(subcategoryName)) {
                return true;
              }
            }
          }
          
          return false;
        });

        if (hasMatch) {
          return {
            categoryId: category.documentId,
            categoryName: category.Category_Name,
            subcategoryId: subcategory.documentId,
            subcategoryName: subcategory.sub_category,
            confidence: 'high',
            method: 'rule-based',
          };
        }
      }
      
      // If category matches but no subcategory, return first subcategory with medium confidence
      if (category.recommendation_sub_categories && category.recommendation_sub_categories.length > 0) {
        return {
          categoryId: category.documentId,
          categoryName: category.Category_Name,
          subcategoryId: category.recommendation_sub_categories[0].documentId,
          subcategoryName: category.recommendation_sub_categories[0].sub_category,
          confidence: 'medium',
          method: 'rule-based',
        };
      }
    }
  }

  return null;
}

/**
 * Uses LLM to categorize a place when rule-based matching fails
 * This is a low-cost operation using a focused prompt
 */
export async function findCategoryByLLM(
  placeData: PlaceCategoryData,
  availableCategories: Array<{
    Category_Name: string;
    documentId: string;
    recommendation_sub_categories: Array<{
      sub_category: string;
      documentId: string;
    }>;
  }>
): Promise<CategoryMatch | null> {
  try {
    const placeName = (placeData.placeName || '').toLowerCase();
    
    // Enhanced keyword detection with regex patterns for better matching
    // IMPORTANT: Order matters - more specific patterns first
    const keywordPatterns: Array<{ pattern: RegExp | string; categories: string[] }> = [
      // Historical/Religious places (check first - most specific)
      { pattern: /imambara|imambarah|mosque|masjid|dargah|shrine|tomb|mausoleum/i, categories: ['Places of Worship', 'Culture'] },
      { pattern: /temple|mandir|gurudwara|church|cathedral|synagogue|monastery/i, categories: ['Places of Worship', 'Culture'] },
      { pattern: /darwaza|gate|arch|monument|memorial|heritage|historical|landmark|ruins|archaeological|fort|palace/i, categories: ['Culture'] },
      { pattern: /museum|gallery|exhibition|art|artifacts/i, categories: ['Culture'] },
      // Natural features
      { pattern: /beach|coast|shore|seaside|seashore/i, categories: ['Natural Features'] },
      { pattern: /trail|hiking|trekking|viewpoint|overlook|waterfall|mountain/i, categories: ['Natural Features'] },
      { pattern: /park|garden|nature|reserve|sanctuary|botanical/i, categories: ['Natural Features', 'Entertainment and Recreation'] },
      // Lodging
      { pattern: /hotel|resort|lodge|inn|motel|hostel|accommodation/i, categories: ['Lodging'] },
      // Food
      { pattern: /restaurant|cafe|bistro|diner|eatery|food|bar|pub|grill|dining/i, categories: ['Food and Drink'] },
      // Shopping
      { pattern: /mall|shop|store|market|bazaar|retail/i, categories: ['Shopping'] },
      // Sports
      { pattern: /gym|fitness|sports|stadium|arena|athletic/i, categories: ['Sports'] },
      // Health
      { pattern: /hospital|clinic|health|wellness|pharmacy|medical/i, categories: ['Health and Wellness'] },
      // Education
      { pattern: /school|university|college|education|library|academic/i, categories: ['Education'] },
      // Transportation
      { pattern: /airport|station|transport|bus|train|ferry|transit/i, categories: ['Transportation'] },
      // Government
      { pattern: /government|office|hall|court|police|fire|municipal/i, categories: ['Government'] },
      // Housing
      { pattern: /apartment|housing|residential|dormitory|hostel/i, categories: ['Housing'] },
      // Automotive
      { pattern: /automotive|car|vehicle|gas|parking|garage/i, categories: ['Automotive'] },
    ];
    
    // Find matching categories based on place name AND metadata
    const matchedCategoryNames = new Set<string>();
    
    // Combine place name and metadata for keyword matching
    const searchTexts = [
      placeName,
      placeData.primaryTypeDisplayName || '',
      placeData.primaryType || '',
      ...(placeData.types || [])
    ].filter(Boolean).map(t => t.toLowerCase());
    
    keywordPatterns.forEach(({ pattern, categories }) => {
      // Check if pattern matches any of the search texts (name or metadata)
      const matches = searchTexts.some(text => {
        return typeof pattern === 'string' 
          ? text.includes(pattern.toLowerCase())
          : pattern.test(text);
      });
      if (matches) {
        categories.forEach(cat => matchedCategoryNames.add(cat));
      }
    });
    
    // Filter categories - ALWAYS limit to prevent huge prompts
    let filteredCategories: typeof availableCategories = [];
    
    if (matchedCategoryNames.size > 0) {
      // If we found keyword matches, use only those categories (max 5)
      filteredCategories = availableCategories
        .filter(cat => matchedCategoryNames.has(cat.Category_Name))
        .slice(0, 5); // Limit to 5 even when matched
    } else {
      // No keyword match - use top 6 most common categories (sorted by subcategory count)
      // BUT always include Culture and Places of Worship as fallback for historical/religious places
      const sortedCategories = [...availableCategories]
        .sort((a, b) => (b.recommendation_sub_categories?.length || 0) - (a.recommendation_sub_categories?.length || 0));
      
      // Always include Culture and Places of Worship if they exist (for historical/religious places)
      const cultureCategory = availableCategories.find(cat => 
        cat.Category_Name === 'Culture' || cat.Category_Name === 'Places of Worship'
      );
      const worshipCategory = availableCategories.find(cat => 
        cat.Category_Name === 'Places of Worship'
      );
      
      // Take top 6, but ensure Culture and Places of Worship are included
      filteredCategories = sortedCategories.slice(0, 6);
      
      // Add Culture and Places of Worship if not already included
      if (cultureCategory && !filteredCategories.find(c => c.documentId === cultureCategory.documentId)) {
        filteredCategories.pop(); // Remove last one
        filteredCategories.push(cultureCategory);
      }
      if (worshipCategory && !filteredCategories.find(c => c.documentId === worshipCategory.documentId)) {
        filteredCategories.pop(); // Remove last one
        filteredCategories.push(worshipCategory);
      }
      
      // Limit to 6 total
      filteredCategories = filteredCategories.slice(0, 6);
    }
    
    // Limit subcategories per category to keep prompt small (max 4 per category)
    const limitedCategories = filteredCategories.map(cat => ({
      ...cat,
      recommendation_sub_categories: (cat.recommendation_sub_categories || []).slice(0, 4)
    }));

    // Ultra-compact format: "Cat|id:sub1|id1,sub2|id2" (single line per category)
    const categoryMap = limitedCategories.map(cat => {
      const subcats = (cat.recommendation_sub_categories || [])
        .map(sub => `${sub.sub_category}|${sub.documentId}`)
        .join(',');
      return `${cat.Category_Name}|${cat.documentId}${subcats ? ':' + subcats : ''}`;
    }).join('\n');

    // Estimate token count (rough: 1 token ≈ 4 characters for English text)
    // Include Google Places metadata for better context
    const addressContext = placeData.formattedAddress ? `\nLocation: ${placeData.formattedAddress}` : '';
    
    // Build metadata section from Google Places API data
    // Optimize: Use both name and metadata intelligently
    let metadataSection = '';
    const metadataParts: string[] = [];
    
    // Debug: Log what metadata we have
    console.log('Place metadata available:', {
      primaryTypeDisplayName: placeData.primaryTypeDisplayName,
      primaryType: placeData.primaryType,
      types: placeData.types,
      rating: placeData.rating
    });
    
    // Check if primaryType is too generic (like "Building", "Establishment", "Premise")
    const genericTypes = ['building', 'establishment', 'premise', 'point_of_interest', 'locality'];
    const isGenericPrimaryType = placeData.primaryTypeDisplayName ? 
      genericTypes.some(g => placeData.primaryTypeDisplayName!.toLowerCase().includes(g)) : false;
    
    if (placeData.primaryTypeDisplayName) {
      if (isGenericPrimaryType) {
        // If primary type is generic, emphasize that types array is more important
        metadataParts.push(`Primary Type: ${placeData.primaryTypeDisplayName} (generic - check Types below)`);
      } else {
        metadataParts.push(`Primary Type: ${placeData.primaryTypeDisplayName}`);
      }
    }
    
    // Always prioritize types array when primaryType is generic
    if (placeData.types && placeData.types.length > 0) {
      // Filter out generic types and show only meaningful ones
      const meaningfulTypes = placeData.types.filter(t => 
        !['point_of_interest', 'establishment', 'locality', 'political', 'geocode', 'neighborhood', 'premise'].includes(t)
      );
      if (meaningfulTypes.length > 0) {
        metadataParts.push(`Types: ${meaningfulTypes.slice(0, 6).join(', ')}${isGenericPrimaryType ? ' (MOST IMPORTANT - use these instead of Primary Type)' : ''}`);
      } else if (placeData.types.length > 0) {
        // If all types were filtered out, show first few anyway
        metadataParts.push(`Types: ${placeData.types.slice(0, 4).join(', ')}`);
      }
    }
    
    if (placeData.primaryType && placeData.primaryType !== placeData.primaryTypeDisplayName && !isGenericPrimaryType) {
      metadataParts.push(`Type Code: ${placeData.primaryType}`);
    }
    
    if (placeData.rating) {
      metadataParts.push(`Rating: ${placeData.rating}/5`);
    }
    
    // Build optimized metadata section
    if (metadataParts.length > 0) {
      const metadataGuidance = isGenericPrimaryType 
        ? `\nCRITICAL: Primary Type is generic. Use the "Types" array above to determine the actual category.`
        : `\nUse metadata to determine category. Primary Type is usually most reliable.`;
      
      metadataSection = `\n\nMetadata from Google Places API:
${metadataParts.join('\n')}${metadataGuidance}

Category Mapping Guide:
- Types include "mosque", "hindu_temple", "church" → Places of Worship
- Types include "tourist_attraction", "museum", "art_gallery" → Culture  
- Types include "lodging", "hotel" → Lodging
- Types include "restaurant", "cafe", "bar" → Food and Drink
- Types include "beach", "natural_feature", "park" → Natural Features`;
    } else {
      console.warn('No metadata available for place:', placeData.placeName);
      metadataSection = `\n\nNote: No metadata available. Categorize based on place name and location.`;
    }
    
    // Optimized prompt - concise but clear
    const promptBase = `Categorize using name AND metadata.

Place: "${placeData.placeName}"${addressContext}${metadataSection}

Categories:
${categoryMap}

Rules:
1. Use metadata Types array (most reliable) - if Primary Type is generic like "Building", ignore it
2. Match category based on what place IS (from metadata), not name keywords
3. Return ONLY IDs (alphanumeric after |), NOT names
4. Return: {"categoryId":"id","subcategoryId":"id"}`;
    
    const estimatedTokens = Math.ceil(promptBase.length / 4);
    
    // If still too large (>450 tokens), further reduce
    if (estimatedTokens > 450) {
      // Reduce to 4 categories with max 3 subcategories each
      const furtherReduced = limitedCategories.slice(0, 4).map(cat => ({
        ...cat,
        recommendation_sub_categories: (cat.recommendation_sub_categories || []).slice(0, 3)
      }));
      
      const reducedMap = furtherReduced.map(cat => {
        const subcats = (cat.recommendation_sub_categories || [])
          .map(sub => `${sub.sub_category}|${sub.documentId}`)
          .join(',');
        return `${cat.Category_Name}|${cat.documentId}${subcats ? ':' + subcats : ''}`;
      }).join('\n');
      
      const addressContext = placeData.formattedAddress ? `\nLocation: ${placeData.formattedAddress}` : '';
      
      // Build compact metadata for reduced prompt
      let compactMetadata = '';
      if (placeData.primaryTypeDisplayName) {
        compactMetadata = `\n\nMetadata: Primary Type = "${placeData.primaryTypeDisplayName}" (USE THIS - it's more reliable than the name)`;
      }
      
      const prompt = `Categorize using name AND metadata.

Place: "${placeData.placeName}"${addressContext}${compactMetadata}

Categories:
${reducedMap}

Rules:
1. Use metadata Types (most reliable) - ignore generic Primary Types like "Building"
2. Return ONLY IDs (after |), NOT names
3. Return: {"categoryId":"id","subcategoryId":"id"}`;
      
      return await makeLLMRequest(prompt, availableCategories, placeData);
    }

    // Use the optimized prompt
    const prompt = promptBase;

    return await makeLLMRequest(prompt, availableCategories, placeData);
  } catch (error) {
    console.error('LLM category matching failed:', error);
    return null;
  }
}

/**
 * Helper function to make LLM API request and parse response
 * Extracted to avoid code duplication
 */
async function makeLLMRequest(
  prompt: string,
  availableCategories: Array<{
    Category_Name: string;
    documentId: string;
    recommendation_sub_categories: Array<{
      sub_category: string;
      documentId: string;
    }>;
  }>,
  placeData: PlaceCategoryData // Add placeData parameter for metadata-based subcategory matching
): Promise<CategoryMatch | null> {
  // Call your AI service - use the same API URL pattern as other services
  const API_URL = import.meta.env.VITE_PAYMENT_API_URL || import.meta.env.VITE_GEMINI_API_URL || "http://localhost:5000";
  
  try {
    const response = await axios.post(
      `${API_URL}/api/gemini/generate`,
      {
        prompt,
        model: 'gemini-2.0-flash-lite', // Use the cheapest/fastest available model
        includeSystemPrompt: false, // Skip system prompt to reduce tokens
        // Ensure no conversation history - each call is independent
        conversationHistory: [], // Explicitly empty to prevent context from previous calls
        temperature: 0.3, // Lower temperature for more consistent, accurate responses
      },
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout for quick response
      }
    );

    const responseData = response.data;

    // Check if response has error
    if (responseData.success === false || responseData.error) {
      console.warn('LLM category matching failed:', responseData.error || 'Unknown error');
      return null;
    }

    let generatedText = '';

    // Handle different response structures (matching aiGuideService.ts pattern)
    if (responseData.data && typeof responseData.data === 'object') {
      // Nested data structure: { success: true, data: { text, ... } }
      generatedText = responseData.data.text || responseData.data.generatedText || '';
    } else if (responseData.text) {
      // Flat structure: { text, ... }
      generatedText = responseData.text;
    } else if (typeof responseData === 'string') {
      // Plain text response
      generatedText = responseData;
    } else {
      console.warn('LLM category matching: Unexpected response format');
      return null;
    }

    if (!generatedText) {
      return null;
    }

    // Extract JSON from response (handle markdown code blocks like ```json ... ```)
    // Remove markdown code block markers if present
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith('```')) {
      // Remove opening ```json or ```
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '');
      // Remove closing ```
      cleanedText = cleanedText.replace(/\s*```$/i, '');
    }
    
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('LLM category matching: No JSON found in response', cleanedText);
      return null;
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.warn('LLM category matching: Failed to parse JSON', jsonMatch[0], parseError);
      return null;
    }
    
    // Check if we have at least categoryId (subcategoryId can be empty, we'll handle it)
    if (result.error || !result.categoryId) {
      console.warn('LLM category matching: Missing categoryId', result);
      return null;
    }

    // Handle case where LLM returns names instead of IDs
    let categoryId = result.categoryId;
    let subcategoryId = result.subcategoryId || ''; // Handle empty subcategoryId
    
    // If categoryId looks like a name (contains spaces or is short), try to find by name
    if (categoryId.includes(' ') || categoryId.length < 10) {
      const categoryByName = availableCategories.find(cat => 
        cat.Category_Name.toLowerCase() === categoryId.toLowerCase().trim()
      );
      if (categoryByName) {
        categoryId = categoryByName.documentId;
        console.log('LLM returned category name, converted to ID:', categoryByName.Category_Name, '→', categoryId);
      } else {
        console.warn('LLM returned category name not found:', result.categoryId);
        return null;
      }
    }
    
    // Find the category by ID
    const category = availableCategories.find(cat => cat.documentId === categoryId);
    if (!category) {
      console.warn('LLM category matching: Category not found by ID', categoryId);
      return null;
    }

    // Handle subcategoryId - it might be null, empty, a name, or an ID
    if (!subcategoryId || subcategoryId === null || subcategoryId === 'null' || subcategoryId.trim() === '') {
      // Empty/null subcategoryId - try to find best match based on metadata, then fallback to first
      let bestSubcategory = null;
      
      // Try to match based on metadata if available
      if (placeData.primaryTypeDisplayName || (placeData.types && placeData.types.length > 0)) {
        const searchText = [
          placeData.primaryTypeDisplayName || '',
          ...(placeData.types || [])
        ].filter(Boolean).map(t => t.toLowerCase());
        
        // Find subcategory that matches metadata
        bestSubcategory = category.recommendation_sub_categories?.find(sub => {
          const subName = sub.sub_category.toLowerCase();
          return searchText.some(text => 
            text.includes(subName) || 
            subName.includes(text) ||
            // Special mappings
            (text.includes('historical') && (subName.includes('monument') || subName.includes('landmark') || subName.includes('historical'))) ||
            (text.includes('landmark') && (subName.includes('monument') || subName.includes('landmark') || subName.includes('historical'))) ||
            (text.includes('mosque') && subName.includes('mosque')) ||
            (text.includes('temple') && subName.includes('temple'))
          );
        });
      }
      
      if (bestSubcategory) {
        subcategoryId = bestSubcategory.documentId;
        console.log('LLM returned null subcategoryId, matched from metadata:', bestSubcategory.sub_category);
      } else if (category.recommendation_sub_categories && category.recommendation_sub_categories.length > 0) {
        // Fallback to first subcategory
        subcategoryId = category.recommendation_sub_categories[0].documentId;
        console.log('LLM returned null subcategoryId, using first subcategory:', category.recommendation_sub_categories[0].sub_category);
      } else {
        console.warn('LLM returned null subcategoryId and category has no subcategories');
        return null;
      }
    } else if (subcategoryId.includes(' ') || subcategoryId.length < 10) {
      // subcategoryId looks like a name - try to find by name
      const subcategoryByName = category.recommendation_sub_categories?.find(
        sub => sub.sub_category.toLowerCase() === subcategoryId.toLowerCase().trim()
      );
      if (subcategoryByName) {
        subcategoryId = subcategoryByName.documentId;
        console.log('LLM returned subcategory name, converted to ID:', subcategoryByName.sub_category, '→', subcategoryId);
      } else {
        // Name not found - try metadata matching, then fallback to first
        let bestSubcategory = null;
        if (placeData.primaryTypeDisplayName || (placeData.types && placeData.types.length > 0)) {
          const searchText = [
            placeData.primaryTypeDisplayName || '',
            subcategoryId,
            ...(placeData.types || [])
          ].filter(Boolean).map(t => t.toLowerCase());
          
          bestSubcategory = category.recommendation_sub_categories?.find(sub => {
            const subName = sub.sub_category.toLowerCase();
            return searchText.some(text => text.includes(subName) || subName.includes(text));
          });
        }
        
        if (bestSubcategory) {
          subcategoryId = bestSubcategory.documentId;
          console.log('LLM returned subcategory name not found, matched from metadata:', bestSubcategory.sub_category);
        } else if (category.recommendation_sub_categories && category.recommendation_sub_categories.length > 0) {
          subcategoryId = category.recommendation_sub_categories[0].documentId;
          console.log('LLM returned subcategory name not found, using first subcategory:', category.recommendation_sub_categories[0].sub_category);
        } else {
          return null;
        }
      }
    }

    // Find subcategory by ID
    const subcategory = category.recommendation_sub_categories?.find(
      sub => sub.documentId === subcategoryId
    );
    if (!subcategory) {
      console.warn('LLM category matching: Subcategory not found by ID', subcategoryId);
      return null;
    }

    console.log('LLM category match found:', {
      categoryId,
      categoryName: category.Category_Name,
      subcategoryId,
      subcategoryName: subcategory.sub_category
    });

    return {
      categoryId: categoryId,
      categoryName: category.Category_Name,
      subcategoryId: subcategoryId,
      subcategoryName: subcategory.sub_category,
      confidence: 'high',
      method: 'llm',
    };
  } catch (apiError: any) {
    // Handle API errors gracefully
    if (apiError.response?.data?.error) {
      console.warn('LLM category matching failed:', apiError.response.data.error);
    } else {
      console.warn('LLM category matching failed:', apiError.message || 'Unknown error');
    }
    return null;
  }
}

/**
 * Main function to find category - uses LLM as primary method for accurate categorization
 * Falls back to rule-based only if LLM fails
 * This ensures accurate categorization even when Google types are generic/outdated
 */
export async function findPlaceCategory(
  placeData: PlaceCategoryData,
  availableCategories: Array<{
    Category_Name: string;
    documentId: string;
    recommendation_sub_categories: Array<{
      sub_category: string;
      documentId: string;
    }>;
  }>,
  options: {
    useLLMPrimary?: boolean; // Use LLM as primary method (default: true)
    useRuleBasedFallback?: boolean; // Fallback to rule-based if LLM fails (default: true)
    enableCache?: boolean; // Future: cache results (not implemented yet)
  } = {}
): Promise<CategoryMatch | null> {
  const { useLLMPrimary = true, useRuleBasedFallback = true } = options;

  // Use LLM as primary method for accurate categorization
  if (useLLMPrimary) {
    const llmMatch = await findCategoryByLLM(placeData, availableCategories);
    if (llmMatch) {
      return llmMatch;
    }
  }

  // Fallback to rule-based if LLM failed or is disabled
  if (useRuleBasedFallback) {
    const ruleBasedMatch = findCategoryByRules(placeData, availableCategories);
    if (ruleBasedMatch) {
      return ruleBasedMatch;
    }
  }

  return null;
}

