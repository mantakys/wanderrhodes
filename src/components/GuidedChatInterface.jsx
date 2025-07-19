import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationCard from './LocationCard';
import { ArrowRight, CheckCircle, MapPin, Send, Sparkles } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

/**
 * Guided Chat Interface - Three-phase travel planning
 * Phase 1: Preferences (handled by parent)
 * Phase 2: POI Rounds (restaurants → beaches → attractions)
 * Phase 3: Open Chat (free-form questions and additions)
 */
const GuidedChatInterface = ({ 
  userPreferences, 
  userLocation, 
  onPlanComplete,
  onPlanUpdate 
}) => {
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Phase management
  const [currentPhase, setCurrentPhase] = useState('strategy'); // 'strategy' | 'guided' | 'open'
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedPOIs, setSelectedPOIs] = useState([]);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // AI Strategy state
  const [planStrategy, setPlanStrategy] = useState(null);
  const [currentRecommendations, setCurrentRecommendations] = useState([]);
  const [roundData, setRoundData] = useState(null);

  // Initialize with AI strategy creation
  useEffect(() => {
    const welcomeMessage = {
      id: Date.now(),
      type: 'ai_message',
      content: "Perfect! I'm analyzing your preferences to create the optimal discovery strategy for your Rhodes adventure. 🧠✨",
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    
    // Create AI strategy first
    createAIStrategy();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentRecommendations]);

  /**
   * Create AI-driven plan strategy
   */
  const createAIStrategy = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/guided-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_PLAN_STRATEGY',
          userPreferences,
          userLocation
        })
      });

      const data = await response.json();

      if (data.success) {
        setPlanStrategy(data.strategy);

        // Add strategy message
        const strategyMessage = {
          id: Date.now(),
          type: 'strategy_created',
          strategy: data.strategy,
          message: data.message,
          aiGenerated: data.aiGenerated,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, strategyMessage]);

        // Start first intelligent round
        setTimeout(() => {
          setCurrentPhase('guided');
          startIntelligentRound(1);
        }, 1500);

      } else {
        throw new Error(data.error || 'Failed to create strategy');
      }
    } catch (error) {
      console.error('Strategy creation error:', error);
      toast({
        title: "Error creating strategy",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start an intelligent AI-driven round
   */
  const startIntelligentRound = async (roundNumber) => {
    setIsLoading(true);
    setCurrentRound(roundNumber);

    try {
      const response = await fetch('/api/guided-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GET_INTELLIGENT_ROUND',
          userPreferences,
          userLocation,
          selectedPOIs,
          currentRound: roundNumber,
          planStrategy
        })
      });

      const data = await response.json();

      if (data.success) {
        setRoundData(data.round);
        setCurrentRecommendations(data.recommendations);

        // Add round introduction message
        const roundMessage = {
          id: Date.now(),
          type: 'intelligent_round_intro',
          round: data.round,
          contextualPrompt: data.contextualPrompt,
          metadata: data.systemStatus?.metadata,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, roundMessage]);

      } else {
        throw new Error(data.error || 'Failed to get intelligent recommendations');
      }
    } catch (error) {
      console.error('Intelligent round start error:', error);
      toast({
        title: "Error starting intelligent round",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle POI selection during guided rounds
   */
  const handlePOISelection = (poi) => {
    const updatedPOIs = [...selectedPOIs, poi];
    setSelectedPOIs(updatedPOIs);
    onPlanUpdate(updatedPOIs);

    // Add selection message
    const selectionMessage = {
      id: Date.now(),
      type: 'poi_selection',
      poi: poi,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, selectionMessage]);

    // Check if round is complete
    if (updatedPOIs.filter(p => matchesRoundType(p, roundData?.type)).length >= roundData?.maxSelections) {
      completeRound();
    }
  };

  /**
   * Complete current round and move to next
   */
  const completeRound = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/guided-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_ROUND',
          userPreferences,
          userLocation,
          selectedPOIs,
          currentRound,
          planStrategy
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add round completion message
        const completionMessage = {
          id: Date.now(),
          type: 'round_completion',
          action: data.action,
          message: data.message,
          nextRound: data.nextRound,
          nextRoundPreview: data.nextRoundPreview,
          optionalRound: data.optionalRound,
          finalPlan: data.finalPlan,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, completionMessage]);

        // Handle different completion actions
        switch (data.action) {
          case 'CONTINUE_TO_NEXT_ROUND':
            setTimeout(() => startIntelligentRound(data.nextRound), 1000);
            break;
          
          case 'PLAN_COMPLETE':
            setCurrentPhase('open');
            onPlanComplete(selectedPOIs);
            addOpenChatWelcome();
            break;
        }
      }
    } catch (error) {
      console.error('Round completion error:', error);
      toast({
        title: "Error completing round",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add welcome message for open chat phase
   */
  const addOpenChatWelcome = () => {
    const openChatMessage = {
      id: Date.now(),
      type: 'phase_transition',
      content: `🎉 Your Rhodes adventure is ready! You've selected ${selectedPOIs.length} amazing places. Now ask me anything - add more stops, get local tips, optimize your route, or ask about opening hours!`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, openChatMessage]);
  };

  /**
   * Handle open chat messages
   */
  const handleOpenChat = async (message) => {
    if (!message.trim()) return;

    setIsLoading(true);
    setInput('');

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user_message',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/guided-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'OPEN_CHAT',
          userPreferences,
          userLocation,
          selectedPOIs,
          chatHistory: messages.filter(m => m.type === 'user_message' || m.type === 'ai_message'),
          userMessage: message
        })
      });

      const data = await response.json();

      if (data.reply) {
        // Parse AI response and add to messages
        const aiMessage = {
          id: Date.now(),
          type: 'ai_message',
          content: data.reply,
          structuredData: data.structuredData,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);

        // If AI suggested new POIs, add them as recommendations
        if (data.structuredData?.locations?.length > 0) {
          const newPOIs = data.structuredData.locations;
          setCurrentRecommendations(newPOIs);
        }
      }
    } catch (error) {
      console.error('Open chat error:', error);
      const errorMessage = {
        id: Date.now(),
        type: 'ai_message',
        content: "Sorry, I had trouble processing your request. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if POI matches round type
   */
  const matchesRoundType = (poi, roundType) => {
    const poiType = poi.type || poi.primary_type || '';
    const typeMapping = {
      'restaurant': ['restaurant', 'taverna', 'cafe', 'dining'],
      'beach': ['beach'],
      'attraction': ['attraction', 'museum', 'historical', 'monument']
    };
    const validTypes = typeMapping[roundType] || [roundType];
    return validTypes.some(type => poiType.toLowerCase().includes(type));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onPOISelect={currentPhase === 'guided' ? handlePOISelection : null}
              onStartRound={startRound}
              onCompleteRound={completeRound}
            />
          ))}
        </AnimatePresence>

        {/* Current Round Recommendations */}
        {currentPhase === 'guided' && currentRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h3 className="text-[#E8D5A4] font-semibold">
              Choose {roundData?.maxSelections} {roundData?.type}(s):
            </h3>
            {currentRecommendations.map((poi, index) => (
              <motion.div
                key={poi.place_id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <LocationCard location={poi} />
                <button
                  onClick={() => handlePOISelection(poi)}
                  className="absolute top-4 right-4 bg-[#E8D5A4] text-[#242b50] px-3 py-1 rounded-full text-sm font-semibold hover:bg-[#CAB17B] transition-colors"
                >
                  Add to Plan
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Open Chat Recommendations */}
        {currentPhase === 'open' && currentRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h3 className="text-[#E8D5A4] font-semibold">Recommendations:</h3>
            {currentRecommendations.map((poi, index) => (
              <LocationCard key={poi.place_id || index} location={poi} />
            ))}
          </motion.div>
        )}

        {isLoading && <LoadingIndicator />}
        <div ref={chatEndRef} />
      </div>

      {/* Input for Open Chat Phase */}
      {currentPhase === 'open' && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="p-4 bg-black/30 backdrop-blur-md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleOpenChat(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your plan, add more places, get tips..."
              disabled={isLoading}
              className="flex-1 rounded-full px-4 py-3 bg-[#1a1f3d] text-white placeholder:text-[#888faa] outline-none text-sm"
            />
            <motion.button
              type="submit"
              disabled={isLoading || !input.trim()}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E8D5A4] to-[#B89E6A] text-[#1a1f3d] disabled:opacity-50"
            >
              <Send size={20} />
            </motion.button>
          </form>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Individual chat message component
 */
const ChatMessage = ({ message, onPOISelect, onStartRound, onCompleteRound }) => {
  switch (message.type) {
    case 'ai_message':
    case 'phase_transition':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="max-w-[80%] px-4 py-3 rounded-3xl bg-black/50 backdrop-blur-md border border-white/10 text-[#F4E1C1]">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            <div className="text-xs opacity-60 mt-2 text-right">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </motion.div>
      );

    case 'user_message':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <div className="max-w-[80%] px-4 py-3 rounded-3xl bg-gradient-to-br from-[#E8D5A4] to-[#B89E6A] text-[#1a1f3d]">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            <div className="text-xs opacity-60 mt-2 text-right">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </motion.div>
      );

    case 'strategy_created':
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4"
        >
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-4 rounded-2xl max-w-lg mx-auto">
            <div className="text-2xl mb-2">🧠</div>
            <div className="font-bold text-lg mb-2">AI Strategy Complete!</div>
            <div className="text-sm opacity-90 mb-3">{message.strategy.rationale}</div>
            <div className="text-xs bg-white/20 rounded-lg p-2">
              {message.strategy.rounds.length} intelligent rounds planned: {message.strategy.rounds.map(r => r.poiType).join(' → ')}
            </div>
          </div>
          <p className="text-[#F4E1C1] text-sm mt-3 max-w-md mx-auto">
            {message.aiGenerated ? '✨ AI-generated strategy' : '📋 Fallback strategy'}
          </p>
        </motion.div>
      );

    case 'round_intro':
    case 'intelligent_round_intro':
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4"
        >
          <div className="inline-block bg-gradient-to-r from-[#E8D5A4] to-[#B89E6A] text-[#1a1f3d] px-6 py-3 rounded-2xl">
            <div className="text-2xl mb-1">🎯</div>
            <div className="font-bold text-lg">{message.round.title}</div>
            <div className="text-sm opacity-80">Round {message.round.number} • {message.round.type}</div>
            {message.metadata && (
              <div className="text-xs mt-2 opacity-70">
                {message.metadata.totalFound} found • {message.metadata.aiFiltered} AI-filtered
              </div>
            )}
          </div>
          <p className="text-[#F4E1C1] text-sm mt-3 max-w-md mx-auto">
            {message.contextualPrompt}
          </p>
        </motion.div>
      );

    case 'poi_selection':
      return (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex justify-end"
        >
          <div className="bg-green-500/20 border border-green-400/40 rounded-2xl p-3 max-w-[70%]">
            <div className="flex items-center gap-2 text-green-300">
              <CheckCircle size={16} />
              <span className="font-semibold">Added to plan</span>
            </div>
            <p className="text-[#F4E1C1] text-sm mt-1">{message.poi.name}</p>
          </div>
        </motion.div>
      );

    case 'round_completion':
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4"
        >
          <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 max-w-md mx-auto">
            <p className="text-[#F4E1C1] text-sm">{message.message}</p>
            
            {message.action === 'CONTINUE_TO_NEXT_ROUND' && (
              <div className="mt-3 flex items-center justify-center gap-2 text-[#E8D5A4]">
                <span className="text-sm">Next: {message.nextRoundPreview?.title}</span>
                <ArrowRight size={16} />
              </div>
            )}
            
            {message.action === 'OFFER_OPTIONAL_ROUND' && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => onStartRound(message.optionalRound.number)}
                  className="bg-[#E8D5A4] text-[#1a1f3d] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#CAB17B] transition-colors"
                >
                  Add {message.optionalRound.title.replace('Want to add some ', '').replace('?', '')}
                </button>
                <button
                  onClick={onCompleteRound}
                  className="block mx-auto text-[#F4E1C1] text-sm hover:text-white transition-colors"
                >
                  Finish Plan
                </button>
              </div>
            )}
          </div>
        </motion.div>
      );

    default:
      return null;
  }
};

/**
 * Loading indicator component
 */
const LoadingIndicator = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex justify-start"
  >
    <div className="px-4 py-3 rounded-3xl bg-black/50 backdrop-blur-md border border-white/10">
      <div className="flex items-center gap-2 text-[#F4E1C1]">
        <Sparkles className="animate-spin" size={16} />
        <span className="text-sm">Finding the perfect spots for you...</span>
      </div>
    </div>
  </motion.div>
);

export default GuidedChatInterface;