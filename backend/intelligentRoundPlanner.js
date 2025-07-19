/**
 * Intelligent Round Planner - AI-driven POI type selection and knowledge base querying
 * Uses AI to analyze preferences and dynamically plan optimal POI discovery rounds
 */

import { OpenAI } from 'openai';
import { hasEnhancedFeatures, getEnhancedNearbyPlaces } from './enhanced-chat-tools.js';
import { 
  searchPOIsAdvanced, 
  getNearbyPOIs, 
  searchPOIsByType,
  getPOIStatistics 
} from './db-adapter.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_INTELLIGENT' : '🔍 DEV_INTELLIGENT';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

/**
 * Extract JSON from AI response that may contain markdown code blocks
 */
function extractJsonFromResponse(response) {
  // Try to extract JSON from markdown code blocks
  const jsonBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1];
  }
  
  // Try to find JSON object in the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  // Return original response if no patterns found
  return response;
}

/**
 * AI analyzes user preferences to create intelligent planning strategy
 */
export async function createIntelligentPlanStrategy(userPreferences, userLocation) {
  debugLog('Creating intelligent plan strategy', { userPreferences, hasLocation: !!userLocation });

  const systemPrompt = `You are a Rhodes travel planning expert. Analyze user preferences and create an intelligent POI discovery strategy.

AVAILABLE POI TYPES in our knowledge base:
- restaurant (tavernas, cafes, fine dining)
- beach (swimming, sunbathing, water sports)
- attraction (historical sites, museums, viewpoints)
- shopping (markets, boutiques, souvenirs)
- bar (nightlife, cocktails, local drinks)
- cultural (churches, monasteries, traditional areas)
- nature (parks, hiking trails, natural landmarks)
- accommodation (hotels for reference/context)

TASK: Create a 3-4 round strategy that logically builds a perfect day based on user preferences.

Consider:
- Time flow (morning → afternoon → evening)
- Spatial relationships (group nearby POIs)
- User energy levels and interests
- Authentic vs tourist preferences
- Group composition (solo, couple, family)
- Transportation method

Return a JSON strategy with this exact structure:
{
  "strategy": {
    "rationale": "Brief explanation of why this sequence works",
    "rounds": [
      {
        "roundNumber": 1,
        "poiType": "restaurant",
        "title": "Perfect start with authentic dining",
        "reasoning": "Why this POI type first",
        "expectedSelections": 1,
        "searchCriteria": {
          "filters": ["family-owned", "traditional"],
          "timeContext": "breakfast",
          "atmospherePreference": "authentic"
        }
      }
    ]
  }
}`;

  const userPreferencesText = Object.entries(userPreferences)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `User preferences:\n${userPreferencesText}\n\nCreate an intelligent 3-4 round POI discovery strategy for Rhodes.` }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    const jsonString = extractJsonFromResponse(response);
    const strategy = JSON.parse(jsonString);

    debugLog('AI strategy created', { 
      roundCount: strategy.strategy.rounds.length,
      rationale: strategy.strategy.rationale 
    });

    return {
      success: true,
      strategy: strategy.strategy,
      aiGenerated: true
    };

  } catch (error) {
    debugLog(`Strategy creation failed: ${error.message}`);
    
    // Fallback to rule-based strategy
    return createFallbackStrategy(userPreferences);
  }
}

/**
 * Execute intelligent round - AI decides what POIs to query from knowledge base
 */
export async function executeIntelligentRound(roundConfig, userPreferences, userLocation, selectedPOIs) {
  debugLog(`Executing intelligent round ${roundConfig.roundNumber}`, {
    poiType: roundConfig.poiType,
    hasSearchCriteria: !!roundConfig.searchCriteria
  });

  try {
    // Step 1: AI crafts intelligent knowledge base query
    const kbQuery = await craftIntelligentKBQuery(roundConfig, userPreferences, userLocation, selectedPOIs);
    
    // Step 2: Execute query against PostgreSQL knowledge base
    const kbResults = await executeKnowledgeBaseQuery(kbQuery, userLocation);
    
    // Step 3: AI filters and ranks results for this specific round
    const intelligentResults = await aiFilterAndRankResults(kbResults, roundConfig, userPreferences, selectedPOIs);

    return {
      success: true,
      round: {
        number: roundConfig.roundNumber,
        type: roundConfig.poiType,
        title: roundConfig.title,
        reasoning: roundConfig.reasoning,
        expectedSelections: roundConfig.expectedSelections
      },
      recommendations: intelligentResults,
      queryUsed: kbQuery,
      source: 'intelligent_ai_kb',
      metadata: {
        totalFound: kbResults.length,
        aiFiltered: intelligentResults.length,
        queryStrategy: kbQuery.strategy
      }
    };

  } catch (error) {
    debugLog(`Intelligent round execution failed: ${error.message}`);
    
    // Fallback to enhanced search
    return await executeFallbackRound(roundConfig, userPreferences, userLocation, selectedPOIs);
  }
}

