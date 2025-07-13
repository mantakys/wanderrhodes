/**
 * Step-by-Step Travel Planning Handler
 * Provides focused, single-purpose POI recommendations
 */

import { OpenAI } from 'openai';
import { hasEnhancedFeatures, getContextualRecommendations, getEnhancedNearbyPlaces } from './enhanced-chat-tools.js';

// Rhodes center coordinates (fallback location)
const RHODES_CENTER = {
  lat: 36.4341,
  lng: 28.2176
};

// Debug logging configuration
const DEBUG_ENABLED = true;
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_STEP' : '🔍 DEV_STEP';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

// Default fallback POIs when location is not available
const DEFAULT_FALLBACK_POIS = [
  {
    name: "Rhodes Old Town",
    type: "attraction",
    description: "Medieval fortress city with cobblestone streets and ancient architecture",
    location: {
      address: "Old Town, Rhodes, Greece",
      coordinates: { lat: 36.4467, lng: 28.2226 }
    },
    details: {
      openingHours: "24/7",
      priceRange: "Free",
      rating: "4.7"
    },
    highlights: ["UNESCO World Heritage Site", "Medieval architecture", "Ancient walls"],
    tips: ["Start early to avoid crowds", "Wear comfortable walking shoes"],
    bestTimeToVisit: "Early morning or late afternoon"
  },
  {
    name: "Mandraki Harbor",
    type: "attraction", 
    description: "Historic harbor with deer statues and beautiful waterfront views",
    location: {
      address: "Mandraki Harbor, Rhodes, Greece",
      coordinates: { lat: 36.4515, lng: 28.2275 }
    },
    details: {
      openingHours: "24/7",
      priceRange: "Free",
      rating: "4.5"
    },
    highlights: ["Historic harbor", "Deer statues", "Waterfront promenade"],
    tips: ["Great for sunset photos", "Many cafes nearby"],
    bestTimeToVisit: "Sunset"
  },
  {
    name: "Elli Beach",
    type: "beach",
    description: "Popular city beach with clear waters and beach facilities",
    location: {
      address: "Elli Beach, Rhodes, Greece", 
      coordinates: { lat: 36.4578, lng: 28.2189 }
    },
    details: {
      openingHours: "24/7",
      priceRange: "Free",
      rating: "4.2"
    },
    highlights: ["City beach", "Clear waters", "Beach facilities"],
    tips: ["Gets busy in summer", "Good for swimming"],
    bestTimeToVisit: "Morning"
  },
  {
    name: "Acropolis of Rhodes",
    type: "attraction",
    description: "Ancient Greek ruins with panoramic views of the city",
    location: {
      address: "Acropolis of Rhodes, Rhodes, Greece",
      coordinates: { lat: 36.4341, lng: 28.2176 }
    },
    details: {
      openingHours: "8:00 AM - 8:00 PM",
      priceRange: "€6",
      rating: "4.3"
    },
    highlights: ["Ancient ruins", "Panoramic views", "Historical significance"],
    tips: ["Bring water and sun protection", "Best views at sunset"],
    bestTimeToVisit: "Late afternoon"
  },
  {
    name: "Lindos",
    type: "attraction",
    description: "Picturesque village with ancient acropolis and stunning sea views",
    location: {
      address: "Lindos, Rhodes, Greece",
      coordinates: { lat: 36.0918, lng: 28.0872 }
    },
    details: {
      openingHours: "8:00 AM - 8:00 PM",
      priceRange: "€12",
      rating: "4.8"
    },
    highlights: ["Ancient acropolis", "Traditional village", "Sea views"],
    tips: ["Take bus or rent car", "Very crowded in summer"],
    bestTimeToVisit: "Early morning or late afternoon"
  }
];

/**
 * Get initial POI recommendations based on user location
 */
