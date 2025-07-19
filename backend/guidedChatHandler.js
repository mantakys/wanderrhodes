/**
 * Guided Chat Handler - Combines step-by-step POI selection with chat UI
 * Flow: Preferences → POI Type Rounds → Open Chat Mode
 */

import { getInitialRecommendations, getNextRecommendations } from './stepHandler.js';
import { hasEnhancedFeatures, getContextualRecommendations } from './enhanced-chat-tools.js';
import { getTravelTime } from './tools/mapbox.js';
import { createIntelligentPlanStrategy, executeIntelligentRound } from './intelligentRoundPlanner.js';

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_GUIDED' : '🔍 DEV_GUIDED';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

// POI type round configuration
const POI_ROUNDS = [
  {
    round: 1,
    type: 'restaurant',
    title: "Let's start with dining! 🍽️",
    description: "Choose 1-2 restaurants that match your taste",
    emoji: "🍽️",
    maxSelections: 2,
    contextualPrompt: "Based on your preferences for {PREFERENCE_CONTEXT}, here are some excellent dining options"
  },
  {
    round: 2,  
    type: 'beach',
    title: "Time for some beach relaxation! 🏖️",
    description: "Select beaches that complement your dining choices",
    emoji: "🏖️",
    maxSelections: 2,
    contextualPrompt: "Perfect restaurant choices! Now let's find beautiful beaches near your selected dining spots"
  },
  {
    round: 3,
    type: 'attraction',
    title: "Let's add some culture and sights! 🏛️", 
    description: "Choose attractions and cultural experiences",
    emoji: "🏛️",
    maxSelections: 2,
    contextualPrompt: "Excellent selections! For cultural experiences, these attractions will complete your Rhodes adventure"
  },
  {
    round: 4,
    type: 'shopping',
    title: "Want to add some shopping? 🛍️",
    description: "Optional: Add shopping or local markets",
    emoji: "🛍️",
    maxSelections: 1,
    optional: true,
    contextualPrompt: "If you'd like to do some shopping, these local spots offer authentic Rhodes experiences"
  }
];

/**
 * Handle guided chat requests - routes between POI rounds and open chat
 */
