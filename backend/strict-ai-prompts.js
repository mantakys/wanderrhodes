/**
 * Strict AI Prompts - Enforce Exact JSON Output Format
 * Contains prompt templates that force AI to return structured responses
 */

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_PROMPTS' : '🔍 DEV_PROMPTS';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

/**
 * Generate strict AI round planning prompt
 * Forces AI to return exact JSON structure for round decisions
 */
export function generateRoundPlanningPrompt({ 
  currentRound, 
  userPreferences, 
  selectedPOIs, 
  totalPOIs,
  userLocation 
}) {
  debugLog(`Generating round planning prompt`, { 
    currentRound, 
    selectedPOIsCount: selectedPOIs?.length || 0,
    totalPOIs,
    hasLocation: !!userLocation
  });

  const selectedPOIsSummary = selectedPOIs && selectedPOIs.length > 0 
    ? selectedPOIs.map(poi => `${poi.name} (${poi.type})`).join(', ')
    : 'None';

  const lastPOI = selectedPOIs && selectedPOIs.length > 0 
    ? selectedPOIs[selectedPOIs.length - 1]
    : null;

  const referenceLocation = lastPOI?.location?.coordinates || userLocation || { lat: 36.4341, lng: 28.2176 };

  const systemPrompt = `You are a Rhodes travel planning AI that MUST return responses in EXACT JSON format.

CRITICAL RULES:
- Return ONLY valid JSON - NO explanatory text before or after
- Use the EXACT structure provided below
- NO deviations from the required format
- All field names must match exactly
- All field types must match exactly

TASK: Plan Round ${currentRound} POI strategy for Rhodes travel itinerary.

CONTEXT:
- Current round: ${currentRound} of ${totalPOIs} total POIs
- Selected POIs so far: ${selectedPOIsSummary}
- User preferences: ${JSON.stringify(userPreferences)}
- Reference location: ${referenceLocation.lat}, ${referenceLocation.lng}
${lastPOI ? `- Last selected POI: ${lastPOI.name} at ${lastPOI.location?.coordinates?.lat}, ${lastPOI.location?.coordinates?.lng}` : ''}

REQUIRED OUTPUT FORMAT (NO DEVIATIONS ALLOWED):
{
  "action": "PLAN_ROUND",
  "round_number": ${currentRound},
  "round_type": "one_of: restaurant|beach|attraction|cafe|market|viewpoint|museum|historical_site|nature|shopping",
  "reasoning": "single_sentence_explanation_why_this_round_type_is_optimal",
  "spatial_strategy": {
    "search_radius_meters": number_between_1000_and_20000,
    "expand_radius_if_needed": number_or_null,
    "spatial_reasoning": "single_sentence_explanation_of_spatial_logic",
    "center_coordinates": {
      "lat": ${referenceLocation.lat},
      "lng": ${referenceLocation.lng},
      "reference": "description_of_what_this_coordinate_represents"
    }
  },
  "poi_criteria": {
    "required_types": ["array_of_specific_poi_types_to_search_for"],
    "preferred_tags": ["array_of_preference_keywords"],
    "exclude_types": ["array_of_poi_types_to_avoid"],
    "quality_threshold": number_between_1_and_5,
    "budget_level": "budget|moderate|luxury"
  },
  "context": {
    "previous_selections": [${selectedPOIs ? selectedPOIs.map(p => `"${p.name}"`).join(', ') : ''}],
    "user_state": "description_of_user_context_after_previous_selections",
    "time_progression": "morning|afternoon|evening_based_on_round_number"
  }
}

SPATIAL STRATEGY GUIDELINES:
- Round 1: Wide search (5000-15000m) for best quality options
- Subsequent rounds after attraction: Moderate search (2000-8000m) for complementary experiences  
- Subsequent rounds after beach: Close search (1000-3000m) for convenience
- Subsequent rounds after restaurant: Varied search (3000-10000m) for experience diversity

ROUND TYPE LOGIC:
- Consider user interests: ${userPreferences.interests?.join(', ') || 'general sightseeing'}
- Ensure variety: Don't repeat same types unless specifically requested
- Consider flow: Beach → Restaurant, Attraction → Cafe, etc.
- Consider time: Morning attractions, afternoon beaches, evening dining

CRITICAL: Return ONLY the JSON object. No explanatory text before or after.`;

  const userPrompt = `Plan Round ${currentRound} strategy for Rhodes travel itinerary. 

CONSTRAINTS:
- Must complement previous selections: ${selectedPOIsSummary}
- Must match user interests: ${userPreferences.interests?.join(', ') || 'general exploration'}
- Must consider spatial efficiency from reference point: ${referenceLocation.lat}, ${referenceLocation.lng}
- Must provide variety while maintaining logical flow

Return ONLY the required JSON structure.`;

  debugLog(`Round planning prompt generated`, { 
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    currentRound
  });

  return { systemPrompt, userPrompt };
}

