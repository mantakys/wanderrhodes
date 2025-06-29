import React from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, BookOpen, MessageCircle, Map, Utensils, Calendar } from 'lucide-react';

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
        className="w-full flex justify-center pt-4 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
      >
        <Logo />
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
            <Lock size={18} />
            <span>Chat Now</span>
          </div>
        </motion.button>
        <motion.button
          className="w-full py-3 text-sm font-medium rounded-xl border border-white/20 text-white/80 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300"
          onClick={() => navigate('/features')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6, ease: 'easeOut' }}
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
    </motion.div>
  );
}