/**
 * Step-by-Step Travel Planning Handler with AI Knowledge Base Integration
 * Provides intelligent POI recommendations using curated Rhodes dataset
 */

import { OpenAI } from 'openai';
import { hasEnhancedFeatures, getContextualRecommendations, getEnhancedNearbyPlaces } from './enhanced-chat-tools.js';
import { aiDatabaseTools } from './ai-database-tools.js';
import { processAIToolCalls, generatePOIReasoning } from './ai-response-processor.js';

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
 * AI-powered initial POI recommendations
 * Uses OpenAI with database tools to find optimal starting POIs
 */
async function getAIInitialRecommendations({ userLocation, userPreferences, selectedPOIs }) {
  const hasLocation = userLocation?.lat && userLocation?.lng;
  const excludeNames = selectedPOIs.map(poi => poi.name);
  
  debugLog('AI Initial Recommendations', {
    hasLocation,
    userPreferences,
    excludeNamesCount: excludeNames.length
  });

  const systemPrompt = `You are a Rhodes travel expert with access to a PostgreSQL database containing 2,651 verified POIs and spatial relationships.

CRITICAL RULES:
- NEVER recommend hotels, accommodations, or lodging
- Focus ONLY on attractions, restaurants, beaches, museums, activities
- Use database tools to query real POI data, never generate fake locations

INITIAL RECOMMENDATION STRATEGY:
${hasLocation 
  ? '- User has provided location: Use search_pois_by_location_and_preferences to find nearby POIs matching their interests'
  : '- No user location: Use get_must_see_rhodes_attractions for top island highlights'
}

GOAL: Find 5 diverse, high-quality POIs that create an excellent starting point for Rhodes exploration.

User Context:
- Location: ${hasLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Not provided'}
- Interests: ${userPreferences.interests?.join(', ') || 'Not specified'}
- Budget: ${userPreferences.budget || 'Not specified'}
- Transport: ${userPreferences.transport || 'Not specified'}
- Exclude: ${excludeNames.join(', ') || 'None'}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Find perfect initial POI recommendations for Rhodes travel.
          
          ${hasLocation ? 
            `User is located at: ${userLocation.lat}, ${userLocation.lng}. Find nearby POIs matching their preferences.` :
            'No location provided. Recommend must-see Rhodes attractions that would appeal to any visitor.'
          }
          
          User preferences: ${JSON.stringify(userPreferences)}
          
          Use the database tools to find real, verified POIs from our knowledge base. Select 5 diverse options.`
        }
      ],
      tools: aiDatabaseTools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      })),
      tool_choice: "auto"
    });

    debugLog('OpenAI API response received', { 
      hasToolCalls: !!(response.choices?.[0]?.message?.tool_calls),
      toolCallCount: response.choices?.[0]?.message?.tool_calls?.length || 0
    });

    // Process AI tool calls and return recommendations
    return await processAIToolCalls(response, excludeNames, []);

  } catch (error) {
    debugLog(`AI initial recommendations failed: ${error.message}`);
    throw error;
  }
}

/**
 * AI-powered sequential POI recommendations
 * Analyzes travel pattern and suggests contextual next steps
 */
