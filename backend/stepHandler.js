/**
 * Step-by-Step Travel Planning Handler with Multi-Workflow Support
 * Supports: Strict AI Workflow, Enhanced POI System, and Basic Fallback
 * Uses environment variables for seamless workflow switching
 */

import { OpenAI } from 'openai';
import { hasEnhancedFeatures, getContextualRecommendations, getEnhancedNearbyPlaces } from './enhanced-chat-tools.js';
import { executeAIRoundWorkflow } from './strict-workflow-controller.js';
import { 
  getStepPlannerWorkflow, 
  getFallbackWorkflow, 
  createWorkflowContext,
  logWorkflowUsage 
} from './config/workflowConfig.js';

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

// Removed old AI functions - now using strict workflow controller

/**
 * Analyze travel pattern from selected POIs
 */
function analyzeTravelPattern(selectedPOIs) {
  if (selectedPOIs.length === 0) return { style: 'starting', pace: 'unknown' };
  
  const types = selectedPOIs.map(p => p.type);
  const hasBeach = types.includes('beach');
  const hasCulture = types.includes('museum') || types.includes('historical_site') || types.includes('attraction');
  const hasDining = types.includes('restaurant') || types.includes('cafe') || types.includes('taverna');
  
  let style = 'mixed';
  if (hasBeach && hasCulture) style = 'cultural_relaxation';
  else if (hasBeach) style = 'beach_focused';
  else if (hasCulture) style = 'cultural_exploration';
  else if (hasDining) style = 'culinary_focused';
  
  const pace = selectedPOIs.length > 2 ? 'active' : 'leisurely';
  
  return { style, pace };
}

/**
 * Get initial POI recommendations using configured workflow
 */
export async function getInitialRecommendations({ userLocation, userPreferences = {}, selectedPOIs = [] }) {
  const workflow = getStepPlannerWorkflow();
  const context = createWorkflowContext(workflow, 'getInitialRecommendations', {
    hasLocation: !!userLocation,
    preferencesCount: Object.keys(userPreferences).length,
    selectedPOIsCount: selectedPOIs.length
  });
  
  debugLog(`Getting initial recommendations using ${workflow} workflow`, context.metadata);

  try {
    // Route to appropriate workflow
    const result = await executeWorkflowForInitialRecommendations(workflow, {
      userLocation,
      userPreferences,
      selectedPOIs,
      context
    });
    
    if (result.success) {
      context.success({ workflow, source: result.source });
      return result;
    } else {
      throw new Error(result.error || 'Initial recommendations failed');
    }
    
  } catch (error) {
    debugLog(`${workflow} workflow failed: ${error.message}`);
    
    const fallbackInfo = context.failure(error);
    if (fallbackInfo.shouldFallback) {
      debugLog(`Attempting fallback to ${fallbackInfo.fallbackWorkflow} workflow`);
      
      try {
        const fallbackResult = await executeWorkflowForInitialRecommendations(fallbackInfo.fallbackWorkflow, {
          userLocation,
          userPreferences,
          selectedPOIs,
          context: createWorkflowContext(fallbackInfo.fallbackWorkflow, 'getInitialRecommendations-fallback')
        });
        
        if (fallbackResult.success) {
          logWorkflowUsage(fallbackInfo.fallbackWorkflow, 'getInitialRecommendations-fallback', {
            originalWorkflow: workflow,
            fallbackSuccessful: true
          });
          return fallbackResult;
        }
      } catch (fallbackError) {
        debugLog(`Fallback workflow also failed: ${fallbackError.message}`);
      }
    }
    
    // Ultimate fallback to basic system
    return await executeBasicInitialRecommendations({ userLocation, userPreferences, selectedPOIs });
  }
}

/**
 * Execute workflow-specific logic for initial recommendations
 */
async function executeWorkflowForInitialRecommendations(workflow, { userLocation, userPreferences, selectedPOIs, context }) {
  switch (workflow) {
    case 'strict':
      return await executeStrictInitialRecommendations({ userLocation, userPreferences, selectedPOIs });
    
    case 'enhanced':
      return await executeEnhancedInitialRecommendations({ userLocation, userPreferences, selectedPOIs });
    
    case 'basic':
    default:
      return await executeBasicInitialRecommendations({ userLocation, userPreferences, selectedPOIs });
  }
}

