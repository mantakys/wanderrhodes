/**
 * Strict Workflow Controller - AI Decision → Server Query → AI Selection
 * Orchestrates the two-step workflow with validation and error handling
 */

import { OpenAI } from 'openai';
import { 
  validateAIRoundDecision, 
  validateAISelectionDecision, 
  parseAndValidateAIResponse,
  createValidationError,
  sanitizeAIResponse
} from './ai-message-validators.js';
import {
  generateRoundPlanningPrompt,
  generatePOISelectionPrompt,
  generateInitialRoundPrompt,
  validatePromptParameters,
  cleanAIResponseText,
  generateFallbackPrompt
} from './strict-ai-prompts.js';
import {
  searchPOIsByLocation,
  getMustSeeRhodesPOIs,
  getNearbyPOIsFromAnchors
} from './knowledge-base-queries.js';

// Initialize OpenAI
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  console.error('Failed to initialize OpenAI:', error.message);
}

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_WORKFLOW' : '🔍 DEV_WORKFLOW';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

/**
 * Execute complete AI-driven POI recommendation workflow
 * Main entry point for the two-step process
 */
export async function executeAIRoundWorkflow({
  currentRound,
  userPreferences = {},
  selectedPOIs = [],
  totalPOIs = 5,
  userLocation = null
}) {
  debugLog(`Starting AI round workflow`, {
    currentRound,
    selectedPOIsCount: selectedPOIs.length,
    totalPOIs,
    hasLocation: !!userLocation,
    userInterests: userPreferences.interests?.length || 0
  });

  try {
    // Validate OpenAI is available
    if (!openai) {
      throw new Error('OpenAI client not initialized - check API key');
    }

    // STEP 1: AI decides round strategy
    debugLog(`Step 1: AI Round Decision for round ${currentRound}`);
    const roundDecision = await getAIRoundDecision({
      currentRound,
      userPreferences,
      selectedPOIs,
      totalPOIs,
      userLocation
    });

    if (!roundDecision.success) {
      return roundDecision; // Return error from step 1
    }

    debugLog(`AI round decision successful`, {
      roundType: roundDecision.data.round_type,
      searchRadius: roundDecision.data.spatial_strategy.search_radius_meters,
      reasoning: roundDecision.data.reasoning
    });

    // STEP 2: Server queries knowledge base with AI parameters
    debugLog(`Step 2: Server Knowledge Base Query`);
    const candidatePOIs = await queryKnowledgeBaseWithAIParams({
      roundDecision: roundDecision.data,
      selectedPOIs,
      userPreferences
    });

    if (!candidatePOIs.success) {
      return candidatePOIs; // Return error from step 2
    }

    if (candidatePOIs.data.length === 0) {
      return {
        success: false,
        error: 'No candidate POIs found matching AI criteria',
        details: {
          roundDecision: roundDecision.data,
          searchCriteria: candidatePOIs.searchCriteria
        }
      };
    }

    debugLog(`Knowledge base query successful`, {
      candidateCount: candidatePOIs.data.length,
      searchRadius: roundDecision.data.spatial_strategy.search_radius_meters,
      poiTypes: roundDecision.data.poi_criteria.required_types
    });

    // STEP 3: AI selects from real data
    debugLog(`Step 3: AI POI Selection from ${candidatePOIs.data.length} candidates`);
    const selectionDecision = await getAISelectionDecision({
      candidatePOIs: candidatePOIs.data,
      roundNumber: currentRound,
      roundDecision: roundDecision.data,
      userPreferences,
      selectedPOIs
    });

    if (!selectionDecision.success) {
      return selectionDecision; // Return error from step 3
    }

    debugLog(`AI selection decision successful`, {
      selectedPOIId: selectionDecision.data.selected_pois[0].poi_id,
      fitScore: selectionDecision.data.selected_pois[0].fit_score,
      reasoning: selectionDecision.data.selected_pois[0].selection_reasoning
    });

    // STEP 4: Match selected POI with full data and return result
    const finalResult = await buildFinalResult({
      aiSelection: selectionDecision.data,
      candidatePOIs: candidatePOIs.data,
      roundDecision: roundDecision.data,
      currentRound
    });

    debugLog(`AI workflow completed successfully`, {
      currentRound,
      selectedPOI: finalResult.selectedPOI?.name,
      workflowDuration: 'complete'
    });

    return finalResult;

  } catch (error) {
    debugLog(`AI workflow error: ${error.message}`, { currentRound, error: error.stack });
    
    return {
      success: false,
      error: 'AI workflow execution failed',
      details: {
        stage: 'workflow_execution',
        originalError: error.message,
        currentRound,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Get AI round decision with strict validation
 * Step 1: AI decides what type of POI to search for and how
 */
async function getAIRoundDecision({
  currentRound,
  userPreferences,
  selectedPOIs,
  totalPOIs,
  userLocation
}) {
  debugLog(`Getting AI round decision`, { currentRound, selectedPOIsCount: selectedPOIs.length });

  try {
    // Validate parameters
    const paramValidation = validatePromptParameters('ROUND_PLANNING', {
      currentRound,
      userPreferences,
      totalPOIs
    });

    if (!paramValidation.valid) {
      return createValidationError('parameter_validation', paramValidation.error, paramValidation);
    }

    // Generate appropriate prompt based on round number
    const promptData = currentRound === 1 
      ? generateInitialRoundPrompt({ userPreferences, totalPOIs, userLocation })
      : generateRoundPlanningPrompt({ 
          currentRound, 
          userPreferences, 
          selectedPOIs, 
          totalPOIs, 
          userLocation 
        });

    debugLog(`AI round prompt generated`, { 
      promptType: currentRound === 1 ? 'initial' : 'sequential',
      systemPromptLength: promptData.systemPrompt.length
    });

    // Call OpenAI with strict formatting requirements
    let response;
    try {
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Use GPT-4o-mini which supports JSON mode
        messages: [
          { role: "system", content: promptData.systemPrompt },
          { role: "user", content: promptData.userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent structure
        max_tokens: 1000,
        response_format: { type: "json_object" } // Force JSON response
      });
    } catch (openaiError) {
      debugLog(`OpenAI API error: ${openaiError.message}`);
      return createValidationError('openai_api', openaiError.message, { 
        model: "gpt-4o-mini",
        currentRound 
      });
    }

    const rawResponse = response.choices[0].message.content;
    debugLog(`AI round decision raw response received`, { 
      responseLength: rawResponse?.length || 0,
      finishReason: response.choices[0].finish_reason
    });

    // Clean and validate response
    const cleanedResponse = cleanAIResponseText(rawResponse);
    const validationResult = parseAndValidateAIResponse(cleanedResponse, 'ROUND_DECISION');

    if (!validationResult.success) {
      debugLog(`AI round decision validation failed`, validationResult);
      
      // Try fallback prompt if validation failed
      const fallbackPrompt = generateFallbackPrompt(promptData, validationResult.error);
      
      try {
        const fallbackResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: fallbackPrompt }],
          temperature: 0.1,
          max_tokens: 1000,
          response_format: { type: "json_object" }
        });

        const fallbackCleaned = cleanAIResponseText(fallbackResponse.choices[0].message.content);
        const fallbackValidation = parseAndValidateAIResponse(fallbackCleaned, 'ROUND_DECISION');

        if (fallbackValidation.success) {
          debugLog(`Fallback prompt successful`);
          return {
            success: true,
            data: sanitizeAIResponse(fallbackValidation.data),
            source: 'ai_fallback'
          };
        }
      } catch (fallbackError) {
        debugLog(`Fallback prompt also failed: ${fallbackError.message}`);
      }

      return createValidationError('ai_response_validation', validationResult.error, validationResult.details);
    }

    debugLog(`AI round decision validation successful`);
    return {
      success: true,
      data: sanitizeAIResponse(validationResult.data),
      source: 'ai_primary'
    };

  } catch (error) {
    debugLog(`AI round decision error: ${error.message}`);
    return createValidationError('ai_round_decision', error.message, { currentRound });
  }
}