/**
 * Generate strict AI POI selection prompt  
 * Forces AI to select from provided candidates with exact JSON structure
 */
export function generatePOISelectionPrompt({ 
  candidatePOIs, 
  roundNumber, 
  roundDecision, 
  userPreferences,
  selectedPOIs 
}) {
  debugLog(`Generating POI selection prompt`, { 
    candidateCount: candidatePOIs?.length || 0,
    roundNumber,
    roundType: roundDecision?.round_type
  });

  if (!candidatePOIs || candidatePOIs.length === 0) {
    throw new Error('Cannot generate selection prompt without candidate POIs');
  }

  const candidatesList = candidatePOIs.map((poi, index) => 
    `${index + 1}. ID: ${poi.place_id || poi.id}, Name: ${poi.name}, Type: ${poi.primary_type || poi.type}, Rating: ${poi.rating || 'N/A'}, Description: ${poi.description || 'No description'}, Address: ${poi.address || 'No address'}`
  ).join('\n');

  const excludePOIIds = candidatePOIs.map(poi => poi.place_id || poi.id);

  const systemPrompt = `You are a Rhodes POI selection AI that MUST return responses in EXACT JSON format.

CRITICAL RULES:
- Return ONLY valid JSON - NO explanatory text before or after
- Use the EXACT structure provided below
- Select EXACTLY ONE POI from the candidate list
- poi_id must match EXACTLY one of the provided candidate IDs
- NO deviations from the required format

TASK: Select the BEST POI from candidates for Round ${roundNumber}.

ROUND CONTEXT:
- Round type: ${roundDecision.round_type}
- Round reasoning: ${roundDecision.reasoning}
- Spatial strategy: ${roundDecision.spatial_strategy.spatial_reasoning}
- User preferences: ${JSON.stringify(userPreferences)}
- Previous selections: ${selectedPOIs?.map(p => p.name).join(', ') || 'None'}

CANDIDATE POIS (SELECT FROM THESE ONLY):
${candidatesList}

SELECTION CRITERIA:
- Must match round type: ${roundDecision.round_type}
- Must satisfy user preferences: ${userPreferences.interests?.join(', ') || 'general'}
- Must complement previous selections
- Must have reasonable quality rating
- Must fit spatial strategy: ${roundDecision.spatial_strategy.spatial_reasoning}

REQUIRED OUTPUT FORMAT (NO DEVIATIONS ALLOWED):
{
  "action": "SELECT_POIS",
  "round_number": ${roundNumber},
  "selected_pois": [
    {
      "poi_id": "exact_id_from_candidate_list_above",
      "selection_reasoning": "single_sentence_explaining_why_this_poi_is_optimal_choice",
      "fit_score": number_between_1_and_10,
      "spatial_logic": "single_sentence_explaining_spatial_positioning_logic"
    }
  ],
  "rejected_pois": [
    {
      "poi_id": "exact_id_from_candidate_list_above", 
      "rejection_reason": "single_sentence_explaining_why_rejected"
    }
  ],
  "round_completion_status": "COMPLETE",
  "next_round_hint": "suggestion_for_next_round_type_and_location_or_null"
}

CRITICAL VALIDATION RULES:
- poi_id in selected_pois MUST exactly match one ID from: ${excludePOIIds.join(', ')}
- poi_id in rejected_pois MUST exactly match IDs from the candidate list
- fit_score must be number between 1-10
- All reasoning fields must be non-empty strings
- Return ONLY the JSON object - no additional text

CRITICAL: Return ONLY the JSON object. No explanatory text before or after.`;

  const userPrompt = `Select the BEST POI from the ${candidatePOIs.length} candidates for Round ${roundNumber} (${roundDecision.round_type}).

SELECTION PRIORITIES:
1. Best fit for round type: ${roundDecision.round_type}
2. Highest quality rating among suitable options
3. Best spatial positioning: ${roundDecision.spatial_strategy.spatial_reasoning}
4. Best match for user preferences: ${userPreferences.interests?.join(', ') || 'general'}
5. Best complement to previous selections

Analyze all ${candidatePOIs.length} candidates and select the optimal choice.

Return ONLY the required JSON structure.`;

  debugLog(`POI selection prompt generated`, { 
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    candidateCount: candidatePOIs.length
  });

  return { systemPrompt, userPrompt };
}

