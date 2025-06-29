import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const regions = [
  { name: 'Ialyssos', position: 'top-[15%] left-[25%]' },
  { name: 'Town', position: 'top-[20%] left-[45%]' },
  { name: 'Faliraki', position: 'top-[35%] left-[65%]' },
  { name: 'Afandou', position: 'top-[50%] left-[60%]' },
  { name: 'Kolymbia', position: 'top-[60%] left-[70%]' },
  { name: 'Lindos', position: 'bottom-[20%] left-[55%]' },
  { name: 'Southern Rhodes', position: 'bottom-[5%] left-[30%]' },
  { name: 'Prasonisi', position: 'bottom-[2%] right-[10%]' },
  { name: 'Monolithos', position: 'bottom-[35%] left-[10%]' },
  { name: 'Kameiros', position: 'top-[40%] left-[15%]' },
];

const ChooseRegionPage = () => {
  const navigate = useNavigate();

  const pageVariants = {
    initial: { opacity: 0, x: "100%" },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: "-100%" }
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.5
  };

  const handleRegionClick = (regionName) => {
    navigate('/paywall');
  };

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="min-h-screen bg-navy-gradient flex flex-col items-center justify-center text-center p-4 overflow-hidden"
    >
      <motion.h1 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-4xl md:text-5xl font-bold mb-2 text-slate-100"
      >
        Reveal what's hidden
      </motion.h1>
      <motion.p 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-md md:text-lg text-slate-300 mb-6 md:mb-10"
      >
        Tap a region to explore hidden gems.
      </motion.p>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.7, type: 'spring', stiffness: 100 }}
        className="relative w-80 h-80 md:w-[450px] md:h-[450px]"
      >
        <img  
          className="w-full h-full object-contain filter brightness-100 saturate-110"
          alt="Map of Rhodes with clearly labeled regions"
         src="https://images.unsplash.com/photo-1603664920868-56aa7717b0aa" />
        
        {regions.map((region, index) => (
          <motion.button
            key={region.name}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 + index * 0.05, duration: 0.3 }}
            onClick={() => handleRegionClick(region.name)}
            className={`absolute ${region.position} px-2 py-1 bg-black/30 backdrop-blur-sm text-white text-xs md:text-sm rounded shadow-lg hover:bg-wr-blue/70 hover:scale-110 transition-all duration-200 transform -translate-x-1/2 -translate-y-1/2`}
            aria-label={`Explore ${region.name}`}
          >
            {region.name}
          </motion.button>
        ))}
      </motion.div>
      <footer className="absolute bottom-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Wander Rhodes. All rights reserved.</p>
      </footer>
    </motion.div>
  );
};

export default ChooseRegionPage;