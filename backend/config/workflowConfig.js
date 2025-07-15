/**
 * Workflow Configuration - Centralized AI System Switching Logic
 * Controls which AI system is used for different types of requests
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * AI Workflow Configuration
 * Provides environment-based switching between different AI implementations
 */
export const WorkflowConfig = {
  // === MASTER WORKFLOW SWITCHES ===
  
  /**
   * Enable the new strict AI workflow system
   * When true: Uses AI decision → Server query → AI selection workflow
   * When false: Falls back to enhanced or traditional systems
   */
  useStrictAIWorkflow: process.env.USE_STRICT_AI_WORKFLOW === 'true',
  
  /**
   * Fallback system when strict workflow fails or is disabled
   * Options: 'enhanced', 'traditional', 'basic'
   */
  strictWorkflowFallback: process.env.STRICT_WORKFLOW_FALLBACK || 'enhanced',
  
  /**
   * OpenAI model for strict workflow (must support JSON mode)
   * Default: gpt-4-1106-preview (GPT-4 Turbo with JSON support)
   */
  strictWorkflowModel: process.env.STRICT_WORKFLOW_MODEL || 'gpt-4-1106-preview',
  
  // === EXISTING SYSTEM CONTROLS ===
  
  /**
   * Use LangChain agent framework vs traditional chat handler
   * Affects: /api/chat endpoint with action=agent
   */
  useLangChainAgent: process.env.USE_LANGCHAIN_AGENT === 'true',
  
  /**
   * Use enhanced chat tools with spatial intelligence
   * Affects: Traditional chat handler capabilities
   */
  useEnhancedChat: process.env.USE_ENHANCED_CHAT !== 'false', // Default enabled
  
  /**
   * Use enhanced POI system with PostgreSQL/spatial relationships
   * When false: Falls back to SQLite and basic POI data
   */
  useEnhancedPOI: process.env.USE_ENHANCED_POI !== 'false', // Default enabled
  
  // === WORKFLOW BEHAVIOR SETTINGS ===
  
  /**
   * Enable automatic fallback when strict workflow fails
   */
  enableAutoFallback: process.env.ENABLE_AUTO_FALLBACK !== 'false', // Default enabled
  
  /**
   * Log workflow decisions for monitoring
   */
  logWorkflowDecisions: process.env.LOG_WORKFLOW_DECISIONS !== 'false', // Default enabled
  
  /**
   * Timeout for strict workflow execution (milliseconds)
   */
  strictWorkflowTimeout: parseInt(process.env.STRICT_WORKFLOW_TIMEOUT) || 60000,
  
  /**
   * Maximum retries for failed strict workflow attempts
   */
  maxStrictWorkflowRetries: parseInt(process.env.MAX_STRICT_WORKFLOW_RETRIES) || 2,
  
  // === PERFORMANCE AND MONITORING ===
  
  /**
   * Enable performance monitoring for workflow switching
   */
  enablePerformanceMonitoring: process.env.ENABLE_WORKFLOW_MONITORING === 'true',
  
  /**
   * Enable detailed workflow execution logging
   */
  enableDetailedLogging: process.env.NODE_ENV === 'development' || process.env.WORKFLOW_DEBUG === 'true',
  
  /**
   * Collect metrics on workflow success/failure rates
   */
  collectWorkflowMetrics: process.env.COLLECT_WORKFLOW_METRICS === 'true'
};

/**
 * Determine which AI system to use for step-by-step planning
 */
export function getStepPlannerWorkflow() {
  if (WorkflowConfig.useStrictAIWorkflow) {
    return 'strict';
  }
  
  if (WorkflowConfig.useEnhancedPOI) {
    return 'enhanced';
  }
  
  return 'basic';
}

/**
 * Determine which AI system to use for chat handling
 */
export function getChatWorkflow(action = null) {
  // Check if specific agent is requested
  if (action === 'agent' && WorkflowConfig.useLangChainAgent) {
    return 'langchain_agent';
  }
  
  // Determine chat handler type
  if (WorkflowConfig.useEnhancedChat) {
    return 'enhanced_chat';
  }
  
  return 'traditional_chat';
}

/**
 * Get fallback workflow when primary system fails
 */
export function getFallbackWorkflow(primaryWorkflow, error = null) {
  const fallbackMap = {
    'strict': WorkflowConfig.strictWorkflowFallback,
    'enhanced': 'traditional',
    'traditional': 'basic',
    'langchain_agent': 'enhanced_chat',
    'enhanced_chat': 'traditional_chat',
    'traditional_chat': 'basic'
  };
  
  const fallback = fallbackMap[primaryWorkflow] || 'basic';
  
  if (WorkflowConfig.logWorkflowDecisions) {
    console.log(`🔄 WORKFLOW FALLBACK: ${primaryWorkflow} → ${fallback}`, {
      reason: error?.message || 'Primary workflow failed',
      timestamp: new Date().toISOString()
    });
  }
  
  return fallback;
}

/**
 * Log workflow decision for monitoring
 */
