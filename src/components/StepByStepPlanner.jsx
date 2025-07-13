import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SelectablePOICard from './SelectablePOICard';
import { CheckCircle, ArrowRight, MapPin, Loader2 } from 'lucide-react';

const StepByStepPlanner = ({ 
  userPreferences = {}, 
  userLocation = null, 
  onPlanComplete = () => {},
  onPlanUpdate = () => {}
}) => {
  // Load persisted state on component mount
  const loadPersistedState = () => {
    if (typeof window === 'undefined') return { currentStep: 1, selectedPOIs: [], planCompleted: false };
    
    try {
      const saved = sessionStorage.getItem('wr_step_by_step_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          currentStep: parsed.currentStep || 1,
          selectedPOIs: parsed.selectedPOIs || [],
          planCompleted: parsed.planCompleted || false
        };
      }
    } catch (error) {
      console.warn('Failed to load step-by-step progress:', error);
    }
    return { currentStep: 1, selectedPOIs: [], planCompleted: false };
  };

  const persistedState = loadPersistedState();
  const [currentStep, setCurrentStep] = useState(persistedState.currentStep);
  const [selectedPOIs, setSelectedPOIs] = useState(persistedState.selectedPOIs);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [planCompleted, setPlanCompleted] = useState(persistedState.planCompleted);
  
  const maxPOIs = userPreferences.numberOfPOIs || 5;

  // Persist state to sessionStorage
  const persistState = (step, pois, completed) => {
    try {
      const stateToSave = {
        currentStep: step,
        selectedPOIs: pois,
        planCompleted: completed,
        timestamp: Date.now()
      };
      sessionStorage.setItem('wr_step_by_step_progress', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to persist step-by-step progress:', error);
    }
  };

  // Clear persisted state
  const clearPersistedState = () => {
    try {
      sessionStorage.removeItem('wr_step_by_step_progress');
    } catch (error) {
      console.warn('Failed to clear step-by-step progress:', error);
    }
  };

  // Get initial recommendations on mount
  useEffect(() => {
    // If we have persisted selectedPOIs, call onPlanUpdate to sync with parent
    if (persistedState.selectedPOIs.length > 0) {
      onPlanUpdate(persistedState.selectedPOIs);
    }
    
    // Get initial recommendations if starting fresh, or next recommendations if resuming
    if (persistedState.selectedPOIs.length === 0) {
      getInitialRecommendations();
    } else if (persistedState.selectedPOIs.length < maxPOIs && !persistedState.planCompleted) {
      // Resume with next recommendations
      getNextRecommendations();
    }
  }, []);

  const getInitialRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/poi-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'GET_INITIAL_RECOMMENDATIONS',
          userLocation,
          userPreferences,
          selectedPOIs // always send, even if empty
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
      } else {
        setError(data.error || 'Failed to get recommendations');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error getting initial recommendations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/poi-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'GET_NEXT_RECOMMENDATIONS',
          userLocation,
          userPreferences,
          selectedPOIs,
          currentStep: currentStep + 1
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
      } else {
        setError(data.error || 'Failed to get next recommendations');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error getting next recommendations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectPOI = async (poi) => {
    const newSelectedPOIs = [...selectedPOIs, poi];
    setSelectedPOIs(newSelectedPOIs);
    
    // Call onPlanUpdate callback
    onPlanUpdate(newSelectedPOIs);
    
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    // Check if we've reached the maximum number of POIs
    if (newSelectedPOIs.length >= maxPOIs) {
      // Plan is complete
      setPlanCompleted(true);
      
      // Persist completed state
      persistState(nextStep, newSelectedPOIs, true);
      
      onPlanComplete(newSelectedPOIs);
      
      // Clear persisted state after completion
      setTimeout(() => clearPersistedState(), 1000);
    } else {
      // Persist current progress
      persistState(nextStep, newSelectedPOIs, false);
      
      // Get next recommendations
      setTimeout(() => {
        getNextRecommendations();
      }, 500); // Small delay for better UX
    }
  };

  const removePOI = (index) => {
    const newSelectedPOIs = selectedPOIs.filter((_, i) => i !== index);
    setSelectedPOIs(newSelectedPOIs);
    setPlanCompleted(false);
    
    // If we removed the last POI, go back a step
    let newCurrentStep = currentStep;
    if (index === selectedPOIs.length - 1) {
      newCurrentStep = Math.max(1, currentStep - 1);
      setCurrentStep(newCurrentStep);
    }
    
    // Persist updated state
    persistState(newCurrentStep, newSelectedPOIs, false);
    
    // Update plan and get new recommendations if needed
    onPlanUpdate(newSelectedPOIs);
    
    if (newSelectedPOIs.length < maxPOIs && !planCompleted) {
      getNextRecommendations();
    }
  };

  const getStepDescription = (step) => {
    if (step === 1) return 'first destination';
    if (step === 2) return 'second stop';
    if (step === 3) return 'third location';
    if (step === 4) return 'fourth place';
    if (step === 5) return 'fifth destination';
    return `${step}th location`;
  };

  const getStepAdvice = (step) => {
    if (step === 1) return 'Choose your starting point or main attraction';
    if (step === 2) return 'Pick something nearby or complementary';
    if (step === 3) return 'Consider adding variety to your experience';
    if (step === 4) return 'Think about dining or relaxation';
    if (step === 5) return 'Complete your journey with a memorable finale';
    return 'Continue building your perfect day';
  };

  return (
    <div className="step-by-step-planner max-w-6xl mx-auto p-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#E8D5A4]">
            Build Your Perfect Day
          </h2>
          <div className="flex items-center gap-4">
            {/* Resume indicator */}
            {persistedState.selectedPOIs.length > 0 && (
              <div className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
                📍 Resumed progress
              </div>
            )}
            <div className="text-sm text-[#F4E1C1]/70">
              {selectedPOIs.length} / {maxPOIs} selected
            </div>
            {/* Start fresh button */}
            {selectedPOIs.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to start over? This will clear your current progress.')) {
                    setSelectedPOIs([]);
                    setCurrentStep(1);
                    setPlanCompleted(false);
                    clearPersistedState();
                    onPlanUpdate([]);
                    getInitialRecommendations();
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
        
        <div className="w-full bg-white/10 rounded-full h-2 mb-2">
          <motion.div
            className="h-2 bg-gradient-to-r from-[#E8D5A4] to-[#CAB17B] rounded-full"
            initial={{ width: 0 }}
            animate={{ 
              width: `${(selectedPOIs.length / maxPOIs) * 100}%` 
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-[#F4E1C1]/50">
          {Array.from({ length: maxPOIs }, (_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${
                i < selectedPOIs.length 
                  ? 'bg-[#E8D5A4]' 
                  : i === selectedPOIs.length 
                  ? 'bg-[#E8D5A4]/50' 
                  : 'bg-white/20'
              }`} />
              <span className="mt-1">Step {i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected POIs */}
      {selectedPOIs.length > 0 && (
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-semibold text-[#E8D5A4] mb-4">
            Your Travel Plan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedPOIs.map((poi, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#E8D5A4] rounded-full flex items-center justify-center text-xs font-bold text-black">
                      {index + 1}
                    </div>
                    <h4 className="font-semibold text-[#E8D5A4]">{poi.name}</h4>
                  </div>
                  <button
                    onClick={() => removePOI(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    ×
                  </button>
                </div>
                <p className="text-sm text-[#F4E1C1]/80 mb-2">{poi.type}</p>
                <p className="text-xs text-[#F4E1C1]/60 line-clamp-2">{poi.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Current Step */}
      {!planCompleted && currentStep <= maxPOIs && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentStep}
        >
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-[#E8D5A4] rounded-full flex items-center justify-center text-sm font-bold text-black">
                {currentStep}
              </div>
              <h3 className="text-xl font-bold text-[#E8D5A4]">
                Choose your {getStepDescription(currentStep)}
              </h3>
            </div>
            <p className="text-[#F4E1C1]/70 ml-11">
              {getStepAdvice(currentStep)}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-300">{error}</p>
              <button
                onClick={() => {
                  if (currentStep === 1) {
                    getInitialRecommendations();
                  } else {
                    getNextRecommendations();
                  }
                }}
                className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#E8D5A4]" />
                <p className="text-[#F4E1C1]/70">Finding perfect recommendations...</p>
              </div>
            </div>
          )}

          {/* Recommendations Grid */}
          {!isLoading && recommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {recommendations.map((poi, index) => (
                  <motion.div
                    key={poi.name || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <SelectablePOICard
                      poi={poi}
                      onSelect={selectPOI}
                      isSelected={false}
                      isLoading={false}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* No Recommendations */}
          {!isLoading && recommendations.length === 0 && !error && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-[#F4E1C1]/50" />
              <p className="text-[#F4E1C1]/70">
                No recommendations available at this time.
              </p>
              <button
                onClick={() => {
                  if (currentStep === 1) {
                    getInitialRecommendations();
                  } else {
                    getNextRecommendations();
                  }
                }}
                className="mt-4 px-6 py-2 bg-[#E8D5A4]/20 text-[#E8D5A4] rounded-lg hover:bg-[#E8D5A4]/30 transition"
              >
                Refresh
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Plan Completed */}
      {planCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h3 className="text-2xl font-bold text-[#E8D5A4] mb-2">
            Your Perfect Day is Ready! 🎉
          </h3>
          <p className="text-[#F4E1C1]/70 mb-6">
            You've selected {selectedPOIs.length} amazing places to visit in Rhodes.
          </p>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setPlanCompleted(false);
                setCurrentStep(selectedPOIs.length + 1);
                if (selectedPOIs.length < maxPOIs) {
                  getNextRecommendations();
                }
              }}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
            >
              Add More Places
            </button>
            <button
              onClick={() => onPlanComplete(selectedPOIs)}
              className="px-6 py-3 bg-[#E8D5A4] text-black rounded-lg hover:bg-[#CAB17B] transition font-semibold"
            >
              Save & Continue
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default StepByStepPlanner; 