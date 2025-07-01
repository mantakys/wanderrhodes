// MultiStepPlanner.js - Advanced workflow orchestrator for complex travel planning
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph } from '@langchain/langgraph';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { getNearbyPlaces, getTravelTime } from '../tools/mapbox.js';
import { geocodeLocation, batchGeocode, validateCoordinates } from '../tools/geocoding.js';

/**
 * Multi-step workflow states for travel planning
 */
const WorkflowStates = {
  ANALYZE_REQUEST: 'analyze_request',
  GATHER_PREFERENCES: 'gather_preferences', 
  SEARCH_LOCATIONS: 'search_locations',
  OPTIMIZE_ROUTE: 'optimize_route',
  VALIDATE_PLAN: 'validate_plan',
  FINALIZE_RESPONSE: 'finalize_response',
  ERROR_HANDLING: 'error_handling'
};

/**
 * Workflow state management class
 */
class PlannerState {
  constructor() {
    this.currentState = WorkflowStates.ANALYZE_REQUEST;
    this.userRequest = '';
    this.userLocation = null;
    this.preferences = {};
    this.candidateLocations = [];
    this.optimizedRoute = [];
    this.validatedPlan = [];
    this.finalResponse = '';
    this.errors = [];
    this.metadata = {};
  }

  updateState(newState) {
    this.currentState = newState;
    this.metadata.lastStateChange = new Date().toISOString();
  }

  addError(error) {
    this.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message || error,
      state: this.currentState
    });
  }

  getContext() {
    return {
      state: this.currentState,
      hasPreferences: Object.keys(this.preferences).length > 0,
      locationCount: this.candidateLocations.length,
      routeOptimized: this.optimizedRoute.length > 0,
      planValidated: this.validatedPlan.length > 0,
      hasErrors: this.errors.length > 0
    };
  }
}

/**
 * Advanced multi-step travel planner using LangGraph
 */
export class MultiStepPlanner {
  constructor(options = {}) {
    this.llm = new ChatOpenAI({
      modelName: options.model || "gpt-4-1106-preview",
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2000,
    });
    
    this.maxRetries = options.maxRetries || 3;
    this.debugMode = options.debug || false;
    
    // Initialize workflow graph
    this.workflow = this.createWorkflow();
  }

  /**
   * Create the state graph workflow
   */
  createWorkflow() {
    const workflow = new StateGraph();

    // Define workflow nodes
    workflow.addNode(WorkflowStates.ANALYZE_REQUEST, this.analyzeRequest.bind(this));
    workflow.addNode(WorkflowStates.GATHER_PREFERENCES, this.gatherPreferences.bind(this));
    workflow.addNode(WorkflowStates.SEARCH_LOCATIONS, this.searchLocations.bind(this));
    workflow.addNode(WorkflowStates.OPTIMIZE_ROUTE, this.optimizeRoute.bind(this));
    workflow.addNode(WorkflowStates.VALIDATE_PLAN, this.validatePlan.bind(this));
    workflow.addNode(WorkflowStates.FINALIZE_RESPONSE, this.finalizeResponse.bind(this));
    workflow.addNode(WorkflowStates.ERROR_HANDLING, this.handleError.bind(this));

    // Define workflow edges (state transitions)
    workflow.addEdge(WorkflowStates.ANALYZE_REQUEST, WorkflowStates.GATHER_PREFERENCES);
    workflow.addEdge(WorkflowStates.GATHER_PREFERENCES, WorkflowStates.SEARCH_LOCATIONS);
    workflow.addEdge(WorkflowStates.SEARCH_LOCATIONS, WorkflowStates.OPTIMIZE_ROUTE);
    workflow.addEdge(WorkflowStates.OPTIMIZE_ROUTE, WorkflowStates.VALIDATE_PLAN);
    workflow.addEdge(WorkflowStates.VALIDATE_PLAN, WorkflowStates.FINALIZE_RESPONSE);

    // Error handling edges
    workflow.addConditionalEdges(
      WorkflowStates.ANALYZE_REQUEST,
      this.shouldHandleError.bind(this),
      {
        continue: WorkflowStates.GATHER_PREFERENCES,
        error: WorkflowStates.ERROR_HANDLING
      }
    );

    // Set entry point
    workflow.setEntryPoint(WorkflowStates.ANALYZE_REQUEST);

    return workflow.compile();
  }

