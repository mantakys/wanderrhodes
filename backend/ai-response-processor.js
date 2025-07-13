/**
 * AI Response Processor
 * Handles OpenAI function calls and processes database results
 * for step-by-step POI recommendations
 */

import { aiDatabaseTools, EXCLUDED_POI_TYPES } from './ai-database-tools.js';

// Debug logging configuration
const DEBUG_ENABLED = true;
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_AI_PROC' : '🔍 DEV_AI_PROC';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

/**
 * Process OpenAI tool calls and return processed POI recommendations
 */
export async function processAIToolCalls(openaiResponse, excludeNames = [], excludeIds = []) {
  debugLog('Processing AI tool calls', {
    hasToolCalls: !!(openaiResponse.choices?.[0]?.message?.tool_calls),
    toolCallCount: openaiResponse.choices?.[0]?.message?.tool_calls?.length || 0,
    excludeNamesCount: excludeNames.length,
    excludeIdsCount: excludeIds.length
  });

  const toolCalls = openaiResponse.choices?.[0]?.message?.tool_calls || [];
  
  if (toolCalls.length === 0) {
    debugLog('No tool calls found in AI response');
    return [];
  }

  let allCandidates = [];
  let searchMetadata = {};

  // Execute each tool call
  for (const toolCall of toolCalls) {
    try {
      debugLog(`Executing tool call: ${toolCall.function.name}`);
      
      const toolFunction = aiDatabaseTools.find(t => t.name === toolCall.function.name);
      if (!toolFunction) {
        debugLog(`Unknown tool function: ${toolCall.function.name}`, {
          availableTools: aiDatabaseTools.map(t => t.name),
          requestedTool: toolCall.function.name
        });
        continue;
      }

      // Parse and validate parameters
      let params;
      try {
        params = JSON.parse(toolCall.function.arguments);
        debugLog(`Tool parameters parsed`, { 
          toolName: toolCall.function.name, 
          rawArgs: toolCall.function.arguments,
          parsedParams: params 
        });
      } catch (parseError) {
        debugLog(`Tool parameter parsing failed`, {
          toolName: toolCall.function.name,
          rawArgs: toolCall.function.arguments,
          parseError: parseError.message
        });
        continue;
      }

      // Validate required parameters
      debugLog(`Validating tool parameters`, {
        toolName: toolCall.function.name,
        hasUserInterests: !!(params.user_interests),
        hasBudget: !!(params.budget),
        hasLocation: !!(params.latitude && params.longitude),
        hasSelectedPOIs: !!(params.selected_pois),
        excludeNamesCount: params.exclude_poi_names?.length || 0
      });

      const result = await toolFunction.function(params);
      debugLog(`Tool execution completed`, { 
        toolName: toolCall.function.name,
        resultCount: result?.results?.length || 0,
        searchSuccess: result?.searchSuccess,
        searchRadius: result?.searchRadius,
        searchType: result?.searchType,
        hasError: !!result?.error
      });

      if (result?.results && Array.isArray(result.results)) {
        debugLog(`Adding candidates from tool`, {
          toolName: toolCall.function.name,
          candidatesAdded: result.results.length,
          sampleCandidates: result.results.slice(0, 2).map(r => ({ name: r.name, type: r.primary_type || r.type }))
        });
        
        allCandidates.push(...result.results);
        
        // Collect search metadata
        if (result.searchRadius) {
          searchMetadata.searchRadius = result.searchRadius;
          searchMetadata.searchAttempts = result.searchAttempts;
          searchMetadata.searchSuccess = result.searchSuccess;
          searchMetadata.searchType = result.searchType;
        }
      } else {
        debugLog(`Tool returned no valid results`, {
          toolName: toolCall.function.name,
          resultStructure: typeof result,
          hasResults: !!(result?.results),
          isArray: Array.isArray(result?.results),
          resultKeys: result ? Object.keys(result) : []
        });
      }

    } catch (error) {
      debugLog(`Tool execution failed: ${error.message}`, {
        toolName: toolCall.function.name,
        errorType: error.constructor.name,
        errorStack: error.stack
      });
    }
  }

  debugLog('All tool calls completed', { 
    totalCandidates: allCandidates.length,
    searchMetadata 
  });

  // Process and filter results
  const processedResults = await processAndFilterPOIs(allCandidates, excludeNames, excludeIds);
  
  // Add metadata to first result for debugging
  if (processedResults.length > 0 && searchMetadata.searchRadius) {
    processedResults[0].searchMetadata = searchMetadata;
  }

  return processedResults;
}