export default async function guidedChatHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { 
      action,
      userPreferences = {},
      userLocation = null,
      selectedPOIs = [],
      currentRound = 1,
      chatHistory = [],
      userMessage = null,
      planStrategy = null
    } = req.body;

    debugLog(`Guided chat request`, { 
      action, 
      currentRound, 
      selectedPOIsCount: selectedPOIs.length,
      hasUserMessage: !!userMessage,
      userPreferences: Object.keys(userPreferences)
    });

    switch (action) {
      case 'CREATE_PLAN_STRATEGY':
        return await handleCreatePlanStrategy(req, res, {
          userPreferences,
          userLocation
        });

      case 'GET_INTELLIGENT_ROUND':
        return await handleIntelligentRound(req, res, {
          userPreferences,
          userLocation,
          selectedPOIs,
          currentRound,
          planStrategy
        });

      case 'COMPLETE_ROUND':
        return await handleRoundCompletion(req, res, {
          userPreferences,
          userLocation,
          selectedPOIs,
          currentRound,
          planStrategy
        });

      case 'OPEN_CHAT':
        return await handleOpenChat(req, res, {
          userPreferences,
          userLocation,
          selectedPOIs,
          chatHistory,
          userMessage
        });

      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          validActions: ['CREATE_PLAN_STRATEGY', 'GET_INTELLIGENT_ROUND', 'COMPLETE_ROUND', 'OPEN_CHAT']
        });
    }

  } catch (error) {
    debugLog(`Guided chat error: ${error.message}`);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Create AI-driven plan strategy based on user preferences
 */
async function handleCreatePlanStrategy(req, res, { userPreferences, userLocation }) {
  try {
    debugLog('Creating intelligent plan strategy', { 
      preferencesCount: Object.keys(userPreferences).length,
      hasLocation: !!userLocation 
    });

    const strategy = await createIntelligentPlanStrategy(userPreferences, userLocation);

    if (strategy.success) {
      return res.status(200).json({
        success: true,
        strategy: strategy.strategy,
        aiGenerated: strategy.aiGenerated,
        message: `🧠 AI has created your personalized ${strategy.strategy.rounds.length}-round discovery plan: ${strategy.strategy.rationale}`,
        systemStatus: {
          enhancedFeatures: await hasEnhancedFeatures(),
          source: 'intelligent_ai_planner'
        }
      });
    } else {
      throw new Error('Failed to create plan strategy');
    }

  } catch (error) {
    debugLog(`Plan strategy creation error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to create plan strategy',
      details: error.message
    });
  }
}

/**
 * Execute intelligent round using AI-driven POI type selection and KB querying
 */
async function handleIntelligentRound(req, res, { userPreferences, userLocation, selectedPOIs, currentRound, planStrategy }) {
  try {
    if (!planStrategy || !planStrategy.rounds) {
      return res.status(400).json({
        error: 'Plan strategy required for intelligent rounds',
        hint: 'Call CREATE_PLAN_STRATEGY first'
      });
    }

    const roundConfig = planStrategy.rounds[currentRound - 1];
    
    if (!roundConfig) {
      return res.status(400).json({
        error: 'Invalid round number',
        maxRounds: planStrategy.rounds.length
      });
    }

    debugLog(`Executing intelligent round ${currentRound}`, {
      poiType: roundConfig.poiType,
      title: roundConfig.title
    });

    // Execute intelligent round with AI-driven KB queries
    const roundResult = await executeIntelligentRound(roundConfig, userPreferences, userLocation, selectedPOIs);

    if (roundResult.success) {
      return res.status(200).json({
        success: true,
        round: roundResult.round,
        recommendations: roundResult.recommendations,
        contextualPrompt: `🎯 ${roundResult.round.title}: ${roundResult.round.reasoning}`,
        hasMore: roundResult.recommendations.length >= 5,
        systemStatus: {
          enhancedFeatures: await hasEnhancedFeatures(),
          source: roundResult.source,
          metadata: roundResult.metadata
        }
      });
    } else {
      throw new Error(roundResult.error || 'Intelligent round execution failed');
    }

  } catch (error) {
    debugLog(`Intelligent round error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute intelligent round',
      details: error.message
    });
  }
}

/**
 * Handle round completion and prepare for next round or open chat
 */
async function handleRoundCompletion(req, res, { userPreferences, userLocation, selectedPOIs, currentRound, planStrategy }) {
  try {
    if (!planStrategy || !planStrategy.rounds) {
      return res.status(400).json({
        error: 'Plan strategy required for round completion'
      });
    }

    const currentRoundConfig = planStrategy.rounds[currentRound - 1];
    const nextRound = currentRound + 1;
    const nextRoundConfig = planStrategy.rounds[nextRound - 1];

    debugLog(`Completing intelligent round ${currentRound}`, {
      roundType: currentRoundConfig?.poiType,
      selectedPOIsCount: selectedPOIs.length,
      hasNextRound: !!nextRoundConfig
    });

    // Calculate travel times between selected POIs
    const optimizedPlan = await addTravelTimesToPlan(selectedPOIs, userLocation);

    if (nextRoundConfig) {
      // Continue to next AI-determined round
      return res.status(200).json({
        success: true,
        action: 'CONTINUE_TO_NEXT_ROUND',
        completedRound: currentRound,
        nextRound: nextRound,
        plan: optimizedPlan,
        nextRoundPreview: {
          title: nextRoundConfig.title,
          reasoning: nextRoundConfig.reasoning,
          poiType: nextRoundConfig.poiType
        },
        message: `Great selection! Next: ${nextRoundConfig.title}`
      });
    } else {
      // All AI-planned rounds complete - ready for open chat
      return res.status(200).json({
        success: true,
        action: 'PLAN_COMPLETE',
        completedRound: currentRound,
        finalPlan: optimizedPlan,
        message: `🎉 Your AI-curated Rhodes adventure is complete! You have ${selectedPOIs.length} perfectly selected stops. Now you can chat freely to add more places, get local tips, or optimize your route!`,
        strategyComplete: true
      });
    }

  } catch (error) {
    debugLog(`Round completion error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete round',
      details: error.message
    });
  }
}

/**
 * Handle open chat mode after plan completion
 */
async function handleOpenChat(req, res, { userPreferences, userLocation, selectedPOIs, chatHistory, userMessage }) {
  try {
    debugLog(`Open chat mode`, {
      hasUserMessage: !!userMessage,
      chatHistoryLength: chatHistory.length,
      planSize: selectedPOIs.length
    });

    // Import the regular chatHandler for open chat mode
    const { default: chatHandler } = await import('./chatHandler.js');
    
    // Enhance request with plan context
    const enhancedReq = {
      ...req,
      body: {
        ...req.body,
        history: chatHistory,
        prompt: userMessage,
        userLocation,
        userPreferences,
        planContext: {
          selectedPOIs,
          planComplete: true,
          mode: 'open_chat'
        }
      }
    };

    // Use regular chat handler for open chat
    return await chatHandler(enhancedReq, res);

  } catch (error) {
    debugLog(`Open chat error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to process open chat',
      details: error.message
    });
  }
}

