import React from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, BookOpen, MessageCircle, Map, Utensils, Calendar } from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0, scale: 0.95 },
  in: { opacity: 1, scale: 1 },
  out: { opacity: 0, scale: 0.95 }
};

const pageTransition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  duration: 0.8
};

const featureIcons = [
  { Icon: MessageCircle, label: 'Instant Chat' },
  { Icon: Map, label: 'Secret Spots' },
  { Icon: Utensils, label: 'Food Tips' },
  { Icon: Calendar, label: 'Day Plans' }
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="h-screen w-full flex flex-col justify-between items-center p-6 text-white relative overflow-hidden"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        maxWidth: '500px',
        maxHeight: '1000px',
        margin: '0 auto', // Center the container if the screen is larger
        border: '1px solid rgba(255,255,255,0.1)' // Optional border for visualization
      }}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Header */}
      <motion.div 
        className="w-full flex justify-center pt-4 z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <Logo />
      </motion.div>

      {/* Hero Section */}
      <div className="flex flex-col items-center text-center z-10">
        <motion.h2 
          className="font-bold text-2xl md:text-3xl mb-2 text-white/95"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Your Personal Rhodes AI Guide
        </motion.h2>
        <motion.p 
          className="text-base text-white/70 max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
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
            className="w-auto h-[35vh] max-w-[80vw] object-contain drop-shadow-[0_0_15px_rgba(74,144,226,0.5)]"
          />
        </motion.div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col items-center w-full max-w-xs gap-3 z-10 mb-4">
        <motion.button
          className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white transition-all duration-300 shadow-lg"
          onClick={() => navigate('/chat')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(255, 165, 0, 0.6)' }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <Lock size={18} />
            <span>Unlock Hidden Spots</span>
          </div>
        </motion.button>
        <motion.button
          className="w-full py-3 text-sm font-medium rounded-xl border border-white/20 text-white/80 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300"
          onClick={() => navigate('/features')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <BookOpen size={16} />
            <span>How It Works</span>
          </div>
        </motion.button>
      </div>

      {/* Feature Icons */}
      <motion.div 
        className="grid grid-cols-4 gap-4 w-full max-w-xs items-center mb-4 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
      >
        {featureIcons.map(({ Icon, label }, i) => (
          <motion.div 
            key={i} 
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 + i * 0.1 }}
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
        transition={{ delay: 1.8 }}
      >
        Your Adventure Awaits 🌴
      </motion.footer>
    </motion.div>
  );
}
