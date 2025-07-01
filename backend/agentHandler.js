// agentHandler.js - LangChain-based Agentic Framework
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNearbyPlaces, getTravelTime } from './tools/mapbox.js';
import { geocodeLocation, validateCoordinates } from './tools/geocoding.js';
import Ajv from 'ajv';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ajv = new Ajv();

// Location schema for validation
const locationSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    description: { type: "string" },
    location: {
      type: "object",
      properties: {
        address: { type: "string" },
        coordinates: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["lat", "lng"],
        },
      },
      required: ["address"],
    },
    details: { type: "object" },
    highlights: { type: "array" },
    tips: { type: "array" },
    nearbyAttractions: { type: "array" },
    bestTimeToVisit: { type: "string" },
    travel: { type: "object" },
  },
  required: ["name", "type", "location"],
};

const validateLocation = ajv.compile(locationSchema);

// Define tools for the agent
const tools = [
  new DynamicStructuredTool({
    name: "getNearbyPlaces",
    description: "Find nearby restaurants or attractions by coordinates. Use this to discover local places around a specific location.",
    schema: z.object({
      lat: z.number().describe("Latitude coordinate"),
      lng: z.number().describe("Longitude coordinate"),
      radius: z.number().optional().default(1000).describe("Search radius in meters"),
      type: z.string().optional().default("restaurant").describe("Type of place to search for")
    }),
    func: async ({ lat, lng, radius = 1000, type = "restaurant" }) => {
      try {
        const result = await getNearbyPlaces({ lat, lng, radius, type });
        return JSON.stringify(result);
      } catch (error) {
        return `Error finding places: ${error.message}`;
      }
    }
  }),

  new DynamicStructuredTool({
    name: "getTravelTime",
    description: "Calculate travel time and distance between two locations. Essential for building travel itineraries.",
    schema: z.object({
      origin: z.string().describe("Starting location (address or coordinates)"),
      destination: z.string().describe("Destination location (address or coordinates)"),
      mode: z.string().optional().default("driving").describe("Travel mode: driving, walking, cycling")
    }),
    func: async ({ origin, destination, mode = "driving" }) => {
      try {
        const result = await getTravelTime({ origin, destination, mode });
        return JSON.stringify(result);
      } catch (error) {
        return `Error calculating travel time: ${error.message}`;
      }
    }
  }),

  // RAG retrieval tool (commented out but ready to use)
  /*
  new DynamicStructuredTool({
    name: "searchKnowledgeBase",
    description: "Search the Rhodes knowledge base for specific information about places, activities, and local insights.",
    schema: z.object({
      query: z.string().describe("Search query for the knowledge base"),
      limit: z.number().optional().default(3).describe("Number of results to return")
    }),
    func: async ({ query, limit = 3 }) => {
      try {
        const { stdout } = await execFileAsync('python3', [
          join(__dirname, 'rag_retrieve.py'),
          query,
          String(limit)
        ]);
        const docs = JSON.parse(stdout);
        const context = docs.map(d => `Title: ${d.title}\nSection: ${d.section}\nContent: ${d.text}\nURL: ${d.url}`).join('\n---\n');
        return context;
      } catch (error) {
        return `Knowledge base search failed: ${error.message}`;
      }
    }
  })
  */
];

