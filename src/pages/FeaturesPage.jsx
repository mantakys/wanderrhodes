import React from 'react';
import Logo from '../components/ui/Logo';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, MapPin, Coffee, Calendar, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const pageVariants = {
  initial:  { opacity: 0 },
  in:       { opacity: 1 },
  out:      { opacity: 0 }
};
const pageTransition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.4
};

export default function FeaturesPage() {
  const navigate = useNavigate();
  const features = [
    {
      Icon: MessageCircle,
      title: 'View on Map',
      desc: 'Waypoints with navigation on the map.'
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
      className="min-h-[100dvh] w-full flex flex-col bg-center bg-no-repeat bg-cover bg-[url('/sea-bg.png')] lg:bg-[url('/sea-bg-dp.png')] overflow-hidden relative max-w-[500px] lg:max-w-none mx-auto"
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
          <h1 className="text-center font-extrabold text-3xl md:text-4xl lg:text-5xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent tracking-wide drop-shadow-lg">
            How&nbsp;It&nbsp;Works
          </h1>

          <p className="text-center text-xs md:text-sm lg:text-base text-white/80 leading-relaxed max-w-sm md:max-w-md lg:max-w-2xl mx-auto mt-3">
            Wander Rhodes is your AI guide to Rhodes—just scan, chat, and get a custom plan with hidden spots, tips, and maps. No app, no account. Try a few for free, then unlock it all with a one-time payment.</p>
        </div>

        {/* Mobile / tablet grid */}
        <div className="w-full max-w-sm mx-auto lg:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={i}
                className="group relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                whileHover={{ y: -2 }}
              >
                <div className="relative overflow-hidden rounded-lg p-3 h-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/20 group-hover:shadow-xl group-hover:shadow-black/30 transition-all duration-300 text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-md bg-white/20 backdrop-blur-sm mb-2 mx-auto group-hover:bg-white/30 transition-colors duration-300">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-sm text-white mb-1 group-hover:text-yellow-300 transition-colors duration-300">
                      {title}
                    </h3>
                    <p className="text-white/90 text-xs leading-relaxed font-medium">
                      {desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Desktop list layout */}
        <div className="hidden lg:flex flex-col gap-8 w-full max-w-4xl mx-auto">
          {features.map(({ Icon, title, desc }, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-6 p-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/25 shadow-lg hover:shadow-2xl transition-shadow duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 + 0.3, type: 'spring', stiffness: 100 }}
            >
              <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-400 to-red-500 shadow-md">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
                <p className="text-white/90 text-sm leading-relaxed max-w-xl">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Sticky CTA Bar */}
      <div className="w-full bg-gradient-to-r from-orange-500/95 to-red-500/95 backdrop-blur-sm py-2 px-3">
        <div className="max-w-sm lg:max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-white font-bold text-xs">Unlock Full Access</div>
              <div className="text-white/90 text-xs font-medium">One-time €3.49 payment</div>
            </div>
            <button
              onClick={() => navigate('/paywall')}
              className="flex items-center space-x-1 bg-white text-orange-600 px-3 py-1.5 rounded-md font-bold text-xs hover:bg-gray-100 transition-colors duration-200 shadow-lg"
            >
              <span>Purchase Now</span>
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