/**
 * Generate AI prompt for initial round planning
 * Special case for Round 1 when no previous POIs exist
 */
export function generateInitialRoundPrompt({ userPreferences, totalPOIs, userLocation }) {
  debugLog(`Generating initial round prompt`, { 
    totalPOIs,
    hasLocation: !!userLocation,
    userInterests: userPreferences.interests?.length || 0
  });

  const startLocation = userLocation || { lat: 36.4341, lng: 28.2176 };

  const systemPrompt = `You are a Rhodes travel planning AI for INITIAL round planning that MUST return responses in EXACT JSON format.

CRITICAL RULES:
- This is Round 1 - the FIRST POI selection
- Return ONLY valid JSON - NO explanatory text before or after
- Use the EXACT structure provided below
- Consider this is the opening experience that sets the tone

TASK: Plan Round 1 POI strategy for Rhodes travel itinerary.

CONTEXT:
- This is the FIRST POI selection (Round 1 of ${totalPOIs})
- No previous POIs selected yet
- User preferences: ${JSON.stringify(userPreferences)}
- Starting location: ${startLocation.lat}, ${startLocation.lng}
- User interests: ${userPreferences.interests?.join(', ') || 'general exploration'}

INITIAL ROUND STRATEGY:
- Choose POI type that best matches user's PRIMARY interest
- Use wider search radius for best quality options
- Set the tone for the entire travel experience
- Consider accessibility and ease of access

REQUIRED OUTPUT FORMAT (NO DEVIATIONS ALLOWED):
{
  "action": "PLAN_ROUND",
  "round_number": 1,
  "round_type": "one_of: restaurant|beach|attraction|cafe|market|viewpoint|museum|historical_site|nature|shopping",
  "reasoning": "single_sentence_why_this_is_optimal_starting_experience",
  "spatial_strategy": {
    "search_radius_meters": number_between_5000_and_20000,
    "expand_radius_if_needed": number_or_null,
    "spatial_reasoning": "single_sentence_explanation_of_initial_search_strategy",
    "center_coordinates": {
      "lat": ${startLocation.lat},
      "lng": ${startLocation.lng},
      "reference": "user_starting_location_or_rhodes_center"
    }
  },
  "poi_criteria": {
    "required_types": ["array_of_specific_poi_types_to_search_for"],
    "preferred_tags": ["array_of_preference_keywords"],
    "exclude_types": ["array_of_poi_types_to_avoid"],
    "quality_threshold": number_between_3_and_5,
    "budget_level": "budget|moderate|luxury"
  },
  "context": {
    "previous_selections": [],
    "user_state": "beginning_travel_experience",
    "time_progression": "morning"
  }
}

ROUND TYPE PRIORITIES FOR ROUND 1:
${userPreferences.interests?.includes('beaches') ? '- BEACHES: Start with iconic beach experience' : ''}
${userPreferences.interests?.includes('history') ? '- HISTORICAL SITES: Begin with cultural immersion' : ''}
${userPreferences.interests?.includes('food') ? '- RESTAURANTS: Start with authentic local dining' : ''}
${userPreferences.interests?.includes('nature') ? '- NATURE/VIEWPOINTS: Begin with scenic beauty' : ''}
${!userPreferences.interests?.length ? '- ATTRACTIONS: Safe choice for general exploration' : ''}

SPATIAL STRATEGY FOR ROUND 1:
- Use wider radius (5000-15000m) to find BEST quality options
- Don't compromise on quality for proximity  
- Consider iconic/representative Rhodes experiences
- Ensure good accessibility for first-time visitors

CRITICAL: Return ONLY the JSON object. No explanatory text before or after.`;

  const userPrompt = `Plan the optimal Round 1 experience for Rhodes travel itinerary.

USER PROFILE:
- Interests: ${userPreferences.interests?.join(', ') || 'general exploration'}
- Budget: ${userPreferences.budget || 'moderate'}
- Group: ${userPreferences.groupSize || 'not specified'}
- Total POIs planned: ${totalPOIs}

ROUND 1 REQUIREMENTS:
- Must create strong first impression
- Must match primary user interest
- Must set positive tone for entire journey
- Must be high-quality, accessible experience

Return ONLY the required JSON structure.`;

  debugLog(`Initial round prompt generated`, { 
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    totalPOIs
  });

  return { systemPrompt, userPrompt };
}