// Agent prompt template - formatted for LangChain OpenAI functions agent
const agentPrompt = ChatPromptTemplate.fromMessages([
  ["system", `You are WanderRhodes, an advanced AI travel planning agent for Rhodes Island. You are a passionate local expert and sophisticated travel companion with multi-step reasoning capabilities.

**Your Advanced Capabilities:**
- Multi-step planning and reasoning for complex travel requests
- Dynamic tool usage based on context and user needs
- Intelligent information gathering and synthesis
- Adaptive planning based on real-time data

**Your Approach:**
1. **Analyze** the user's request thoroughly
2. **Plan** your approach - what information do you need to gather?
3. **Execute** your plan using available tools strategically
4. **Synthesize** information to create personalized recommendations
5. **Validate** your recommendations for practical feasibility

**Key Reasoning Patterns:**
- If user asks for restaurants, use getNearbyPlaces to find options, then getTravelTime to optimize routing
- For itinerary planning, gather location data first, then calculate optimal travel sequences
- Always consider practical factors: opening hours, travel logistics, user preferences
- Use tools multiple times if needed to gather comprehensive information

**Output Format:**
For each location you recommend, provide detailed information in this exact JSON format on a single line:
{{"name": "Location Name", "type": "Category", "description": "Engaging description", "location": {{"address": "Full address in Rhodes, Greece", "coordinates": {{"lat": 36.4341, "lng": 28.2176}}}}, "details": {{"openingHours": "Hours", "priceRange": "€/€€/€€€", "rating": "Rating", "website": "URL", "phone": "Phone"}}, "highlights": ["Feature 1", "Feature 2", "Feature 3"], "tips": ["Local tip 1", "Local tip 2"], "bestTimeToVisit": "Best time", "nearbyAttractions": ["Nearby 1", "Nearby 2"], "travel": {{"distanceMeters": distance_number, "durationMinutes": duration_number}}}}

**Important:** For coordinates, just use the Rhodes center coordinates (36.4341, 28.2176) - they will be automatically geocoded for accuracy based on the location name and address.

**Tool Usage Guidelines:**
- Use getNearbyPlaces to discover local options around coordinates
- Use getTravelTime to calculate routes between locations
- Plan tool usage strategically - gather information before making recommendations
- Consider using tools multiple times to build comprehensive itineraries

**Response Structure:**
1. Acknowledge the user's request professionally
2. If user preferences are insufficient, IMMEDIATELY trigger preference collection using |||PREFERENCES|||
3. If sufficient preferences exist, use tools to gather information and provide recommendations
4. Always provide personalized recommendations with proper JSON formatting
5. Include practical travel advice and local insights

**Critical UX Rules:**
- NEVER expose your internal planning process to users
- NEVER ask questions in plain text - use interactive markers instead
- If you need more preferences, use |||PREFERENCES||| immediately
- Be decisive and professional in your responses

**Interactive Response Types:**
You can trigger interactive UI elements by including special markers:

- For preference collection: |||PREFERENCES||| followed by preference categories needed
- For plan editing: |||EDIT_PLAN||| to trigger the plan editor
- For location suggestions: |||LOCATION_OPTIONS||| followed by alternative suggestions
- For follow-up questions: |||QUESTION||| followed by specific questions

**Examples:**
- "I'll help you create the perfect Rhodes adventure! Let me gather some preferences to personalize your plan. |||PREFERENCES|||interests,budget,timeOfDay|||"
- "Perfect! Here's your personalized plan. Would you like to edit any locations? |||EDIT_PLAN|||"
- "I found several great options |||LOCATION_OPTIONS|||restaurant,beach,historical|||"

**Preference Assessment:**
Only trigger |||PREFERENCES||| if the user has NO preferences set or specifically asks for help setting them. If the user has ANY preferences (interests, budget, groupSize, pace, etc.), proceed with planning using available tools and their stated preferences.

Begin your response professionally and use tools or interactive elements as needed.`],
  
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad")
]);

// Agent state management
class AgentState {
  constructor() {
    this.userLocation = null;
    this.currentPlan = [];
    this.gatheredInfo = {};
    this.planningPhase = 'initial'; // initial, gathering, planning, optimizing, finalizing
  }

  updateUserLocation(location) {
    this.userLocation = location;
  }

  addPlanLocation(location) {
    this.currentPlan.push(location);
  }

  setGatheredInfo(key, value) {
    this.gatheredInfo[key] = value;
  }

  setPlanningPhase(phase) {
    this.planningPhase = phase;
  }

  getState() {
    return {
      userLocation: this.userLocation,
      currentPlan: this.currentPlan,
      gatheredInfo: this.gatheredInfo,
      planningPhase: this.planningPhase
    };
  }
}