export async function getInitialRecommendations({ userLocation, userPreferences = {} }) {
  debugLog(`Getting initial recommendations`, { 
    hasLocation: !!userLocation,
    userLocation: userLocation || 'none',
    preferencesCount: Object.keys(userPreferences).length 
  });

  // Determine search location
  const searchLocation = userLocation || RHODES_CENTER;
  
  try {
    // Check if enhanced features are available
    const hasEnhanced = await hasEnhancedFeatures();
    debugLog(`Enhanced features status: ${hasEnhanced ? 'ACTIVE' : 'INACTIVE'}`);

    if (hasEnhanced) {
      // Use enhanced POI system with spatial intelligence
      const recommendations = await getContextualRecommendations({
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        userPreferences,
        timeOfDay: 'morning', // Default to morning for initial recommendations
        activityType: 'sightseeing' // Default to sightseeing for first step
      });

      if (recommendations && recommendations.length > 0) {
        debugLog(`Enhanced recommendations found`, { 
          count: recommendations.length,
          location: `${searchLocation.lat}, ${searchLocation.lng}` 
        });
        return {
          success: true,
          recommendations: recommendations.slice(0, 5),
          source: 'enhanced_spatial',
          location: searchLocation
        };
      }
    }

    // Fallback to default POIs if enhanced system not available or no results
    debugLog(`Using fallback POIs`, { 
      reason: hasEnhanced ? 'no_enhanced_results' : 'no_enhanced_system',
      fallbackCount: DEFAULT_FALLBACK_POIS.length 
    });

    return {
      success: true,
      recommendations: DEFAULT_FALLBACK_POIS,
      source: 'fallback_default',
      location: searchLocation
    };

  } catch (error) {
    debugLog(`Error getting initial recommendations: ${error.message}`);
    
    // Final fallback to default POIs
    return {
      success: true,
      recommendations: DEFAULT_FALLBACK_POIS,
      source: 'fallback_error',
      location: searchLocation,
      error: error.message
    };
  }
}

/**
 * Get next POI recommendations based on selected POIs
 */
export async function getNextRecommendations({ userLocation, userPreferences = {}, selectedPOIs = [], currentStep = 1 }) {
  debugLog(`Getting next recommendations`, { 
    currentStep,
    selectedPOICount: selectedPOIs.length,
    hasLocation: !!userLocation
  });

  // Determine search location (last selected POI or user location or center)
  const lastPOI = selectedPOIs[selectedPOIs.length - 1];
  const searchLocation = lastPOI?.location?.coordinates || userLocation || RHODES_CENTER;

  // Gather exclude lists
  const excludeNames = selectedPOIs.map(poi => poi.name);
  const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);

  try {
    const hasEnhanced = await hasEnhancedFeatures();
    
    if (hasEnhanced) {
      // Determine activity type based on step and preferences
      const activityType = determineActivityType(currentStep, userPreferences, selectedPOIs);
      const timeOfDay = determineTimeOfDay(currentStep);

      debugLog(`Enhanced search parameters`, { 
        searchLocation,
        activityType,
        timeOfDay,
        currentStep,
        excludeNames,
        excludeIds,
        selectedPOIs
      });

      const recommendations = await getContextualRecommendations({
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        userPreferences,
        timeOfDay,
        activityType,
        excludeNames,
        excludeIds,
        selectedPOIs // for future agent reasoning
      });

      if (recommendations && recommendations.length > 0) {
        debugLog(`Enhanced next recommendations`, { 
          totalFound: recommendations.length,
          activityType,
          timeOfDay 
        });

        return {
          success: true,
          recommendations: recommendations.slice(0, 5),
          source: 'enhanced_contextual',
          location: searchLocation,
          context: { activityType, timeOfDay, currentStep, selectedPOIs }
        };
      }
    }

    // Fallback to simpler logic
    const fallbackRecommendations = DEFAULT_FALLBACK_POIS.filter(poi => 
      !selectedPOIs.some(selected => selected.name === poi.name)
    );

    debugLog(`Fallback next recommendations`, { 
      available: fallbackRecommendations.length,
      reason: hasEnhanced ? 'no_enhanced_results' : 'no_enhanced_system' 
    });

    return {
      success: true,
      recommendations: fallbackRecommendations.slice(0, 5),
      source: 'fallback_filtered',
      location: searchLocation
    };

  } catch (error) {
    debugLog(`Error getting next recommendations: ${error.message}`);
    
    // Final fallback
    const fallbackRecommendations = DEFAULT_FALLBACK_POIS.filter(poi => 
      !selectedPOIs.some(selected => selected.name === poi.name)
    );

    return {
      success: true,
      recommendations: fallbackRecommendations.slice(0, 5),
      source: 'fallback_error',
      location: searchLocation,
      error: error.message
    };
  }
}