/**
 * Query knowledge base with AI-determined parameters
 * Step 2: Server uses AI decision to query real POI data
 */
async function queryKnowledgeBaseWithAIParams({ roundDecision, selectedPOIs, userPreferences }) {
  debugLog(`Querying knowledge base with AI parameters`, {
    roundType: roundDecision.round_type,
    searchRadius: roundDecision.spatial_strategy.search_radius_meters,
    requiredTypes: roundDecision.poi_criteria.required_types
  });

  try {
    const searchParams = {
      latitude: roundDecision.spatial_strategy.center_coordinates.lat,
      longitude: roundDecision.spatial_strategy.center_coordinates.lng,
      radius_meters: roundDecision.spatial_strategy.search_radius_meters,
      poi_types: roundDecision.poi_criteria.required_types,
      user_preferences: {
        ...userPreferences,
        budget: roundDecision.poi_criteria.budget_level
      },
      exclude_poi_ids: selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean),
      max_results: 15 // Get enough candidates for AI to choose from
    };

    debugLog(`Knowledge base search parameters`, searchParams);

    // Choose appropriate query method based on context
    let candidatePOIs;
    if (selectedPOIs.length === 0) {
      // First round - use must-see or location-based search
      if (searchParams.latitude === 36.4341 && searchParams.longitude === 28.2176) {
        // Default Rhodes center - use must-see POIs
        candidatePOIs = await getMustSeeRhodesPOIs(searchParams);
      } else {
        // User has specific location - use location-based search
        candidatePOIs = await searchPOIsByLocation(searchParams);
      }
    } else {
      // Subsequent rounds - use spatial relationships from anchors
      const anchorPOIIds = selectedPOIs.map(poi => poi.place_id || poi.id).filter(Boolean);
      if (anchorPOIIds.length > 0) {
        candidatePOIs = await getNearbyPOIsFromAnchors({
          anchor_poi_ids: anchorPOIIds,
          max_distance_meters: roundDecision.spatial_strategy.search_radius_meters,
          exclude_poi_ids: searchParams.exclude_poi_ids,
          max_results: searchParams.max_results
        });
      } else {
        // Fallback to location-based search
        candidatePOIs = await searchPOIsByLocation(searchParams);
      }
    }

    // Filter by quality threshold if specified
    if (roundDecision.poi_criteria.quality_threshold && candidatePOIs.length > 0) {
      candidatePOIs = candidatePOIs.filter(poi => 
        !poi.rating || poi.rating >= roundDecision.poi_criteria.quality_threshold
      );
    }

    // Filter by excluded types if specified
    if (roundDecision.poi_criteria.exclude_types && roundDecision.poi_criteria.exclude_types.length > 0) {
      candidatePOIs = candidatePOIs.filter(poi => {
        const poiType = poi.primary_type || poi.type;
        return !roundDecision.poi_criteria.exclude_types.includes(poiType);
      });
    }

    debugLog(`Knowledge base query completed`, {
      totalCandidates: candidatePOIs.length,
      qualityFiltered: !!roundDecision.poi_criteria.quality_threshold,
      typeFiltered: !!roundDecision.poi_criteria.exclude_types?.length
    });

    return {
      success: true,
      data: candidatePOIs,
      searchCriteria: searchParams
    };

  } catch (error) {
    debugLog(`Knowledge base query error: ${error.message}`);
    return {
      success: false,
      error: 'Knowledge base query failed',
      details: {
        originalError: error.message,
        roundDecision: roundDecision.round_type,
        searchParams: {
          radius: roundDecision.spatial_strategy.search_radius_meters,
          types: roundDecision.poi_criteria.required_types
        }
      }
    };
  }
}