export default async function agentHandler(req, res) {
  if (req.method && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const { history = [], prompt, userLocation = null, userPreferences = {} } = req.body;

  try {
    // Initialize LangChain components
    const llm = new ChatOpenAI({
      modelName: "gpt-4-1106-preview", // Using GPT-4 Turbo for better reasoning
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Create the agent
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt: agentPrompt,
    });

    // Create agent executor with enhanced configuration
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      maxIterations: 10, // Increased for complex multi-step tasks
      returnIntermediateSteps: true,
      handleParsingErrors: true,
      verbose: true, // Enable for debugging
      earlyStoppingMethod: "generate", // Ensure it continues execution after tool calls
    });

    // Initialize agent state
    const agentState = new AgentState();
    if (userLocation) {
      agentState.updateUserLocation(userLocation);
    }

    // Convert chat history to LangChain format
    const chatHistory = history.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });

    // Enhanced prompt with context
    let enhancedPrompt = prompt;
    if (userLocation) {
      enhancedPrompt = `[User is currently at coordinates: ${userLocation.lat}, ${userLocation.lng}]\n\n${prompt}`;
    }

    // Add agent state context with user preferences
    let preferenceContext = '';
    if (userPreferences && Object.keys(userPreferences).length > 0) {
      preferenceContext = `
User Preferences:
- Budget: ${userPreferences.budget || 'Not specified'}
- Interests: ${userPreferences.interests?.join(', ') || 'Not specified'}
- Preferred times: ${userPreferences.timeOfDay?.join(', ') || 'Not specified'}
- Group size: ${userPreferences.groupSize || 'Not specified'}
- Pace: ${userPreferences.pace || 'Not specified'}
- Mobility: ${userPreferences.mobility || 'Not specified'}
- Dining style: ${userPreferences.dining || 'Not specified'}
- Trip duration: ${userPreferences.duration || 'Not specified'}

**IMPORTANT: Tailor ALL recommendations based on these preferences. Consider budget constraints, match to stated interests, respect time preferences and group dynamics.**
`;
    }

    const stateContext = `
Current Agent State:
- Planning Phase: ${agentState.planningPhase}
- User Location: ${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Unknown'}
- Plan Progress: ${agentState.currentPlan.length} locations planned
${preferenceContext}
User Request: ${enhancedPrompt}

${userPreferences && Object.keys(userPreferences).length > 0 ? 
  'IMPORTANT: User has provided preferences above. Proceed with creating travel recommendations using tools. DO NOT ask for additional preferences.' : 
  'Note: User has not set preferences yet. Consider using |||PREFERENCES||| if needed for personalization.'
}

Remember to use tools strategically to gather information before making recommendations. Think step by step about what information you need and how to best serve the user's request.`;

    console.log('🤖 Starting LangChain agent execution...');
    
    // Execute the agent with proper input format
    const result = await agentExecutor.invoke({
      input: stateContext,
      chat_history: chatHistory,
    });
    
    // If no intermediate steps, try running once more to ensure tool execution
    if (!result.intermediateSteps || result.intermediateSteps.length === 0) {
      console.log('⚠️ No intermediate steps detected, attempting to force tool execution...');
      
      // Check if we have a user request that requires tools but the agent failed to execute them
      const needsPlaces = prompt.toLowerCase().includes('plan') || 
                         prompt.toLowerCase().includes('recommend') || 
                         prompt.toLowerCase().includes('travel') ||
                         prompt.toLowerCase().includes('beach') ||
                         prompt.toLowerCase().includes('restaurant') ||
                         userPreferences?.interests?.length > 0;
      
      // Check if output is empty or very short (indicating tool execution failure)
      const hasEmptyOrShortOutput = !result.output || result.output.trim().length < 50;
      
      if (needsPlaces || hasEmptyOrShortOutput) {
        console.log('🔄 Tool execution failed - triggering manual execution for user preferences');
        
        try {
          // Determine what types of places to search for based on user preferences OR text content
          const searchTypes = [];
          
          // Check user preferences object AND text content
          if (userPreferences?.interests?.includes('beaches') || 
              prompt.toLowerCase().includes('beach') || 
              prompt.toLowerCase().includes('water') ||
              prompt.toLowerCase().includes('swimming')) {
            searchTypes.push('beach');
          }
          if (userPreferences?.interests?.includes('food') || 
              prompt.toLowerCase().includes('restaurant') || 
              prompt.toLowerCase().includes('dining') ||
              prompt.toLowerCase().includes('food')) {
            searchTypes.push('restaurant');
          }
          if (userPreferences?.interests?.includes('nature') || 
              prompt.toLowerCase().includes('nature') ||
              prompt.toLowerCase().includes('park')) {
            searchTypes.push('park');
          }
          if (userPreferences?.interests?.includes('history') || 
              prompt.toLowerCase().includes('history') ||
              prompt.toLowerCase().includes('historical') ||
              prompt.toLowerCase().includes('culture')) {
            searchTypes.push('tourist_attraction');
          }
          
          // Special case: if user mentions water activities, definitely include beaches
          if (prompt.toLowerCase().includes('wateractivities') || 
              prompt.toLowerCase().includes('water activities')) {
            searchTypes.push('beach');
          }
          
          // Default to beaches and restaurants if no specific interests
          if (searchTypes.length === 0) {
            searchTypes.push('beach', 'restaurant');
          }
          
          const toolResults = {};
          
          // Execute searches for each type
          for (const type of searchTypes) {
            console.log(`🔧 Manually executing getNearbyPlaces for ${type}...`);
            const results = await getNearbyPlaces({ 
              lat: 36.4341, 
              lng: 28.2176, 
              type: type, 
              radius: type === 'beach' ? 10000 : 5000 
            });
            toolResults[type] = results.slice(0, 3); // Top 3 results
            console.log(`✅ Found ${results.length} ${type} results`);
          }
          
          console.log(`✅ Manual execution complete for ${Object.keys(toolResults).length} categories`);
          
          // Enhance the result with tool data
          result.toolResults = toolResults;
          
          // If output is empty, provide a basic response
          if (!result.output || result.output.trim().length === 0) {
            result.output = "Perfect! I've found some great options for your Rhodes adventure based on your preferences. Let me create your personalized itinerary.";
          }
          
        } catch (error) {
          console.error('❌ Manual tool execution failed:', error.message);
        }
      }
    }

    console.log('🤖 Agent execution completed');

    // Extract structured data from the response
    let { locations, cleanedText, metadata } = extractStructuredData(result.output);
    
    // Check if user already has sufficient preferences (either in userPreferences object OR in their message text)
    const hasSufficientPreferences = userPreferences && (
      (userPreferences.interests && userPreferences.interests.length > 0) ||
      userPreferences.budget ||
      userPreferences.groupSize ||
      userPreferences.pace
    );
    
    // Also check if user provided preferences in their message text
    const hasTextPreferences = prompt.toLowerCase().includes('preference') ||
                              prompt.toLowerCase().includes('pace:') ||
                              prompt.toLowerCase().includes('budget:') ||
                              prompt.toLowerCase().includes('interest') ||
                              prompt.toLowerCase().includes('companion') ||
                              prompt.toLowerCase().includes('group') ||
                              prompt.toLowerCase().includes('wateractivities') ||
                              prompt.toLowerCase().includes('transport:');
    
    const hasAnyPreferences = hasSufficientPreferences || hasTextPreferences;
    
    console.log(`🔍 Preference check: hasSufficient=${hasSufficientPreferences}, hasTextPrefs=${hasTextPreferences}, interests=${userPreferences?.interests?.length || 0}, budget=${userPreferences?.budget}`);
    
    // Only ask for preferences if we don't have sufficient ones and no locations were generated
    if (locations.length === 0 && !cleanedText.includes('|||PREFERENCES|||') && !hasAnyPreferences) {
      // Check if the response is asking for more information instead of providing recommendations
      if (cleanedText.includes('specific interests') || 
          cleanedText.includes('preferences') || 
          cleanedText.includes('more information') ||
          cleanedText.includes('Before proceeding')) {
        console.log('🔄 Agent asked for preferences without using marker - fixing UX...');
        
        // Replace the response with a proper preference request
        cleanedText = "I'll help you create the perfect Rhodes adventure! Let me gather some additional preferences to personalize your plan. |||PREFERENCES|||interests,budget,activities|||";
      }
    }
    
    // If we have manually executed tool results and no locations found, generate some based on tool results
    if (result.toolResults && locations.length === 0 && !cleanedText.includes('|||PREFERENCES|||')) {
      console.log('📝 No structured locations found in response, generating from tool results...');
      
      const generatedLocations = [];
      
      // Process each type of search results
      Object.entries(result.toolResults).forEach(([type, results]) => {
        if (!results || !Array.isArray(results)) return;
        
        results.forEach((place, index) => {
          let locationData;
          
          switch (type) {
            case 'beach':
              locationData = {
                name: place.name,
                type: "Beach",
                description: `Beautiful beach perfect for your Rhodes adventure. Rating: ${place.rating || 'N/A'}`,
                highlights: ["Water activities", "Beautiful scenery", "Relaxing atmosphere"],
                tips: ["Arrive early for best spots", "Bring water and sunscreen"],
                bestTimeToVisit: "09:00-17:00 for best experience",
                details: {
                  rating: place.rating,
                  priceRange: "Free",
                  openingHours: "24/7"
                }
              };
              break;
              
            case 'restaurant':
              locationData = {
                name: place.name,
                type: "Restaurant",
                description: `Great dining option with local flavor. Rating: ${place.rating || 'N/A'}`,
                highlights: ["Local cuisine", "Great atmosphere", "Good service"],
                tips: ["Make reservations recommended", "Try local specialties"],
                bestTimeToVisit: "12:00-14:00 for lunch, 19:00-21:00 for dinner",
                details: {
                  rating: place.rating,
                  priceRange: userPreferences?.budget === 'luxury' ? "€€€" : userPreferences?.budget === 'budget' ? "€" : "€€",
                  openingHours: "11:00-23:00"
                }
              };
              break;
              
            case 'park':
              locationData = {
                name: place.name,
                type: "Nature",
                description: `Beautiful natural area perfect for nature lovers. Rating: ${place.rating || 'N/A'}`,
                highlights: ["Natural beauty", "Peaceful atmosphere", "Great for photos"],
                tips: ["Wear comfortable shoes", "Bring water"],
                bestTimeToVisit: "Early morning or late afternoon",
                details: {
                  rating: place.rating,
                  priceRange: "Free",
                  openingHours: "Dawn to dusk"
                }
              };
              break;
              
            case 'tourist_attraction':
              locationData = {
                name: place.name,
                type: "Historical Site",
                description: `Fascinating historical attraction with rich heritage. Rating: ${place.rating || 'N/A'}`,
                highlights: ["Historical significance", "Cultural heritage", "Educational"],
                tips: ["Check opening hours", "Consider guided tour"],
                bestTimeToVisit: "Morning hours for fewer crowds",
                details: {
                  rating: place.rating,
                  priceRange: "€-€€",
                  openingHours: "09:00-17:00"
                }
              };
              break;
              
            default:
              locationData = {
                name: place.name,
                type: "Attraction",
                description: `Interesting location worth visiting. Rating: ${place.rating || 'N/A'}`,
                highlights: ["Worth visiting", "Local experience"],
                tips: ["Check before visiting"],
                bestTimeToVisit: "Daytime hours",
                details: {
                  rating: place.rating,
                  priceRange: "€",
                  openingHours: "Varies"
                }
              };
          }
          
          generatedLocations.push({
            ...locationData,
            location: {
              address: place.address || "Rhodes, Greece",
              coordinates: place.coordinates || { lat: 36.4341, lng: 28.2176 }
            },
            travel: { distanceMeters: 0, durationMinutes: 0 }
          });
        });
        
        // Limit locations per type to avoid overwhelming users
        if (generatedLocations.length >= 4) return;
      });
      
      locations = generatedLocations.slice(0, 4); // Max 4 locations total
      console.log(`📍 Generated ${locations.length} locations from tool results`);
    }
    
    // Geocode any locations with missing or invalid coordinates
    const geocodedLocations = await geocodeLocations(locations);
    
    // Post-process travel times if missing
    await addTravelTimes(geocodedLocations, userLocation);

    // Update agent state
    geocodedLocations.forEach(loc => agentState.addPlanLocation(loc));

    return res.status(200).json({ 
      reply: cleanedText, // This now includes the fixed preference request if needed
      structuredData: { 
        locations: geocodedLocations, 
        metadata: {
          ...metadata,
          agentState: agentState.getState(),
          intermediateSteps: result.intermediateSteps?.length || 0,
          toolsUsed: result.intermediateSteps?.map(step => step.action?.tool).filter(Boolean) || []
        }
      }
    });

  } catch (error) {
    console.error('🚨 Agent execution error:', error);
    
    // Fallback to basic response
    return res.status(500).json({ 
      error: 'Agent execution failed',
      fallback: true,
      reply: "I apologize, but I'm experiencing technical difficulties. Please try your request again.",
      structuredData: { locations: [], metadata: { error: error.message } }
    });
  }
}