/**
 * Check if POI type matches round type
 */
function matchesPOIType(poiType, roundType) {
  const typeMapping = {
    'restaurant': ['restaurant', 'taverna', 'cafe', 'bar', 'dining'],
    'beach': ['beach', 'swimming', 'water'],
    'attraction': ['attraction', 'museum', 'historical_site', 'monument', 'landmark', 'cultural'],
    'shopping': ['shopping', 'market', 'store', 'souvenir']
  };

  const validTypes = typeMapping[roundType] || [roundType];
  return validTypes.some(type => 
    poiType.toLowerCase().includes(type.toLowerCase()) ||
    type.toLowerCase().includes(poiType.toLowerCase())
  );
}

/**
 * Generate contextual prompt for each round
 */
function generateContextualPrompt(roundConfig, userPreferences, selectedPOIs) {
  let prompt = roundConfig.contextualPrompt;

  // Replace preference context
  const preferenceContext = [];
  if (userPreferences.budget) preferenceContext.push(userPreferences.budget);
  if (userPreferences.pace) preferenceContext.push(`${userPreferences.pace} pace`);
  if (userPreferences.companions) preferenceContext.push(`${userPreferences.companions} travel`);
  
  const contextString = preferenceContext.length > 0 
    ? preferenceContext.join(', ')
    : 'authentic experiences';
    
  prompt = prompt.replace('{PREFERENCE_CONTEXT}', contextString);

  // Add spatial context if POIs already selected
  if (selectedPOIs.length > 0) {
    const lastPOI = selectedPOIs[selectedPOIs.length - 1];
    prompt += ` near ${lastPOI.name}`;
  }

  return prompt;
}

/**
 * Add travel times between POIs in the plan
 */
async function addTravelTimesToPlan(selectedPOIs, userLocation) {
  if (selectedPOIs.length < 2) return selectedPOIs;

  const optimizedPlan = [...selectedPOIs];

  try {
    // Add travel time to first POI from user location
    if (userLocation && optimizedPlan[0]) {
      const origin = `${userLocation.lat},${userLocation.lng}`;
      const destination = `${optimizedPlan[0].latitude},${optimizedPlan[0].longitude}`;
      
      const travelTime = await getTravelTime({ origin, destination });
      if (travelTime) {
        optimizedPlan[0].travel = {
          distanceMeters: travelTime.distance_m,
          durationMinutes: Math.round(travelTime.duration_s / 60)
        };
      }
    }

    // Add travel times between consecutive POIs
    for (let i = 1; i < optimizedPlan.length; i++) {
      const prevPOI = optimizedPlan[i - 1];
      const currentPOI = optimizedPlan[i];
      
      const origin = `${prevPOI.latitude},${prevPOI.longitude}`;
      const destination = `${currentPOI.latitude},${currentPOI.longitude}`;
      
      const travelTime = await getTravelTime({ origin, destination });
      if (travelTime) {
        currentPOI.travel = {
          distanceMeters: travelTime.distance_m,
          durationMinutes: Math.round(travelTime.duration_s / 60)
        };
      }
    }

  } catch (error) {
    debugLog(`Travel time calculation error: ${error.message}`);
    // Return plan without travel times on error
  }

  return optimizedPlan;
}