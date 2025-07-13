/**
 * Enhanced Chat Tools for Spatial Intelligence
 * Integrates with chatHandler.js to provide context-aware recommendations
 */

import { 
  getNearbyPOIs, 
  searchPOIsByType, 
  getAdjacentPOIs, 
  getWalkingDistancePOIs,
  searchPOIsAdvanced,
  isPOIDataAvailable,
  hasPOIFeatures,
  getPOIStatistics,
  findPOIByNameAndLocation
} from './db-adapter.js';

// Debug logging configuration - Enable in production for workflow tracking
const DEBUG_ENABLED = true; // Always enabled to track production workflow
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_ENHANCED' : '🔍 DEV_ENHANCED';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    // In production, limit data output to prevent log spam
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

// Check if enhanced features are available
export async function hasEnhancedFeatures() {
  try {
    const hasPOI = hasPOIFeatures();
    const isPOIAvailable = hasPOI ? await isPOIDataAvailable() : false;
    
    debugLog(`Enhanced features check`, { 
      hasPOIFeatures: hasPOI,
      isPOIDataAvailable: isPOIAvailable,
      result: hasPOI && isPOIAvailable 
    });
    
    return hasPOI && isPOIAvailable;
  } catch (error) {
    debugLog(`Enhanced features check failed: ${error.message}`);
    return false;
  }
}

// Enhanced nearby places search using spatial relationships
export async function getEnhancedNearbyPlaces({ lat, lng, type = 'restaurant', radius = 1000 }) {
  try {
    if (!await hasEnhancedFeatures()) {
      debugLog(`Enhanced features not available for getEnhancedNearbyPlaces`);
      throw new Error('Enhanced POI data not available');
    }
    
    debugLog(`🎯 Enhanced nearby places search with spatial intelligence`, { lat, lng, type, radius });
    
    // Search for POIs of the specified type
    const pois = await searchPOIsByType(type, lat, lng, radius, 10);
    debugLog(`🔍 PostgreSQL POI search result`, { 
      resultCount: pois?.length || 0,
      searchType: 'searchPOIsByType',
      database: 'POSTGRESQL_ENHANCED'
    });
    
    if (!pois || pois.length === 0) {
      debugLog(`No POIs found for type ${type}, trying broader search`);
      
      // Fallback to broader search
      const nearbyPois = await getNearbyPOIs(lat, lng, radius * 2, [type], 5);
      debugLog(`Broader search result`, { resultCount: nearbyPois?.length || 0 });
      
      if (!nearbyPois || nearbyPois.length === 0) {
        debugLog(`No POIs found in broader search either`);
        return [];
      }
      
      return transformPOIsForResponse(nearbyPois);
    }
    
    // Enhance results with spatial context
    debugLog(`🔗 Enhancing ${pois.length} POIs with spatial relationships`);
    const enhancedPois = await Promise.all(
      pois.map(async (poi) => {
        try {
          // Get spatial relationships for context
          const adjacent = await getAdjacentPOIs(poi.id, 3);
          const walkingDistance = await getWalkingDistancePOIs(poi.id, 5);
          
          debugLog(`🌐 Spatial context for ${poi.name}`, { 
            poiId: poi.id,
            adjacentCount: adjacent?.length || 0,
            walkingDistanceCount: walkingDistance?.length || 0,
            spatialIntelligence: 'ACTIVE'
          });
          
          return {
            ...poi,
            spatialContext: {
              adjacent: (adjacent || []).map(rel => ({
                name: rel.related_poi_name,
                type: rel.related_poi_type,
                distance: rel.distance_meters
              })),
              walkingDistance: (walkingDistance || []).map(rel => ({
                name: rel.related_poi_name,
                type: rel.related_poi_type,
                distance: rel.distance_meters,
                walkingTime: rel.travel_time_walking
              }))
            }
          };
        } catch (error) {
          debugLog(`Error enhancing POI ${poi.id}: ${error.message}`);
          return poi; // Return original POI if enhancement fails
        }
      })
    );
    
    const transformedResults = transformPOIsForResponse(enhancedPois);
    debugLog(`Enhanced nearby places search completed`, { 
      finalResultCount: transformedResults.length 
    });
    
    return transformedResults;
    
  } catch (error) {
    debugLog(`Enhanced nearby places search failed: ${error.message}`);
    throw error; // Let caller handle fallback
  }
}

