# Agent Workflow Examples

This document provides comprehensive examples of how the LangChain-based agentic framework enhances travel planning for different user scenarios.

## Basic Usage Examples

### Example 1: Restaurant Recommendations with Tool Usage

**User Input:**
```
"I'm hungry and near Faliraki. Find me some good restaurants within walking distance."
```

**Agent Workflow:**
1. **Analyze Request**: Determines user wants restaurants near Faliraki
2. **Tool Usage**: Calls `getNearbyPlaces` with Faliraki coordinates
3. **Route Planning**: Uses `getTravelTime` to calculate walking distances
4. **Response**: Provides 3-5 restaurants with detailed JSON data

**Expected Response Structure:**
```javascript
{
  "reply": "I found some excellent restaurants within walking distance of Faliraki! Let me share the best options based on current availability and local favorites.",
  "structuredData": {
    "locations": [
      {
        "name": "Taverna Kostas",
        "type": "restaurant",
        "description": "Authentic Greek taverna with amazing seafood",
        "location": {
          "address": "Faliraki Beach Road, Rhodes",
          "coordinates": { "lat": 36.3386, "lng": 28.2018 }
        },
        "travel": { "distanceMeters": 250, "durationMinutes": 3 }
      }
    ],
    "metadata": {
      "agentState": {
        "planningPhase": "finalizing",
        "currentPlan": [...]
      },
      "toolsUsed": ["getNearbyPlaces", "getTravelTime"],
      "intermediateSteps": 4
    }
  }
}
```

### Example 2: Multi-Step Day Trip Planning

**User Input:**
```
"Plan a full day in Rhodes Old Town starting at 10 AM. I'm interested in history and good food."
```

**Agent Workflow:**
1. **Analyze Request**: Identifies full-day planning need with historical focus
2. **Information Gathering**: 
   - Uses `getNearbyPlaces` to find historical sites
   - Uses `getNearbyPlaces` to find restaurants
3. **Route Optimization**: 
   - Calls `getTravelTime` multiple times to optimize walking route
   - Considers opening hours and lunch timing
4. **Validation**: Checks feasibility of timing and distances
5. **Response**: Provides complete itinerary with 6-8 locations

**Advanced Features Demonstrated:**
- Multi-step reasoning across different location types
- Time-based planning (morning sights, lunch break, afternoon activities)
- Route optimization to minimize walking
- Local insights and tips integration

### Example 3: Complex Multi-Region Planning

**User Input:**
```
"I have 2 days in Rhodes. Day 1 focus on beaches and relaxation, Day 2 explore villages and culture. I'm staying in Rhodes Town."
```

**Agent Workflow:**
1. **Multi-Day Analysis**: Breaks request into two distinct day plans
2. **Day 1 Planning**:
   - `getNearbyPlaces` for beaches near Rhodes Town
   - `getTravelTime` for beach accessibility
   - Considers beach amenities and sunset timing
3. **Day 2 Planning**:
   - Searches for traditional villages
   - Plans cultural sites and local experiences
   - Optimizes route for day trip logistics
4. **Integration**: Ensures both days complement each other
5. **Response**: Provides detailed 2-day itinerary

## Advanced Workflow Scenarios

### Scenario 1: Adaptive Planning Based on Tool Results

```javascript
// Initial user request
"Find me a romantic dinner spot"

// Agent workflow:
1. Uses getNearbyPlaces(userLocation, type: "restaurant")
2. Analyzes results and realizes user is in busy tourist area
3. Uses getNearbyPlaces again with larger radius to find quieter options
4. Uses getTravelTime to ensure accessibility
5. Provides curated romantic options with ambiance details
```

### Scenario 2: Error Recovery and Fallback

```javascript
// When tools fail or return insufficient data
1. Agent detects getTravelTime API failure
2. Falls back to estimated distances based on coordinates
3. Provides response with "estimated" travel times
4. Includes note about potential variations
5. Suggests alternative verification methods
```

### Scenario 3: Context-Aware Multi-Tool Usage

```javascript
// User: "Plan lunch and afternoon activities near Lindos"
1. Uses getNearbyPlaces(Lindos_coords, type: "restaurant") for lunch
2. Uses getNearbyPlaces(Lindos_coords, type: "tourist_attraction") for activities  
3. Uses getTravelTime between lunch spot and each activity
4. Optimizes sequence based on opening hours and travel time
5. Provides integrated lunch + activity plan
```

## Implementation Examples

### Adding Custom Tools

```javascript
// Example: Weather-aware planning tool
const weatherTool = new DynamicStructuredTool({
  name: "getWeatherForecast",
  description: "Get weather forecast to inform activity recommendations",
  schema: z.object({
    location: z.string(),
    date: z.string().optional()
  }),
  func: async ({ location, date }) => {
    // Weather API integration
    return await weatherService.getForecast(location, date);
  }
});

// Agent uses weather data to modify recommendations
```

### State Management Example

```javascript
// Agent maintains state across multiple interactions
class TravelPlannerState {
  constructor() {
    this.userPreferences = {};
    this.visitedLocations = [];
    this.plannedRoute = [];
    this.timeConstraints = {};
  }
  
  updateFromUserInput(input) {
    // Extract and store user preferences
    if (input.includes("budget")) {
      this.userPreferences.budget = this.extractBudget(input);
    }
    // Continue building user profile
  }
}
```

