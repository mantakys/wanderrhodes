import React from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, MapPin, Coffee, Calendar } from 'lucide-react';
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

export default function FeaturesPage() {
  const navigate = useNavigate();
  const features = [
    {
      Icon: MessageCircle,
      title: 'Instant AI Chat',
      desc: 'Ask about hidden gems, local customs, history & more.'
    },
    {
      Icon: MapPin,
      title: 'Secret Spot Finder',
      desc: 'Discover beaches & ruins that aren’t on any map.'
    },
    {
      Icon: Coffee,
      title: 'Local Food Tips',
      desc: 'Get curated tavernas and dishes based on your taste.'
    },
    {
      Icon: Calendar,
      title: 'Custom Day Plans',
      desc: 'Build your perfect itinerary in seconds.'
    }
  ];

  return (
    <motion.div
      className="absolute inset-0 min-h-screen w-full flex flex-col items-center text-center text-white px-4"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Logo at top */}
      <div className="mt-7 mb-4 cursor-pointer" onClick={() => navigate('/')}>
        <Logo />
      </div>

      {/* Hero */}
      <section
        className="w-full flex flex-col items-center rounded-3xl mb-6 px-6 py-12"
        style={{
          background: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3))'
        }}
      >
        <h1 className="font-serif text-4xl mb-2 drop-shadow-lg">
          How Wander Rhodes Works
        </h1>
        <p className="font-sans text-lg max-w-xl drop-shadow-md">
          A concierge-style AI that unlocks Rhodes’ hidden treasures—no signup, just instant insider knowledge.
        </p>
      </section>

      {/* Features Grid */}
      <section className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-6 py-12">
        {features.map(({ Icon, title, desc }, i) => (
          <div
            key={i}
            className="flex flex-col items-center bg-white/20 p-6 rounded-2xl shadow-lg"
          >
            <div className="bg-[#F4E1C1] p-3 rounded-full mb-3">
              <Icon className="h-8 w-8 text-[#3E2F1B]" />
            </div>
            <h3 className="font-serif text-xl mb-1">{title}</h3>
            <p className="font-sans text-sm">{desc}</p>
          </div>
        ))}
      </section>

      {/* Sticky CTA Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white/30 backdrop-blur-sm py-3 px-4 flex items-center justify-between">
        <div className="font-sans text-sm text-white">
          One-time €3.49 unlock
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="py-2 px-4 rounded-full bg-[#FF6B00] text-white font-medium hover:bg-[#ff7d24] transition"
        >
          🔍 Chat Now
        </button>
      </div>
    </motion.div>
  );
}
