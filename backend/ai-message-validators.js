/**
 * AI Message Validators - Strict JSON Structure Enforcement
 * Ensures AI responses conform to exact expected formats
 */

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = process.env.NODE_ENV === 'production' ? '🚀 PROD_VALIDATOR' : '🔍 DEV_VALIDATOR';
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    const maxLength = process.env.NODE_ENV === 'production' ? 500 : 2000;
    const dataStr = JSON.stringify(data, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    const truncatedData = dataStr.length > maxLength ? dataStr.substring(0, maxLength) + '...[TRUNCATED]' : dataStr;
    console.log(`${prefix} [${timestamp}] DATA:`, truncatedData);
  }
};

/**
 * Validate AI Round Decision Structure
 * Ensures AI returns proper round planning decisions
 */
export function validateAIRoundDecision(decision) {
  debugLog('Validating AI Round Decision', { hasDecision: !!decision });

  if (!decision || typeof decision !== 'object') {
    return {
      valid: false,
      error: 'Decision must be a valid object',
      details: { received: typeof decision }
    };
  }

  // Required fields
  const requiredFields = [
    'action',
    'round_number', 
    'round_type',
    'reasoning',
    'spatial_strategy',
    'poi_criteria'
  ];

  // Check for missing required fields
  const missingFields = requiredFields.filter(field => decision[field] === undefined);
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: 'Missing required fields',
      details: { missingFields, received: Object.keys(decision) }
    };
  }

  // Validate action field
  if (decision.action !== 'PLAN_ROUND') {
    return {
      valid: false,
      error: 'Invalid action field',
      details: { expected: 'PLAN_ROUND', received: decision.action }
    };
  }

  // Validate round_number
  if (!Number.isInteger(decision.round_number) || decision.round_number < 1) {
    return {
      valid: false,
      error: 'Invalid round_number field',
      details: { expected: 'positive integer', received: decision.round_number }
    };
  }

  // Validate round_type
  const validRoundTypes = ['restaurant', 'beach', 'attraction', 'cafe', 'market', 'viewpoint', 'museum', 'historical_site', 'nature', 'shopping'];
  if (!validRoundTypes.includes(decision.round_type)) {
    return {
      valid: false,
      error: 'Invalid round_type field',
      details: { expected: validRoundTypes, received: decision.round_type }
    };
  }

  // Validate reasoning
  if (typeof decision.reasoning !== 'string' || decision.reasoning.trim().length === 0) {
    return {
      valid: false,
      error: 'Invalid reasoning field',
      details: { expected: 'non-empty string', received: typeof decision.reasoning }
    };
  }

  // Validate spatial_strategy structure
  const spatialValidation = validateSpatialStrategy(decision.spatial_strategy);
  if (!spatialValidation.valid) {
    return {
      valid: false,
      error: 'Invalid spatial_strategy',
      details: spatialValidation.details
    };
  }

  // Validate poi_criteria structure
  const criteriaValidation = validatePOICriteria(decision.poi_criteria);
  if (!criteriaValidation.valid) {
    return {
      valid: false,
      error: 'Invalid poi_criteria',
      details: criteriaValidation.details
    };
  }

  debugLog('AI Round Decision validation successful');
  return { valid: true };
}

/**
 * Validate Spatial Strategy Structure
 */
function validateSpatialStrategy(spatialStrategy) {
  if (!spatialStrategy || typeof spatialStrategy !== 'object') {
    return {
      valid: false,
      details: { error: 'spatial_strategy must be an object', received: typeof spatialStrategy }
    };
  }

  const requiredFields = ['search_radius_meters', 'spatial_reasoning', 'center_coordinates'];
  const missingFields = requiredFields.filter(field => spatialStrategy[field] === undefined);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      details: { error: 'Missing spatial_strategy fields', missingFields }
    };
  }

  // Validate search_radius_meters
  if (!Number.isInteger(spatialStrategy.search_radius_meters) || 
      spatialStrategy.search_radius_meters < 500 || 
      spatialStrategy.search_radius_meters > 50000) {
    return {
      valid: false,
      details: { 
        error: 'search_radius_meters must be integer between 500-50000', 
        received: spatialStrategy.search_radius_meters 
      }
    };
  }

  // Validate center_coordinates
  const coordsValidation = validateCoordinates(spatialStrategy.center_coordinates);
  if (!coordsValidation.valid) {
    return {
      valid: false,
      details: { error: 'Invalid center_coordinates', ...coordsValidation.details }
    };
  }

  // Validate spatial_reasoning
  if (typeof spatialStrategy.spatial_reasoning !== 'string' || 
      spatialStrategy.spatial_reasoning.trim().length === 0) {
    return {
      valid: false,
      details: { 
        error: 'spatial_reasoning must be non-empty string', 
        received: typeof spatialStrategy.spatial_reasoning 
      }
    };
  }

  return { valid: true };
}

/**
 * Validate POI Criteria Structure
 */