async function getAISequentialRecommendations({ selectedPOIs, userLocation, userPreferences, currentStep, excludeNames }) {
  const lastPOI = selectedPOIs[selectedPOIs.length - 1];
  const travelPattern = analyzeTravelPattern(selectedPOIs);
  
  debugLog('AI Sequential Recommendations', {
    currentStep,
    selectedPOIsCount: selectedPOIs.length,
    lastPOI: lastPOI?.name,
    travelPattern,
    excludeNamesCount: excludeNames.length
  });

  const systemPrompt = `You are a Rhodes travel expert analyzing a user's travel journey to recommend the perfect next destinations.

CRITICAL RULES:
- NEVER recommend hotels, accommodations, or lodging
- Analyze the complete travel pattern to suggest logical next experiences
- Use spatial relationships and contextual reasoning
- Ensure variety while maintaining travel flow coherence

SEQUENTIAL REASONING STRATEGY:
1. Analyze ALL previously selected POIs to understand user preferences
2. Use get_contextual_next_pois to find spatially related options from last POI
3. Consider travel variety, timing, and logical progression
4. Recommend POIs that complement the existing journey

CONTEXT ANALYSIS:
- Current step: ${currentStep}
- Travel pattern: ${travelPattern.style} (${travelPattern.pace})
- Journey so far: ${selectedPOIs.map(p => `${p.name} (${p.type})`).join(' → ')}
- Last location: ${lastPOI?.name} at ${lastPOI?.latitude}, ${lastPOI?.longitude}
- User preferences: ${JSON.stringify(userPreferences)}
- Exclude: ${excludeNames.join(', ')}

GOAL: Find 5 POIs that create perfect logical flow from the established travel pattern.`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Plan step ${currentStep} recommendations based on the established travel journey.
          
          Journey analysis:
          ${selectedPOIs.map((poi, i) => `${i+1}. ${poi.name} (${poi.type}) - ${poi.description || 'No description'}`).join('\n')}
          
          What should come next to create optimal travel flow and variety? Use database tools to find contextually appropriate POIs.`
        }
      ],
      tools: aiDatabaseTools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      })),
      tool_choice: "auto"
    });

    debugLog('Sequential AI response received', { 
      hasToolCalls: !!(response.choices?.[0]?.message?.tool_calls),
      toolCallCount: response.choices?.[0]?.message?.tool_calls?.length || 0
    });

    // Process AI tool calls and return recommendations
    const recommendations = await processAIToolCalls(response, excludeNames, []);
    
    // Add AI reasoning to each recommendation
    return recommendations.map(poi => ({
      ...poi,
      aiReasoning: generatePOIReasoning(poi, { stepNumber: currentStep, selectedPOIs, userPreferences })
    }));

  } catch (error) {
    debugLog(`AI sequential recommendations failed: ${error.message}`);
    throw error;
  }
}

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
 * Get initial POI recommendations with AI reasoning
 */
export async function getInitialRecommendations({ userLocation, userPreferences = {}, selectedPOIs = [] }) {
  debugLog(`Getting AI-powered initial recommendations`, { 
    hasLocation: !!userLocation,
    userLocation: userLocation || 'none',
    preferencesCount: Object.keys(userPreferences).length,
    selectedPOIsCount: selectedPOIs.length
  });

  try {
    // Check if enhanced features (PostgreSQL) are available
    const hasEnhanced = await hasEnhancedFeatures();
    
    if (hasEnhanced) {
      debugLog(`Attempting AI knowledge base recommendations`);
      const aiResult = await getAIInitialRecommendations({
        userLocation,
        userPreferences,
        selectedPOIs
      });
      
      if (aiResult && aiResult.length > 0) {
        debugLog(`AI recommendations successful`, {
          count: aiResult.length,
          source: 'ai_database_tools'
        });
        
        return {
          success: true,
          recommendations: aiResult,
          source: 'ai_knowledge_base',
          location: userLocation || RHODES_CENTER
        };
      }
    }
  } catch (aiError) {
    debugLog(`AI recommendations failed, falling back to enhanced system: ${aiError.message}`);
  }

  // Fallback to enhanced POI system
  try {
    const searchLocation = userLocation || RHODES_CENTER;
    const excludeNames = selectedPOIs.map(poi => poi.name);
    const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
    
    const hasEnhanced = await hasEnhancedFeatures();
    debugLog(`Enhanced features fallback status: ${hasEnhanced ? 'ACTIVE' : 'INACTIVE'}`);

    if (hasEnhanced) {
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
        debugLog(`Enhanced fallback successful`, { count: recommendations.length });
        return {
          success: true,
          recommendations: recommendations.slice(0, 5),
          source: 'enhanced_spatial_fallback',
          location: searchLocation
        };
      }
    }

    // Final fallback to default POIs
    debugLog(`Using default POI fallback`);
    const fallbackRecommendations = DEFAULT_FALLBACK_POIS.filter(poi => {
      const nameExcluded = excludeNames && excludeNames.includes(poi.name);
      const idExcluded = excludeIds && (poi.place_id && excludeIds.includes(poi.place_id) || poi.id && excludeIds.includes(poi.id));
      return !nameExcluded && !idExcluded;
    });

    return {
      success: true,
      recommendations: fallbackRecommendations.slice(0, 5),
      source: 'default_fallback',
      location: searchLocation
    };

  } catch (error) {
    debugLog(`All recommendation methods failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get next POI recommendations with AI reasoning and full travel plan context
 */
export async function getNextRecommendations({ userLocation, userPreferences = {}, selectedPOIs = [], currentStep = 1 }) {
  debugLog(`Getting AI-powered next recommendations`, { 
    currentStep,
    selectedPOICount: selectedPOIs.length,
    hasLocation: !!userLocation,
    selectedPOINames: selectedPOIs.map(p => p.name)
  });

  try {
    // Check if enhanced features (PostgreSQL) are available
    const hasEnhanced = await hasEnhancedFeatures();
    
    if (hasEnhanced) {
      debugLog(`Attempting AI sequential recommendations for step ${currentStep}`);
      const excludeNames = selectedPOIs.map(poi => poi.name);
      
      const aiResult = await getAISequentialRecommendations({
        selectedPOIs,
        userLocation,
        userPreferences,
        currentStep,
        excludeNames
      });
      
      if (aiResult && aiResult.length > 0) {
        debugLog(`AI sequential recommendations successful`, {
          count: aiResult.length,
          source: 'ai_sequential_reasoning'
        });
        
        // Determine search location for response
        const lastPOI = selectedPOIs[selectedPOIs.length - 1];
        const searchLocation = lastPOI?.location?.coordinates || userLocation || RHODES_CENTER;
        
        return {
          success: true,
          recommendations: aiResult,
          source: 'ai_sequential_reasoning',
          location: searchLocation,
          context: { currentStep, selectedPOIs: selectedPOIs.length }
        };
      }
    }
  } catch (aiError) {
    debugLog(`AI sequential recommendations failed, falling back to enhanced system: ${aiError.message}`);
  }

  // Fallback to enhanced POI system
  try {
    const lastPOI = selectedPOIs[selectedPOIs.length - 1];
    const searchLocation = lastPOI?.location?.coordinates || userLocation || RHODES_CENTER;
    const excludeNames = selectedPOIs.map(poi => poi.name);
    const excludeIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
    
    const hasEnhanced = await hasEnhancedFeatures();
    
    if (hasEnhanced) {
      const activityType = determineActivityType(currentStep, userPreferences, selectedPOIs);
      const timeOfDay = determineTimeOfDay(currentStep);

      debugLog(`Enhanced fallback search parameters`, { 
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
        debugLog(`Enhanced fallback successful`, { 
          totalFound: recommendations.length, activityType, timeOfDay 
        });

        return {
          success: true,
          recommendations: recommendations.slice(0, 5),
          source: 'enhanced_contextual_fallback',
          location: searchLocation,
          context: { activityType, timeOfDay, currentStep, selectedPOIs }
        };
      }
    }

    // Final fallback to default POIs
    debugLog(`Using default POI fallback for next recommendations`);
    const fallbackRecommendations = DEFAULT_FALLBACK_POIS.filter(poi => {
      const nameExcluded = excludeNames && excludeNames.includes(poi.name);
      const idExcluded = excludeIds && (poi.place_id && excludeIds.includes(poi.place_id) || poi.id && excludeIds.includes(poi.id));
      const selectedExcluded = selectedPOIs && selectedPOIs.some(selected => selected.name === poi.name);
      return !nameExcluded && !idExcluded && !selectedExcluded;
    });

    return {
      success: true,
      recommendations: fallbackRecommendations.slice(0, 5),
      source: 'default_filtered_fallback',
      location: searchLocation
    };

  } catch (error) {
    debugLog(`All next recommendation methods failed: ${error.message}`);
    throw error;
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