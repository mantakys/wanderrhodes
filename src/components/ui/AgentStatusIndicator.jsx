// AgentStatusIndicator.jsx - UI component to show agent framework status
import React, { useState } from 'react';
import { Bot, Settings, Activity, Clock, MapPin, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AgentStatusIndicator = ({ agentMetadata, isAgentMode = false }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isAgentMode && !agentMetadata) return null;

  const hasMetadata = agentMetadata && Object.keys(agentMetadata).length > 0;
  const agentState = agentMetadata?.agentState;
  const toolsUsed = agentMetadata?.toolsUsed || [];
  const intermediateSteps = agentMetadata?.intermediateSteps || 0;

  return (
    <div className="relative">
      {/* Agent Mode Indicator */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 mb-4"
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full border border-purple-400/30">
          <Bot size={16} className="text-purple-400" />
          <span className="text-sm font-medium text-purple-300">
            {isAgentMode ? 'AI Agent Mode' : 'Enhanced Planning'}
          </span>
          
          {/* Pulse animation for active state */}
          <div className="relative">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
          </div>
          
          {hasMetadata && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <Settings size={14} className="text-purple-300" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Detailed Agent Execution Info */}
      <AnimatePresence>
        {showDetails && hasMetadata && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mb-4 p-4 bg-black/30 rounded-lg border border-purple-400/20 backdrop-blur-sm"
          >
            <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Activity size={16} />
              Agent Execution Details
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {/* Planning Phase */}
              {agentState?.planningPhase && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-blue-400" />
                  <span className="text-white/70">Phase:</span>
                  <span className="text-blue-300 font-medium capitalize">
                    {agentState.planningPhase.replace('_', ' ')}
                  </span>
                </div>
              )}

              {/* Intermediate Steps */}
              {intermediateSteps > 0 && (
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-yellow-400" />
                  <span className="text-white/70">Steps:</span>
                  <span className="text-yellow-300 font-medium">{intermediateSteps}</span>
                </div>
              )}

              {/* Tools Used */}
              {toolsUsed.length > 0 && (
                <div className="col-span-full">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings size={14} className="text-green-400" />
                    <span className="text-white/70">Tools Used:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {toolsUsed.map((tool, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-500/20 text-green-300 rounded-md text-xs border border-green-500/30"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Time */}
              {agentMetadata.executionTime && (
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-orange-400" />
                  <span className="text-white/70">Time:</span>
                  <span className="text-orange-300 font-medium">
                    {agentMetadata.executionTime}ms
                  </span>
                </div>
              )}

              {/* Optimization Status */}
              {agentMetadata.optimizationApplied !== undefined && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-purple-400" />
                  <span className="text-white/70">Route Optimized:</span>
                  <span className={`font-medium ${agentMetadata.optimizationApplied ? 'text-green-300' : 'text-red-300'}`}>
                    {agentMetadata.optimizationApplied ? 'Yes' : 'No'}
                  </span>
                </div>
              )}

              {/* Current Plan Progress */}
              {agentState?.currentPlan && (
                <div className="col-span-full">
                  <span className="text-white/70">Locations Planned: </span>
                  <span className="text-purple-300 font-medium">
                    {agentState.currentPlan.length}
                  </span>
                </div>
              )}
            </div>

            {/* Extraction Method */}
            {agentMetadata.extractionMethod && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-xs text-white/50">
                  Extraction: {agentMetadata.extractionMethod}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentStatusIndicator; 