/**
 * Process, filter, and rank POI candidates
 */
async function processAndFilterPOIs(candidates, excludeNames = [], excludeIds = []) {
  debugLog('Processing and filtering POIs', { 
    candidateCount: candidates.length,
    excludeNamesCount: excludeNames.length,
    excludeIdsCount: excludeIds.length
  });

  if (!candidates || candidates.length === 0) {
    debugLog('No candidates to process');
    return [];
  }

  // Step 1: Basic filtering with enhanced logging
  let filtered = candidates.filter(poi => {
    if (!poi || !poi.name) {
      debugLog(`Filtered out invalid POI: ${JSON.stringify(poi)}`);
      return false;
    }
    
    // Exclude by name (case-insensitive)
    const excludeByName = excludeNames.some(excludeName => 
      excludeName.toLowerCase() === poi.name.toLowerCase()
    );
    if (excludeByName) {
      debugLog(`Excluded by name: ${poi.name} (matches exclude list)`);
      return false;
    }
    
    // Exclude by ID
    const poiId = poi.place_id || poi.id;
    if (poiId && excludeIds.includes(poiId)) {
      debugLog(`Excluded by ID: ${poi.name} (${poiId})`);
      return false;
    }
    
    // Exclude hotels and accommodations
    const poiType = (poi.primary_type || poi.type || '').toLowerCase();
    if (EXCLUDED_POI_TYPES.includes(poiType)) {
      debugLog(`Excluded hotel/accommodation: ${poi.name} (${poiType})`);
      return false;
    }
    
    return true;
  });

  debugLog('After basic filtering', { count: filtered.length });

  // Step 2: Deduplicate by place_id and name
  const seen = new Set();
  filtered = filtered.filter(poi => {
    const identifier = poi.place_id || poi.name;
    if (seen.has(identifier)) {
      debugLog(`Duplicate removed: ${poi.name}`);
      return false;
    }
    seen.add(identifier);
    return true;
  });

  debugLog('After deduplication', { count: filtered.length });

  // Step 3: Rank and score POIs
  const rankedPOIs = rankPOIs(filtered);
  
  // Step 4: Transform for frontend
  const transformedPOIs = transformPOIsForResponse(rankedPOIs);
  
  // Step 5: Return top 5
  const finalResults = transformedPOIs.slice(0, 5);
  
  debugLog('Processing completed', { 
    finalCount: finalResults.length,
    topPOIs: finalResults.map(p => ({ name: p.name, type: p.type, score: p.aiScore }))
  });

  return finalResults;
}

/**
 * Rank POIs based on various factors
 */
function rankPOIs(pois) {
  return pois.map(poi => {
    let score = 0;
    
    // Factor 1: Rating (if available)
    if (poi.rating) {
      score += (parseFloat(poi.rating) / 5.0) * 30; // 0-30 points
    } else {
      score += 15; // Default score for unrated POIs
    }
    
    // Factor 2: Distance (closer is better, if available)
    if (poi.distance_meters) {
      const distanceScore = Math.max(0, 20 - (poi.distance_meters / 100)); // Closer = higher score
      score += Math.min(distanceScore, 20); // Max 20 points
    } else {
      score += 10; // Default score when no distance
    }
    
    // Factor 3: POI type variety bonus
    const popularTypes = ['attraction', 'restaurant', 'beach', 'museum', 'historical_site'];
    if (popularTypes.includes(poi.primary_type || poi.type)) {
      score += 15;
    }
    
    // Factor 4: Description richness
    if (poi.description && poi.description.length > 100) {
      score += 10;
    }
    
    // Factor 5: Has highlights or tips
    if (poi.highlights && poi.highlights.length > 0) {
      score += 5;
    }
    if (poi.local_tips && poi.local_tips.length > 0) {
      score += 5;
    }
    
    return {
      ...poi,
      aiScore: Math.round(score)
    };
  }).sort((a, b) => b.aiScore - a.aiScore);
}

