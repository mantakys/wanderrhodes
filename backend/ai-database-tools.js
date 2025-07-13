/**
 * AI Database Tools for Step-by-Step Planning
 * Provides intelligent POI search tools that leverage the PostgreSQL knowledge base
 * with hotel exclusion and dynamic radius calculation
 */

import { searchPOIsAdvanced, getNearbyPOIs, getAdjacentPOIs, getWalkingDistancePOIs } from './db-poi.js';

// Debug logging configuration
const DEBUG_ENABLED = true;
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_AI_TOOLS' : '🔍 DEV_AI_TOOLS';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

// Rhodes location density zones for intelligent radius calculation
const RHODES_ZONES = {
  HIGH_DENSITY: {
    name: 'Rhodes City Center',
    bounds: { minLat: 36.43, maxLat: 36.46, minLng: 28.21, maxLng: 28.24 },
    baseRadius: 1000
  },
  MEDIUM_DENSITY: [
    { name: 'Lindos', bounds: { minLat: 36.08, maxLat: 36.12, minLng: 28.08, maxLng: 28.10 }, baseRadius: 1500 },
    { name: 'Faliraki', bounds: { minLat: 36.33, maxLat: 36.36, minLng: 28.19, maxLng: 28.22 }, baseRadius: 1500 },
    { name: 'Ixia', bounds: { minLat: 36.41, maxLat: 36.43, minLng: 28.20, maxLng: 28.22 }, baseRadius: 1500 },
    { name: 'Kallithea', bounds: { minLat: 36.37, maxLat: 36.40, minLng: 28.19, maxLng: 28.22 }, baseRadius: 1500 }
  ],
  LOW_DENSITY: {
    name: 'Rural/Remote Areas',
    baseRadius: 3000
  }
};

// CRITICAL: Types to exclude (hotels and accommodations)
const EXCLUDED_POI_TYPES = [
  'hotel',
  'lodging', 
  'accommodation',
  'resort',
  'guesthouse',
  'villa',
  'apartment',
  'hostel',
  'bed_and_breakfast',
  'vacation_rental'
];

/**
 * Calculate optimal search radius based on location, preferences, and context
 */
function calculateOptimalRadius(userLocation, userPreferences = {}, selectedPOIs = [], stepNumber = 1) {
  debugLog('Calculating optimal radius', { 
    userLocation, 
    preferencesCount: Object.keys(userPreferences).length,
    selectedPOIsCount: selectedPOIs.length,
    stepNumber 
  });

  if (!userLocation?.lat || !userLocation?.lng) {
    debugLog('No user location, using default radius');
    return 5000; // Default for must-see attractions
  }

  const { lat, lng } = userLocation;
  let baseRadius = 2000; // Default 2km
  let radiusMultiplier = 1.0;

  // Factor 1: Location density
  const locationDensity = getLocationDensity(lat, lng);
  debugLog('Location density detected', { density: locationDensity.type, zone: locationDensity.zone });
  
  if (locationDensity.type === 'high') {
    baseRadius = 1000;
    radiusMultiplier = 0.8;
  } else if (locationDensity.type === 'medium') {
    baseRadius = 1500;
    radiusMultiplier = 1.0;
  } else {
    baseRadius = 3000;
    radiusMultiplier = 1.2;
  }

  // Factor 2: Transportation mode
  const transport = userPreferences.transport || 'walking';
  if (transport === 'car') radiusMultiplier *= 2.0;
  else if (transport === 'bicycle') radiusMultiplier *= 1.5;
  else if (transport === 'public_transport') radiusMultiplier *= 1.3;

  // Factor 3: User pace preference
  const pace = userPreferences.pace || 'moderate';
  if (pace === 'relaxed') radiusMultiplier *= 0.8;
  else if (pace === 'active') radiusMultiplier *= 1.3;

  // Factor 4: Step-based adjustment
  if (stepNumber === 1) {
    // Initial step: moderate radius
    radiusMultiplier *= 1.0;
  } else if (stepNumber === 2) {
    // Second step: stay closer for logical flow
    radiusMultiplier *= 0.7;
  } else if (stepNumber >= 3) {
    // Later steps: consider travel variety
    const travelStyle = analyzeTravelStyle(selectedPOIs);
    if (travelStyle === 'concentrated') {
      radiusMultiplier *= 0.9;
    } else if (travelStyle === 'exploring') {
      radiusMultiplier *= 1.4;
    }
  }

  const finalRadius = Math.round(baseRadius * radiusMultiplier);
  const clampedRadius = Math.min(Math.max(finalRadius, 500), 8000); // Min 500m, Max 8km

  debugLog('Radius calculation completed', {
    baseRadius,
    radiusMultiplier,
    finalRadius,
    clampedRadius,
    factors: {
      locationDensity: locationDensity.type,
      transport,
      pace,
      stepNumber,
      travelStyle: selectedPOIs.length >= 2 ? analyzeTravelStyle(selectedPOIs) : 'unknown'
    }
  });

  return clampedRadius;
}