/**
 * Validate AI prompt parameters
 * Ensures all required parameters are present before generating prompts
 */
export function validatePromptParameters(type, parameters) {
  debugLog(`Validating prompt parameters for type: ${type}`, { parameters });

  switch (type) {
    case 'ROUND_PLANNING':
      const roundRequired = ['currentRound', 'userPreferences', 'totalPOIs'];
      const roundMissing = roundRequired.filter(param => parameters[param] === undefined);
      if (roundMissing.length > 0) {
        return {
          valid: false,
          error: 'Missing required parameters for round planning',
          missing: roundMissing
        };
      }
      break;

    case 'POI_SELECTION':
      const selectionRequired = ['candidatePOIs', 'roundNumber', 'roundDecision'];
      const selectionMissing = selectionRequired.filter(param => parameters[param] === undefined);
      if (selectionMissing.length > 0) {
        return {
          valid: false,
          error: 'Missing required parameters for POI selection',
          missing: selectionMissing
        };
      }
      if (!Array.isArray(parameters.candidatePOIs) || parameters.candidatePOIs.length === 0) {
        return {
          valid: false,
          error: 'candidatePOIs must be non-empty array'
        };
      }
      break;

    case 'INITIAL_ROUND':
      const initialRequired = ['userPreferences', 'totalPOIs'];
      const initialMissing = initialRequired.filter(param => parameters[param] === undefined);
      if (initialMissing.length > 0) {
        return {
          valid: false,
          error: 'Missing required parameters for initial round',
          missing: initialMissing
        };
      }
      break;

    default:
      return {
        valid: false,
        error: 'Unknown prompt type',
        type
      };
  }

  debugLog(`Prompt parameters validation successful for type: ${type}`);
  return { valid: true };
}

/**
 * Clean AI response text
 * Remove any extra text that might interfere with JSON parsing
 */
export function cleanAIResponseText(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return responseText;
  }

  debugLog('Cleaning AI response text', { originalLength: responseText.length });

  // Remove common AI prefixes/suffixes
  let cleaned = responseText
    .replace(/^Here\s+is\s+the\s+[^:]*:\s*/i, '')
    .replace(/^The\s+response\s+is:\s*/i, '')
    .replace(/^```json\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^Based\s+on\s+[^,]*,\s*/i, '')
    .trim();

  // Extract JSON object if text contains other content
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  debugLog('AI response text cleaned', { 
    originalLength: responseText.length,
    cleanedLength: cleaned.length,
    wasModified: responseText !== cleaned
  });

  return cleaned;
}

/**
 * Generate fallback prompt for AI retry
 * When AI fails to return proper structure, use this stricter prompt
 */
export function generateFallbackPrompt(originalPrompt, failureReason) {
  debugLog('Generating fallback prompt', { failureReason });

  const strictFallbackPrompt = `CRITICAL ERROR RECOVERY MODE

Your previous response failed validation: ${failureReason}

YOU MUST RETURN ONLY A VALID JSON OBJECT. NO OTHER TEXT.

Example of EXACTLY what is required:
{
  "action": "PLAN_ROUND",
  "round_number": 1,
  "round_type": "attraction",
  "reasoning": "Starting with iconic Rhodes attraction",
  "spatial_strategy": {
    "search_radius_meters": 10000,
    "spatial_reasoning": "Wide search for best quality",
    "center_coordinates": {
      "lat": 36.4341,
      "lng": 28.2176,
      "reference": "rhodes_center"
    }
  },
  "poi_criteria": {
    "required_types": ["tourist_attraction", "historical_site"],
    "quality_threshold": 4.0,
    "budget_level": "moderate"
  }
}

NO explanatory text. NO markdown. NO additional comments. ONLY THE JSON OBJECT.

${originalPrompt.userPrompt}`;

  debugLog('Fallback prompt generated', { 
    promptLength: strictFallbackPrompt.length,
    failureReason 
  });

  return strictFallbackPrompt;
}