  /**
   * Execute the complete workflow
   */
  async executePlan(userRequest, userLocation = null, chatHistory = []) {
    const state = new PlannerState();
    state.userRequest = userRequest;
    state.userLocation = userLocation;
    state.metadata.startTime = new Date().toISOString();

    this.log('🚀 Starting multi-step planning workflow', { userRequest, userLocation });

    try {
      // Execute the workflow
      const result = await this.workflow.invoke({
        state,
        chatHistory,
        userRequest,
        userLocation
      });

      state.metadata.endTime = new Date().toISOString();
      state.metadata.duration = Date.now() - new Date(state.metadata.startTime).getTime();

      this.log('✅ Workflow completed successfully', {
        finalState: result.state,
        locationCount: result.validatedPlan?.length || 0,
        duration: state.metadata.duration
      });

      return {
        success: true,
        response: result.finalResponse,
        locations: result.validatedPlan || [],
        metadata: {
          ...state.metadata,
          workflowSteps: this.getExecutedSteps(state),
          optimizationApplied: result.optimizedRoute?.length > 0,
          validationPassed: result.validatedPlan?.length > 0
        }
      };

    } catch (error) {
      this.log('❌ Workflow execution failed', { error: error.message });
      state.addError(error);
      
      return {
        success: false,
        error: error.message,
        fallbackResponse: "I encountered an issue while planning your trip. Let me provide a simpler recommendation.",
        metadata: {
          ...state.metadata,
          workflowSteps: this.getExecutedSteps(state),
          errorCount: state.errors.length
        }
      };
    }
  }

  /**
   * Step 1: Analyze the user request
   */
  async analyzeRequest(workflowState) {
    this.log('🔍 Analyzing user request', { request: workflowState.userRequest });

    const analysisPrompt = `
Analyze this travel request for Rhodes Island and extract key information:

User Request: "${workflowState.userRequest}"
User Location: ${workflowState.userLocation ? `${workflowState.userLocation.lat}, ${workflowState.userLocation.lng}` : 'Unknown'}

Extract and categorize:
1. Intent (restaurant search, day trip planning, activity recommendations, etc.)
2. Location preferences (specific areas, distances, types of places)
3. Time constraints (time of day, duration, urgency)
4. Group size and special requirements
5. Budget or style preferences

Provide a structured analysis that will guide the next planning steps.
`;

    const response = await this.llm.invoke([
      new SystemMessage("You are an expert travel request analyzer. Provide clear, structured analysis."),
      new HumanMessage(analysisPrompt)
    ]);

    // Parse the analysis (simplified for demo - could use structured output)
    workflowState.state.metadata.analysis = response.content;
    workflowState.state.updateState(WorkflowStates.GATHER_PREFERENCES);

    return workflowState;
  }

  /**
   * Step 2: Gather user preferences and requirements
   */
  async gatherPreferences(workflowState) {
    this.log('📋 Gathering user preferences');

    const preferencesPrompt = `
Based on the user request analysis, determine what preferences and requirements we should consider:

Analysis: ${workflowState.state.metadata.analysis}

Determine:
1. Cuisine preferences (if restaurant-related)
2. Activity types (cultural, adventure, relaxation)
3. Transportation preferences
4. Budget range
5. Accessibility requirements
6. Time of day preferences

Return a structured list of preferences to guide location search.
`;

    const response = await this.llm.invoke([
      new SystemMessage("You are gathering travel preferences to personalize recommendations."),
      new HumanMessage(preferencesPrompt)
    ]);

    // Store extracted preferences
    workflowState.state.preferences = this.parsePreferences(response.content);
    workflowState.state.updateState(WorkflowStates.SEARCH_LOCATIONS);

    return workflowState;
  }

  /**
   * Step 3: Search for candidate locations
   */
  async searchLocations(workflowState) {
    this.log('🔎 Searching for candidate locations');

    const searchPrompt = `
Find 6-10 candidate locations for this travel request:

Original Request: ${workflowState.userRequest}
Preferences: ${JSON.stringify(workflowState.state.preferences)}
User Location: ${workflowState.userLocation ? `${workflowState.userLocation.lat}, ${workflowState.userLocation.lng}` : 'Rhodes center'}

For each location, provide:
- Exact name and type (restaurant, beach, monument, etc.)
- Full address in Rhodes
- Why it matches the request
- Key highlights and local tips
- Opening hours if relevant
- Price range (€/€€/€€€)

Focus on a mix of popular and hidden gem locations that create a well-rounded experience.
Return as a structured list with clear location names and addresses.
DO NOT include coordinates - these will be geocoded separately for accuracy.
`;

    const response = await this.llm.invoke([
      new SystemMessage("You are a local Rhodes expert finding the perfect locations for travel requests."),
      new HumanMessage(searchPrompt)
    ]);

    // Parse candidate locations and geocode them
    workflowState.state.candidateLocations = await this.parseLocations(response.content);
    workflowState.state.updateState(WorkflowStates.OPTIMIZE_ROUTE);

    return workflowState;
  }