/**
 * Execute strict AI workflow for initial recommendations
 */
async function executeStrictInitialRecommendations({ userLocation, userPreferences, selectedPOIs }) {
  // Check if enhanced features (PostgreSQL) are available
  const hasEnhanced = await hasEnhancedFeatures();
  
  if (!hasEnhanced) {
    throw new Error('Strict workflow requires enhanced features (PostgreSQL)');
  }
  
  debugLog(`Executing strict AI workflow for initial recommendations`);
  
  // Use strict AI workflow for initial recommendation
  const aiWorkflowResult = await executeAIRoundWorkflow({
    currentRound: 1,
    userPreferences,
    selectedPOIs,
    totalPOIs: userPreferences.numberOfPOIs || 5,
    userLocation
  });
  
  if (aiWorkflowResult.success) {
    debugLog(`Strict AI workflow successful`, {
      selectedPOI: aiWorkflowResult.selectedPOI.name,
      source: 'strict_ai_workflow'
    });
    
    return {
      success: true,
      recommendations: [aiWorkflowResult.selectedPOI], // Return single POI from AI workflow
      source: 'strict_ai_workflow',
      location: userLocation || RHODES_CENTER,
      aiMetadata: {
        roundDecision: aiWorkflowResult.aiDecision,
        aiReasoning: aiWorkflowResult.selectedPOI.aiReasoning,
        fitScore: aiWorkflowResult.selectedPOI.fitScore
      }
    };
  } else {
    throw new Error(`Strict AI workflow failed: ${aiWorkflowResult.error}`);
  }
}

/**
 * Execute enhanced POI system for initial recommendations
 */
async function executeEnhancedInitialRecommendations({ userLocation, userPreferences, selectedPOIs }) {
  // Check if enhanced features are available
  const hasEnhanced = await hasEnhancedFeatures();
  
  if (!hasEnhanced) {
    throw new Error('Enhanced workflow requires enhanced features (PostgreSQL)');
  }
  
  debugLog(`Executing enhanced POI workflow for initial recommendations`);
  
  const searchLocation = userLocation || RHODES_CENTER;
  const excludeNames = selectedPOIs.map(poi => poi.name);
  const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
  
  const recommendations = await getContextualRecommendations({
    lat: searchLocation.lat,
    lng: searchLocation.lng,
    userPreferences,
    timeOfDay: 'morning',
    activityType: 'sightseeing',
    excludeNames,
    excludeIds
  });

  if (recommendations && recommendations.length > 0) {
    debugLog(`Enhanced POI workflow successful`, { count: recommendations.length });
    return {
      success: true,
      recommendations: recommendations.slice(0, 5),
      source: 'enhanced_spatial',
      location: searchLocation
    };
  } else {
    throw new Error('Enhanced POI workflow returned no recommendations');
  }
}

/**
 * Execute basic fallback system for initial recommendations
 */
async function executeBasicInitialRecommendations({ userLocation, userPreferences, selectedPOIs }) {
  debugLog(`Executing basic fallback workflow for initial recommendations`);
  
  const searchLocation = userLocation || RHODES_CENTER;
  const excludeNames = selectedPOIs.map(poi => poi.name);
  const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
  
  // Filter default POIs
  const fallbackRecommendations = DEFAULT_FALLBACK_POIS.filter(poi => {
    const nameExcluded = excludeNames && excludeNames.includes(poi.name);
    const idExcluded = excludeIds && (poi.place_id && excludeIds.includes(poi.place_id) || poi.id && excludeIds.includes(poi.id));
    return !nameExcluded && !idExcluded;
  });

  return {
    success: true,
    recommendations: fallbackRecommendations.slice(0, 5),
    source: 'basic_fallback',
    location: searchLocation
  };
}


/**
 * Get next POI recommendations using configured workflow
 */