// Contextual search based on user preferences and location
export async function getContextualRecommendations({ 
  lat, 
  lng, 
  userPreferences = {}, 
  timeOfDay = null,
  activityType = null 
}) {
  try {
    if (!await hasEnhancedFeatures()) {
      debugLog(`Enhanced features not available for contextual recommendations`);
      return null;
    }
    
    debugLog(`Contextual recommendations search`, { 
      lat, lng, userPreferences, timeOfDay, activityType 
    });
    
    // Build search criteria based on context
    const criteria = {
      latitude: lat,
      longitude: lng,
      radius: 5000, // 5km default radius
      limit: 15
    };
    
    // Map activity types to POI types
    const activityTypeMappings = {
      'dining': ['restaurant', 'cafe', 'bar'],
      'sightseeing': ['attraction', 'museum', 'historical_site'],
      'beach': ['beach'],
      'shopping': ['shopping_mall', 'store'],
      'nightlife': ['bar', 'nightclub'],
      'culture': ['museum', 'gallery', 'theater', 'historical_site'],
      'nature': ['park', 'beach', 'hiking_trail']
    };
    
    if (activityType && activityTypeMappings[activityType]) {
      criteria.types = activityTypeMappings[activityType];
      debugLog(`Activity type mapping`, { activityType, mappedTypes: criteria.types });
    }
    
    // Apply user preferences
    if (userPreferences.budget) {
      const budgetToPriceLevel = {
        'budget': 1,
        'mid-range': 2,
        'luxury': 3
      };
      criteria.priceLevel = budgetToPriceLevel[userPreferences.budget] || 3;
      debugLog(`Budget preference applied`, { budget: userPreferences.budget, priceLevel: criteria.priceLevel });
    }
    
    if (userPreferences.minRating) {
      criteria.minRating = userPreferences.minRating;
      debugLog(`Rating preference applied`, { minRating: criteria.minRating });
    }
    
    // Time-based filtering
    if (timeOfDay === 'evening' || timeOfDay === 'sunset') {
      criteria.tags = ['sunset-view', 'romantic', 'terrace'];
      debugLog(`Time-based filtering applied`, { timeOfDay, tags: criteria.tags });
    }
    
    debugLog(`Final search criteria`, criteria);
    
    const results = await searchPOIsAdvanced(criteria);
    debugLog(`Advanced search results`, { resultCount: results?.length || 0 });
    
    if (!results || results.length === 0) {
      debugLog(`No results from advanced search`);
      return [];
    }
    
    // Add contextual insights
    const enhancedResults = results.map(poi => ({
      ...poi,
      contextualTips: generateContextualTips(poi, { timeOfDay, activityType, userPreferences })
    }));
    
    const transformedResults = transformPOIsForResponse(enhancedResults);
    debugLog(`Contextual recommendations completed`, { 
      finalResultCount: transformedResults.length 
    });
    
    return transformedResults;
    
  } catch (error) {
    debugLog(`Contextual recommendations failed: ${error.message}`);
    return null;
  }
}

// Generate travel route with spatial optimization
export async function getOptimizedRoute(locations, startPoint = null) {
  try {
    if (!await hasEnhancedFeatures() || locations.length < 2) {
      debugLog(`Route optimization not available`, { 
        hasEnhanced: await hasEnhancedFeatures(),
        locationCount: locations.length 
      });
      return locations; // Return original order
    }
    
    debugLog(`Route optimization requested`, { 
      locationCount: locations.length,
      hasStartPoint: !!startPoint 
    });
    
    // Simple distance-based optimization
    const optimizedLocations = [...locations];
    if (startPoint) {
      optimizedLocations.unshift(startPoint);
    }
    
    // Sort by distance from previous location (greedy approach)
    for (let i = 1; i < optimizedLocations.length - 1; i++) {
      const current = optimizedLocations[i];
      let nearestIndex = i;
      let minDistance = Infinity;
      
      for (let j = i + 1; j < optimizedLocations.length; j++) {
        const distance = calculateDistance(current, optimizedLocations[j]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = j;
        }
      }
      
      if (nearestIndex !== i) {
        // Swap locations
        [optimizedLocations[i + 1], optimizedLocations[nearestIndex]] = 
        [optimizedLocations[nearestIndex], optimizedLocations[i + 1]];
      }
    }
    
    debugLog(`Route optimization completed`, { 
      originalOrder: locations.map(l => l.name),
      optimizedOrder: optimizedLocations.map(l => l.name) 
    });
    
    return optimizedLocations;
    
  } catch (error) {
    debugLog(`Route optimization failed: ${error.message}`);
    return locations; // Return original order on error
  }
}

