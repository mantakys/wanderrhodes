import React from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, MapPin, Coffee, Calendar, ArrowLeft } from 'lucide-react';
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
      desc: 'Discover beaches & ruins that aren\'t on any map.'
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
      className="h-screen w-full flex flex-col bg-cover bg-center bg-no-repeat overflow-hidden relative"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        maxWidth: '500px',
        maxHeight: '1000px'
      }}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Back Arrow */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-all duration-200 shadow-lg"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Logo - moved further down */}
      <div className="mt-16 mb-6 cursor-pointer flex justify-center" onClick={() => navigate('/')}>
        <div className="transform hover:scale-105 transition-transform duration-200">
          <Logo />
        </div>
      </div>

      {/* Features Grid */}
      <section className="w-full px-3 flex-1 flex flex-col items-center justify-center">
        {/* Title above features */}
        <div className="text-center mb-4">
          <h1 className="font-bold text-2xl md:text-3xl text-white mb-2 leading-tight">
            How Wander Rhodes
            <span className="block bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent font-extrabold">
              Works
            </span>
          </h1>
          <p className="font-medium text-sm text-white/90 leading-relaxed max-w-xs mx-auto">
            Your AI travel companion that unlocks Rhodes' hidden treasures with instant insider knowledge.
          </p>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {features.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={i}
                className="group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                whileHover={{ y: -2 }}
              >
                <div className="relative overflow-hidden rounded-lg p-3 h-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/20 group-hover:shadow-xl group-hover:shadow-black/30 transition-all duration-300 text-center">
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Icon */}
                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-md bg-white/20 backdrop-blur-sm mb-2 mx-auto group-hover:bg-white/30 transition-colors duration-300">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="font-bold text-sm text-white mb-1 group-hover:text-yellow-300 transition-colors duration-300">
                      {title}
                    </h3>
                    <p className="text-white/90 text-xs leading-relaxed font-medium">
                      {desc}
                    </p>
                  </div>
                  
                  {/* Hover border effect */}
                  <div className="absolute inset-0 rounded-lg border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky CTA Bar */}
      <div className="w-full bg-gradient-to-r from-orange-500/95 to-red-500/95 backdrop-blur-sm py-2 px-3">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-white font-bold text-xs">Unlock Full Access</div>
              <div className="text-white/90 text-xs font-medium">One-time €3.49 payment</div>
            </div>
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center space-x-1 bg-white text-orange-600 px-3 py-1.5 rounded-md font-bold text-xs hover:bg-gray-100 transition-colors duration-200 shadow-lg"
            >
              <span>Start Exploring</span>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
