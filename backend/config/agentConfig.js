// agentConfig.js - Centralized configuration for the agentic framework
import dotenv from 'dotenv';

dotenv.config();

/**
 * Agent Framework Configuration
 * Centralizes all configuration with environment variable support and sensible defaults
 */
export const AgentConfig = {
  // === CORE AGENT SETTINGS ===
  
  /**
   * Whether to use the LangChain agent framework
   * If false, falls back to traditional chatHandler
   */
  useLangChainAgent: process.env.USE_LANGCHAIN_AGENT === 'true',
  
  /**
   * OpenAI model for agent reasoning
   * Recommended: gpt-4-1106-preview for best performance
   */
  model: process.env.AGENT_MODEL || 'gpt-4-1106-preview',
  
  /**
   * Temperature for agent responses (0.0-1.0)
   * Lower = more deterministic, Higher = more creative
   */
  temperature: parseFloat(process.env.AGENT_TEMPERATURE) || 0.7,
  
  /**
   * Maximum token limit for agent responses
   */
  maxTokens: parseInt(process.env.AGENT_MAX_TOKENS) || 2000,
  
  /**
   * Maximum iterations for agent execution loops
   * Prevents infinite loops while allowing complex reasoning
   */
  maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS) || 10,
  
  /**
   * Enable detailed agent execution logging
   */
  debugMode: process.env.AGENT_DEBUG === 'true' || process.env.NODE_ENV === 'development',
  
  // === TOOL CONFIGURATION ===
  
  /**
   * Tool execution timeout in milliseconds
   */
  toolTimeout: parseInt(process.env.TOOL_TIMEOUT) || 30000,
  
  /**
   * Google Maps API timeout
   */
  googleApiTimeout: parseInt(process.env.GOOGLE_API_TIMEOUT) || 8000,
  
  /**
   * Default search radius for location-based queries (meters)
   */
  defaultSearchRadius: parseInt(process.env.DEFAULT_SEARCH_RADIUS) || 1000,
  
  /**
   * Maximum travel time to consider for route optimization (minutes)
   */
  maxTravelTime: parseInt(process.env.MAX_TRAVEL_TIME) || 60,
  
  // === RAG CONFIGURATION ===
  
  /**
   * Enable RAG knowledge base integration
   */
  ragEnabled: process.env.RAG_ENABLED === 'true',
  
  /**
   * RAG collection name in Qdrant
   */
  ragCollection: process.env.RAG_COLLECTION || 'rhodes_rag',
  
  /**
   * Path to Qdrant database
   */
  ragDbPath: process.env.RAG_DB_PATH || 'rhodes_qdrant',
  
  /**
   * OpenAI embedding model for RAG
   */
  ragEmbedModel: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
  
  /**
   * Number of RAG documents to retrieve
   */
  ragDocumentLimit: parseInt(process.env.RAG_DOCUMENT_LIMIT) || 3,
  
  // === PERFORMANCE SETTINGS ===
  
  /**
   * Enable response caching
   */
  enableCaching: process.env.ENABLE_CACHING !== 'false',
  
  /**
   * Cache expiry time in seconds
   */
  cacheExpiry: parseInt(process.env.CACHE_EXPIRY) || 3600,
  
  /**
   * Enable parallel tool execution
   */
  enableParallelTools: process.env.ENABLE_PARALLEL_TOOLS !== 'false',
  
  /**
   * Maximum concurrent tool executions
   */
  maxConcurrentTools: parseInt(process.env.MAX_CONCURRENT_TOOLS) || 3,
  
  // === FEATURE FLAGS ===
  
  /**
   * Enable multi-step workflow planner (experimental)
   */
  enableMultiStepPlanner: process.env.ENABLE_MULTI_STEP_PLANNER === 'true',
  
  /**
   * Enable agent state persistence across requests
   */
  enableStatePersistence: process.env.ENABLE_STATE_PERSISTENCE === 'true',
  
  /**
   * Enable advanced route optimization algorithms
   */
  enableRouteOptimization: process.env.ENABLE_ROUTE_OPTIMIZATION !== 'false',
  
  /**
   * Enable weather-aware planning
   */
  enableWeatherAware: process.env.ENABLE_WEATHER_AWARE === 'true',
  
  // === MONITORING AND ANALYTICS ===
  
  /**
   * Enable performance monitoring
   */
  enableMonitoring: process.env.ENABLE_MONITORING === 'true',
  
  /**
   * Log level for agent operations
   */
  logLevel: process.env.LOG_LEVEL || 'info',
  
  /**
   * Enable execution metrics collection
   */
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  
  // === DEVELOPMENT AND TESTING ===
  
  /**
   * Development mode enables additional debugging features
   */
  devMode: process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true',
  
  /**
   * Mock external API responses for testing
   */
  mockApis: process.env.MOCK_APIS === 'true',
  
  /**
   * Skip API key validation (for testing)
   */
  skipApiValidation: process.env.SKIP_API_VALIDATION === 'true',
  
  // === LOCATION-SPECIFIC SETTINGS ===
  
  /**
   * Rhodes island center coordinates (default location)
   */
  rhodesCenter: {
    lat: parseFloat(process.env.RHODES_CENTER_LAT) || 36.4341,
    lng: parseFloat(process.env.RHODES_CENTER_LNG) || 28.2176
  },
  
  /**
   * Rhodes island bounding box for location validation
   */
  rhodesBounds: {
    north: parseFloat(process.env.RHODES_NORTH) || 36.4773,
    south: parseFloat(process.env.RHODES_SOUTH) || 35.8885,
    east: parseFloat(process.env.RHODES_EAST) || 28.2441,
    west: parseFloat(process.env.RHODES_WEST) || 27.7388
  }
};