export async function getNextRecommendations({ userLocation, userPreferences = {}, selectedPOIs = [], currentStep = 1 }) {
  const workflow = getStepPlannerWorkflow();
  const context = createWorkflowContext(workflow, 'getNextRecommendations', {
    currentStep,
    selectedPOICount: selectedPOIs.length,
    hasLocation: !!userLocation,
    selectedPOINames: selectedPOIs.map(p => p.name)
  });
  
  debugLog(`Getting next recommendations using ${workflow} workflow`, context.metadata);

  try {
    // Route to appropriate workflow
    const result = await executeWorkflowForNextRecommendations(workflow, {
      userLocation,
      userPreferences,
      selectedPOIs,
      currentStep,
      context
    });
    
    if (result.success) {
      context.success({ workflow, source: result.source, currentStep });
      return result;
    } else {
      throw new Error(result.error || 'Next recommendations failed');
    }
    
  } catch (error) {
    debugLog(`${workflow} workflow failed for step ${currentStep}: ${error.message}`);
    
    const fallbackInfo = context.failure(error);
    if (fallbackInfo.shouldFallback) {
      debugLog(`Attempting fallback to ${fallbackInfo.fallbackWorkflow} workflow`);
      
      try {
        const fallbackResult = await executeWorkflowForNextRecommendations(fallbackInfo.fallbackWorkflow, {
          userLocation,
          userPreferences,
          selectedPOIs,
          currentStep,
          context: createWorkflowContext(fallbackInfo.fallbackWorkflow, 'getNextRecommendations-fallback')
        });
        
        if (fallbackResult.success) {
          logWorkflowUsage(fallbackInfo.fallbackWorkflow, 'getNextRecommendations-fallback', {
            originalWorkflow: workflow,
            fallbackSuccessful: true,
            currentStep
          });
          return fallbackResult;
        }
      } catch (fallbackError) {
        debugLog(`Fallback workflow also failed: ${fallbackError.message}`);
      }
    }
    
    // Ultimate fallback to basic system
    return await executeBasicNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep });
  }
}

/**
 * Execute workflow-specific logic for next recommendations
 */
async function executeWorkflowForNextRecommendations(workflow, { userLocation, userPreferences, selectedPOIs, currentStep, context }) {
  switch (workflow) {
    case 'strict':
      return await executeStrictNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep });
    
    case 'enhanced':
      return await executeEnhancedNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep });
    
    case 'basic':
    default:
      return await executeBasicNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep });
  }
}

/**
 * Execute strict AI workflow for next recommendations
 */
async function executeStrictNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep }) {
  // Check if enhanced features (PostgreSQL) are available
  const hasEnhanced = await hasEnhancedFeatures();
  
  if (!hasEnhanced) {
    throw new Error('Strict workflow requires enhanced features (PostgreSQL)');
  }
  
  debugLog(`Executing strict AI workflow for step ${currentStep}`);
  
  // Use strict AI workflow for sequential recommendation
  const aiWorkflowResult = await executeAIRoundWorkflow({
    currentRound: currentStep,
    userPreferences,
    selectedPOIs,
    totalPOIs: userPreferences.numberOfPOIs || 5,
    userLocation
  });
  
  if (aiWorkflowResult.success) {
    debugLog(`Strict AI workflow successful for step ${currentStep}`, {
      selectedPOI: aiWorkflowResult.selectedPOI.name,
      source: 'strict_ai_workflow'
    });
    
    // Determine search location for response
    const lastPOI = selectedPOIs[selectedPOIs.length - 1];
    const searchLocation = lastPOI?.location?.coordinates || userLocation || RHODES_CENTER;
    
    return {
      success: true,
      recommendations: [aiWorkflowResult.selectedPOI], // Return single POI from AI workflow
      source: 'strict_ai_workflow',
      location: searchLocation,
      context: { currentStep, selectedPOIs: selectedPOIs.length },
      aiMetadata: {
        roundDecision: aiWorkflowResult.aiDecision,
        aiReasoning: aiWorkflowResult.selectedPOI.aiReasoning,
        fitScore: aiWorkflowResult.selectedPOI.fitScore,
        spatialLogic: aiWorkflowResult.selectedPOI.spatialLogic
      }
    };
  } else {
    throw new Error(`Strict AI workflow failed: ${aiWorkflowResult.error}`);
  }
}