/**
 * Add selected POI to travel plan
 */
export async function addPOIToPlan({ selectedPOI, currentPlan = [] }) {
  debugLog(`Adding POI to plan`, { 
    poiName: selectedPOI.name,
    currentPlanSize: currentPlan.length 
  });

  const updatedPlan = [...currentPlan, selectedPOI];

  return {
    success: true,
    plan: updatedPlan,
    message: `Added ${selectedPOI.name} to your travel plan`
  };
}

/**
 * Finalize travel plan with route optimization
 */
export async function finalizePlan({ selectedPOIs, userPreferences = {} }) {
  debugLog(`Finalizing travel plan`, { 
    totalPOIs: selectedPOIs.length,
    preferences: Object.keys(userPreferences) 
  });

  // TODO: Implement route optimization logic
  // For now, return the plan as-is
  return {
    success: true,
    finalizedPlan: selectedPOIs,
    message: `Your travel plan is ready with ${selectedPOIs.length} locations!`
  };
}

/**
 * Determine activity type based on step and context
 */
function determineActivityType(currentStep, userPreferences, selectedPOIs) {
  // Step 1: Usually sightseeing/attractions
  if (currentStep === 1) {
    return 'sightseeing';
  }

  // Check user preferences
  if (userPreferences.interests) {
    const interests = userPreferences.interests;
    if (interests.includes('beaches')) return 'beach';
    if (interests.includes('food')) return 'dining';
    if (interests.includes('history')) return 'culture';
    if (interests.includes('nature')) return 'nature';
  }

  // Check what's already selected for variety
  if (selectedPOIs) {
    const hasAttraction = selectedPOIs.some(poi => poi.type === 'attraction');
    const hasBeach = selectedPOIs.some(poi => poi.type === 'beach');
    const hasRestaurant = selectedPOIs.some(poi => poi.type === 'restaurant');

    if (!hasBeach && currentStep > 1) return 'beach';
    if (!hasRestaurant && currentStep > 2) return 'dining';
    if (!hasAttraction) return 'sightseeing';
  }

  // Default progression
  if (currentStep <= 2) return 'sightseeing';
  if (currentStep === 3) return 'beach';
  if (currentStep === 4) return 'dining';
  return 'sightseeing';
}

/**
 * Determine time of day based on step
 */
function determineTimeOfDay(currentStep) {
  if (currentStep <= 2) return 'morning';
  if (currentStep <= 4) return 'afternoon';
  return 'evening';
}

/**
 * Main step handler endpoint
 */
export default async function stepHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { step, userLocation, userPreferences, selectedPOIs, currentStep } = req.body;

  debugLog(`Step handler called`, { 
    step,
    hasLocation: !!userLocation,
    currentStep: currentStep || 1,
    selectedPOICount: selectedPOIs?.length || 0 
  });

  try {
    let result;

    switch (step) {
      case 'GET_INITIAL_RECOMMENDATIONS':
        result = await getInitialRecommendations({ userLocation, userPreferences });
        break;

      case 'GET_NEXT_RECOMMENDATIONS':
        result = await getNextRecommendations({ 
          userLocation, 
          userPreferences, 
          selectedPOIs, 
          currentStep 
        });
        break;

      case 'ADD_POI':
        const { selectedPOI, currentPlan } = req.body;
        result = await addPOIToPlan({ selectedPOI, currentPlan });
        break;

      case 'FINALIZE_PLAN':
        result = await finalizePlan({ selectedPOIs, userPreferences });
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown step: ${step}` 
        });
    }

    debugLog(`Step handler success`, { 
      step,
      resultType: result.source || 'unknown',
      recommendationCount: result.recommendations?.length || 0 
    });

    return res.status(200).json(result);

  } catch (error) {
    debugLog(`Step handler error: ${error.message}`, { step, error: error.stack });
    
    return res.status(500).json({
      success: false,
      error: error.message,
      step
    });
  }
} 