/**
 * Validate configuration and warn about missing required settings
 */
export function validateAgentConfig() {
  const warnings = [];
  const errors = [];
  
  // Check required API keys
  if (!process.env.OPENAI_API_KEY && !AgentConfig.skipApiValidation) {
    errors.push('OPENAI_API_KEY is required for agent functionality');
  }
  
  if (!process.env.GOOGLE_MAPS_API_KEY && !AgentConfig.mockApis) {
    warnings.push('GOOGLE_MAPS_API_KEY missing - tool functionality will be limited');
  }
  
  // Check RAG configuration if enabled
  if (AgentConfig.ragEnabled) {
    if (!AgentConfig.ragCollection) {
      warnings.push('RAG enabled but RAG_COLLECTION not specified');
    }
    if (!AgentConfig.ragDbPath) {
      warnings.push('RAG enabled but RAG_DB_PATH not specified');
    }
  }
  
  // Check model availability
  const supportedModels = [
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo'
  ];
  
  if (!supportedModels.includes(AgentConfig.model)) {
    warnings.push(`Model ${AgentConfig.model} may not be optimal for agent reasoning`);
  }
  
  // Validate numeric settings
  if (AgentConfig.temperature < 0 || AgentConfig.temperature > 1) {
    warnings.push('Temperature should be between 0.0 and 1.0');
  }
  
  if (AgentConfig.maxIterations < 1 || AgentConfig.maxIterations > 50) {
    warnings.push('Max iterations should be between 1 and 50');
  }
  
  // Log validation results
  if (errors.length > 0) {
    console.error('❌ Agent Configuration Errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error('Agent configuration validation failed');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Agent Configuration Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  if (AgentConfig.debugMode) {
    console.log('🔧 Agent Configuration:');
    console.log(`   - Model: ${AgentConfig.model}`);
    console.log(`   - Temperature: ${AgentConfig.temperature}`);
    console.log(`   - Max Iterations: ${AgentConfig.maxIterations}`);
    console.log(`   - RAG Enabled: ${AgentConfig.ragEnabled}`);
    console.log(`   - Multi-Step Planner: ${AgentConfig.enableMultiStepPlanner}`);
    console.log(`   - Debug Mode: ${AgentConfig.debugMode}`);
  }
  
  return { errors, warnings };
}

/**
 * Get runtime configuration status
 */
export function getConfigStatus() {
  return {
    agentFrameworkEnabled: AgentConfig.useLangChainAgent,
    ragEnabled: AgentConfig.ragEnabled,
    toolsAvailable: {
      googleMaps: !!process.env.GOOGLE_MAPS_API_KEY || AgentConfig.mockApis,
      openai: !!process.env.OPENAI_API_KEY || AgentConfig.skipApiValidation
    },
    features: {
      multiStepPlanner: AgentConfig.enableMultiStepPlanner,
      routeOptimization: AgentConfig.enableRouteOptimization,
      statePersistence: AgentConfig.enableStatePersistence,
      weatherAware: AgentConfig.enableWeatherAware
    },
    performance: {
      cachingEnabled: AgentConfig.enableCaching,
      parallelToolsEnabled: AgentConfig.enableParallelTools,
      monitoringEnabled: AgentConfig.enableMonitoring
    }
  };
}

// Auto-validate configuration on import
if (process.env.NODE_ENV !== 'test') {
  try {
    validateAgentConfig();
  } catch (error) {
    console.error('Failed to validate agent configuration:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
} 