/**
 * Execute enhanced POI system for next recommendations
 */
async function executeEnhancedNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep }) {
  // Check if enhanced features are available
  const hasEnhanced = await hasEnhancedFeatures();
  
  if (!hasEnhanced) {
    throw new Error('Enhanced workflow requires enhanced features (PostgreSQL)');
  }
  
  debugLog(`Executing enhanced POI workflow for step ${currentStep}`);
  
  const lastPOI = selectedPOIs[selectedPOIs.length - 1];
  const searchLocation = lastPOI?.location?.coordinates || userLocation || RHODES_CENTER;
  const excludeNames = selectedPOIs.map(poi => poi.name);
  const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
  
  const activityType = determineActivityType(currentStep, userPreferences, selectedPOIs);
  const timeOfDay = determineTimeOfDay(currentStep);

  debugLog(`Enhanced search parameters`, { 
    searchLocation, activityType, timeOfDay, currentStep
  });

  const recommendations = await getContextualRecommendations({
    lat: searchLocation.lat,
    lng: searchLocation.lng,
    userPreferences,
    timeOfDay,
    activityType,
    excludeNames,
    excludeIds,
    selectedPOIs
  });

  if (recommendations && recommendations.length > 0) {
    debugLog(`Enhanced POI workflow successful`, { 
      totalFound: recommendations.length, activityType, timeOfDay 
    });

    return {
      success: true,
      recommendations: recommendations.slice(0, 5),
      source: 'enhanced_contextual',
      location: searchLocation,
      context: { activityType, timeOfDay, currentStep, selectedPOIs }
    };
  } else {
    throw new Error('Enhanced POI workflow returned no recommendations');
  }
}

/**
 * Execute basic fallback system for next recommendations
 */
async function executeBasicNextRecommendations({ userLocation, userPreferences, selectedPOIs, currentStep }) {
  debugLog(`Executing basic fallback workflow for next recommendations`);
  
  const lastPOI = selectedPOIs[selectedPOIs.length - 1];
  const searchLocation = lastPOI?.location?.coordinates || userLocation || RHODES_CENTER;
  const excludeNames = selectedPOIs.map(poi => poi.name);
  const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
  
  // Filter default POIs
  const fallbackRecommendations = DEFAULT_FALLBACK_POIS.filter(poi => {
    const nameExcluded = excludeNames && excludeNames.includes(poi.name);
    const idExcluded = excludeIds && (poi.place_id && excludeIds.includes(poi.place_id) || poi.id && excludeIds.includes(poi.id));
    const selectedExcluded = selectedPOIs && selectedPOIs.some(selected => selected.name === poi.name);
    return !nameExcluded && !idExcluded && !selectedExcluded;
  });

  return {
    success: true,
    recommendations: fallbackRecommendations.slice(0, 5),
    source: 'basic_filtered_fallback',
    location: searchLocation
  };
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
  const workflow = getStepPlannerWorkflow();

  debugLog(`Step handler called with ${workflow} workflow`, { 
    step,
    workflow,
    hasLocation: !!userLocation,
    currentStep: currentStep || 1,
    selectedPOICount: selectedPOIs?.length || 0 
  });

  try {
    let result;

    switch (step) {
      case 'GET_INITIAL_RECOMMENDATIONS':
        result = await getInitialRecommendations({ userLocation, userPreferences, selectedPOIs });
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
      workflow,
      resultType: result.source || 'unknown',
      recommendationCount: result.recommendations?.length || 0 
    });

    // Log successful workflow usage
    if (result.source) {
      logWorkflowUsage(result.source, `poi-step-${step}`, {
        success: true,
        recommendationCount: result.recommendations?.length || 0,
        currentStep: currentStep || 1
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    debugLog(`Step handler error: ${error.message}`, { step, workflow, error: error.stack });
    
    // Log failed workflow usage
    logWorkflowUsage(workflow, `poi-step-${step}`, {
      success: false,
      error: error.message,
      currentStep: currentStep || 1
    });
    
    return res.status(500).json({
      success: false,
      error: error.message,
      step
    });
  }
} 