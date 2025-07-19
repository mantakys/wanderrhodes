// src/pages/ChatPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/ui/Logo";
import LocationCard from "../components/LocationCard";
import AgentStatusIndicator from "../components/ui/AgentStatusIndicator";
import TravelPreferences from "../components/ui/TravelPreferences";
import PlanEditor from "../components/ui/PlanEditor";
import StepByStepPlanner from "../components/StepByStepPlanner";
import GuidedChatInterface from "../components/GuidedChatInterface";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, BookMarked, ArrowLeft, Send, Sparkles, Thermometer, SunMedium, MapPin, Settings, Edit } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { getSavedPlans, canSaveAnotherPlan } from '@/utils/plans';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUser } from '@/components/ThemeProvider';
import { logServerError } from '@/utils/serverErrorMonitor';

const SUGGESTIONS = [
  "Where should I eat tonight in Faliraki?",
  "Show me secret beaches in Lindos",
  "Plan a day trip in Rhodes old town"
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const parseAiResponse = (reply, structuredData, blur) => {
  const newMessages = [];
  const locations = structuredData?.locations || [];

  // Check for interactive markers
  const interactiveMarkers = {
    preferences: reply.match(/\|\|\|PREFERENCES\|\|\|([^|]*)\|\|\|/),
    editPlan: reply.includes('|||EDIT_PLAN|||'),
    locationOptions: reply.match(/\|\|\|LOCATION_OPTIONS\|\|\|([^|]*)\|\|\|/),
    question: reply.match(/\|\|\|QUESTION\|\|\|([^|]*)\|\|\|/)
  };

  // Remove interactive markers from text for display
  let cleanReply = reply
    .replace(/\|\|\|PREFERENCES\|\|\|[^|]*\|\|\|/g, '')
    .replace(/\|\|\|EDIT_PLAN\|\|\|/g, '')
    .replace(/\|\|\|LOCATION_OPTIONS\|\|\|[^|]*\|\|\|/g, '')
    .replace(/\|\|\|QUESTION\|\|\|[^|]*\|\|\|/g, '');

  // Handle responses without locations
  if (!locations.length) {
    if (cleanReply.trim()) {
      const message = {
        sender: 'ai',
        type: 'text',
        message: cleanReply.trim(),
        time: new Date(),
        blur: blur,
        interactive: interactiveMarkers
      };
      newMessages.push(message);
    }
    return newMessages;
  }

  // Handle responses with locations
  const textParts = cleanReply.split('|||LOCATION|||');

  // If no location markers found but we have locations, add text first then all locations
  if (textParts.length === 1 && locations.length > 0) {
    // Add the text message first
    if (cleanReply.trim()) {
      const message = {
        sender: 'ai',
        type: 'text',
        message: cleanReply.trim(),
        time: new Date(),
        blur: blur,
        interactive: interactiveMarkers
      };
      newMessages.push(message);
    }
    
    // Add all location cards
    locations.forEach(location => {
      newMessages.push({
        sender: 'ai',
        type: 'location',
        locationData: location,
        time: new Date(),
        blur: blur,
      });
    });
    
    return newMessages;
  }

  // Handle responses with location markers (existing logic)
  textParts.forEach((text, i) => {
    const trimmedText = text.trim();
    if (trimmedText) {
      const message = {
        sender: 'ai',
        type: 'text',
        message: trimmedText,
        time: new Date(),
        blur: blur,
        interactive: i === 0 ? interactiveMarkers : {} // Only add to first message
      };
      newMessages.push(message);
    }
    if (locations[i]) {
      newMessages.push({
        sender: 'ai',
        type: 'location',
        locationData: locations[i],
        time: new Date(),
        blur: blur,
      });
    }
  });

  return newMessages;
};

export default function ChatPage() {
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const FREE_LIMIT = 5;

  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  const isNewPlan = searchParams.get('new') === 'true';
  const serverErrorReason = searchParams.get('reason') === 'server-error';

  const { user, loading, refreshUser } = useUser();

  // Initialize replyCount based on how many AI responses already exist (useful when loading from a saved plan)
  const initialMessages = (() => {
    if (typeof window === 'undefined') return [];

    // If this is a new plan, start with just the greeting
    if (isNewPlan) {
      return [
        {
          sender: 'ai',
          type: 'text',
          message: "Hi! Ready to plan your perfect Rhodes adventure? Let's start by setting up your preferences!",
          time: new Date(),
          blur: false,
        },
      ];
    }

    // Plan-specific chat history will be loaded asynchronously in useEffect
    // since getSavedPlans is now async

    try {
      const raw = localStorage.getItem('wr_chat_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.map((m) => ({ ...m, time: new Date(m.time) }));
      }
    } catch {}
    return [
      {
        sender: 'ai',
        type: 'text',
        message: "Hi! I'm your local Rhodes AI assistant. Ask me anything—food, sights, or secrets!",
        time: new Date(),
        blur: false,
      },
    ];
  })();

  const [messages, setMessages] = useState(initialMessages);

  const [replyCount, setReplyCount] = useState(() => {
    const count = initialMessages.filter((m) => m.sender === 'ai').length;
    return Math.max(0, count - 1); // exclude greeting if present
  });

  const [blurNext, setBlurNext] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastSent, setLastSent] = useState(0);
  const [abortController, setAbortController] = useState(null);
  const [planConfig, setPlanConfig] = useState(() => {
    if (typeof window === 'undefined') return null;
    
    // If this is a new plan, force plan configuration
    if (isNewPlan) {
      return null;
    }
    
    try {
      const raw = localStorage.getItem('wr_plan_config');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('wr_current_plan');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [planSaved, setPlanSaved] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [planName, setPlanName] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [companions, setCompanions] = useState(null);
  const [extraDetails, setExtraDetails] = useState("");
  const [showRightNow, setShowRightNow] = useState(false);
  
  // Interactive elements state
  const [showPreferences, setShowPreferences] = useState(false);
  const [userPreferences, setUserPreferences] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('wr_user_preferences');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [editablePlan, setEditablePlan] = useState([]);
  const [lastResponse, setLastResponse] = useState(null);
  
  // Planning mode state
  const [planningMode, setPlanningMode] = useState('guided'); // 'guided' | 'stepByStep' | 'chat'
  const [stepByStepPlan, setStepByStepPlan] = useState([]);
  
  // Server error handling state
  const [serverErrorCount, setServerErrorCount] = useState(0);
  const [lastServerErrorTime, setLastServerErrorTime] = useState(null);

  const freeRemaining = Math.max(FREE_LIMIT - replyCount, 0);

  // Determine if the overall trial has expired
  // For paid users: trial never expires (unlimited access)
  // For unauthenticated users: trial expires when they've used up free messages
  // For authenticated but unpaid users: trial expires when they've used up free messages
  const trialExpired = user?.has_paid ? false : (replyCount >= FREE_LIMIT);

  // auto-scroll
  useEffect(() => {
    // Attempt to detect user's geolocation once
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("Geolocation error:", err.message);
          if (err.code === err.PERMISSION_DENIED) {
            setLocationDenied(true);
            toast({
              title: "Location permission denied",
              description: "We'll plan your trip starting from the island center. You can specify a different start point in chat.",
              variant: "destructive",
            });
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: 'start' });
  }, [messages, isTyping]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const target = e.target;
      
      // Don't focus if the user is already in an input, textarea, or contentEditable element.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Don't focus if a modifier key is pressed.
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Focus on character key presses, but ignore special keys like Enter, Tab, etc.
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Load plan-specific chat history if planId is provided
  useEffect(() => {
    if (planId && user) {
      async function loadPlanChatHistory() {
        try {
          const plans = await getSavedPlans(user);
          const plan = plans.find((p) => 
            String(p.id) === String(planId) || String(p.timestamp) === String(planId)
          );
          
          if (plan) {
            // Handle both backend and localStorage format
            const planData = plan.data || plan;
            if (planData.chatHistory) {
              setMessages(planData.chatHistory.map((m) => ({ ...m, time: new Date(m.time) })));
              const aiCount = planData.chatHistory.filter((m) => m.sender === 'ai').length;
              setReplyCount(Math.max(0, aiCount - 1));
            }
          }
        } catch (error) {
          console.error('Failed to load plan chat history:', error);
        }
      }
      
      loadPlanChatHistory();
    }
  }, [planId, user]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  // Warn user before leaving page during agent processing
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isTyping) {
        e.preventDefault();
        e.returnValue = 'The AI is currently thinking. Are you sure you want to leave?';
        return 'The AI is currently thinking. Are you sure you want to leave?';
      }
    };

    const handlePopState = (e) => {
      if (isTyping) {
        const confirmed = window.confirm('The AI is currently thinking. Are you sure you want to leave?');
        if (!confirmed) {
          e.preventDefault();
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    if (isTyping) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isTyping]);

  // Clear the 'new' parameter from URL after component loads
  useEffect(() => {
    if (isNewPlan) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('new');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [isNewPlan]);

  // Show notification when page loads due to server error
  useEffect(() => {
    if (serverErrorReason) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('reason');
      window.history.replaceState({}, '', newUrl.toString());
      
      toast({
        title: "Fresh Chat Started",
        description: "I've started a new chat session to resolve the previous server issue. Your conversation history has been backed up safely.",
        duration: 6000,
        variant: "default",
      });
    }
  }, [serverErrorReason]);

  const sanitize = (str) => str.replace(/<\/?[^>]+(>|$)/g, "");

  // Server error handling utilities
  const isServerError = (response, data) => {
    // Check for server errors (500-599) or fallback responses
    return (!response.ok && response.status >= 500) || 
           (data && data.fallback === true) || 
           (data && data.error && data.error.includes('server error'));
  };

  const shouldCreateNewChatOnError = () => {
    const now = Date.now();
    const ONE_MINUTE = 60 * 1000;
    
    // Get error tracking from localStorage for persistence
    const lastErrorTime = localStorage.getItem('wr_last_server_error_time');
    const errorCount = localStorage.getItem('wr_server_error_count');
    
    // Rate limiting: max 1 new chat per minute due to server errors
    if (lastErrorTime && (now - parseInt(lastErrorTime)) < ONE_MINUTE) {
      return false;
    }
    
    // Don't create new chat if we've had too many server errors recently
    if (errorCount && parseInt(errorCount) >= 3) {
      return false;
    }
    
    return true;
  };

  const handleServerError = (response, data) => {
    if (isServerError(response, data) && shouldCreateNewChatOnError()) {
      const now = Date.now();
      
      // Update error tracking in localStorage for persistence
      setServerErrorCount(prev => prev + 1);
      setLastServerErrorTime(now);
      localStorage.setItem('wr_server_error_count', String(serverErrorCount + 1));
      localStorage.setItem('wr_last_server_error_time', String(now));
      
      // Backup current chat history
      const backupKey = `wr_chat_backup_${now}`;
      try {
        localStorage.setItem(backupKey, JSON.stringify(messages));
        
        // Clean up old backups (keep only last 3)
        const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('wr_chat_backup_'));
        if (backupKeys.length > 3) {
          backupKeys.sort();
          backupKeys.slice(0, -3).forEach(key => localStorage.removeItem(key));
        }
      } catch (error) {
        console.warn('Failed to backup chat history:', error);
      }
      
      // Clear current chat and start fresh
      localStorage.removeItem('wr_chat_history');
      localStorage.removeItem('wr_plan_config');
      sessionStorage.removeItem('wr_current_plan');
      
      // Log the event for monitoring and security analysis
      const errorLogData = {
        status: response.status,
        fallback: data?.fallback,
        error: data?.error,
        errorType: data?.fallback ? 'fallback_response' : 'http_error',
        newChatTriggered: true,
        userAuthenticated: !!user?.email,
        endpoint: response.url || 'unknown'
      };
      
      logServerError(errorLogData);
      
      console.log('🚨 Server error triggered new chat creation:', {
        ...errorLogData,
        timestamp: now
      });
      
      // Show notification to user
      toast({
        title: "Server Issue Detected",
        description: "I've started a fresh chat to help resolve the issue. Your previous conversation has been backed up.",
        duration: 8000,
        variant: "destructive",
      });
      
      // Redirect to new chat
      navigate('/chat?new=true&reason=server-error');
      
      return true;
    }
    
    return false;
  };

  // Interactive functionality handlers
  const handlePreferencesUpdate = (preferences) => {
    setUserPreferences(preferences);
    localStorage.setItem('wr_user_preferences', JSON.stringify(preferences));
  };

  const handlePreferencesComplete = (preferences) => {
    if (preferences) {
      handlePreferencesUpdate(preferences);
      setShowPreferences(false);
      
      // Start guided chat mode with AI-driven rounds
      toast({
        title: "Perfect! 🧠✨",
        description: "AI is analyzing your preferences to create your personalized Rhodes discovery plan.",
        duration: 4000,
      });
    } else {
      setShowPreferences(false);
    }
  };

  const handlePlanEdit = (locations) => {
    const currentLocations = messages
      .filter(m => m.type === 'location')
      .map(m => m.locationData);
    
    setEditablePlan(currentLocations);
    setShowPlanEditor(true);
  };

  const handlePlanSave = (updatedLocations) => {
    // Update the messages to reflect the new plan
    const newMessages = [...messages];
    let locationIndex = 0;
    
    const updatedMessages = newMessages.map(message => {
      if (message.type === 'location') {
        if (locationIndex < updatedLocations.length) {
          return {
            ...message,
            locationData: updatedLocations[locationIndex++]
          };
        } else {
          return null; // Remove extra locations
        }
      }
      return message;
    }).filter(Boolean);

    // Add any new locations that weren't in the original messages
    while (locationIndex < updatedLocations.length) {
      updatedMessages.push({
        sender: 'ai',
        type: 'location',
        locationData: updatedLocations[locationIndex],
        time: new Date(),
        blur: false
      });
      locationIndex++;
    }

    setMessages(updatedMessages);
    setShowPlanEditor(false);
    
    toast({
      title: "Plan Updated",
      description: "Your travel plan has been successfully updated.",
    });
  };

  // Step-by-step planner handlers

  const handleStepByStepPlanUpdate = (updatedPlan) => {
    setStepByStepPlan(updatedPlan);
    
    // Update current plan for compatibility with existing system
    const planObj = {
      title: `Step-by-Step Plan (${updatedPlan.length} places)`,
      locations: updatedPlan,
      timestamp: Date.now(),
      stepByStep: true
    };
    setCurrentPlan(planObj);
    try { 
      sessionStorage.setItem('wr_current_plan', JSON.stringify(planObj)); 
    } catch {}
  };

  const handleStepByStepComplete = (finalPlan) => {
    setStepByStepPlan(finalPlan);
    
    // Create plan object
    const planObj = {
      title: `My Rhodes Adventure (${finalPlan.length} places)`,
      locations: finalPlan,
      timestamp: Date.now(),
      stepByStep: true
    };
    setCurrentPlan(planObj);
    try { 
      sessionStorage.setItem('wr_current_plan', JSON.stringify(planObj)); 
    } catch {}
    setPlanSaved(false);
    
    // Show success toast
    toast({
      title: "Your Perfect Day is Ready! 🎉",
      description: `Created a travel plan with ${finalPlan.length} amazing places to visit.`,
      duration: 5000,
    });

    // Show save reminder for paid users
    if (user?.has_paid) {
      setTimeout(() => {
        toast({
          title: "Don't forget to save! 💾",
          description: "Save your plan so you can access it anytime during your trip.",
          duration: 6000,
        });
      }, 2000);
    }
  };

  // Configuration for using the agentic framework
  const USE_AGENT_FRAMEWORK = localStorage.getItem('wr_use_agent') === 'true' || false;

  const handleSend = async (overrideText, silent=false) => {
    if (trialExpired) {
      navigate("/paywall");
      return;
    }

    const now = Date.now();
    if (isTyping || now - lastSent < 2000) return;

    const text = overrideText != null ? overrideText : sanitize(input).trim();
    if (!text || text.length > 500) return;

    if (replyCount === FREE_LIMIT && !user?.has_paid) setBlurNext(true);

    setInput("");
    setLastSent(now);
    setIsTyping(true);

    // Cancel any existing request
    if (abortController) {
      abortController.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    if(!silent){
      setMessages((m) => [
        ...m,
        { sender: "user", type: "text", message: text, time: new Date(), blur: false }
      ]);
    }

    try {
      const history = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.message
      }));
      
      // Choose endpoint based on configuration with fallback
      let endpoint = USE_AGENT_FRAMEWORK ? "/api/agent" : "/api/chat";
      
      let res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          history, 
          prompt: text, 
          userLocation,
          userPreferences 
        }),
        signal: controller.signal
      });

      // If agent endpoint fails (404/405), fallback to chat endpoint
      if (!res.ok && USE_AGENT_FRAMEWORK && endpoint === "/api/agent") {
        console.log('🤖 Agent endpoint not available, falling back to chat endpoint');
        endpoint = "/api/chat";
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            history, 
            prompt: text, 
            userLocation,
            userPreferences 
          }),
          signal: controller.signal
        });
      }
      
      const data = await res.json();
      const { reply = "(no reply)", structuredData = null } = data;
      
      // Check for server errors and handle accordingly
      if (handleServerError(res, data)) {
        // Server error handled, new chat will be created
        return;
      }

      // Log agent metadata if available
      if (structuredData?.metadata?.agentState) {
        console.log('🤖 Agent Execution Details:', {
          state: structuredData.metadata.agentState,
          toolsUsed: structuredData.metadata.toolsUsed,
          intermediateSteps: structuredData.metadata.intermediateSteps
        });
      }

      const newAiMessages = parseAiResponse(reply, structuredData, blurNext);

      if (newAiMessages.length > 0) {
        setMessages((m) => [...m, ...newAiMessages]);
      } else {
        setMessages((m) => [
          ...m,
          {
            sender: "ai",
            type: "text",
            message: reply || "Sorry, I had trouble generating a response.",
            time: new Date(),
            blur: blurNext
          }
        ]);
      }

      if (blurNext) setBlurNext(false);
      setReplyCount((c) => c + 1);

      // If AI returned locations, store as currentPlan
      if (structuredData?.locations?.length > 0) {
        const planObj = {
          title: text.substring(0, 60),
          locations: structuredData.locations,
          timestamp: Date.now(),
          // Store agent metadata if available
          agentMetadata: structuredData.metadata || {}
        };
        setCurrentPlan(planObj);
        try { sessionStorage.setItem('wr_current_plan', JSON.stringify(planObj)); } catch {}
        setPlanSaved(false);
        
        // Show save reminder for new plans
        if (isNewPlan && user?.has_paid) {
          setTimeout(() => {
            toast({
              title: "Your travel plan is ready! 🎉",
              description: "Don't forget to save it so you can access it anytime during your trip.",
              duration: 6000,
            });
          }, 2000);
        }
      }
    } catch (error) {
      // Don't show error message if request was aborted (user navigated away)
      if (error.name !== 'AbortError') {
        setMessages((m) => [
          ...m,
          {
            sender: "ai",
            type: "text",
            message: "Sorry, something went wrong.",
            time: new Date(),
            blur: false
          }
        ]);
      }
    } finally {
      setIsTyping(false);
      setAbortController(null);
    }
  };

  // Copies the full conversation (user & AI messages) to the clipboard
  const handleCopyTranscript = () => {
    const transcriptText = messages
      .map((m) => {
        if (m.type === "location") {
          const name = m.locationData?.name || "Location";
          return `${m.sender === "user" ? "You" : "Rhodes"} shared: ${name}`;
        }
        return `${m.sender === "user" ? "You" : "Rhodes"}: ${m.message}`;
      })
      .join("\n\n");

    navigator.clipboard
      .writeText(transcriptText)
      .then(() => {
        toast({ title: "Transcript copied to clipboard" });
      })
      .catch(() => {
        toast({ title: "Failed to copy transcript", variant: "destructive" });
      });
  };

  // Persist messages on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('wr_chat_history', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // If user hasn't configured the plan yet, show configuration overlay
  if (!planConfig) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center p-6 text-[#F4E1C1] relative"
        style={{
          backgroundImage:
            "linear-gradient(rgba(20,24,48,0.85), rgba(20,24,48,0.85)), url('/assets/secret-beach.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md"
          title="Back to Home"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Centered clickable logo */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-1/2 -translate-x-1/2 focus:outline-none"
        >
          <Logo className="text-3xl whitespace-nowrap" />
        </button>

        <h2 className="text-2xl font-semibold mb-4">
          {user?.has_paid && isNewPlan ? 'Create New Travel Plan' : 'Plan preferences'}
        </h2>
        
        {user?.has_paid && isNewPlan && (
          <p className="text-white/80 text-center mb-4 text-sm">
            Set your preferences to create a personalized Rhodes travel plan that you can save and revisit anytime.
          </p>
        )}

        <PlanConfigurator
          onSubmit={(cfg) => {
            setPlanConfig(cfg);
            try {
              localStorage.setItem('wr_plan_config', JSON.stringify(cfg));
            } catch {}
            
            // Convert plan config to user preferences format
            const preferences = {
              budget: 'moderate',
              interests: cfg.waterActivities === 'yes' ? ['beaches'] : [],
              timeOfDay: cfg.startTime ? [cfg.startTime] : [],
              groupSize: cfg.companions || 'solo',
              pace: cfg.pace || 'moderate',
              mobility: 'active',
              dining: 'mixed',
              duration: 'half-day',
              numberOfPOIs: cfg.numberOfPOIs || 5,
              transport: cfg.transport || 'car',
              extraDetails: cfg.extraDetails || ''
            };
            
            // Set preferences and start guided chat mode
            handlePreferencesUpdate(preferences);
            setPlanningMode('guided');
          }}
        />
        <Toaster />
      </div>
    );
  }

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{
        backgroundImage:
          "linear-gradient(rgba(20,24,48,0.7), rgba(20,24,48,0.9)), url('/assets/secret-beach.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm border-b border-white/10 shrink-0">
        {/* left group: back & logo */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="focus:outline-none p-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="text-white/80" />
          </button>
        </div>

        {/* centered logo */}
        <button
          onClick={() => navigate('/')}
          className="absolute left-1/2 -translate-x-1/2 focus:outline-none"
        >
          <Logo className="text-3xl whitespace-nowrap" />
        </button>

        {/* right buttons */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              if (isTyping) {
                const confirmed = window.confirm('The AI is currently thinking. Are you sure you want to leave?');
                if (!confirmed) return;
                if (abortController) {
                  abortController.abort();
                }
              }
              navigate('/plans');
            }}
            disabled={isTyping}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              isTyping 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-white/10 cursor-pointer'
            }`}
            title={isTyping ? "AI is thinking..." : "My Plans"}
          >
            <BookMarked size={18} color="#F4E1C1" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT - GUIDED CHAT, STEP-BY-STEP, OR TRADITIONAL CHAT */}
      {planningMode === 'guided' ? (
        <div className="flex-1 overflow-y-auto">
          <GuidedChatInterface
            userPreferences={userPreferences}
            userLocation={userLocation}
            onPlanComplete={(plan) => {
              setCurrentPlan({
                title: `Guided Rhodes Adventure (${plan.length} places)`,
                locations: plan,
                timestamp: Date.now(),
                guided: true
              });
              setPlanSaved(false);
              toast({
                title: "Your travel plan is ready! 🎉",
                description: `Created ${plan.length} amazing stops. You can now chat freely to add more or get tips!`,
                duration: 5000,
              });
            }}
            onPlanUpdate={handleStepByStepPlanUpdate}
          />
        </div>
      ) : planningMode === 'stepByStep' ? (
        <div className="flex-1 overflow-y-auto">
          <StepByStepPlanner
            userPreferences={userPreferences}
            userLocation={userLocation}
            onPlanComplete={handleStepByStepComplete}
            onPlanUpdate={handleStepByStepPlanUpdate}
            isNewPlan={isNewPlan}
          />
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4 pb-32"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
        <AnimatePresence>
        {messages.map((m, i) => {
          if (m.type === 'location') {
            return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`relative flex justify-start my-1 ${m.blur ? 'blur-sm' : ''}`}
                >
                {/* Show agent status for location responses */}
                {i === messages.length - 1 && USE_AGENT_FRAMEWORK && (
                  <AgentStatusIndicator 
                    isAgentMode={USE_AGENT_FRAMEWORK}
                    agentMetadata={currentPlan?.agentMetadata}
                  />
                )}
                <div className="max-w-[75%]">
                  <LocationCard location={m.locationData} />
                </div>
                {m.blur && (
                  <button
                    onClick={() => navigate("/paywall")}
                    className="absolute inset-0 w-full h-full bg-transparent flex items-center justify-center text-white font-bold text-lg z-10"
                  >
                    Unlock Full Response
                  </button>
                )}
                </motion.div>
            );
          }
          
          return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
            <ChatBubble
              sender={m.sender}
              message={m.message}
              time={m.time}
              blur={m.blur}
              interactive={m.interactive}
              onPreferencesRequest={() => setShowPreferences(true)}
              onPlanEdit={() => handlePlanEdit()}
            />
              </motion.div>
          );
        })}
        </AnimatePresence>
        {isTyping && <AiLoadingAnimation />}
        <div ref={chatEndRef} />
        </div>
      )}

      {/* BOTTOM: suggestions + free-pill + input - only show in traditional chat mode */}
      {planningMode === 'chat' && (
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="p-4 bg-black/30 backdrop-blur-md"
      >
        {/* save plan button */}
        {currentPlan && !planSaved && (
          <div className="flex justify-center mb-2">
            <button
              onClick={async () => {
                try {
                  const { canSaveAnotherPlan } = await import('@/utils/plans');
                  // If user is not paid and has already used their free plan, redirect to paywall
                  if (!user?.has_paid && !(await canSaveAnotherPlan(user))) { 
                    navigate('/paywall'); 
                    return; 
                  }
                  setPlanName(`${isNewPlan ? 'Rhodes Adventure' : 'Travel plan'} #${Date.now().toString().slice(-5)}`);
                  setShowNameDialog(true);
                } catch (error) {
                  console.error('Failed to check plan quota:', error);
                  // Fallback - show dialog anyway
                  setPlanName(`${isNewPlan ? 'Rhodes Adventure' : 'Travel plan'} #${Date.now().toString().slice(-5)}`);
                  setShowNameDialog(true);
                }
              }}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                isNewPlan 
                  ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg hover:shadow-xl hover:scale-105' 
                  : 'bg-[#E8D5A4] text-[#242b50] hover:bg-[#CAB17B]'
              }`}
            >
              {isNewPlan ? '💾 Save Your New Plan' : 'Save this plan'}
            </button>
          </div>
        )}

        {/* free-prompts + right-now pill */}
        <div className="flex justify-center gap-2 mb-2">
          <div className="px-3 py-1 text-xs font-semibold rounded-full border border-white/20 bg-black/20 text-white/70 backdrop-blur-sm">
            {user?.has_paid
              ? "Unlimited access ✨"
              : trialExpired
                ? "Free plan used – upgrade for unlimited access"
                : freeRemaining > 0
                  ? `${freeRemaining} free ${freeRemaining !== 1 ? "prompts" : "prompt"} left`
                  : "Upgrade for unlimited access"}
          </div>

          {/* Right Now pill */}
          <button
            onClick={() => setShowRightNow(true)}
            className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border border-white/20 bg-white/5 text-white/80 backdrop-blur-sm hover:bg-white/10 transition"
          >
            <SunMedium className="w-3 h-3" /> Right&nbsp;Now
          </button>
        </div>

        {/* input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 mb-safe"
        >
          {!trialExpired ? (
            <>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              user?.has_paid 
                ? "Ask anything about Rhodes…" 
                : freeRemaining > 0 
                  ? "Ask anything about Rhodes…" 
                  : "Upgrade to continue"
            }
            disabled={isTyping}
            className="flex-1 rounded-full px-4 py-3 bg-[#1a1f3d] text-white placeholder:text-[#888faa] outline-none shadow-inner text-sm"
          />
            <motion.button
              type="submit"
              disabled={isTyping || !input.trim()}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E8D5A4] to-[#B89E6A] text-[#1a1f3d] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </motion.button>
            </>
          ) : (
          <button
              type="button"
              onClick={() => navigate('/paywall')}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#E8D5A4] to-[#B89E6A] text-[#1a1f3d] font-semibold hover:from-[#B89E6A] hover:to-[#E8D5A4] transition"
            >
              Upgrade for Unlimited Chat
          </button>
          )}
        </form>
      </motion.footer>
      )}

      {/* Toast notifications */}
      <Toaster />

      {/* dialog JSX after footer */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="bg-[#181c2c] text-[#F4E1C1] border border-yellow-400/20 shadow-2xl rounded-2xl p-0 overflow-hidden max-w-md">
          <div className="flex flex-col items-center px-8 py-8">
            <div className="mb-3 text-4xl">📝</div>
            <DialogHeader className="w-full text-center mb-2">
              <DialogTitle className="text-2xl font-extrabold bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 bg-clip-text text-transparent drop-shadow">Name Your Plan</DialogTitle>
              <div className="text-sm text-white/70 mt-2 font-medium">Give your saved itinerary a name so you can find it later.</div>
            </DialogHeader>
            <input
              value={planName}
              onChange={(e)=>setPlanName(e.target.value)}
              className="w-full mt-6 px-4 py-3 rounded-xl bg-white/10 border border-yellow-400/20 text-lg text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-yellow-400/40 transition"
              placeholder="e.g. South Coast Adventure"
              maxLength={40}
              autoFocus
            />
            <DialogFooter className="mt-8 w-full flex gap-3 justify-center">
              <Button
                className="w-1/2 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-[#242b50] font-bold text-base shadow-lg hover:from-orange-400 hover:to-yellow-400 transition"
                onClick={async () => {
                  try {
                    const { savePlan } = await import('@/utils/plans');
                    const ok = await savePlan({ ...currentPlan, title: planName || currentPlan.title, chatHistory: messages }, user);
                    if (ok) {
                      setPlanSaved(true);
                      setShowNameDialog(false);
                      try { sessionStorage.removeItem('wr_current_plan'); } catch { }
                      toast({ title: 'Plan saved!' });
                    } else { 
                      navigate('/paywall'); 
                    }
                  } catch (error) {
                    console.error('Failed to save plan:', error);
                    toast({ title: 'Failed to save plan', description: 'Please try again', variant: 'destructive' });
                  }
                }}
              >Save</Button>
              <DialogClose asChild>
                <Button variant="secondary" className="w-1/2 py-3 rounded-full bg-white/10 text-white border border-white/20 font-bold text-base hover:bg-white/20 transition">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Right Now dialog */}
      <Dialog open={showRightNow} onOpenChange={setShowRightNow}>
        <DialogContent className="backdrop-blur-lg bg-white/5 border border-white/10 p-0 max-w-xs rounded-2xl text-white">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Right Now in Rhodes</h2>
              <button onClick={() => setShowRightNow(false)} className="text-white/70 hover:text-white">✕</button>
            </div>

            {/* Temperature card */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/10">
              <Thermometer className="text-red-400 w-4 h-4" />
              <div className="text-sm">33°C&nbsp; <span className="text-xs opacity-70">• 01:36 PM</span></div>
            </div>

            {/* suggestion list */}
            <div className="space-y-2 text-sm">
              <div className="p-3 rounded-lg bg-white/5 flex items-start gap-2">
                <Thermometer className="text-red-400 w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-semibold">Beat the Heat</div>
                  <div className="text-xs text-white/80">Shady spots & cool breaks for 33°C weather.</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 flex items-start gap-2">
                <SunMedium className="text-yellow-300 w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-semibold">Lunch Time Locals</div>
                  <div className="text-xs text-white/80">Where Greeks actually eat lunch (not tourist traps).</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 flex items-start gap-2">
                <MapPin className="text-cyan-300 w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-semibold">What's Around Me</div>
                  <div className="text-xs text-white/80">Hidden gems within walking distance.</div>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-white/60 pt-2">
              Suggestions update based on weather, time, and your location
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive Components */}
      <AnimatePresence>
        {showPreferences && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto"
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <TravelPreferences
                initialPreferences={userPreferences}
                onPreferencesUpdate={handlePreferencesUpdate}
                onComplete={handlePreferencesComplete}
              />
            </div>
          </motion.div>
        )}

        {showPlanEditor && (
          <PlanEditor
            locations={editablePlan}
            preferences={userPreferences}
            onUpdate={(locations) => setEditablePlan(locations)}
            onSave={handlePlanSave}
            onClose={() => setShowPlanEditor(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatBubble({ sender, message, time, blur, interactive = {}, onPreferencesRequest, onPlanEdit }) {
  const isUser = sender === "user";
  const navigate = useNavigate();

  const bubbleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`relative flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`px-4 py-3 max-w-[80%] break-words rounded-3xl shadow-lg transition-all duration-300 ${
          blur && !isUser ? "blur-md" : ""
        }`}
        style={{
          background: isUser
            ? "linear-gradient(135deg, #E8D5A4, #B89E6A)"
            : "rgba(26, 31, 61, 0.7)",
          backdropFilter: "blur(10px)",
          border: isUser ? "none" : "1px solid rgba(244, 225, 193, 0.1)",
          color: isUser ? "#1a1f3d" : "#F4E1C1",
          fontWeight: 500,
        }}
      >
        <p className="text-sm whitespace-pre-wrap">{message}</p>
        
        {/* Interactive Elements */}
        {!isUser && (interactive?.preferences || interactive?.editPlan) && (
          <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
            {interactive.preferences && (
              <button
                onClick={onPreferencesRequest}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30 transition-colors"
              >
                <Settings size={12} />
                Set Preferences
              </button>
            )}
            {interactive.editPlan && (
              <button
                onClick={onPlanEdit}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs hover:bg-purple-500/30 transition-colors"
              >
                <Edit size={12} />
                Edit Plan
              </button>
            )}
          </div>
        )}
        
        <div className="text-xs text-right mt-2 opacity-60">
          {formatTime(time)}
        </div>
      </div>
      {blur && !isUser && (
        <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={() => navigate("/paywall")}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-gradient-to-r from-[#E8D5A4] to-[#CAB17B] text-[#242b50] shadow-xl hover:scale-105 transition-transform"
        >
            Unlock Full Access
        </button>
        </div>
      )}
    </motion.div>
  );
}