/**
 * Get AI POI selection decision with strict validation
 * Step 3: AI selects best POI from real candidate data
 */
async function getAISelectionDecision({
  candidatePOIs,
  roundNumber,
  roundDecision,
  userPreferences,
  selectedPOIs
}) {
  debugLog(`Getting AI selection decision`, { 
    candidateCount: candidatePOIs.length,
    roundNumber,
    roundType: roundDecision.round_type
  });

  try {
    // Validate parameters
    const paramValidation = validatePromptParameters('POI_SELECTION', {
      candidatePOIs,
      roundNumber,
      roundDecision
    });

    if (!paramValidation.valid) {
      return createValidationError('parameter_validation', paramValidation.error, paramValidation);
    }

    // Generate selection prompt
    const promptData = generatePOISelectionPrompt({
      candidatePOIs,
      roundNumber,
      roundDecision,
      userPreferences,
      selectedPOIs
    });

    debugLog(`AI selection prompt generated`, { 
      candidateCount: candidatePOIs.length,
      systemPromptLength: promptData.systemPrompt.length
    });

    // Call OpenAI for POI selection
    let response;
    try {
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: promptData.systemPrompt },
          { role: "user", content: promptData.userPrompt }
        ],
        temperature: 0.2, // Lower temperature for consistent selection
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });
    } catch (openaiError) {
      debugLog(`OpenAI API error in selection: ${openaiError.message}`);
      return createValidationError('openai_api', openaiError.message, { 
        model: "gpt-4o-mini",
        stage: 'selection',
        candidateCount: candidatePOIs.length
      });
    }

    const rawResponse = response.choices[0].message.content;
    debugLog(`AI selection raw response received`, { 
      responseLength: rawResponse?.length || 0,
      finishReason: response.choices[0].finish_reason
    });

    // Clean and validate response
    const cleanedResponse = cleanAIResponseText(rawResponse);
    const validationResult = parseAndValidateAIResponse(cleanedResponse, 'SELECTION_DECISION');

    if (!validationResult.success) {
      debugLog(`AI selection validation failed`, validationResult);
      return createValidationError('ai_response_validation', validationResult.error, validationResult.details);
    }

    // Validate that selected POI ID exists in candidates
    const selectedPOIId = validationResult.data.selected_pois[0].poi_id;
    const candidateExists = candidatePOIs.some(poi => 
      (poi.place_id && poi.place_id === selectedPOIId) || 
      (poi.id && poi.id === selectedPOIId)
    );

    if (!candidateExists) {
      debugLog(`AI selected non-existent POI ID: ${selectedPOIId}`);
      return createValidationError('poi_id_validation', 
        `Selected POI ID ${selectedPOIId} does not exist in candidate list`,
        { 
          selectedId: selectedPOIId,
          availableIds: candidatePOIs.map(p => p.place_id || p.id)
        }
      );
    }

    debugLog(`AI selection validation successful`, {
      selectedPOIId,
      fitScore: validationResult.data.selected_pois[0].fit_score
    });

    return {
      success: true,
      data: sanitizeAIResponse(validationResult.data),
      source: 'ai_selection'
    };

  } catch (error) {
    debugLog(`AI selection decision error: ${error.message}`);
    return createValidationError('ai_selection_decision', error.message, { 
      roundNumber,
      candidateCount: candidatePOIs.length
    });
  }
}

