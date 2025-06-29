// src/pages/ChatPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/ui/Logo";
import LocationCard from "../components/LocationCard";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, BookMarked, ArrowLeft, Send, Sparkles, Thermometer, SunMedium, MapPin } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { isPaid } from "@/utils/auth";
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

  if (!locations.length) {
    if (reply.trim()) {
      newMessages.push({
        sender: 'ai',
        type: 'text',
        message: reply.trim(),
        time: new Date(),
        blur: blur,
      });
    }
    return newMessages;
  }

  const textParts = reply.split('|||LOCATION|||');

  textParts.forEach((text, i) => {
    const trimmedText = text.trim();
    if (trimmedText) {
      newMessages.push({
        sender: 'ai',
        type: 'text',
        message: trimmedText,
        time: new Date(),
        blur: blur,
      });
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

  // Initialize replyCount based on how many AI responses already exist (useful when loading from a saved plan)
  const initialMessages = (() => {
    if (typeof window === 'undefined') return [];

    if (planId) {
      try {
        const plans = getSavedPlans();
        const plan = plans.find((p) => String(p.timestamp) === String(planId));
        if (plan && plan.chatHistory) {
          return plan.chatHistory.map((m) => ({ ...m, time: new Date(m.time) }));
        }
      } catch {}
    }

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
  const [planConfig, setPlanConfig] = useState(() => {
    if (typeof window === 'undefined') return null;
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

  const freeRemaining = Math.max(FREE_LIMIT - replyCount, 0);

  // Determine if the overall trial (single free plan) has expired
  const trialExpired = !isPaid() && !canSaveAnotherPlan();

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

  const sanitize = (str) => str.replace(/<\/?[^>]+(>|$)/g, "");

  const handleSend = async (overrideText, silent=false) => {
    if (trialExpired) {
      navigate("/paywall");
      return;
    }

    if (replyCount > FREE_LIMIT) {
      navigate("/paywall");
      return;
    }

    const now = Date.now();
    if (isTyping || now - lastSent < 2000) return;

    const text = overrideText != null ? overrideText : sanitize(input).trim();
    if (!text || text.length > 500) return;

    if (replyCount === FREE_LIMIT) setBlurNext(true);

    setInput("");
    setLastSent(now);
    setIsTyping(true);

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
      const endpoint = "/api/chat"; // proxy handles dev -> backend
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, prompt: text, userLocation })
      });
      const { reply = "(no reply)", structuredData = null } = await res.json();

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
        };
        setCurrentPlan(planObj);
        try { sessionStorage.setItem('wr_current_plan', JSON.stringify(planObj)); } catch {}
        setPlanSaved(false);
      }
    } catch {
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
    } finally {
      setIsTyping(false);
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

        <h2 className="text-2xl font-semibold mb-4">Plan preferences</h2>

        <PlanConfigurator
          onSubmit={(cfg) => {
            setPlanConfig(cfg);
            try {
              localStorage.setItem('wr_plan_config', JSON.stringify(cfg));
            } catch {}
            // Compose a single-line instruction for the assistant
            const prefsPairs = Object.entries(cfg).filter(([_, v]) => {
              if (Array.isArray(v)) return v.length > 0;
              return v != null && v !== '';
            });
            let intro =
              'Here are my preferences: ' +
              prefsPairs
                .map(([k, v]) =>
                  `${k}: ${Array.isArray(v) ? v.join(', ') : v}`,
                )
                .join(', ') +
              '.';
            if (cfg.extraDetails && cfg.extraDetails.trim()) {
              intro += ` Additional details: ${cfg.extraDetails.trim()}.`;
            }
            intro += ' Please tailor the plan accordingly.';
            handleSend(intro, true); // send silently
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
            onClick={() => navigate('/plans')}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            title="My Plans"
          >
            <BookMarked size={18} color="#F4E1C1" />
          </button>
        </div>
      </header>

      {/* CHAT */}
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
            />
              </motion.div>
          );
        })}
        </AnimatePresence>
        {isTyping && <AiLoadingAnimation />}
        <div ref={chatEndRef} />
      </div>

      {/* BOTTOM: suggestions + free-pill + input */}
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
              onClick={() => {
                import('@/utils/plans').then(({ canSaveAnotherPlan }) => {
                  if (!canSaveAnotherPlan()) { navigate('/paywall'); return; }
                  setPlanName(`Travel plan #${Date.now().toString().slice(-5)}`);
                  setShowNameDialog(true);
                });
              }}
              className="px-4 py-1 rounded-full text-xs font-semibold bg-[#E8D5A4] text-[#242b50] hover:bg-[#CAB17B] transition"
            >
              Save this plan
            </button>
          </div>
        )}

        {/* free-prompts + right-now pill */}
        <div className="flex justify-center gap-2 mb-2">
          <div className="px-3 py-1 text-xs font-semibold rounded-full border border-white/20 bg-black/20 text-white/70 backdrop-blur-sm">
            {trialExpired
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
              freeRemaining > 0 ? "Ask anything about Rhodes…" : "Upgrade to continue"
            }
            disabled={isTyping}
            className="flex-1 rounded-full px-4 py-2 bg-[#1a1f3d] text-white placeholder:text-[#888faa] outline-none shadow-inner text-sm"
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
                onClick={() => {
                  import('@/utils/plans').then(({ savePlan }) => {
                    const ok = savePlan({ ...currentPlan, title: planName || currentPlan.title, chatHistory: messages });
                    if (ok) {
                      setPlanSaved(true);
                      setShowNameDialog(false);
                      try { sessionStorage.removeItem('wr_current_plan'); } catch { }
                      toast({ title: 'Plan saved!' });
                    } else { navigate('/paywall'); }
                  })
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
    </div>
  );
}