// Geocode locations with missing or invalid coordinates
async function geocodeLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  console.log(`🗺️ [Agent] Geocoding ${locations.length} locations`);

  const geocodedLocations = await Promise.all(
    locations.map(async (location, index) => {
      try {
        // Check if coordinates are valid
        const currentCoords = location?.location?.coordinates;
        const validCoords = validateCoordinates(currentCoords);
        
        if (validCoords) {
          // Coordinates are valid, keep as is
          console.log(`✅ [Agent] Location ${index + 1} already has valid coordinates: ${location.name}`);
          return location;
        }

        // Coordinates are missing or invalid, geocode the location
        console.log(`🗺️ [Agent] Geocoding location ${index + 1}: ${location.name}`);
        
        const locationName = location.name;
        const address = location?.location?.address;
        
        if (!locationName) {
          console.log(`⚠️ [Agent] Location ${index + 1} missing name, skipping geocoding`);
          return location;
        }

        // Try to geocode
        const coordinates = await geocodeLocation(locationName, address);
        const newValidCoords = validateCoordinates(coordinates);

        if (newValidCoords) {
          console.log(`✅ [Agent] Successfully geocoded ${locationName}: ${newValidCoords.lat}, ${newValidCoords.lng}`);
          return {
            ...location,
            location: {
              ...location.location,
              coordinates: newValidCoords
            }
          };
        } else {
          console.log(`⚠️ [Agent] Failed to geocode ${locationName}, keeping original`);
          return location;
        }

      } catch (error) {
        console.error(`❌ [Agent] Error geocoding location ${index + 1}:`, error.message);
        return location; // Return original location on error
      }
    })
  );

  const validGeocodedCount = geocodedLocations.filter(loc => 
    validateCoordinates(loc?.location?.coordinates)
  ).length;

  console.log(`✅ [Agent] Geocoding complete: ${validGeocodedCount}/${locations.length} locations have valid coordinates`);

  return geocodedLocations;
}