/**
 * Build final result with selected POI and AI reasoning
 * Step 4: Combine AI selection with full POI data
 */
async function buildFinalResult({ aiSelection, candidatePOIs, roundDecision, currentRound }) {
  debugLog(`Building final result`, { 
    selectedPOIId: aiSelection.selected_pois[0].poi_id,
    currentRound
  });

  try {
    const selectedPOIId = aiSelection.selected_pois[0].poi_id;
    const selectedPOI = candidatePOIs.find(poi => 
      (poi.place_id && poi.place_id === selectedPOIId) || 
      (poi.id && poi.id === selectedPOIId)
    );

    if (!selectedPOI) {
      throw new Error(`Cannot find POI with ID ${selectedPOIId} in candidate list`);
    }

    // Enhance POI with AI reasoning and metadata
    const enhancedPOI = {
      ...selectedPOI,
      aiReasoning: aiSelection.selected_pois[0].selection_reasoning,
      spatialLogic: aiSelection.selected_pois[0].spatial_logic,
      fitScore: aiSelection.selected_pois[0].fit_score,
      roundNumber: currentRound,
      aiDecisionContext: {
        roundType: roundDecision.round_type,
        roundReasoning: roundDecision.reasoning,
        spatialStrategy: roundDecision.spatial_strategy,
        nextRoundHint: aiSelection.next_round_hint
      }
    };

    debugLog(`Final result built successfully`, {
      poiName: selectedPOI.name,
      fitScore: aiSelection.selected_pois[0].fit_score,
      hasAIReasoning: true
    });

    return {
      success: true,
      selectedPOI: enhancedPOI,
      aiDecision: roundDecision,
      aiSelection: aiSelection,
      source: 'ai_workflow_complete',
      metadata: {
        workflowSteps: 4,
        candidatesConsidered: candidatePOIs.length,
        roundNumber: currentRound,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    debugLog(`Final result building error: ${error.message}`);
    return {
      success: false,
      error: 'Failed to build final result',
      details: {
        originalError: error.message,
        selectedPOIId: aiSelection.selected_pois[0].poi_id,
        candidateCount: candidatePOIs.length
      }
    };
  }
}

/**
 * Execute batch AI workflow for multiple rounds
 * Convenience function for planning multiple rounds at once
 */
export async function executeMultiRoundWorkflow({
  startRound = 1,
  endRound = 5,
  userPreferences = {},
  userLocation = null,
  initialSelectedPOIs = []
}) {
  debugLog(`Starting multi-round workflow`, { 
    startRound, 
    endRound, 
    totalRounds: endRound - startRound + 1,
    initialPOIsCount: initialSelectedPOIs.length
  });

  const results = [];
  let selectedPOIs = [...initialSelectedPOIs];

  for (let round = startRound; round <= endRound; round++) {
    debugLog(`Processing round ${round} of ${endRound}`);

    const roundResult = await executeAIRoundWorkflow({
      currentRound: round,
      userPreferences,
      selectedPOIs,
      totalPOIs: endRound,
      userLocation
    });

    if (!roundResult.success) {
      debugLog(`Multi-round workflow failed at round ${round}`, roundResult);
      return {
        success: false,
        error: `Failed at round ${round}`,
        details: roundResult,
        completedRounds: results,
        failedAtRound: round
      };
    }

    results.push(roundResult);
    selectedPOIs.push(roundResult.selectedPOI);

    debugLog(`Round ${round} completed successfully`, {
      poiName: roundResult.selectedPOI.name,
      totalSelectedPOIs: selectedPOIs.length
    });
  }

  debugLog(`Multi-round workflow completed successfully`, {
    totalRounds: results.length,
    finalPOIsCount: selectedPOIs.length
  });

  return {
    success: true,
    rounds: results,
    finalPlan: selectedPOIs,
    metadata: {
      totalRounds: results.length,
      workflow: 'multi_round_ai',
      timestamp: new Date().toISOString()
    }
  };
}