function validatePOICriteria(poiCriteria) {
  if (!poiCriteria || typeof poiCriteria !== 'object') {
    return {
      valid: false,
      details: { error: 'poi_criteria must be an object', received: typeof poiCriteria }
    };
  }

  const requiredFields = ['required_types', 'quality_threshold'];
  const missingFields = requiredFields.filter(field => poiCriteria[field] === undefined);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      details: { error: 'Missing poi_criteria fields', missingFields }
    };
  }

  // Validate required_types
  if (!Array.isArray(poiCriteria.required_types) || poiCriteria.required_types.length === 0) {
    return {
      valid: false,
      details: { 
        error: 'required_types must be non-empty array', 
        received: poiCriteria.required_types 
      }
    };
  }

  // Validate quality_threshold
  if (typeof poiCriteria.quality_threshold !== 'number' || 
      poiCriteria.quality_threshold < 1 || 
      poiCriteria.quality_threshold > 5) {
    return {
      valid: false,
      details: { 
        error: 'quality_threshold must be number between 1-5', 
        received: poiCriteria.quality_threshold 
      }
    };
  }

  // Validate budget_level if present
  if (poiCriteria.budget_level) {
    const validBudgetLevels = ['budget', 'moderate', 'luxury'];
    if (!validBudgetLevels.includes(poiCriteria.budget_level)) {
      return {
        valid: false,
        details: { 
          error: 'Invalid budget_level', 
          expected: validBudgetLevels,
          received: poiCriteria.budget_level 
        }
      };
    }
  }

  return { valid: true };
}

/**
 * Validate AI POI Selection Structure
 * Ensures AI returns proper POI selection decisions
 */
export function validateAISelectionDecision(selection) {
  debugLog('Validating AI Selection Decision', { hasSelection: !!selection });

  if (!selection || typeof selection !== 'object') {
    return {
      valid: false,
      error: 'Selection must be a valid object',
      details: { received: typeof selection }
    };
  }

  // Required fields
  const requiredFields = [
    'action',
    'round_number',
    'selected_pois',
    'round_completion_status'
  ];

  // Check for missing required fields
  const missingFields = requiredFields.filter(field => selection[field] === undefined);
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: 'Missing required fields',
      details: { missingFields, received: Object.keys(selection) }
    };
  }

  // Validate action field
  if (selection.action !== 'SELECT_POIS') {
    return {
      valid: false,
      error: 'Invalid action field',
      details: { expected: 'SELECT_POIS', received: selection.action }
    };
  }

  // Validate round_number
  if (!Number.isInteger(selection.round_number) || selection.round_number < 1) {
    return {
      valid: false,
      error: 'Invalid round_number field',
      details: { expected: 'positive integer', received: selection.round_number }
    };
  }

  // Validate selected_pois
  if (!Array.isArray(selection.selected_pois) || selection.selected_pois.length === 0) {
    return {
      valid: false,
      error: 'selected_pois must be non-empty array',
      details: { received: selection.selected_pois }
    };
  }

  // Validate each selected POI
  for (let i = 0; i < selection.selected_pois.length; i++) {
    const poiValidation = validateSelectedPOI(selection.selected_pois[i], i);
    if (!poiValidation.valid) {
      return {
        valid: false,
        error: `Invalid selected POI at index ${i}`,
        details: poiValidation.details
      };
    }
  }

  // Validate round_completion_status
  const validStatuses = ['COMPLETE', 'NEEDS_MORE_OPTIONS'];
  if (!validStatuses.includes(selection.round_completion_status)) {
    return {
      valid: false,
      error: 'Invalid round_completion_status',
      details: { expected: validStatuses, received: selection.round_completion_status }
    };
  }

  // Validate rejected_pois if present
  if (selection.rejected_pois && Array.isArray(selection.rejected_pois)) {
    for (let i = 0; i < selection.rejected_pois.length; i++) {
      const rejectedValidation = validateRejectedPOI(selection.rejected_pois[i], i);
      if (!rejectedValidation.valid) {
        return {
          valid: false,
          error: `Invalid rejected POI at index ${i}`,
          details: rejectedValidation.details
        };
      }
    }
  }

  debugLog('AI Selection Decision validation successful');
  return { valid: true };
}

/**
 * Validate Selected POI Structure
 */
function validateSelectedPOI(poi, index) {
  if (!poi || typeof poi !== 'object') {
    return {
      valid: false,
      details: { error: `Selected POI ${index} must be an object`, received: typeof poi }
    };
  }

  const requiredFields = ['poi_id', 'selection_reasoning', 'fit_score'];
  const missingFields = requiredFields.filter(field => poi[field] === undefined);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      details: { error: `Missing fields in selected POI ${index}`, missingFields }
    };
  }

  // Validate poi_id
  if (typeof poi.poi_id !== 'string' || poi.poi_id.trim().length === 0) {
    return {
      valid: false,
      details: { 
        error: `poi_id must be non-empty string in POI ${index}`, 
        received: poi.poi_id 
      }
    };
  }

  // Validate selection_reasoning
  if (typeof poi.selection_reasoning !== 'string' || poi.selection_reasoning.trim().length === 0) {
    return {
      valid: false,
      details: { 
        error: `selection_reasoning must be non-empty string in POI ${index}`, 
        received: typeof poi.selection_reasoning 
      }
    };
  }

  // Validate fit_score
  if (typeof poi.fit_score !== 'number' || poi.fit_score < 1 || poi.fit_score > 10) {
    return {
      valid: false,
      details: { 
        error: `fit_score must be number between 1-10 in POI ${index}`, 
        received: poi.fit_score 
      }
    };
  }

  return { valid: true };
}