// Helper function to add travel times between locations
async function addTravelTimes(locations, userLocation) {
  if (locations.length === 0) return;

  const locToString = (loc) =>
    loc?.coordinates ? `${loc.coordinates.lat},${loc.coordinates.lng}` : loc?.address;

  // Add travel time from user location to first location
  if (userLocation && locations.length > 0) {
    const first = locations[0];
    if (!first.travel || !(first.travel.distanceMeters && first.travel.durationMinutes)) {
      try {
        const origin = `${userLocation.lat},${userLocation.lng}`;
        const destination = locToString(first.location);
        if (destination) {
          const result = await getTravelTime({ origin, destination });
          if (result) {
            first.travel = {
              distanceMeters: result.distance_m,
              durationMinutes: Math.round(result.duration_s / 60)
            };
          }
        }
      } catch (e) {
        console.error('Failed to fetch first leg travel time:', e.message);
      }
    }
  }

  // Add travel times between consecutive locations
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];

    if (curr.travel && curr.travel.distanceMeters && curr.travel.durationMinutes) continue;

    try {
      const origin = locToString(prev.location);
      const destination = locToString(curr.location);
      if (!origin || !destination) continue;

      const result = await getTravelTime({ origin, destination });
      if (result) {
        curr.travel = {
          distanceMeters: result.distance_m,
          durationMinutes: Math.round(result.duration_s / 60)
        };
      }
    } catch (e) {
      console.error('Failed to fetch travel time:', e.message);
    }
  }
}

