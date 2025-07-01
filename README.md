# WanderRhodes Map - Agentic AI Framework

## Overview

WanderRhodes now features an advanced **agentic AI framework** built with LangChain that provides sophisticated multi-step reasoning for travel planning. This framework enhances the existing RAG-powered system with intelligent tool usage, state management, and complex workflow orchestration.

## 🚀 Key Features

### Agentic Capabilities
- **Multi-step reasoning** for complex travel requests
- **Dynamic tool usage** based on context and user needs
- **Intelligent workflow orchestration** with state management
- **Adaptive planning** based on real-time data
- **Error recovery** and fallback mechanisms

### Enhanced Travel Planning
- **Route optimization** with real travel time calculations
- **Context-aware recommendations** based on user location and preferences
- **Multi-day itinerary planning** with logical flow
- **Local insights integration** combining RAG knowledge with live data
- **Structured data output** for rich frontend display

## 🏗️ Architecture

### Core Components

1. **AgentHandler** (`backend/agentHandler.js`)
   - LangChain-based agent execution
   - Tool integration and orchestration
   - Structured output generation

2. **MultiStepPlanner** (`backend/workflows/MultiStepPlanner.js`)
   - Advanced workflow states for complex planning
   - State graph implementation using LangGraph
   - Multi-step validation and optimization

3. **Tool Integration**
   - Google Places API for location discovery
   - Google Directions API for travel time calculation
   - RAG knowledge base search (ready for activation)

### Framework Structure

```
┌─────────────────────────────────────────┐
│               User Request              │
└───────────────┬─────────────────────────┘
                │
        ┌───────▼───────┐
        │  Agent Router │
        │ (Config Flag) │
        └───┬───────┬───┘
            │       │
    ┌───────▼───┐   │   ┌─────────▼─────────┐
    │ Original  │   │   │ LangChain Agent   │
    │ Handler   │   │   │    Framework      │
    └───────────┘   │   └─────────┬─────────┘
                    │             │
                    │   ┌─────────▼─────────┐
                    │   │ Multi-Step        │
                    │   │ Workflow Engine   │
                    │   └─────────┬─────────┘
                    │             │
                    │   ┌─────────▼─────────┐
                    │   │ Tool Orchestrator │
                    │   │ - Google Places   │
                    │   │ - Travel Time     │
                    │   │ - RAG Search      │
                    │   └─────────┬─────────┘
                    │             │
                    └─────────────▼─────────────
                            Structured Output
```

## 🛠️ Implementation Details

### 1. Agent Handler Features

The `agentHandler.js` provides:

```javascript
// Enhanced prompt with multi-step reasoning
const agentPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(`You are WanderRhodes, an advanced AI travel planning agent...
  
  Your Advanced Capabilities:
  - Multi-step planning and reasoning for complex travel requests
  - Dynamic tool usage based on context and user needs
  - Intelligent information gathering and synthesis
  - Adaptive planning based on real-time data`),
  
  new MessagesPlaceholder("chat_history"),
  new HumanMessage("{input}"),
  new MessagesPlaceholder("agent_scratchpad")
]);
```

### 2. Tool Integration

```javascript
// Dynamic tool selection based on request context
const tools = [
  new DynamicStructuredTool({
    name: "getNearbyPlaces",
    description: "Find nearby restaurants or attractions...",
    schema: z.object({
      lat: z.number(),
      lng: z.number(),
      radius: z.number().optional(),
      type: z.string().optional()
    }),
    func: async ({ lat, lng, radius, type }) => {
      // Google Places API integration
    }
  }),
  
  new DynamicStructuredTool({
    name: "getTravelTime", 
    description: "Calculate travel time between locations...",
    // Enhanced with multi-modal transport options
  })
];
```

### 3. State Management

```javascript
class AgentState {
  constructor() {
    this.userLocation = null;
    this.currentPlan = [];
    this.gatheredInfo = {};
    this.planningPhase = 'initial';
  }
  
  // Track planning progress and user context
  updateUserLocation(location) { ... }
  addPlanLocation(location) { ... }
  setPlanningPhase(phase) { ... }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Enable LangChain agent framework
USE_LANGCHAIN_AGENT=true

# Required API keys
OPENAI_API_KEY=your_openai_key
GOOGLE_MAPS_API_KEY=your_google_maps_key

# RAG Configuration (optional)
RAG_COLLECTION=rhodes_rag
RAG_DB_PATH=rhodes_qdrant
RAG_EMBED_MODEL=text-embedding-3-small
```

### Frontend Configuration

