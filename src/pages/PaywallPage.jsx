import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Slider from 'react-slick';
import {
  MessageCircle,
  Compass,
  Calendar,
  Info
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import Logo from '../components/ui/Logo';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// ✅ Use your real publishable key here
const stripePromise = loadStripe('pk_live_51RXoMyGWCBowuVLxxYE8ZUpnScJMWKETs9TbbRUvV4aaKCousC2kh9XLa38JehuDPpAzhfu3i98B5a9YmHpdRjHc00NmygCVNK');

export default function PaywallPage() {
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const expired = timeLeft <= 0;

  useEffect(() => {
    if (!expired) {
      fetch('http://localhost:4242/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(res => res.json())
        .then(data => {
          console.log("✅ clientSecret:", data.clientSecret);
          setClientSecret(data.clientSecret);
        })
        .catch(err => console.error("❌ fetch error:", err));
    }
  }, [expired]);

  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');

  const images = [
    { src: '/assets/secret-beach.jpg', caption: 'AI reveals this secret cove' },
    { src: '/assets/hidden-taverna.png', caption: 'AI guides you to hidden tavernas' },
    { src: '/assets/sunset-view.webp', caption: 'AI plans your perfect sunset view' },
    { src: '/assets/lost-ruins.jpg', caption: 'AI uncovers lost ruins' }
  ];

  const carouselSettings = {
    dots: true,
    infinite: true,
    autoplay: true,
    arrows: false,
    speed: 600,
    autoplaySpeed: 3500
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center p-4 text-white"
      style={{
        backgroundImage: "url('/sea-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="pt-6 cursor-pointer" onClick={() => navigate('/')}>
        <Logo />
      </div>

      <div className="w-full max-w-md mt-8">
        <Slider {...carouselSettings}>
          {images.map((img, i) => (
            <div key={i} className="px-1">
              <img
                src={img.src}
                alt={img.caption}
                className="rounded-lg w-full h-48 object-cover shadow-lg"
              />
              <p className="mt-2 text-center text-sm drop-shadow-sm">{img.caption}</p>
            </div>
          ))}
        </Slider>
      </div>

      <h1 className="font-serif text-3xl mt-8 drop-shadow-lg">
        Chat with Rhodes AI Expert
      </h1>
      <p className="font-sans text-lg drop-shadow-md text-center">
        Unlock personalized local knowledge and hidden spots—no apps, no accounts.
      </p>

      {!expired && (
        <span className="mt-4 inline-block bg-[#F4E1C1]/80 px-4 py-1 rounded-full text-sm text-[#3E2F1B] animate-pulse">
          Intro offer ends in <strong>{minutes}:{seconds}</strong>
        </span>
      )}

      {!expired && clientSecret && (
        <div className="w-full max-w-md mt-6 bg-white p-4 rounded shadow-lg text-black">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}

      {expired && (
        <button disabled className="mt-6 w-full max-w-xs py-4 rounded-full bg-gray-500 text-gray-200 text-lg cursor-not-allowed">
          Offer Expired
        </button>
      )}

      <div className="grid grid-cols-2 gap-6 mt-8 max-w-xs text-center">
        {[
          { Icon: MessageCircle, label: 'AI Chat' },
          { Icon: Compass, label: 'Local Tips' },
          { Icon: Calendar, label: 'Day Plans' },
          { Icon: Info, label: 'Insider Info' }
        ].map(({ Icon, label }, i) => (
          <div key={i} className="flex flex-col items-center">
            <Icon className="h-6 w-6 text-[#F4E1C1] mb-1" />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>

      <footer className="mt-auto py-4 text-center text-xs text-slate-300">
        Secured by Stripe • No account required • Instant access
      </footer>
    </div>
  );
}
