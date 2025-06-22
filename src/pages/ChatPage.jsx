// src/pages/ChatPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import Logo from "../components/ui/Logo";

const SUGGESTIONS = [
  "Where should I eat tonight in Faliraki?",
  "Show me secret beaches in Lindos",
  "Plan a day trip in Rhodes old town"
];

const formatTime = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ChatBubble = ({ sender, message, time, blur }) => {
  const isUser = sender === "user";
  const navigate = useNavigate();

  const bubbleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
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
          fontWeight: 500
        }}
      >
        <p className="text-sm">{message}</p>
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
};

const TypingBubble = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="flex items-center space-x-1.5"
  >
    <div
      className="h-2 w-2 bg-[#F4E1C1] rounded-full"
      style={{ animation: "bounce 1s infinite" }}
    />
    <div
      className="h-2 w-2 bg-[#F4E1C1] rounded-full"
      style={{ animation: "bounce 1s infinite 0.2s" }}
    />
    <div
      className="h-2 w-2 bg-[#F4E1C1] rounded-full"
      style={{ animation: "bounce 1s infinite 0.4s" }}
    />
    <style>{`
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
    `}</style>
  </motion.div>
);

export default function ChatPage() {
  const navigate = useNavigate();
  const chatEndRef = useRef(null);

  const FREE_LIMIT = 5;
  const [replyCount, setReplyCount] = useState(0);
  const [blurNext, setBlurNext] = useState(false);

  const [messages, setMessages] = useState([
    {
      sender: "ai",
      message:
        "Hi! I'm your local Rhodes AI assistant. Ask me anything—food, sights, or secrets!",
      time: new Date(),
      blur: false
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastSent, setLastSent] = useState(0);

  const freeRemaining = Math.max(FREE_LIMIT - replyCount, 0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sanitize = (str) => str.replace(/<\/?[^>]+(>|$)/g, "");

  const handleSend = async (overrideText) => {
    if (replyCount >= FREE_LIMIT) {
      navigate("/paywall");
      return;
    }
    const now = Date.now();
    if (isTyping || now - lastSent < 2000) return;

    const text = overrideText != null ? overrideText : sanitize(input).trim();
    if (!text || text.length > 500) return;

    if (replyCount === FREE_LIMIT -1 ) setBlurNext(true);

    setInput("");
    setLastSent(now);
    
    setMessages((m) => [
      ...m,
      { sender: "user", message: text, time: new Date(), blur: false }
    ]);
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.message
      }));
      const endpoint = import.meta.env.DEV
        ? "http://localhost:3001/api/chat"
        : "/api/chat";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, prompt: text })
      });
      const { reply = "(no reply)" } = await res.json();

      setMessages((m) => [
        ...m,
        {
          sender: "ai",
          message: reply,
          time: new Date(),
          blur: blurNext
        }
      ]);
      if (blurNext) setBlurNext(false);
      setReplyCount((c) => c + 1);
    } catch {
      setMessages((m) => [
        ...m,
        {
          sender: "ai",
          message: "Sorry, something went wrong.",
          time: new Date(),
          blur: false
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      className="h-screen max-h-screen w-full flex flex-col font-sans"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <header className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm border-b border-white/10 shrink-0">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/")}
          className="p-2 rounded-full hover:bg-white/10"
        >
          <ArrowLeft className="text-white/80" />
        </motion.button>
        <Logo className="h-8 text-white" />
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              sender={m.sender}
              message={m.message}
              time={m.time}
              blur={m.blur}
            />
          ))}
        </AnimatePresence>
        {isTyping && <TypingBubble />}
        <div ref={chatEndRef} />
      </div>

      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="p-4 bg-black/30 backdrop-blur-md"
      >
        {freeRemaining > 0 && messages.length <= 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 space-y-2"
          >
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleSend(s)}
                className="w-full text-left rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-[#F4E1C1] font-medium backdrop-blur-sm shadow-sm hover:bg-white/10 transition text-sm flex items-center gap-3"
              >
                <Sparkles className="w-4 h-4 text-[#E8D5A4] shrink-0" />
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}

        <div className="flex justify-center mb-2">
          <div className="px-3 py-1 text-xs font-semibold rounded-full border border-white/20 bg-black/20 text-white/70">
            {freeRemaining > 0 ? (
              `${freeRemaining} free ${
                freeRemaining !== 1 ? "prompts" : "prompt"
              } left`
            ) : (
              "Upgrade for unlimited access"
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              freeRemaining > 0 ? "Ask anything..." : "Please upgrade"
            }
            disabled={isTyping || freeRemaining <= 0}
            className="flex-1 rounded-full px-5 py-3 bg-black/30 text-white placeholder:text-white/50 border border-white/20 focus:ring-2 focus:ring-[#E8D5A4] focus:border-[#E8D5A4] outline-none transition duration-300"
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
        </form>
      </motion.footer>
    </div>
  );
}