function ChatBubble({ sender, message, time, blur }) {
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
  const [extraDetails, setExtraDetails] = useState("");

  const isReady = Boolean(pace || waterActivities !== null || transport || startTime || companions);

  const pillBase =
    "px-4 py-2 rounded-full border border-white/20 text-xs md:text-sm font-semibold transition-colors";

  const selectedPill = "bg-gradient-to-r from-yellow-400 to-orange-500 text-[#242b50] shadow-lg";
  const unselectedPill = "bg-white/10 text-white/80 hover:bg-white/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl"
    >
      {/* Pace */}
      <div className="space-y-2 text-left">
        <h3 className="text-base font-semibold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🏃‍♂️ Pace</h3>
        <div className="flex flex-wrap gap-2 justify-center">
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
      <div className="space-y-2 text-left">
        <h3 className="text-base font-semibold bg-gradient-to-r from-teal-300 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🏖️ Water Fun</h3>
        <div className="flex flex-wrap gap-2 justify-center">
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
      <div className="space-y-2 text-left">
        <h3 className="text-base font-semibold bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🚗 Transport</h3>
        <div className="flex flex-wrap gap-2 justify-center">
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
      <div className="space-y-2 text-left">
        <h3 className="text-base font-semibold bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">⏰ Start Time</h3>
        <div className="flex flex-wrap gap-2 justify-center">
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
      <div className="space-y-2 text-left">
        <h3 className="text-base font-semibold bg-gradient-to-r from-green-300 to-lime-400 bg-clip-text text-transparent uppercase tracking-wide text-center w-full">🧑‍🤝‍🧑 Who's Coming?</h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {[{label:'Solo',value:'solo'},{label:'Couple',value:'couple'},{label:'Family',value:'family'}].map(opt=> (
            <button key={opt.value} className={`${pillBase} ${companions===opt.value?selectedPill:unselectedPill}`} onClick={()=>setCompanions(opt.value)}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Additional Details */}
      <div className="space-y-2 text-left">
        <h3 className="text-sm font-semibold bg-gradient-to-r from-fuchsia-400 to-pink-500 bg-clip-text text-transparent uppercase tracking-wide">
          📝 Extra Notes <span className="text-xs text-white/60 normal-case">(optional)</span>
        </h3>
        <textarea
          value={extraDetails}
          onChange={(e) => setExtraDetails(e.target.value)}
          rows={3}
          placeholder="e.g. Where can i hit the penjamin?"
          className="w-full rounded-lg px-4 py-2 bg-white/10 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 resize-none"
        />
      </div>

      <motion.button
        whileHover={isReady ? { scale: 1.03 } : {}}
        disabled={!isReady}
        onClick={() => onSubmit({ pace, waterActivities, transport, startTime, companions, extraDetails })}
        className={`w-full py-3 rounded-full text-sm font-bold uppercase tracking-wide transition-colors ${
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