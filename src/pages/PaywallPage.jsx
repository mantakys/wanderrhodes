import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Slider from 'react-slick';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Lock, ArrowLeft } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './PaywallPage.css';

const stripePromise = loadStripe('pk_live_51RXoMyGWCBowuVLxxYE8ZUpnScJMWKETs9TbbRUvV4aaKCousC2kh9XLa38JehuDPpAzhfu3i98B5a9YmHpdRjHc00NmygCVNK');

const images = [
  { src: '/assets/secret-beach.jpg', caption: 'Explore breathtaking secret beaches' },
  { src: '/assets/hidden-taverna.png', caption: 'Find authentic, hidden tavernas' },
  { src: '/assets/sunset-view.webp', caption: 'Discover unforgettable sunset spots' },
  { src: '/assets/lost-ruins.jpg', caption: 'Uncover mysterious ancient ruins' }
];

const unlockedFeatures = [
  "AI-powered chat with local experts",
  "Access to 100+ hidden gems",
  "Personalized day-trip itineraries",
  "Real-time tips on food, culture & events",
  "A one-time payment, lifetime access",
];

export default function PaywallPage() {
  const navigate = useNavigate();
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleGetAccess = async () => {
    if (isUnlocking) return;

    setIsUnlocking(true);

    const fetchPromise = fetch('http://localhost:4242/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        return data.clientSecret;
      })
      .catch((err) => {
        console.error('Stripe Checkout Error:', err);
        setIsUnlocking(false);
        return null;
      });

    const animationDuration = unlockedFeatures.length * 150 + 500;
    const minAnimationTime = new Promise(resolve => setTimeout(resolve, animationDuration));

    const [secret] = await Promise.all([fetchPromise, minAnimationTime]);

    if (secret) {
      setIsCheckoutVisible(true);
    }
  };

  const carouselSettings = {
    dots: false,
    infinite: true,
    autoplay: true,
    arrows: false,
    speed: 1000,
    autoplaySpeed: 3000,
    fade: true,
  };

  const featureListVariants = {
    hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const featureItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div
      className="h-screen w-full flex flex-col text-white overflow-hidden"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        maxWidth: '500px',
        maxHeight: '1000px',
        margin: '0 auto',
      }}
    >
      <div className="w-full pt-8 px-6 flex items-center gap-4 z-10">
        <motion.button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </motion.button>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
        >
          <Logo />
        </motion.div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-sm bg-black/50 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
        >
          <AnimatePresence>
            {!isCheckoutVisible && (
              <motion.div
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Slider {...carouselSettings}>
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <img
                        src={img.src}
                        alt="Rhodes scenery"
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                      <p className="absolute bottom-4 w-full text-center text-sm font-medium text-white drop-shadow-md px-2">
                        {img.caption}
                      </p>
                    </div>
                  ))}
                </Slider>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {!isCheckoutVisible ? (
                <motion.div
                  key="offer-details"
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <h1 
                    className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent"
                  >
                    Unlock Everything
                  </h1>

                  <motion.div 
                    className="space-y-3 mb-6"
                    variants={featureListVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {unlockedFeatures.map((feature, i) => (
                      <motion.div 
                        key={feature} 
                        className="flex items-center gap-3"
                        variants={featureItemVariants}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={isUnlocking ? `check-${i}` : `lock-${i}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.1 }}}
                            exit={{ opacity: 0, scale: 0.5 }}
                          >
                            {isUnlocking ? (
                              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                            ) : (
                              <Lock className="h-5 w-5 text-white/40 flex-shrink-0" />
                            )}
                          </motion.div>
                        </AnimatePresence>
                        <span className="text-sm text-white/80">{feature}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                  
                  <motion.button
                    className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white transition-all duration-300 shadow-lg flex items-center justify-center"
                    whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(255, 165, 0, 0.6)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGetAccess}
                    disabled={isUnlocking}
                  >
                    {isUnlocking ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <Lock size={18} />
                        <span>Get Instant Access — €3.49</span>
                      </div>
                    )}
                  </motion.button>
                  
                  <p className="text-center text-xs text-white/50 mt-4">
                    A one-time secure payment. No subscriptions.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="checkout"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <h1 className="text-xl font-bold text-center mb-4 text-white">
                    Complete Your Purchase
                  </h1>
                  {clientSecret ? (
                    <div id="checkout">
                      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                        <EmbeddedCheckout className="stripe-checkout" />
                      </EmbeddedCheckoutProvider>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-white/60">Something went wrong. Please try again.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