```javascript
// In ChatPage.jsx - Enable agent framework
localStorage.setItem('wr_use_agent', 'true');

// The system will use /api/agent endpoint instead of /api/chat
```

## 📊 Enhanced Response Structure

### Traditional Response
```json
{
  "reply": "Here are some restaurants...",
  "structuredData": {
    "locations": [...],
    "metadata": {
      "totalLocations": 3,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

### Agentic Response
```json
{
  "reply": "I found excellent restaurants using multi-step analysis...",
  "structuredData": {
    "locations": [...],
    "metadata": {
      "totalLocations": 3,
      "timestamp": "2024-01-01T12:00:00Z",
      "agentState": {
        "planningPhase": "finalizing",
        "userLocation": [36.4341, 28.2176],
        "currentPlan": [...],
        "gatheredInfo": {...}
      },
      "intermediateSteps": 6,
      "toolsUsed": ["getNearbyPlaces", "getTravelTime"],
      "executionTime": 3200,
      "optimizationApplied": true,
      "validationPassed": true
    }
  }
}
```

## 🔄 Workflow Examples

### Example 1: Simple Restaurant Search
```
User: "Find restaurants near me"

Agent Workflow:
1. Analyze Request → Identify location-based restaurant search
2. Use getNearbyPlaces → Discover restaurants around user location
3. Use getTravelTime → Calculate walking distances
4. Optimize Results → Sort by distance and rating
5. Generate Response → Provide personalized recommendations
```

### Example 2: Complex Day Trip Planning
```
User: "Plan a full day in Rhodes Old Town with history and food"

Agent Workflow:
1. Analyze Request → Multi-objective planning (history + food + timing)
2. Search Historical Sites → Use getNearbyPlaces(type: "tourist_attraction")
3. Search Restaurants → Use getNearbyPlaces(type: "restaurant") 
4. Route Optimization → Use getTravelTime for all location pairs
5. Timeline Planning → Consider opening hours and meal timing
6. Validation → Check feasibility of walking distances
7. Generate Itinerary → Complete day plan with 6-8 locations
```

## 🎯 Advantages Over Traditional Implementation

### Before (Traditional OpenAI Chat)
- Single-step responses
- Limited tool usage
- Basic location data
- No route optimization
- Minimal context awareness

### After (Agentic Framework)
- **Multi-step reasoning** for complex requests
- **Strategic tool usage** based on context
- **Rich location data** with travel optimization
- **State management** across conversation
- **Error recovery** with graceful fallbacks
- **Workflow transparency** with execution metadata

## 📈 Performance Monitoring

### Agent Execution Insights
```javascript
// Detailed execution metadata
console.log('🤖 Agent Execution Details:', {
  state: metadata.agentState,
  toolsUsed: metadata.toolsUsed,
  intermediateSteps: metadata.intermediateSteps,
  executionTime: metadata.executionTime
});
```

### Error Handling
- **Tool failure recovery**: Automatic fallback to alternative data sources
- **API timeout handling**: Graceful degradation with estimated data
- **Validation errors**: Clear error messages with suggested alternatives

## 🚀 Future Enhancements

### Planned Features
1. **Multi-Agent Collaboration**: Specialized agents for different domains
2. **Learning from Interactions**: Preference learning and personalization
3. **Real-time Data Integration**: Weather, events, traffic conditions
4. **Advanced Route Optimization**: Genetic algorithms for complex itineraries
5. **Voice Interface Integration**: Conversational planning workflows

### RAG Integration Roadmap
```javascript
// When enabled, RAG tool enhances responses with local knowledge
const ragTool = new DynamicStructuredTool({
  name: "searchKnowledgeBase",
  description: "Search Rhodes knowledge base for local insights",
  func: async ({ query, locationContext }) => {
    // Combines local knowledge with real-time data
    return await ragRetrieve(query, locationContext);
  }
});
```

## 🔍 Debugging and Development

### Enable Debug Mode
```javascript
// In agentHandler.js
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true, // Enable detailed logging
  returnIntermediateSteps: true
});
```

### Tool Testing
```bash
# Test individual tools
curl -X POST localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find restaurants in Faliraki", "userLocation": {"lat": 36.3386, "lng": 28.2018}}'
```

## 📚 Documentation

- **AgentWorkflowExamples.md**: Comprehensive usage examples
- **MultiStepPlanner.js**: Advanced workflow implementation
- **Tool Integration Guides**: Custom tool development

The agentic framework transforms WanderRhodes from a simple chat interface into an intelligent travel planning assistant capable of sophisticated reasoning, strategic tool usage, and contextual recommendations that adapt to user needs in real-time.