  /**
   * Step 4: Optimize route and calculate travel times
   */
  async optimizeRoute(workflowState) {
    this.log('🗺️ Optimizing route and calculating travel times');

    if (workflowState.state.candidateLocations.length === 0) {
      throw new Error('No candidate locations found to optimize');
    }

    // Calculate travel times between all location pairs
    const locationsWithTravel = await this.calculateOptimalRoute(
      workflowState.state.candidateLocations,
      workflowState.userLocation
    );

    workflowState.state.optimizedRoute = locationsWithTravel;
    workflowState.state.updateState(WorkflowStates.VALIDATE_PLAN);

    return workflowState;
  }

  /**
   * Step 5: Validate the plan for feasibility
   */
  async validatePlan(workflowState) {
    this.log('✅ Validating plan feasibility');

    const validationPrompt = `
Validate this travel plan for practical feasibility:

Optimized Route: ${JSON.stringify(workflowState.state.optimizedRoute.slice(0, 3))}... (${workflowState.state.optimizedRoute.length} total locations)

Check for:
1. Reasonable travel times between locations
2. Logical flow and grouping
3. Opening hours compatibility
4. Time requirements for each location
5. Overall trip duration feasibility

Provide validation results and any recommended adjustments.
`;

    const response = await this.llm.invoke([
      new SystemMessage("You are validating travel plans for real-world feasibility."),
      new HumanMessage(validationPrompt)
    ]);

    // Apply validation results
    workflowState.state.validatedPlan = this.applyValidation(
      workflowState.state.optimizedRoute,
      response.content
    );
    
    workflowState.state.updateState(WorkflowStates.FINALIZE_RESPONSE);

    return workflowState;
  }

  /**
   * Step 6: Finalize response with structured output
   */
  async finalizeResponse(workflowState) {
    this.log('📝 Finalizing response');

    const finalizationPrompt = `
Create the final travel response based on the validated plan:

Validated Plan: ${JSON.stringify(workflowState.state.validatedPlan)}
Original Request: ${workflowState.userRequest}

Create an engaging, personalized response that:
1. Acknowledges the user's specific request
2. Provides each location in the required JSON format
3. Includes local insights and practical tips
4. Explains the routing logic
5. Offers additional suggestions

Format each location as: {"name": "...", "type": "...", ...} on a single line
`;

    const response = await this.llm.invoke([
      new SystemMessage("You are WanderRhodes, creating the final personalized travel response."),
      new HumanMessage(finalizationPrompt)
    ]);

    workflowState.state.finalResponse = response.content;

    return workflowState;
  }

  /**
   * Error handling step
   */
  async handleError(workflowState) {
    this.log('⚠️ Handling workflow error', { errors: workflowState.state.errors });

    // Provide fallback response
    workflowState.state.finalResponse = `I encountered some technical difficulties while planning your trip, but I can still help! Based on your request "${workflowState.userRequest}", let me provide some general recommendations for Rhodes.`;

    return workflowState;
  }

  /**
   * Determine if error handling is needed
   */
  shouldHandleError(workflowState) {
    return workflowState.state.errors.length > 0 ? 'error' : 'continue';
  }

  /**
   * Calculate optimal route between locations
   */
  async calculateOptimalRoute(locations, userLocation) {
    if (locations.length === 0) return [];

    this.log('📍 Calculating optimal route', { locationCount: locations.length });

    // For demo purposes, implement a simple optimization
    // In production, you could use more sophisticated algorithms
    
    let optimizedLocations = [...locations];
    
    // Add travel times between consecutive locations
    for (let i = 0; i < optimizedLocations.length; i++) {
      const currentLoc = optimizedLocations[i];
      
      if (i === 0 && userLocation) {
        // Calculate travel from user location to first location
        try {
          const travelResult = await getTravelTime({
            origin: `${userLocation.lat},${userLocation.lng}`,
            destination: `${currentLoc.coordinates.lat},${currentLoc.coordinates.lng}`
          });
          
          if (travelResult) {
            currentLoc.travel = {
              distanceMeters: travelResult.distance_m,
              durationMinutes: Math.round(travelResult.duration_s / 60)
            };
          }
        } catch (error) {
          this.log('❌ Travel time calculation failed', { error: error.message });
        }
      } else if (i > 0) {
        // Calculate travel between consecutive locations
        const prevLoc = optimizedLocations[i - 1];
        try {
          const travelResult = await getTravelTime({
            origin: `${prevLoc.coordinates.lat},${prevLoc.coordinates.lng}`,
            destination: `${currentLoc.coordinates.lat},${currentLoc.coordinates.lng}`
          });
          
          if (travelResult) {
            currentLoc.travel = {
              distanceMeters: travelResult.distance_m,
              durationMinutes: Math.round(travelResult.duration_s / 60)
            };
          }
        } catch (error) {
          this.log('❌ Travel time calculation failed', { error: error.message });
        }
      }
    }

    return optimizedLocations;
  }