/**
 * AI crafts intelligent knowledge base query based on round context
 */
async function craftIntelligentKBQuery(roundConfig, userPreferences, userLocation, selectedPOIs) {
  debugLog('Crafting intelligent KB query', { 
    roundType: roundConfig.poiType,
    selectedPOIsCount: selectedPOIs.length 
  });

  const systemPrompt = `You are a Rhodes knowledge base query expert. Craft intelligent database queries to find the perfect POIs.

ROUND CONTEXT:
- POI Type: ${roundConfig.poiType}
- Round Title: ${roundConfig.title}
- Search Criteria: ${JSON.stringify(roundConfig.searchCriteria)}
- User has already selected: ${selectedPOIs.map(p => p.name).join(', ') || 'none'}

KNOWLEDGE BASE CAPABILITIES:
- Advanced spatial queries (distance, walking time, routes)
- Cultural significance filtering (authentic, tourist-friendly, local favorites)
- Amenity and tag filtering
- Rating and price level filtering
- Temporal context (opening hours, best times)

Create a query strategy that will find the most relevant POIs for this round.

Return JSON:
{
  "strategy": "brief description of query approach",
  "searchParameters": {
    "primaryType": "main POI type",
    "spatialContext": {
      "useLocation": true/false,
      "radiusMeters": number,
      "spatialRelationship": "near_user_location|near_selected_pois|specific_area"
    },
    "filters": {
      "authenticity": "local|mixed|tourist",
      "priceLevel": [1,2,3],
      "minRating": number,
      "tags": ["tag1", "tag2"],
      "excludeIds": "ids of already selected POIs"
    },
    "contextualBoosts": {
      "timeOfDay": "morning|afternoon|evening",
      "atmosphere": "romantic|family|social|quiet",
      "specialRequirements": ["parking", "sea-view", "traditional"]
    }
  }
}`;

  const contextText = `
User Preferences: ${JSON.stringify(userPreferences)}
User Location: ${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Not provided'}
Already Selected POIs: ${selectedPOIs.length > 0 ? selectedPOIs.map(p => `${p.name} (${p.type})`).join(', ') : 'None'}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText }
      ],
      temperature: 0.3,
      max_tokens: 600
    });

    const response = completion.choices[0].message.content;
    const jsonString = extractJsonFromResponse(response);
    const queryStrategy = JSON.parse(jsonString);

    debugLog('AI KB query crafted', { strategy: queryStrategy.strategy });

    return queryStrategy;

  } catch (error) {
    debugLog(`Query crafting failed: ${error.message}`);
    
    // Fallback to basic query structure
    return createFallbackQuery(roundConfig, userLocation, selectedPOIs);
  }
}

/**
 * Execute crafted query against PostgreSQL knowledge base
 */
async function executeKnowledgeBaseQuery(queryStrategy, userLocation) {
  debugLog('Executing KB query', { strategy: queryStrategy.strategy });

  try {
    const searchParams = queryStrategy.searchParameters;
    const hasEnhanced = await hasEnhancedFeatures();

    if (!hasEnhanced) {
      throw new Error('Enhanced KB features not available');
    }

    // Build search criteria for our enhanced POI system
    const criteria = {
      latitude: searchParams.spatialContext?.useLocation ? userLocation?.lat : null,
      longitude: searchParams.spatialContext?.useLocation ? userLocation?.lng : null,
      radius: searchParams.spatialContext?.radiusMeters || 5000,
      types: [searchParams.primaryType],
      limit: 15
    };

    // Add filters
    if (searchParams.filters) {
      if (searchParams.filters.minRating) criteria.minRating = searchParams.filters.minRating;
      if (searchParams.filters.priceLevel) criteria.priceLevel = searchParams.filters.priceLevel;
      if (searchParams.filters.tags) criteria.tags = searchParams.filters.tags;
      if (searchParams.filters.excludeIds) criteria.excludeIds = searchParams.filters.excludeIds;
    }

    // Execute advanced POI search
    const results = await searchPOIsAdvanced(criteria);

    debugLog('KB query executed', { 
      resultCount: results?.length || 0,
      queryType: 'searchPOIsAdvanced'
    });

    return results || [];

  } catch (error) {
    debugLog(`KB query execution failed: ${error.message}`);
    
    // Fallback to basic type search
    const basicResults = await searchPOIsByType(
      queryStrategy.searchParameters.primaryType,
      userLocation?.lat || 36.4341,
      userLocation?.lng || 28.2176,
      5000,
      10
    );

    return basicResults || [];
  }
}

/**
 * AI filters and ranks KB results for optimal round presentation
 */
async function aiFilterAndRankResults(kbResults, roundConfig, userPreferences, selectedPOIs) {
  if (!kbResults || kbResults.length === 0) return [];

  debugLog('AI filtering and ranking results', { 
    inputCount: kbResults.length,
    roundType: roundConfig.poiType 
  });

  const systemPrompt = `You are a Rhodes travel curation expert. Filter and rank POI results for optimal user experience.

ROUND CONTEXT:
- Round: ${roundConfig.title}
- POI Type: ${roundConfig.poiType}
- Expected Selections: ${roundConfig.expectedSelections}
- User already selected: ${selectedPOIs.map(p => p.name).join(', ') || 'none'}

TASK: From the provided POIs, select the best 4-5 that:
1. Match the round's purpose and user preferences
2. Offer variety while maintaining quality
3. Have good spatial distribution (not all clustered)
4. Complement already selected POIs
5. Provide authentic Rhodes experiences

Return POI IDs in ranked order (best first):
{
  "selectedPOIs": [
    {
      "id": "poi_id",
      "reasoning": "Why this POI is perfect for this round"
    }
  ],
  "curatorNotes": "Overall curation strategy explanation"
}`;

  const poiSummaries = kbResults.slice(0, 10).map(poi => ({
    id: poi.id,
    name: poi.name,
    type: poi.primary_type,
    rating: poi.rating,
    description: poi.description,
    tags: poi.tags,
    latitude: poi.latitude,
    longitude: poi.longitude
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `User Preferences: ${JSON.stringify(userPreferences)}\n\nPOIs to curate:\n${JSON.stringify(poiSummaries, null, 2)}` 
        }
      ],
      temperature: 0.4,
      max_tokens: 800
    });

    const response = completion.choices[0].message.content;
    const jsonString = extractJsonFromResponse(response);
    const curation = JSON.parse(jsonString);

    // Map selected IDs back to full POI objects
    const curatedPOIs = curation.selectedPOIs.map(selection => {
      const poi = kbResults.find(p => p.id == selection.id);
      return poi ? { ...poi, aiReasoning: selection.reasoning } : null;
    }).filter(Boolean);

    debugLog('AI curation complete', { 
      originalCount: kbResults.length,
      curatedCount: curatedPOIs.length,
      curatorNotes: curation.curatorNotes 
    });

    return curatedPOIs;

  } catch (error) {
    debugLog(`AI filtering failed: ${error.message}`);
    
    // Fallback to simple ranking by rating and relevance
    return kbResults
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);
  }
}

/**
 * Fallback strategy when AI planning fails
 */
function createFallbackStrategy(userPreferences) {
  debugLog('Creating fallback strategy');

  const fallbackRounds = [
    {
      roundNumber: 1,
      poiType: 'restaurant',
      title: 'Start with authentic dining 🍽️',
      reasoning: 'Food is essential and sets the cultural tone',
      expectedSelections: 1,
      searchCriteria: { atmospherePreference: 'authentic' }
    },
    {
      roundNumber: 2,
      poiType: 'beach',
      title: 'Relax at beautiful beaches 🏖️',
      reasoning: 'Rhodes is famous for its stunning coastline',
      expectedSelections: 1,
      searchCriteria: { timeContext: 'afternoon' }
    },
    {
      roundNumber: 3,
      poiType: 'attraction',
      title: 'Explore cultural treasures 🏛️',
      reasoning: 'Rich history and culture are Rhodes highlights',
      expectedSelections: 1,
      searchCriteria: { atmospherePreference: 'cultural' }
    }
  ];

  return {
    success: true,
    strategy: {
      rationale: 'Balanced fallback strategy covering food, beach, and culture',
      rounds: fallbackRounds
    },
    aiGenerated: false
  };
}

/**
 * Fallback query when AI query crafting fails
 */
function createFallbackQuery(roundConfig, userLocation, selectedPOIs) {
  return {
    strategy: 'Basic fallback query',
    searchParameters: {
      primaryType: roundConfig.poiType,
      spatialContext: {
        useLocation: !!userLocation,
        radiusMeters: 5000,
        spatialRelationship: 'near_user_location'
      },
      filters: {
        excludeIds: selectedPOIs.map(p => p.id || p.place_id).filter(Boolean)
      }
    }
  };
}

/**
 * Fallback round execution using enhanced tools
 */
async function executeFallbackRound(roundConfig, userPreferences, userLocation, selectedPOIs) {
  debugLog('Executing fallback round');

  try {
    const searchLocation = userLocation || { lat: 36.4341, lng: 28.2176 };
    const results = await getEnhancedNearbyPlaces({
      lat: searchLocation.lat,
      lng: searchLocation.lng,
      type: roundConfig.poiType,
      radius: 5000
    });

    return {
      success: true,
      round: {
        number: roundConfig.roundNumber,
        type: roundConfig.poiType,
        title: roundConfig.title,
        reasoning: roundConfig.reasoning,
        expectedSelections: roundConfig.expectedSelections
      },
      recommendations: results.slice(0, 5),
      source: 'fallback_enhanced',
      metadata: {
        totalFound: results.length,
        fallbackUsed: true
      }
    };

  } catch (error) {
    debugLog(`Fallback round failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}