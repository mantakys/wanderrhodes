import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Slider from 'react-slick';
import { motion } from 'framer-motion';
import { CheckCircle, Lock, ArrowLeft } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './PaywallPage.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const isDev = import.meta.env.DEV;

const fetchClientSecret = async () => {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // may return { url } or { clientSecret }
};

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
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleGetAccess = async () => {
    if (isUnlocking) return;
    setIsUnlocking(true);

    // unlock animation
    const animationDuration = unlockedFeatures.length * 150 + 500;
    await new Promise(r => setTimeout(r, animationDuration));

    // call backend
    const data = await fetchClientSecret().catch(err => {
      console.error(err);
      alert('Payment error');
      setIsUnlocking(false);
    });
    if (!data) return;

    if (isDev) {
      // redirect flow in dev
      window.location.href = data.url;
    } else {
      // embedded in prod
      setShowCheckout(true);
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

  return (
    <div className="paywall-container">
      <div className="header">
        <motion.button
          onClick={() => navigate('/')}
          className="back-btn"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <ArrowLeft />
        </motion.button>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Logo />
        </motion.div>
      </div>

      <div className="content">
        <motion.div
          className="card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {!showCheckout ? (
            <>
              <Slider {...carouselSettings} className="carousel">
                {images.map((img, i) => (
                  <div key={i} className="slide">
                    <img src={img.src} alt={img.caption} />
                    <div className="gradient" />
                    <p className="caption">{img.caption}</p>
                  </div>
                ))}
              </Slider>

              <div className="details">
                <h1>Unlock Everything</h1>
                <ul className="features">
                  {unlockedFeatures.map((feature, i) => (
                    <li key={i}>
                      <motion.span
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {isUnlocking
                          ? <CheckCircle className="icon unlocked" />
                          : <Lock className="icon locked" />}
                      </motion.span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  className="cta-btn"
                  onClick={handleGetAccess}
                  disabled={isUnlocking}
                >
                  {isUnlocking
                    ? <div className="spinner" />
                    : <>
                        <Lock /> Get Instant Access — €3.49
                      </>}
                </button>
                <p className="small">A one-time secure payment. No subscriptions.</p>
              </div>
            </>
          ) : (
            <div className="checkout-wrapper">
              <h2>Complete Your Purchase</h2>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout className="embedded-checkout" />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