  /**
   * Helper methods for parsing and processing
   */
  parsePreferences(content) {
    // Simplified parsing - in production, use structured output
    return {
      extractedAt: new Date().toISOString(),
      content: content.substring(0, 500) // Truncate for demo
    };
  }

  async parseLocations(content) {
    this.log('🗺️ Parsing and geocoding locations from LLM response');
    
    // Extract location information from LLM response
    // This is a simplified parser - in production, use structured output
    const locations = [];
    const lines = content.split('\n');
    
    let currentLocation = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for location indicators
      if (trimmed.match(/^\d+\.|^-|^\*/) || trimmed.toLowerCase().includes('name:') || trimmed.toLowerCase().includes('location:')) {
        // Save previous location if complete
        if (currentLocation.name && currentLocation.address) {
          locations.push({...currentLocation});
        }
        
        // Start new location
        currentLocation = {};
        
        // Extract name from various formats
        const nameMatch = trimmed.match(/(?:name[:\s]*|^\d+\.\s*|^[-*]\s*)([^,\n]+)/i);
        if (nameMatch) {
          currentLocation.name = nameMatch[1].trim();
        }
      }
      
      // Extract address
      if (trimmed.toLowerCase().includes('address:') || trimmed.toLowerCase().includes('location:')) {
        const addressMatch = trimmed.match(/address[:\s]*(.+)/i) || trimmed.match(/location[:\s]*(.+)/i);
        if (addressMatch) {
          currentLocation.address = addressMatch[1].trim();
        }
      }
      
      // Extract type
      if (trimmed.toLowerCase().includes('type:')) {
        const typeMatch = trimmed.match(/type[:\s]*([^,\n]+)/i);
        if (typeMatch) {
          currentLocation.type = typeMatch[1].trim().toLowerCase();
        }
      }
      
      // Extract description/highlights
      if (trimmed.toLowerCase().includes('why:') || trimmed.toLowerCase().includes('highlights:')) {
        const descMatch = trimmed.match(/(?:why|highlights)[:\s]*(.+)/i);
        if (descMatch) {
          currentLocation.description = descMatch[1].trim();
        }
      }
    }
    
    // Add final location
    if (currentLocation.name && currentLocation.address) {
      locations.push(currentLocation);
    }
    
    // If parsing failed, create fallback locations
    if (locations.length === 0) {
      this.log('⚠️ Failed to parse locations from LLM response, using fallback');
      locations.push({
        name: "Rhodes Old Town",
        address: "Old Town, Rhodes, Greece",
        type: "historic site",
        description: "Medieval walled city with cobblestone streets"
      });
    }
    
    this.log(`📍 Parsed ${locations.length} locations, starting geocoding`);
    
    // Geocode all locations
    const geocodedLocations = await Promise.all(
      locations.map(async (location, index) => {
        try {
          this.log(`🗺️ Geocoding location ${index + 1}/${locations.length}: ${location.name}`);
          
          const coordinates = await geocodeLocation(location.name, location.address);
          const validatedCoords = validateCoordinates(coordinates);
          
          if (validatedCoords) {
            return {
              ...location,
              coordinates: validatedCoords,
              location: {
                address: location.address,
                coordinates: validatedCoords
              }
            };
          } else {
            this.log(`⚠️ Invalid coordinates for ${location.name}, skipping`);
            return null;
          }
        } catch (error) {
          this.log(`❌ Geocoding failed for ${location.name}: ${error.message}`);
          return null;
        }
      })
    );
    
    // Filter out failed geocoding attempts
    const validLocations = geocodedLocations.filter(loc => loc !== null);
    
    this.log(`✅ Successfully geocoded ${validLocations.length}/${locations.length} locations`);
    
    return validLocations;
  }

  applyValidation(locations, validationContent) {
    // Apply validation logic and return filtered/adjusted locations
    return locations.filter(loc => loc.coordinates); // Basic validation
  }

  getExecutedSteps(state) {
    return [
      state.currentState,
      // Would track all executed steps in production
    ];
  }

  log(message, data = {}) {
    if (this.debugMode) {
      console.log(`[MultiStepPlanner] ${message}`, data);
    }
  }
} 