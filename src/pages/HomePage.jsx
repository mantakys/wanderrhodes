import React, { useEffect, useState } from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, BookOpen, MessageCircle, Map, Utensils, Calendar, Mail, ArrowRight, LogOut } from 'lucide-react';
import { useUser } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';

const pageVariants = {
  initial: { opacity: 0 },
  in:      { opacity: 1 },
  out:     { opacity: 0 }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.6
};

const featureIcons = [
  { Icon: MessageCircle, label: 'Chat' },
  { Icon: Map, label: 'Secret Spots' },
  { Icon: Utensils, label: 'Local Eats' },
  { Icon: Calendar, label: 'Plans' }
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, loading, refreshUser } = useUser();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      
      if (res.ok) {
        await refreshUser();
        toast({
          title: "Logged out successfully",
          description: "You have been signed out of your account.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request-login', email: email.trim() })
      });

      if (res.ok) {
        setEmailSent(true);
        toast({
          title: "Magic link sent! ✨",
          description: "Check your email and click the link to log in.",
          duration: 5000,
        });
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send magic link",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show welcome message for newly authenticated paid users
  useEffect(() => {
    if (user?.has_paid) {
      // Check if this is a new authentication (you could add a flag in localStorage)
      const hasShownWelcome = localStorage.getItem('wr_welcome_shown');
      if (!hasShownWelcome) {
        toast({
          title: "Welcome to WanderRhodes! 🎉",
          description: "You now have unlimited access to our AI travel assistant.",
          duration: 5000,
        });
        localStorage.setItem('wr_welcome_shown', 'true');
      }
    }
  }, [user?.has_paid]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-cover bg-center bg-[url('/sea-bg.png')] lg:bg-[url('/sea-bg-dp.png')]">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8D5A4] mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-between px-4 py-4 text-white relative overflow-hidden bg-cover bg-center bg-[url('/sea-bg.png')] lg:bg-[url('/sea-bg-dp.png')] md:px-8 lg:px-12 lg:max-w-none xl:max-w-none 2xl:max-w-none mx-auto"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Header */}
      <motion.div 
        className="w-full flex justify-between items-center pt-4 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
      >
        <div className="flex-1"></div>
        <Logo />
        <div className="flex-1 flex justify-end">
          {user && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20"
              title="Logout"
            >
              <LogOut size={18} className="text-white/80" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Hero Section */}
      <div className="flex flex-col items-center text-center z-10 flex-grow justify-center">
        <motion.h2 
          className="font-bold text-2xl md:text-3xl mb-2 text-white/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
        >
          Your Personal Rhodes AI Guide
        </motion.h2>
        <motion.p 
          className="text-base text-white/70 max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
        >
          Discover hidden spots, find local eats, and plan your perfect day.
        </motion.p>
        
        <motion.div 
          className="relative mt-4 mb-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 100 }}
        >
          <img
            src="/rhodes-bg.png"
            alt="Rhodes glowing map"
            loading="lazy"
            className="w-auto max-h-[32vh] sm:max-h-[35vh] md:max-h-[38vh] lg:max-h-[40vh] max-w-[80vw] object-contain drop-shadow-[0_0_15px_rgba(74,144,226,0.5)]"
          />
        </motion.div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col items-center w-full max-w-xs gap-3 z-10 mb-4">
        <motion.button
          className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white transition-all duration-300 shadow-lg"
          onClick={() => navigate('/chat')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6, ease: 'easeOut' }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(255, 165, 0, 0.6)' }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <MessageCircle size={18} />
            <span>{user?.has_paid ? 'Start Chatting' : 'Chat Now'}</span>
          </div>
        </motion.button>
        
        {user?.has_paid && (
          <motion.button
            className="w-full py-3 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white transition-all duration-300 shadow-lg"
            onClick={() => navigate('/plans')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6, ease: 'easeOut' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center justify-center space-x-2">
              <Calendar size={16} />
              <span>View Travel Plans</span>
            </div>
          </motion.button>
        )}
        
        {user?.has_paid && (
          <motion.button
            className="w-full py-3 text-sm font-medium rounded-xl bg-gradient-to-r from-green-500 to-teal-500 text-white transition-all duration-300 shadow-lg"
            onClick={() => {
              // Clear existing chat and plan data to start fresh
              localStorage.removeItem('wr_chat_history');
              localStorage.removeItem('wr_plan_config');
              sessionStorage.removeItem('wr_current_plan');
              
              // Navigate to chat with new plan parameter
              navigate('/chat?new=true');
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15, duration: 0.6, ease: 'easeOut' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center justify-center space-x-2">
              <MessageCircle size={16} />
              <span>New Chat/Travel Plan</span>
            </div>
          </motion.button>
        )}

        {/* Login Section for Non-Authenticated Users */}
        {!user && !showLogin && (
          <motion.button
            className="w-full py-3 text-sm font-medium rounded-xl border border-white/30 text-white bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300"
            onClick={() => setShowLogin(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6, ease: 'easeOut' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center justify-center space-x-2">
              <Lock size={16} />
              <span>Already have an account? Sign In</span>
            </div>
          </motion.button>
        )}

        {/* Login Form */}
        {!user && showLogin && !emailSent && (
          <motion.div
            className="w-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-white font-medium text-center mb-3">Sign In to Your Account</h3>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 rounded-lg bg-white/20 text-white placeholder:text-white/60 border border-white/30 focus:border-white/50 focus:outline-none"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Mail size={16} />
                    <span>Send Magic Link</span>
                  </div>
                )}
              </button>
            </form>
            <button
              onClick={() => setShowLogin(false)}
              className="w-full mt-2 py-1 text-sm text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}

        {/* Email Sent Confirmation */}
        {!user && emailSent && (
          <motion.div
            className="w-full bg-green-500/20 backdrop-blur-md rounded-xl border border-green-400/30 p-4 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-green-300 mb-2">
              <Mail size={24} className="mx-auto" />
            </div>
            <h3 className="text-green-100 font-medium mb-1">Magic Link Sent!</h3>
            <p className="text-green-200/80 text-sm mb-3">
              Check your email and click the link to sign in.
            </p>
            <button
              onClick={() => {
                setShowLogin(false);
                setEmailSent(false);
                setEmail('');
              }}
              className="text-sm text-green-300 hover:text-green-100 transition-colors"
            >
              Send another link
            </button>
          </motion.div>
        )}
        
        <motion.button
          className="w-full py-3 text-sm font-medium rounded-xl border border-white/20 text-white/80 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300"
          onClick={() => navigate('/features')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: user?.has_paid ? 1.25 : 1.2, duration: 0.6, ease: 'easeOut' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <BookOpen size={16} />
            <span>See Features</span>
          </div>
        </motion.button>
      </div>

      {/* Feature Icons */}
      <motion.div 
        className="grid grid-cols-4 gap-4 w-full max-w-xs items-center mb-4 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6, ease: 'easeOut' }}
      >
        {featureIcons.map(({ Icon, label }, i) => (
          <motion.div 
            key={i} 
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 + i * 0.1, type: 'tween', ease: 'easeOut' }}
          >
            <div className="bg-white/10 rounded-full p-2 mb-1">
              <Icon className="h-5 w-5 text-white/80" />
            </div>
            <span className="text-xs font-medium text-white/70">{label}</span>
          </motion.div>
        ))}
      </motion.div>
      
      <motion.footer 
        className="w-full text-xs text-center py-2 text-white/40 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, type: 'tween', ease: 'easeOut' }}
      >
        Your Adventure Awaits 🌴
      </motion.footer>
      
      {/* Toast notifications */}
      <Toaster />
    </motion.div>
  );
}