// Find alternative suggestions based on spatial relationships
export async function getAlternativeSuggestions(originalLocationName, lat, lng) {
  try {
    if (!await hasEnhancedFeatures()) {
      debugLog(`Enhanced features not available for alternative suggestions`);
      return [];
    }
    
    debugLog(`Alternative suggestions search`, { 
      originalLocationName, lat, lng 
    });
    
    // Find the original POI in our database
    const originalPOI = await findPOIByNameAndLocation(originalLocationName, lat, lng, 500);
    debugLog(`Original POI lookup result`, { 
      found: !!originalPOI,
      poiId: originalPOI?.id 
    });
    
    if (!originalPOI) {
      debugLog(`Original POI not found, using nearby search`);
      // If not found, search for similar POIs nearby
      const nearbyPois = await getNearbyPOIs(lat, lng, 2000, null, 5);
      debugLog(`Nearby POIs fallback result`, { 
        resultCount: nearbyPois?.length || 0 
      });
      return nearbyPois || [];
    }
    
    // Get spatially related POIs
    const adjacent = await getAdjacentPOIs(originalPOI.id, 5);
    const walking = await getWalkingDistancePOIs(originalPOI.id, 8);
    
    debugLog(`Spatial relationships found`, { 
      adjacentCount: adjacent?.length || 0,
      walkingCount: walking?.length || 0 
    });
    
    // Combine and deduplicate
    const alternatives = new Map();
    
    [...(adjacent || []), ...(walking || [])].forEach(rel => {
      if (!alternatives.has(rel.related_poi_id)) {
        alternatives.set(rel.related_poi_id, {
          id: rel.related_poi_id,
          name: rel.related_poi_name,
          type: rel.related_poi_type,
          latitude: rel.related_poi_lat,
          longitude: rel.related_poi_lng,
          address: rel.related_poi_address,
          rating: rel.related_poi_rating,
          distance_meters: rel.distance_meters,
          relationship: rel.relationship_type
        });
      }
    });
    
    const finalAlternatives = Array.from(alternatives.values())
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, 5);
    
    debugLog(`Alternative suggestions completed`, { 
      finalAlternativeCount: finalAlternatives.length 
    });
    
    return finalAlternatives;
    
  } catch (error) {
    debugLog(`Alternative suggestions failed: ${error.message}`);
    return [];
  }
}

// Transform POI data to match chatHandler expected format
function transformPOIsForResponse(pois) {
  if (!pois || !Array.isArray(pois)) {
    debugLog(`Invalid POI data for transformation`, { pois });
    return [];
  }
  
  const transformed = pois.map(poi => ({
    name: poi.name,
    type: poi.primary_type,
    place_id: poi.place_id,
    latitude: parseFloat(poi.latitude),
    longitude: parseFloat(poi.longitude),
    address: poi.address,
    rating: poi.rating ? parseFloat(poi.rating) : null,
    price_level: poi.price_level,
    opening_hours: poi.opening_hours,
    phone: poi.phone,
    website: poi.website,
    
    // Enhanced fields
    amenities: poi.amenities || [],
    tags: poi.tags || [],
    description: poi.description,
    highlights: poi.highlights || [],
    local_tips: poi.local_tips || [],
    distance_meters: poi.distance_meters ? parseInt(poi.distance_meters) : null,
    
    // Spatial context if available
    ...(poi.spatialContext && { spatialContext: poi.spatialContext }),
    ...(poi.contextualTips && { contextualTips: poi.contextualTips })
  }));
  
  debugLog(`POI transformation completed`, { 
    originalCount: pois.length,
    transformedCount: transformed.length 
  });
  
  return transformed;
}

// Generate contextual tips based on POI and context
function generateContextualTips(poi, context) {
  const tips = [];
  
  try {
    // Time-based tips
    if (context.timeOfDay === 'sunset' && poi.tags?.includes('sunset-view')) {
      tips.push('Perfect timing for sunset views!');
    }
    
    if (context.timeOfDay === 'evening' && poi.primary_type === 'restaurant') {
      tips.push('Great choice for evening dining');
    }
    
    // Activity-based tips
    if (context.activityType === 'beach' && poi.amenities?.includes('parking')) {
      tips.push('Convenient parking available');
    }
    
    // Rating-based tips
    if (poi.rating && parseFloat(poi.rating) >= 4.5) {
      tips.push('Highly rated by visitors');
    }
    
    // Local tips from database
    if (poi.local_tips && Array.isArray(poi.local_tips) && poi.local_tips.length > 0) {
      tips.push(...poi.local_tips.slice(0, 2));
    }
    
    debugLog(`Generated contextual tips`, { 
      poiName: poi.name,
      context,
      tipsCount: tips.length 
    });
    
  } catch (error) {
    debugLog(`Error generating contextual tips: ${error.message}`);
  }
  
  return tips;
}

// Calculate distance between two points
function calculateDistance(point1, point2) {
  const lat1 = parseFloat(point1.latitude || point1.lat);
  const lng1 = parseFloat(point1.longitude || point1.lng);
  const lat2 = parseFloat(point2.latitude || point2.lat);
  const lng2 = parseFloat(point2.longitude || point2.lng);
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 1000; // Convert to meters
  
  return distance;
}

// Get system status for debugging
export async function getSystemStatus() {
  try {
    const hasEnhanced = await hasEnhancedFeatures();
    const stats = hasEnhanced ? await getPOIStatistics() : null;
    
    const status = {
      status: hasEnhanced ? 'enhanced' : 'basic',
      message: hasEnhanced ? 'Enhanced POI features available' : 'Basic features only',
      features: {
        spatialRelationships: hasEnhanced,
        contextualRecommendations: hasEnhanced,
        routeOptimization: hasEnhanced
      },
      data: stats || { message: 'No enhanced data available' }
    };
    
    debugLog(`System status check`, status);
    return status;
    
  } catch (error) {
    debugLog(`System status check failed: ${error.message}`);
    return {
      status: 'error',
      message: error.message,
      features: {
        spatialRelationships: false,
        contextualRecommendations: false,
        routeOptimization: false
      },
      data: { error: error.message }
    };
  }
} 