### RAG Integration Example

```javascript
// When RAG is enabled, agent uses knowledge base strategically
const ragTool = new DynamicStructuredTool({
  name: "searchKnowledgeBase",
  description: "Search Rhodes knowledge base for detailed local information",
  schema: z.object({
    query: z.string(),
    locationContext: z.string().optional()
  }),
  func: async ({ query, locationContext }) => {
    // Call RAG retrieval system
    const results = await ragRetrieve(query, locationContext);
    return results.map(r => r.text).join('\n---\n');
  }
});

// Agent workflow with RAG:
1. User asks about "hidden beaches in Lindos"
2. Agent uses searchKnowledgeBase("hidden beaches", "Lindos")
3. Enriches response with specific local knowledge
4. Uses getNearbyPlaces for current accessibility
5. Combines local knowledge with real-time data
```

## Response Quality Improvements

### Before (Simple OpenAI Integration):
```
User: "Find restaurants in Faliraki"
Response: "Here are some restaurants: [generic list]"
```

### After (Agentic Framework):
```
User: "Find restaurants in Faliraki"

Agent Process:
1. Analyzes user is asking for restaurants
2. Uses getCurrentLocation or assumes Faliraki center
3. Calls getNearbyPlaces with current coordinates
4. For each restaurant found, calculates travel time
5. Considers time of day, opening hours, cuisine variety
6. Provides personalized recommendations with rich context

Response: "I found some excellent dining options in Faliraki! Based on your location, here are my top recommendations within walking distance, each offering a unique experience perfect for [time context]..."
```

## Monitoring and Debugging

### Agent Execution Insights

```javascript
// Response includes detailed execution metadata
{
  "metadata": {
    "agentState": {
      "planningPhase": "finalizing",
      "userLocation": [36.4341, 28.2176],
      "currentPlan": [...],
      "gatheredInfo": {...}
    },
    "intermediateSteps": 6,
    "toolsUsed": ["getNearbyPlaces", "getTravelTime", "searchKnowledgeBase"],
    "executionTime": 3200,
    "optimizationApplied": true,
    "validationPassed": true
  }
}
```

### Error Handling Examples

```javascript
// Graceful degradation when tools fail
1. getNearbyPlaces fails → Use fallback location database
2. getTravelTime fails → Calculate estimated distances
3. RAG search fails → Use general Rhodes knowledge
4. All tools fail → Provide basic recommendations with human-like explanation
```

## Performance Optimizations

### Parallel Tool Execution

```javascript
// Agent can execute multiple tools simultaneously
const [nearbyRestaurants, nearbyAttractions] = await Promise.all([
  getNearbyPlaces({ lat, lng, type: "restaurant" }),
  getNearbyPlaces({ lat, lng, type: "tourist_attraction" })
]);
```

### Caching Strategy

```javascript
// Tool results cached to avoid redundant API calls
// Travel times cached for common route combinations
// User preferences stored for session continuity
```

### Smart Tool Selection

```javascript
// Agent learns when to use which tools based on context
if (userRequest.includes("route") || userRequest.includes("directions")) {
  // Prioritize getTravelTime tool
}
if (userRequest.includes("near") || userRequest.includes("around")) {
  // Use getNearbyPlaces first
}
```

This agentic framework provides a robust foundation for sophisticated travel planning that adapts to user needs, leverages available tools intelligently, and provides rich, contextual responses with proper error handling and fallback mechanisms.

## Interactive Features Examples

### Example 1: Preference-Driven Planning

**User Query:** "Plan a romantic day in Rhodes"

**Agent Response:**
```
I'd love to help you plan a romantic day in Rhodes! To create the perfect experience for you, let me gather some preferences first |||PREFERENCES|||interests,budget,timeOfDay,groupSize|||

Based on typical romantic preferences, I'll start planning a beautiful day that includes scenic viewpoints, intimate dining, and magical sunset spots. Once you set your preferences, I can customize this perfectly for you!
```

**Interactive Flow:**
1. User sees preference collection UI with romantic defaults
2. User selects: Budget: Luxury, Interests: Beaches + Photography, Time: Afternoon + Evening, Group: Couple
3. Agent receives updated preferences and refines the plan
4. Final plan includes high-end restaurants, photography spots, and luxury experiences

### Example 2: Dynamic Plan Editing

**User Query:** "Create a family day trip with kids"

**Agent Response:**
```
Perfect! Here's a family-friendly adventure designed for kids and parents:

[Location cards for family attractions]

|||EDIT_PLAN||| Would you like to modify this itinerary? You can reorder stops, add activities, or remove locations that don't work for your family.
```

**Interactive Flow:**
1. User clicks "Edit Plan" button in chat
2. Plan editor opens with drag-and-drop interface
3. User can:
   - Reorder locations by dragging
   - Remove kid-unfriendly spots
   - Add custom stops (playgrounds, ice cream shops)
   - Adjust timing and distances
4. Saves updated plan back to conversation

These interactive features transform the static chat experience into a dynamic, personalized travel planning tool that adapts to user preferences and allows real-time customization. 