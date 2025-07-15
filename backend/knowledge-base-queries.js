/**
 * Knowledge Base Query Functions
 * Loads and queries the curated Rhodes dataset for AI-powered recommendations
 */

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache for loaded datasets
let poiDataset = null;
let spatialRelationships = null;

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_KB' : '🔍 DEV_KB';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

/**
 * Load POI dataset from enhanced_pois_with_beaches.json
 */
async function loadPOIDataset() {
  if (poiDataset) {
    return poiDataset;
  }

  try {
    const datasetPath = path.join(__dirname, '../output/enhanced_pois_with_beaches.json');
    const fileContent = fs.readFileSync(datasetPath, 'utf8');
    poiDataset = JSON.parse(fileContent);
    
    debugLog(`POI dataset loaded successfully`, {
      totalPOIs: poiDataset.pois?.length || 0,
      filePath: datasetPath
    });
    
    return poiDataset;
  } catch (error) {
    debugLog(`Failed to load POI dataset: ${error.message}`);
    throw new Error(`Failed to load POI dataset: ${error.message}`);
  }
}

/**
 * Load spatial relationships from spatial_relationships.json
 */
async function loadSpatialRelationships() {
  if (spatialRelationships) {
    return spatialRelationships;
  }

  try {
    const relationshipsPath = path.join(__dirname, '../output/spatial_relationships.json');
    const fileContent = fs.readFileSync(relationshipsPath, 'utf8');
    spatialRelationships = JSON.parse(fileContent);
    
    debugLog(`Spatial relationships loaded successfully`, {
      totalRelationships: spatialRelationships.spatial_relationships?.length || 0,
      filePath: relationshipsPath
    });
    
    return spatialRelationships;
  } catch (error) {
    debugLog(`Failed to load spatial relationships: ${error.message}`);
    throw new Error(`Failed to load spatial relationships: ${error.message}`);
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(poi, location) {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (location.latitude || location.lat) * Math.PI / 180;
  const lat2Rad = poi.latitude * Math.PI / 180;
  const deltaLatRad = (poi.latitude - (location.latitude || location.lat)) * Math.PI / 180;
  const deltaLngRad = (poi.longitude - (location.longitude || location.lng)) * Math.PI / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if POI matches user preferences
 */
function matchesUserPreferences(poi, userPreferences) {
  if (!userPreferences) return true;

  // Check interests
  if (userPreferences.interests && userPreferences.interests.length > 0) {
    const poiTypes = [poi.primary_type, ...(poi.secondary_types || []), ...(poi.tags || [])];
    const hasMatchingInterest = userPreferences.interests.some(interest => {
      // Map user interests to POI types
      const interestMappings = {
        'beaches': ['beach'],
        'history': ['historical_site', 'museum', 'castle'],
        'food': ['restaurant', 'cafe', 'bar'],
        'culture': ['museum', 'gallery', 'theater', 'historical_site'],
        'nature': ['park', 'hiking_trail', 'natural_site'],
        'shopping': ['shopping_mall', 'store', 'market']
      };
      
      const mappedTypes = interestMappings[interest] || [interest];
      return mappedTypes.some(type => poiTypes.includes(type));
    });
    
    if (!hasMatchingInterest) return false;
  }

  // Check budget (simplified - could be more sophisticated)
  if (userPreferences.budget && poi.price_level) {
    const budgetLevels = {
      'budget': [1, 2],
      'moderate': [1, 2, 3],
      'luxury': [2, 3, 4]
    };
    
    const allowedLevels = budgetLevels[userPreferences.budget] || [1, 2, 3, 4];
    if (!allowedLevels.includes(poi.price_level)) return false;
  }

  return true;
}

/**
 * Search POIs by location and user preferences
 * Used for initial recommendations when user has location
 */
export async function searchPOIsByLocation({
  latitude,
  longitude,
  radius_meters = 5000,
  poi_types = null,
  user_preferences = {},
  exclude_poi_ids = [],
  max_results = 15
}) {
  debugLog(`Searching POIs by location`, {
    latitude, longitude, radius_meters, poi_types, exclude_poi_ids: exclude_poi_ids.length
  });

  try {
    const dataset = await loadPOIDataset();
    
    let filteredPOIs = dataset.pois
      // Exclude previously selected POIs
      .filter(poi => !exclude_poi_ids.includes(poi.place_id))
      // Filter by location if provided
      .filter(poi => {
        if (!latitude || !longitude) return true;
        const distance = calculateDistance(poi, { latitude, longitude });
        return distance <= radius_meters;
      })
      // Filter by POI types if specified
      .filter(poi => {
        if (!poi_types || poi_types.length === 0) return true;
        return poi_types.includes(poi.primary_type) || 
               (poi.secondary_types && poi.secondary_types.some(type => poi_types.includes(type)));
      })
      // Filter by user preferences
      .filter(poi => matchesUserPreferences(poi, user_preferences))
      // Add distance for sorting
      .map(poi => ({
        ...poi,
        distance_meters: latitude && longitude ? calculateDistance(poi, { latitude, longitude }) : 0
      }))
      // Sort by distance
      .sort((a, b) => a.distance_meters - b.distance_meters)
      // Limit results
      .slice(0, max_results);

    debugLog(`Location search completed`, {
      totalFound: filteredPOIs.length,
      nearestPOI: filteredPOIs[0]?.name,
      furthestDistance: filteredPOIs[filteredPOIs.length - 1]?.distance_meters
    });

    return filteredPOIs;
  } catch (error) {
    debugLog(`Error in searchPOIsByLocation: ${error.message}`);
    throw error;
  }
}

/**
 * Get must-see Rhodes POIs for users without location
 */
export async function getMustSeeRhodesPOIs({
  user_preferences = {},
  exclude_poi_ids = [],
  max_results = 15
}) {
  debugLog(`Getting must-see Rhodes POIs`, {
    exclude_poi_ids: exclude_poi_ids.length, user_preferences
  });

  try {
    const dataset = await loadPOIDataset();
    
    // Define must-see POI names/types for Rhodes
    const mustSeePOIs = [
      'Rhodes Old Town',
      'Palace of the Grand Master',
      'Lindos',
      'Anthony Quinn Bay',
      'Mandraki Harbor',
      'Elli Beach',
      'Valley of the Butterflies',
      'Acropolis of Rhodes',
      'Street of the Knights'
    ];

    let filteredPOIs = dataset.pois
      // Exclude previously selected POIs
      .filter(poi => !exclude_poi_ids.includes(poi.place_id))
      // Filter by user preferences
      .filter(poi => matchesUserPreferences(poi, user_preferences))
      // Prioritize must-see POIs
      .map(poi => ({
        ...poi,
        is_must_see: mustSeePOIs.some(mustSee => 
          poi.name.toLowerCase().includes(mustSee.toLowerCase())
        ),
        priority_score: (poi.rating || 0) + (poi.highlights?.length || 0) * 0.1
      }))
      // Sort by must-see status and rating
      .sort((a, b) => {
        if (a.is_must_see && !b.is_must_see) return -1;
        if (!a.is_must_see && b.is_must_see) return 1;
        return b.priority_score - a.priority_score;
      })
      // Limit results
      .slice(0, max_results);

    debugLog(`Must-see search completed`, {
      totalFound: filteredPOIs.length,
      mustSeeCount: filteredPOIs.filter(p => p.is_must_see).length,
      topPOI: filteredPOIs[0]?.name
    });

    return filteredPOIs;
  } catch (error) {
    debugLog(`Error in getMustSeeRhodesPOIs: ${error.message}`);
    throw error;
  }
}

/**
 * Get POIs near selected POIs using spatial relationships
 */
export async function getNearbyPOIsFromAnchors({
  anchor_poi_ids,
  max_distance_meters = 2000,
  exclude_poi_ids = [],
  max_results = 15
}) {
  debugLog(`Getting nearby POIs from anchors`, {
    anchor_poi_ids, max_distance_meters, exclude_poi_ids: exclude_poi_ids.length
  });

  try {
    const [dataset, relationships] = await Promise.all([
      loadPOIDataset(),
      loadSpatialRelationships()
    ]);

    // Find spatial relationships from anchor POIs
    const relatedPOIIds = new Set();
    
    anchor_poi_ids.forEach(anchorId => {
      relationships.spatial_relationships
        .filter(rel => rel.poi_from === anchorId)
        .filter(rel => rel.distance_meters <= max_distance_meters)
        .forEach(rel => {
          if (!exclude_poi_ids.includes(rel.poi_to)) {
            relatedPOIIds.add(rel.poi_to);
          }
        });
    });

    // Get POI details for related POIs
    const nearbyPOIs = dataset.pois
      .filter(poi => relatedPOIIds.has(poi.place_id))
      .slice(0, max_results);

    debugLog(`Spatial relationship search completed`, {
      anchorCount: anchor_poi_ids.length,
      relatedPOIsFound: nearbyPOIs.length,
      spatialRelationshipsChecked: relationships.spatial_relationships.length
    });

    return nearbyPOIs;
  } catch (error) {
    debugLog(`Error in getNearbyPOIsFromAnchors: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze travel plan context for intelligent next recommendations
 */
export function analyzeTravelPlanContext(selectedPOIs, userPreferences) {
  debugLog(`Analyzing travel plan context`, {
    selectedPOIsCount: selectedPOIs.length,
    userPreferences
  });

  // Analyze POI type distribution
  const poiTypes = {};
  const poiAreas = new Set();
  let totalDistance = 0;

  selectedPOIs.forEach((poi, index) => {
    // Count POI types
    poiTypes[poi.type || poi.primary_type] = (poiTypes[poi.type || poi.primary_type] || 0) + 1;
    
    // Track areas visited (simplified by coordinates)
    poiAreas.add(`${Math.round(poi.latitude * 100)},${Math.round(poi.longitude * 100)}`);
    
    // Calculate travel distance (simplified)
    if (index > 0) {
      const prevPOI = selectedPOIs[index - 1];
      totalDistance += calculateDistance(poi, prevPOI);
    }
  });

  // Determine missing POI types
  const allTypes = ['beach', 'restaurant', 'attraction', 'historical_site', 'museum', 'nature'];
  const missingTypes = allTypes.filter(type => !poiTypes[type]);

  // Analyze travel pattern
  const analysis = {
    poi_type_distribution: poiTypes,
    missing_poi_types: missingTypes,
    areas_explored: poiAreas.size,
    total_travel_distance: totalDistance,
    recommended_next_types: determineNextPOITypes(selectedPOIs, missingTypes),
    travel_intensity: totalDistance > 10000 ? 'high' : totalDistance > 5000 ? 'medium' : 'low'
  };

  debugLog(`Travel plan analysis completed`, analysis);

  return analysis;
}

/**
 * Determine recommended next POI types based on travel plan
 */
function determineNextPOITypes(selectedPOIs, missingTypes) {
  if (selectedPOIs.length === 0) return ['attraction', 'historical_site'];
  
  const lastPOI = selectedPOIs[selectedPOIs.length - 1];
  const lastType = lastPOI.type || lastPOI.primary_type;
  
  // Define logical progressions
  const progressions = {
    'historical_site': ['restaurant', 'museum', 'beach'],
    'museum': ['restaurant', 'beach', 'attraction'],
    'restaurant': ['beach', 'attraction', 'nature'],
    'beach': ['restaurant', 'attraction', 'historical_site'],
    'attraction': ['restaurant', 'beach', 'historical_site'],
    'nature': ['restaurant', 'beach', 'attraction']
  };
  
  const suggestedTypes = progressions[lastType] || ['restaurant', 'beach', 'attraction'];
  
  // Prioritize missing types
  return missingTypes.length > 0 
    ? missingTypes.slice(0, 3)
    : suggestedTypes.slice(0, 3);
}

// Export all functions
export {
  loadPOIDataset,
  loadSpatialRelationships,
  calculateDistance,
  matchesUserPreferences
};