export function logWorkflowUsage(workflow, endpoint, metadata = {}) {
  if (!WorkflowConfig.logWorkflowDecisions) return;
  
  const logEntry = {
    workflow,
    endpoint,
    timestamp: new Date().toISOString(),
    ...metadata
  };
  
  console.log(`🤖 WORKFLOW USAGE: ${workflow} @ ${endpoint}`, logEntry);
  
  // TODO: Send to monitoring service if enabled
  if (WorkflowConfig.collectWorkflowMetrics) {
    // Add metrics collection logic here
  }
}

/**
 * Validate workflow configuration
 */
export function validateWorkflowConfig() {
  const warnings = [];
  const errors = [];
  
  // Check for conflicting configurations
  if (WorkflowConfig.useStrictAIWorkflow && !process.env.OPENAI_API_KEY) {
    errors.push('Strict AI workflow requires OPENAI_API_KEY');
  }
  
  // Check strict workflow model compatibility
  const jsonSupportedModels = [
    'gpt-4-1106-preview',
    'gpt-4-turbo-preview', 
    'gpt-3.5-turbo-1106'
  ];
  
  if (WorkflowConfig.useStrictAIWorkflow && !jsonSupportedModels.includes(WorkflowConfig.strictWorkflowModel)) {
    warnings.push(`Model ${WorkflowConfig.strictWorkflowModel} may not support JSON mode required for strict workflow`);
  }
  
  // Check fallback configuration
  const validFallbacks = ['enhanced', 'traditional', 'basic'];
  if (!validFallbacks.includes(WorkflowConfig.strictWorkflowFallback)) {
    errors.push(`Invalid fallback system: ${WorkflowConfig.strictWorkflowFallback}. Must be one of: ${validFallbacks.join(', ')}`);
  }
  
  // Log validation results
  if (errors.length > 0) {
    console.error('❌ Workflow Configuration Errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error('Workflow configuration validation failed');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Workflow Configuration Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  if (WorkflowConfig.enableDetailedLogging) {
    console.log('🔧 Workflow Configuration:');
    console.log(`   - Strict AI Workflow: ${WorkflowConfig.useStrictAIWorkflow}`);
    console.log(`   - Fallback System: ${WorkflowConfig.strictWorkflowFallback}`);
    console.log(`   - LangChain Agent: ${WorkflowConfig.useLangChainAgent}`);
    console.log(`   - Enhanced Chat: ${WorkflowConfig.useEnhancedChat}`);
    console.log(`   - Enhanced POI: ${WorkflowConfig.useEnhancedPOI}`);
    console.log(`   - Auto Fallback: ${WorkflowConfig.enableAutoFallback}`);
  }
  
  return { errors, warnings };
}

/**
 * Get complete runtime configuration status
 */
export function getWorkflowStatus() {
  return {
    // Primary workflow settings
    workflows: {
      strict: WorkflowConfig.useStrictAIWorkflow,
      langchainAgent: WorkflowConfig.useLangChainAgent,
      enhancedChat: WorkflowConfig.useEnhancedChat,
      enhancedPOI: WorkflowConfig.useEnhancedPOI
    },
    
    // Current active systems
    activeWorkflows: {
      stepPlanner: getStepPlannerWorkflow(),
      chat: getChatWorkflow(),
      chatWithAgent: getChatWorkflow('agent')
    },
    
    // Configuration details
    config: {
      strictModel: WorkflowConfig.strictWorkflowModel,
      fallbackSystem: WorkflowConfig.strictWorkflowFallback,
      autoFallback: WorkflowConfig.enableAutoFallback,
      timeout: WorkflowConfig.strictWorkflowTimeout,
      maxRetries: WorkflowConfig.maxStrictWorkflowRetries
    },
    
    // Monitoring settings
    monitoring: {
      performanceMonitoring: WorkflowConfig.enablePerformanceMonitoring,
      detailedLogging: WorkflowConfig.enableDetailedLogging,
      workflowMetrics: WorkflowConfig.collectWorkflowMetrics,
      logDecisions: WorkflowConfig.logWorkflowDecisions
    }
  };
}

/**
 * Create workflow execution context with timing and error handling
 */
export function createWorkflowContext(workflowType, endpoint, metadata = {}) {
  const startTime = Date.now();
  const context = {
    workflow: workflowType,
    endpoint,
    startTime,
    metadata,
    
    // Log successful completion
    success: (result = {}) => {
      const duration = Date.now() - startTime;
      logWorkflowUsage(workflowType, endpoint, {
        ...metadata,
        duration,
        status: 'success',
        ...result
      });
      return result;
    },
    
    // Log failure and determine fallback
    failure: (error, shouldFallback = true) => {
      const duration = Date.now() - startTime;
      logWorkflowUsage(workflowType, endpoint, {
        ...metadata,
        duration,
        status: 'failure',
        error: error.message
      });
      
      if (shouldFallback && WorkflowConfig.enableAutoFallback) {
        const fallback = getFallbackWorkflow(workflowType, error);
        return { shouldFallback: true, fallbackWorkflow: fallback };
      }
      
      return { shouldFallback: false };
    }
  };
  
  return context;
}

// Auto-validate configuration on import
if (process.env.NODE_ENV !== 'test') {
  try {
    validateWorkflowConfig();
  } catch (error) {
    console.error('Failed to validate workflow configuration:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}