const LOADING_ICONS = ['🏖️', '🌊', '🏔️', '☀️', '🗺️'];
const LOADING_TEXTS = [
  'Finding hidden beaches…',
  'Listening to waves…',
  'Climbing up viewpoints…',
  'Soaking up sunshine…',
  'Plotting your route…',
];

function AiLoadingAnimation() {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % LOADING_ICONS.length);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center my-4 space-y-2">
      <motion.span
        key={step}
        initial={{ scale: 0, rotate: -90, opacity: 0 }}
        animate={{ scale: 1.2, rotate: 0, opacity: 1 }}
        exit={{ scale: 0, rotate: 90, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 12 }}
        className="text-4xl"
      >
        {LOADING_ICONS[step]}
      </motion.span>
      <p className="text-xs text-white/70 font-medium">
        {LOADING_TEXTS[step]}
      </p>
      <p className="text-[10px] text-white/50">Hang tight while we craft your perfect Rhodes experience…</p>
    </div>
  );
}

// ---------------- PlanConfigurator component ----------------
function PlanConfigurator({ onSubmit }) {
  const [pace, setPace] = useState(null);
  const [waterActivities, setWaterActivities] = useState(null);
  const [transport, setTransport] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [companions, setCompanions] = useState(null);
  const [numberOfPOIs, setNumberOfPOIs] = useState(5);
  const [extraDetails, setExtraDetails] = useState("");

  const isReady = Boolean(pace || waterActivities !== null || transport || startTime || companions);

  const pillBase =
    "px-3 py-2 rounded-full border border-white/20 text-xs md:text-sm font-semibold transition-colors whitespace-nowrap";

  const selectedPill = "bg-gradient-to-r from-yellow-400 to-orange-500 text-[#242b50] shadow-lg";
  const unselectedPill = "bg-white/10 text-white/80 hover:bg-white/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full sm:max-w-md md:max-w-lg mx-auto backdrop-blur-lg bg-white/5 border border-white/10 rounded-none sm:rounded-2xl p-2 sm:p-3 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 shadow-2xl overflow-y-auto max-h-[100dvh] min-h-[60vh]"
      style={{ minWidth: 0 }}
    >
      {/* Pace */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-sm md:text-base font-semibold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🏃‍♂️ Pace</h3>
        <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
          {[
            { label: 'Fast-Paced', value: 'fast' },
            { label: 'Relaxed', value: 'relaxed' },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`${pillBase} ${pace === opt.value ? selectedPill : unselectedPill}`}
              onClick={() => setPace(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Water Activities */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-sm md:text-base font-semibold bg-gradient-to-r from-teal-300 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🏖️ Water Fun</h3>
        <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
          {[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`${pillBase} ${waterActivities === opt.value ? selectedPill : unselectedPill}`}
              onClick={() => setWaterActivities(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transport */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-sm md:text-base font-semibold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🚗 Transport</h3>
        <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
          {[
            { label: 'Car', value: 'car' },
            { label: 'Public', value: 'public' },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`${pillBase} ${transport === opt.value ? selectedPill : unselectedPill}`}
              onClick={() => setTransport(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Start Time */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-sm md:text-base font-semibold bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">⏰ Start Time</h3>
        <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
          {['08:00', '09:00', '10:00', '11:00'].map((time) => (
            <button
              key={time}
              className={`${pillBase} ${startTime === time ? selectedPill : unselectedPill}`}
              onClick={() => setStartTime(time)}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Companions */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-sm md:text-base font-semibold bg-gradient-to-r from-green-300 to-lime-400 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🧑‍🤝‍🧑 Who's Coming?</h3>
        <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
          {[{label:'Solo',value:'solo'},{label:'Couple',value:'couple'},{label:'Family',value:'family'}].map(opt=> (
            <button key={opt.value} className={`${pillBase} ${companions===opt.value?selectedPill:unselectedPill}`} onClick={()=>setCompanions(opt.value)}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Number of POIs */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-sm md:text-base font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">📍 Places to Visit</h3>
        <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
          {[
            { label: '🎯 3 places', value: 3 },
            { label: '⏰ 4 places', value: 4 },
            { label: '🌟 5 places', value: 5 },
            { label: '🗺️ 6 places', value: 6 },
            { label: '📍 7 places', value: 7 },
            { label: '🌍 8 places', value: 8 },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`${pillBase} ${numberOfPOIs === opt.value ? selectedPill : unselectedPill}`}
              onClick={() => setNumberOfPOIs(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Details */}
      <div className="space-y-1 md:space-y-2 text-left">
        <h3 className="text-xs md:text-sm font-semibold bg-gradient-to-r from-fuchsia-400 to-pink-500 bg-clip-text text-transparent uppercase tracking-wide">
          📝 Extra Notes <span className="text-xs text-white/60 normal-case">(optional)</span>
        </h3>
        <textarea
          value={extraDetails}
          onChange={(e) => setExtraDetails(e.target.value)}
          rows={3}
          placeholder="e.g. Where can i hit the penjamin?"
          className="w-full rounded-lg px-3 py-2 md:px-4 md:py-2 bg-white/10 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 resize-none text-xs md:text-sm"
        />
      </div>

      <motion.button
        whileHover={isReady ? { scale: 1.03 } : {}}
        disabled={!isReady}
        onClick={() => onSubmit({ pace, waterActivities, transport, startTime, companions, numberOfPOIs, extraDetails })}
        className={`w-full py-2 md:py-3 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide transition-colors ${
          isReady
            ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-[#242b50] shadow-lg'
            : 'bg-white/10 text-white/40 cursor-not-allowed'
        }`}
      >
        Plan My Day ✨
      </motion.button>
    </motion.div>
  );
}