/**
 * Validate Rejected POI Structure
 */
function validateRejectedPOI(poi, index) {
  if (!poi || typeof poi !== 'object') {
    return {
      valid: false,
      details: { error: `Rejected POI ${index} must be an object`, received: typeof poi }
    };
  }

  const requiredFields = ['poi_id', 'rejection_reason'];
  const missingFields = requiredFields.filter(field => poi[field] === undefined);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      details: { error: `Missing fields in rejected POI ${index}`, missingFields }
    };
  }

  // Validate poi_id
  if (typeof poi.poi_id !== 'string' || poi.poi_id.trim().length === 0) {
    return {
      valid: false,
      details: { 
        error: `poi_id must be non-empty string in rejected POI ${index}`, 
        received: poi.poi_id 
      }
    };
  }

  // Validate rejection_reason
  if (typeof poi.rejection_reason !== 'string' || poi.rejection_reason.trim().length === 0) {
    return {
      valid: false,
      details: { 
        error: `rejection_reason must be non-empty string in rejected POI ${index}`, 
        received: typeof poi.rejection_reason 
      }
    };
  }

  return { valid: true };
}

/**
 * Validate Coordinates Structure
 */
function validateCoordinates(coordinates) {
  if (!coordinates || typeof coordinates !== 'object') {
    return {
      valid: false,
      details: { error: 'coordinates must be an object', received: typeof coordinates }
    };
  }

  const requiredFields = ['lat', 'lng'];
  const missingFields = requiredFields.filter(field => coordinates[field] === undefined);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      details: { error: 'Missing coordinate fields', missingFields }
    };
  }

  // Validate latitude
  if (typeof coordinates.lat !== 'number' || coordinates.lat < -90 || coordinates.lat > 90) {
    return {
      valid: false,
      details: { 
        error: 'lat must be number between -90 and 90', 
        received: coordinates.lat 
      }
    };
  }

  // Validate longitude
  if (typeof coordinates.lng !== 'number' || coordinates.lng < -180 || coordinates.lng > 180) {
    return {
      valid: false,
      details: { 
        error: 'lng must be number between -180 and 180', 
        received: coordinates.lng 
      }
    };
  }

  return { valid: true };
}

/**
 * Parse and validate AI JSON response
 * Safely parses AI response and validates structure
 */
export function parseAndValidateAIResponse(responseText, expectedType) {
  debugLog(`Parsing AI response for type: ${expectedType}`, { 
    responseLength: responseText?.length || 0,
    expectedType 
  });

  if (!responseText || typeof responseText !== 'string') {
    return {
      success: false,
      error: 'Response text must be a non-empty string',
      details: { received: typeof responseText }
    };
  }

  // Try to parse JSON
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(responseText.trim());
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse AI response as JSON',
      details: { 
        parseError: parseError.message,
        responsePreview: responseText.substring(0, 200) + '...'
      }
    };
  }

  // Validate based on expected type
  let validation;
  switch (expectedType) {
    case 'ROUND_DECISION':
      validation = validateAIRoundDecision(parsedResponse);
      break;
    case 'SELECTION_DECISION':
      validation = validateAISelectionDecision(parsedResponse);
      break;
    default:
      return {
        success: false,
        error: 'Unknown expected type',
        details: { expectedType }
      };
  }

  if (!validation.valid) {
    return {
      success: false,
      error: `AI response validation failed: ${validation.error}`,
      details: validation.details
    };
  }

  debugLog(`AI response validation successful for type: ${expectedType}`);
  return {
    success: true,
    data: parsedResponse
  };
}

/**
 * Create validation error response
 * Standardized error format for validation failures
 */
export function createValidationError(stage, error, details = {}) {
  const timestamp = new Date().toISOString();
  const validationError = {
    success: false,
    error: `Validation failed at ${stage}: ${error}`,
    details: {
      stage,
      timestamp,
      ...details
    }
  };

  debugLog(`Validation error created`, validationError);
  return validationError;
}

/**
 * Sanitize AI response for safety
 * Remove potentially harmful content from AI responses
 */
export function sanitizeAIResponse(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  // Create deep copy to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(response));

  // Sanitize string fields
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove potentially harmful HTML/script tags
    return str
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  // Recursively sanitize all string values
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  sanitizeObject(sanitized);
  return sanitized;
}