/**
 * Transform POI data to match expected frontend format
 */
function transformPOIsForResponse(pois) {
  if (!pois || !Array.isArray(pois)) {
    debugLog('Invalid POI data for transformation', { pois });
    return [];
  }
  
  return pois.map(poi => ({
    // Core POI data
    name: poi.name,
    type: poi.primary_type || poi.type,
    place_id: poi.place_id || poi.id,
    latitude: parseFloat(poi.latitude),
    longitude: parseFloat(poi.longitude),
    address: poi.address,
    rating: poi.rating ? parseFloat(poi.rating) : null,
    price_level: poi.price_level,
    
    // Contact information
    phone: poi.phone,
    website: poi.website,
    
    // Enhanced fields
    description: poi.description,
    highlights: poi.highlights || [],
    local_tips: poi.local_tips || [],
    amenities: poi.amenities || [],
    tags: poi.tags || [],
    
    // Distance information (if available)
    distance_meters: poi.distance_meters ? parseInt(poi.distance_meters) : null,
    
    // AI scoring
    aiScore: poi.aiScore || 0,
    
    // Location object for compatibility
    location: {
      address: poi.address,
      coordinates: {
        lat: parseFloat(poi.latitude),
        lng: parseFloat(poi.longitude)
      }
    },
    
    // Details object for compatibility  
    details: {
      openingHours: poi.opening_hours,
      priceRange: poi.price_level ? `Level ${poi.price_level}` : 'Not specified',
      rating: poi.rating ? parseFloat(poi.rating).toString() : 'Not rated'
    },
    
    // Search metadata (for first result only)
    ...(poi.searchMetadata && { searchMetadata: poi.searchMetadata })
  }));
}

/**
 * Generate AI reasoning explanation for POI selection
 */
export function generatePOIReasoning(poi, context = {}) {
  const { stepNumber, selectedPOIs = [], userPreferences = {} } = context;
  
  let reasoning = [];
  
  // Step context
  if (stepNumber === 1) {
    reasoning.push("Perfect starting point for your Rhodes adventure");
  } else {
    reasoning.push(`Great ${stepNumber === 2 ? 'second' : 'next'} stop in your journey`);
  }
  
  // Type reasoning
  const typeReasons = {
    'attraction': 'Popular attraction with cultural significance',
    'restaurant': 'Excellent dining experience with local flavors',
    'beach': 'Beautiful beach perfect for relaxation',
    'museum': 'Rich cultural experience with historical artifacts',
    'historical_site': 'Important historical landmark with stories to tell',
    'cafe': 'Charming spot for coffee and local atmosphere'
  };
  
  if (typeReasons[poi.type]) {
    reasoning.push(typeReasons[poi.type]);
  }
  
  // Rating reasoning
  if (poi.rating && poi.rating >= 4.0) {
    reasoning.push(`Highly rated (${poi.rating}/5) by visitors`);
  }
  
  // Distance reasoning
  if (poi.distance_meters) {
    if (poi.distance_meters < 500) {
      reasoning.push("Very close to your current location");
    } else if (poi.distance_meters < 1500) {
      reasoning.push("Short walk from your current location");
    } else {
      reasoning.push("Worth the journey for this experience");
    }
  }
  
  // Variety reasoning
  if (selectedPOIs.length > 0) {
    const selectedTypes = selectedPOIs.map(p => p.type);
    if (!selectedTypes.includes(poi.type)) {
      reasoning.push("Adds variety to your travel experience");
    }
  }
  
  return reasoning.join('. ') + '.';
}

export default {
  processAIToolCalls,
  generatePOIReasoning,
  transformPOIsForResponse
};