// Enhanced structured data extraction
function extractStructuredData(response) {
  try {
    const jsonMatches = [];
    let braceCount = 0;
    let currentMatchStartIndex = -1;
    let inString = false;
    let isEscaped = false;

    // Extract JSON objects from response
    for (let i = 0; i < response.length; i++) {
      const char = response[i];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
      }

      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            currentMatchStartIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          if (braceCount > 0) {
            braceCount--;
            if (braceCount === 0 && currentMatchStartIndex !== -1) {
              jsonMatches.push(response.substring(currentMatchStartIndex, i + 1));
              currentMatchStartIndex = -1;
            }
          }
        }
      }
    }

    const locations = [];
    const errors = [];
    const validJsonMatches = [];

    // Parse and validate JSON matches
    jsonMatches.forEach((match, index) => {
      try {
        const data = JSON.parse(match);
        
        if (validateLocation(data)) {
          locations.push(data);
          validJsonMatches.push(match);
        } else {
          errors.push({
            type: 'invalid_structure',
            index,
            data: match.substring(0, 100) + '...',
          });
        }
      } catch (e) {
        errors.push({
          type: 'parse_error',
          index,
          error: e.message,
          data: match.substring(0, 100) + '...',
        });
      }
    });

    // Clean response text
    let cleanedText = response;
    validJsonMatches.forEach(match => {
      cleanedText = cleanedText.replace(match, '|||LOCATION|||');
    });

    if (errors.length > 0) {
      console.log('📋 JSON Extraction Report:', {
        totalMatches: jsonMatches.length,
        validLocations: locations.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 3) // Show first 3 errors
      });
    }

    return {
      locations,
      cleanedText,
      metadata: {
        totalLocations: locations.length,
        totalErrors: errors.length,
        timestamp: new Date().toISOString(),
        extractionMethod: 'langchain-enhanced'
      }
    };
  } catch (error) {
    console.error('🚨 Error in extractStructuredData:', error);
    return {
      locations: [],
      cleanedText: response,
      metadata: {
        totalLocations: 0,
        totalErrors: 1,
        timestamp: new Date().toISOString(),
        error: 'Failed to extract structured data',
        extractionMethod: 'langchain-enhanced'
      }
    };
  }
} 