/**
 * Detect location density type and zone
 */
function getLocationDensity(lat, lng) {
  // Check high density (Rhodes city center)
  const highDensity = RHODES_ZONES.HIGH_DENSITY;
  if (isWithinBounds(lat, lng, highDensity.bounds)) {
    return { type: 'high', zone: highDensity.name, baseRadius: highDensity.baseRadius };
  }

  // Check medium density zones (tourist areas)
  for (const zone of RHODES_ZONES.MEDIUM_DENSITY) {
    if (isWithinBounds(lat, lng, zone.bounds)) {
      return { type: 'medium', zone: zone.name, baseRadius: zone.baseRadius };
    }
  }

  // Default to low density (rural/remote)
  return { 
    type: 'low', 
    zone: RHODES_ZONES.LOW_DENSITY.name, 
    baseRadius: RHODES_ZONES.LOW_DENSITY.baseRadius 
  };
}

/**
 * Check if coordinates are within bounds
 */
function isWithinBounds(lat, lng, bounds) {
  return lat >= bounds.minLat && lat <= bounds.maxLat && 
         lng >= bounds.minLng && lng <= bounds.maxLng;
}

/**
 * Analyze travel style from selected POIs
 */
function analyzeTravelStyle(selectedPOIs) {
  if (selectedPOIs.length < 2) return 'unknown';

  const distances = [];
  for (let i = 1; i < selectedPOIs.length; i++) {
    const prev = selectedPOIs[i - 1];
    const curr = selectedPOIs[i];
    if (prev.latitude && curr.latitude) {
      const dist = calculateDistance(prev, curr);
      distances.push(dist);
    }
  }

  if (distances.length === 0) return 'unknown';

  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  return avgDistance < 1000 ? 'concentrated' : 'exploring';
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistance(poi1, poi2) {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (poi1.latitude || poi1.lat) * Math.PI / 180;
  const lat2Rad = (poi2.latitude || poi2.lat) * Math.PI / 180;
  const deltaLatRad = ((poi2.latitude || poi2.lat) - (poi1.latitude || poi1.lat)) * Math.PI / 180;
  const deltaLngRad = ((poi2.longitude || poi2.lng) - (poi1.longitude || poi1.lng)) * Math.PI / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Map user interests to POI types
 */
function mapInterestsToPOITypes(interests = []) {
  const mapping = {
    'beaches': ['beach'],
    'history': ['historical_site', 'museum', 'monument', 'archaeological_site'],
    'food': ['restaurant', 'cafe', 'taverna', 'bar'],
    'culture': ['museum', 'gallery', 'theater', 'cultural_site'],
    'nature': ['park', 'beach', 'hiking_trail', 'natural_site'],
    'nightlife': ['bar', 'nightclub', 'entertainment'],
    'shopping': ['shopping_mall', 'market', 'store'],
    'adventure': ['activity', 'sports', 'adventure_park'],
    'relaxation': ['spa', 'beach', 'park']
  };

  const poiTypes = interests.flatMap(interest => mapping[interest.toLowerCase()] || []);
  return poiTypes.length > 0 ? poiTypes : ['attraction', 'restaurant', 'beach', 'museum']; // Default types
}

/**
 * Map budget to price level
 */
function mapBudgetToPriceLevel(budget) {
  const mapping = {
    'budget': 1,
    'moderate': 2,
    'luxury': 3
  };
  return mapping[budget] || 3; // Default to moderate-high
}

/**
 * Intelligent POI search with adaptive radius
 */
async function intelligentPOISearch(params) {
  const { userLocation, userPreferences, selectedPOIs, stepNumber, excludeNames = [] } = params;
  
  let radius = calculateOptimalRadius(userLocation, userPreferences, selectedPOIs, stepNumber);
  let attempts = 0;
  const maxAttempts = 3;

  debugLog('Starting intelligent POI search', {
    initialRadius: radius,
    maxAttempts,
    excludedTypes: EXCLUDED_POI_TYPES,
    excludeNamesCount: excludeNames.length
  });

  while (attempts < maxAttempts) {
    try {
      const searchParams = {
        types: mapInterestsToPOITypes(userPreferences.interests),
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        radius,
        priceLevel: mapBudgetToPriceLevel(userPreferences.budget),
        excludeNames,
        excludeTypes: EXCLUDED_POI_TYPES, // CRITICAL: Exclude hotels
        limit: 15
      };

      debugLog(`Search attempt ${attempts + 1}`, { searchParams });

      const results = await searchPOIsAdvanced(searchParams);

      debugLog(`Search attempt ${attempts + 1} results`, { 
        resultCount: results?.length || 0,
        radius 
      });

      // Success criteria: at least 5 diverse POIs
      if (results && results.length >= 5) {
        return {
          results,
          searchRadius: radius,
          searchAttempts: attempts + 1,
          searchSuccess: true
        };
      }

      // Expand search radius and try again
      radius = Math.min(radius * 1.8, 10000); // Max 10km
      attempts++;

    } catch (error) {
      debugLog(`Search attempt ${attempts + 1} failed: ${error.message}`);
      attempts++;
      radius = Math.min(radius * 2, 10000);
    }
  }

  // Final attempt with island-wide search
  debugLog('Final attempt with island-wide search');
  try {
    const results = await searchPOIsAdvanced({
      types: mapInterestsToPOITypes(userPreferences.interests),
      latitude: userLocation?.lat || 36.4341, // Rhodes center
      longitude: userLocation?.lng || 28.2176,
      radius: 25000, // Whole island
      excludeNames,
      excludeTypes: EXCLUDED_POI_TYPES,
      limit: 15
    });

    return {
      results: results || [],
      searchRadius: 25000,
      searchAttempts: maxAttempts + 1,
      searchSuccess: results && results.length > 0
    };
  } catch (error) {
    debugLog(`Final search attempt failed: ${error.message}`);
    return {
      results: [],
      searchRadius: 25000,
      searchAttempts: maxAttempts + 1,
      searchSuccess: false,
      error: error.message
    };
  }
}

/**
 * AI Database Tools for OpenAI function calling
 */
export const aiDatabaseTools = [
  {
    name: "search_pois_by_location_and_preferences",
    description: "Search POIs near user location matching their preferences (excludes hotels/accommodations)",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "User latitude" },
        longitude: { type: "number", description: "User longitude" },
        user_interests: { 
          type: "array", 
          items: { type: "string" },
          description: "User interests (beaches, history, food, culture, nature, etc.)"
        },
        budget: { 
          type: "string", 
          enum: ["budget", "moderate", "luxury"],
          description: "User budget preference"
        },
        transport: {
          type: "string",
          enum: ["walking", "bicycle", "car", "public_transport"],
          description: "Transportation mode"
        },
        pace: {
          type: "string", 
          enum: ["relaxed", "moderate", "active"],
          description: "Travel pace preference"
        },
        exclude_poi_names: { 
          type: "array", 
          items: { type: "string" },
          description: "POI names to exclude from results"
        }
      },
      required: ["latitude", "longitude"]
    },
    function: async (params) => {
      debugLog('AI Tool: search_pois_by_location_and_preferences called', params);
      
      return await intelligentPOISearch({
        userLocation: { lat: params.latitude, lng: params.longitude },
        userPreferences: {
          interests: params.user_interests || [],
          budget: params.budget || 'moderate',
          transport: params.transport || 'walking',
          pace: params.pace || 'moderate'
        },
        selectedPOIs: [],
        stepNumber: 1,
        excludeNames: params.exclude_poi_names || []
      });
    }
  },

  {
    name: "get_must_see_rhodes_attractions",
    description: "Get top must-see attractions in Rhodes (fallback when no location provided, excludes hotels)",
    parameters: {
      type: "object",
      properties: {
        user_interests: { 
          type: "array", 
          items: { type: "string" },
          description: "User interests to filter attractions"
        },
        budget: { 
          type: "string", 
          enum: ["budget", "moderate", "luxury"],
          description: "User budget preference"
        },
        exclude_poi_names: { 
          type: "array", 
          items: { type: "string" },
          description: "POI names to exclude from results"
        }
      }
    },
    function: async (params) => {
      debugLog('AI Tool: get_must_see_rhodes_attractions called', params);
      
      try {
        // Start with no rating requirement for broader results
        const searchCriteria = {
          types: ['attraction', 'historical_site', 'museum', 'landmark', 'archaeological_site'],
          latitude: 36.4341, // Rhodes center
          longitude: 28.2176,
          radius: 25000, // Cover whole island
          minRating: null, // REMOVED: No rating filter to get more results
          priceLevel: mapBudgetToPriceLevel(params.budget),
          excludeNames: params.exclude_poi_names || [],
          excludeTypes: EXCLUDED_POI_TYPES, // CRITICAL: Exclude hotels
          limit: 15
        };
        
        debugLog('Must-see attractions search criteria', searchCriteria);
        
        const results = await searchPOIsAdvanced(searchCriteria);
        
        debugLog('Must-see attractions raw database results', {
          resultCount: results?.length || 0,
          firstFew: results?.slice(0, 3)?.map(p => ({ 
            name: p.name, 
            type: p.primary_type, 
            rating: p.rating,
            hasDescription: !!p.description
          })) || []
        });

        // Now we should have good results since no rating filter

        return {
          results: results || [],
          searchRadius: 25000,
          searchAttempts: 1,
          searchSuccess: (results?.length || 0) > 0,
          searchType: 'must_see_attractions'
        };
      } catch (error) {
        debugLog(`Must-see attractions search failed: ${error.message}`, { error: error.stack });
        return {
          results: [],
          searchRadius: 25000,
          searchAttempts: 1,
          searchSuccess: false,
          error: error.message
        };
      }
    }
  },

  {
    name: "get_contextual_next_pois",
    description: "Get POIs based on travel pattern and previously selected POIs (excludes hotels)",
    parameters: {
      type: "object",
      properties: {
        selected_pois: { 
          type: "array", 
          items: { 
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              latitude: { type: "number" },
              longitude: { type: "number" },
              type: { type: "string" }
            }
          },
          description: "Previously selected POIs"
        },
        current_location: { 
          type: "object", 
          properties: { 
            lat: { type: "number" }, 
            lng: { type: "number" } 
          },
          description: "Current user location"
        },
        user_preferences: { 
          type: "object",
          description: "User preferences including interests, budget, transport, pace"
        },
        step_number: {
          type: "number",
          description: "Current step in the itinerary"
        },
        exclude_poi_names: { 
          type: "array", 
          items: { type: "string" },
          description: "POI names to exclude from results"
        }
      },
      required: ["selected_pois"]
    },
    function: async (params) => {
      debugLog('AI Tool: get_contextual_next_pois called', { 
        selectedPOIsCount: params.selected_pois?.length || 0,
        stepNumber: params.step_number,
        hasCurrentLocation: !!(params.current_location?.lat),
        excludeNamesCount: params.exclude_poi_names?.length || 0
      });
      
      const lastPOI = params.selected_pois?.[params.selected_pois.length - 1];
      const searchLat = lastPOI?.latitude || params.current_location?.lat || 36.4341;
      const searchLng = lastPOI?.longitude || params.current_location?.lng || 28.2176;
      
      try {
        // Get spatially related POIs first
        let candidates = [];
        
        if (lastPOI?.id) {
          debugLog('Getting spatial relationships for last POI', { lastPOIId: lastPOI.id });
          try {
            const adjacent = await getAdjacentPOIs(lastPOI.id, 10);
            const walking = await getWalkingDistancePOIs(lastPOI.id, 15);
            candidates = [...(adjacent || []), ...(walking || [])];
            debugLog('Spatial relationships found', { 
              adjacentCount: adjacent?.length || 0,
              walkingCount: walking?.length || 0 
            });
          } catch (spatialError) {
            debugLog(`Spatial search failed: ${spatialError.message}`);
          }
        }
        
        // Add nearby POIs for variety
        const radius = calculateOptimalRadius(
          { lat: searchLat, lng: searchLng },
          params.user_preferences,
          params.selected_pois,
          params.step_number
        );
        
        debugLog('Searching nearby POIs for variety', { radius });
        const nearby = await getNearbyPOIs(searchLat, searchLng, radius, null, 10);
        candidates = [...candidates, ...(nearby || [])];
        
        // Filter out already selected and hotels
        const filtered = candidates.filter(poi => {
          if (!poi || !poi.name) return false;
          if (params.exclude_poi_names?.includes(poi.name)) return false;
          if (EXCLUDED_POI_TYPES.includes(poi.primary_type || poi.type)) return false;
          return true;
        });

        debugLog('Contextual search completed', { 
          totalCandidates: candidates.length,
          filteredResults: filtered.length 
        });

        return {
          results: filtered,
          searchRadius: radius,
          searchAttempts: 1,
          searchSuccess: filtered.length > 0,
          searchType: 'contextual_spatial'
        };
        
      } catch (error) {
        debugLog(`Contextual search failed: ${error.message}`);
        return {
          results: [],
          searchRadius: 0,
          searchAttempts: 1,
          searchSuccess: false,
          error: error.message
        };
      }
    }
  }
];

/**
 * Export helper functions for use in other modules
 */
export {
  calculateOptimalRadius,
  getLocationDensity,
  analyzeTravelStyle,
  intelligentPOISearch,
  mapInterestsToPOITypes,
  mapBudgetToPriceLevel,
  EXCLUDED_POI_TYPES
};