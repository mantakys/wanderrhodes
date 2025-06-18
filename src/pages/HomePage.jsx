import React from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const pageVariants = {
  initial:  { x: '100vw' },
  in:       { x: 0 },
  out:      { x: '-100vw' }
};
const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.5
};

export default function HomePage() {
  const navigate = useNavigate();
  const features = [
    { icon: '💬', label: 'Instant Chat' },
    { icon: '🗺️', label: 'Secret Spots' },
    { icon: '🍴', label: 'Food Tips' },
    { icon: '📅', label: 'Day Plans' }
  ];

  return (
    <motion.div
      className="absolute inset-0 min-h-screen w-full flex flex-col justify-between items-center p-4 text-white"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Logo */}
      <div className="pt-6">
        <Logo />
      </div>

      {/* Intro + Map */}
      <div className="flex flex-col items-center">
        <div className="text-center mb-3">
          <h2 className="font-serif text-xl mb-1 drop-shadow-md">
            Your personal Rhodes AI travel companion
          </h2>
          <p className="font-sans text-sm drop-shadow-sm">
            Ask for hidden spots, local eats, or plan your perfect day.
          </p>
        </div>
        <img
          src="/rhodes-bg.png"
          alt="Rhodes glowing map"
          className="w-auto h-[38vh] max-w-[90vw] object-contain drop-shadow-lg mb-4"
        />

        {/* Urgency trigger */}
        <p className="text-sm text-[#F4E1C1] mb-10 drop-shadow-sm">
          First 3 questions free — explore now while spots are still quiet!
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col items-center w-full max-w-xs gap-4 mb-10">
        <button
          className="w-full py-4 text-base rounded-full bg-[#FF6B00] text-white font-medium hover:bg-[#ff7d24] transition shadow-md"
          onClick={() =>
            navigate('/chat', {
              state: { prefill: 'Hello! 😊 What local secret are you after today?' }
            })
          }
        >
          🔓 Unlock Hidden Spots — Start Free
        </button>
        <button
          className="w-full py-4 text-base rounded-full border border-[#F4E1C1] text-white font-medium bg-white/20 backdrop-blur-sm hover:bg-white/30 transition shadow-sm"
          onClick={() => navigate('/features')}
        >
          📖 How It Works
        </button>
      </div>

      {/* Feature Icons */}
      <div className="grid grid-cols-4 gap-4 items-center mb-10">
        {features.map((feat, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-3xl mb-1 drop-shadow-sm">{feat.icon}</span>
            <span className="text-xs font-sans drop-shadow-sm">{feat.label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="w-full text-xs text-center py-2 text-slate-300">
        Built by locals for travelers 🌞
      </footer>
    </motion.div>
  );
}
