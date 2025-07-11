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
  hasPOIFeatures 
} from './db-adapter.js';

// Check if enhanced features are available
export async function hasEnhancedFeatures() {
  return hasPOIFeatures() && await isPOIDataAvailable();
}

// Enhanced nearby places search using spatial relationships
export async function getEnhancedNearbyPlaces({ lat, lng, type = 'restaurant', radius = 1000 }) {
  try {
    if (!await hasEnhancedFeatures()) {
      throw new Error('Enhanced POI data not available');
    }
    
    console.log(`🔍 Enhanced search: ${type} near ${lat}, ${lng} (radius: ${radius}m)`);
    
    // Search for POIs of the specified type
    const pois = await searchPOIsByType(type, lat, lng, radius, 10);
    
    if (pois.length === 0) {
      // Fallback to broader search
      const nearbyPois = await getNearbyPOIs(lat, lng, radius * 2, [type], 5);
      return transformPOIsForResponse(nearbyPois);
    }
    
    // Enhance results with spatial context
    const enhancedPois = await Promise.all(
      pois.map(async (poi) => {
        // Get spatial relationships for context
        const adjacent = await getAdjacentPOIs(poi.id, 3);
        const walkingDistance = await getWalkingDistancePOIs(poi.id, 5);
        
        return {
          ...poi,
          spatialContext: {
            adjacent: adjacent.map(rel => ({
              name: rel.related_poi_name,
              type: rel.related_poi_type,
              distance: rel.distance_meters
            })),
            walkingDistance: walkingDistance.map(rel => ({
              name: rel.related_poi_name,
              type: rel.related_poi_type,
              distance: rel.distance_meters,
              walkingTime: rel.travel_time_walking
            }))
          }
        };
      })
    );
    
    return transformPOIsForResponse(enhancedPois);
    
  } catch (error) {
    console.warn('⚠️ Enhanced search failed, using fallback:', error.message);
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
      return null;
    }
    
    console.log(`🎯 Contextual search for ${activityType} at ${lat}, ${lng}`);
    
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
    }
    
    // Apply user preferences
    if (userPreferences.budget) {
      const budgetToPriceLevel = {
        'budget': 1,
        'mid-range': 2,
        'luxury': 3
      };
      criteria.priceLevel = budgetToPriceLevel[userPreferences.budget] || 3;
    }
    
    if (userPreferences.minRating) {
      criteria.minRating = userPreferences.minRating;
    }
    
    // Time-based filtering
    if (timeOfDay === 'evening' || timeOfDay === 'sunset') {
      criteria.tags = ['sunset-view', 'romantic', 'terrace'];
    }
    
    const results = await searchPOIsAdvanced(criteria);
    
    // Add contextual insights
    const enhancedResults = results.map(poi => ({
      ...poi,
      contextualTips: generateContextualTips(poi, { timeOfDay, activityType, userPreferences })
    }));
    
    return transformPOIsForResponse(enhancedResults);
    
  } catch (error) {
    console.error('❌ Contextual recommendations failed:', error);
    return null;
  }
}

// Generate travel route with spatial optimization
export async function getOptimizedRoute(locations, startPoint = null) {
  try {
    if (!await hasEnhancedFeatures() || locations.length < 2) {
      return locations; // Return as-is if no optimization possible
    }
    
    console.log(`🗺️ Optimizing route for ${locations.length} locations`);
    
    // For now, implement a simple nearest-neighbor optimization
    // In the future, this could use more sophisticated algorithms
    
    const optimized = [];
    let current = startPoint || locations[0];
    let remaining = [...locations];
    
    if (startPoint) {
      optimized.push(current);
    } else {
      remaining.shift();
      optimized.push(current);
    }
    
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = calculateDistance(current, remaining[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }
      
      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }
    
    return optimized;
    
  } catch (error) {
    console.error('❌ Route optimization failed:', error);
    return locations;
  }
}

// Find alternative suggestions based on spatial relationships
export async function getAlternativeSuggestions(originalLocationName, lat, lng) {
  try {
    if (!await hasEnhancedFeatures()) {
      return [];
    }
    
    // Find the original POI in our database
    const originalPOI = await findPOIByNameAndLocation(originalLocationName, lat, lng, 500);
    
    if (!originalPOI) {
      // If not found, search for similar POIs nearby
      return await getNearbyPOIs(lat, lng, 2000, null, 5);
    }
    
    // Get spatially related POIs
    const adjacent = await getAdjacentPOIs(originalPOI.id, 5);
    const walking = await getWalkingDistancePOIs(originalPOI.id, 8);
    
    // Combine and deduplicate
    const alternatives = new Map();
    
    [...adjacent, ...walking].forEach(rel => {
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
    
    return Array.from(alternatives.values())
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, 5);
    
  } catch (error) {
    console.error('❌ Alternative suggestions failed:', error);
    return [];
  }
}

// Transform POI data to match chatHandler expected format
function transformPOIsForResponse(pois) {
  return pois.map(poi => ({
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
}

// Generate contextual tips based on POI and context
function generateContextualTips(poi, context) {
  const tips = [];
  
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
  if (poi.rating >= 4.5) {
    tips.push('Highly rated by visitors');
  }
  
  // Local tips from database
  if (poi.local_tips && poi.local_tips.length > 0) {
    tips.push(...poi.local_tips.slice(0, 2));
  }
  
  return tips;
}

// Calculate haversine distance between two points
function calculateDistance(point1, point2) {
  const lat1 = parseFloat(point1.latitude || point1.lat);
  const lon1 = parseFloat(point1.longitude || point1.lng);
  const lat2 = parseFloat(point2.latitude || point2.lat);
  const lon2 = parseFloat(point2.longitude || point2.lng);
  
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Export system status for debugging
export async function getSystemStatus() {
  try {
    const hasFeatures = await hasEnhancedFeatures();
    
    if (!hasFeatures) {
      return {
        status: 'basic',
        message: 'Using basic features - enhanced POI data not available',
        features: {
          spatialRelationships: false,
          contextualRecommendations: false,
          routeOptimization: false
        }
      };
    }
    
    // Get POI statistics if available
    const stats = await getPOIStatistics?.() || {};
    
    return {
      status: 'enhanced',
      message: 'Enhanced POI features available',
      features: {
        spatialRelationships: true,
        contextualRecommendations: true,
        routeOptimization: true
      },
      data: {
        totalPOIs: stats.totalPOIs || 0,
        totalRelationships: stats.totalRelationships || 0,
        topTypes: stats.topTypes?.slice(0, 5) || []
      }
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      features: {
        spatialRelationships: false,
        contextualRecommendations: false,
        routeOptimization: false
      }
    };
  }
} 