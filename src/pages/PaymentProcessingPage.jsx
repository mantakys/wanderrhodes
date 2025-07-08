import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@/components/ThemeProvider';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function PaymentProcessingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useUser();
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'timeout'
  const [timeLeft, setTimeLeft] = useState(30); // 30 second timeout
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      navigate('/paywall');
      return;
    }

    const maxAttempts = 30; // Try for 30 seconds
    let intervalId;
    let timeoutId;

    const checkPaymentStatus = async () => {
      if (attempts >= maxAttempts) {
        setStatus('timeout');
        return;
      }

      try {
        const res = await fetch(`/api/session-status?session_id=${sessionId}`);
        if (!res.ok) throw new Error('Failed to check payment status');
        
        const data = await res.json();
        
        if (data.status === 'complete') {
          // Refresh user data to check if webhook has processed payment
          await refreshUser();
          
          // Check if user is now marked as paid
          const userRes = await fetch('/api/me', {
            credentials: 'include' // Required to send cookies with the request
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.user && userData.user.has_paid) {
              setStatus('success');
              // Redirect to chat after a short delay
              setTimeout(() => {
                navigate('/chat');
              }, 2000);
              return;
            }
          }
        }
        
        setAttempts(prev => prev + 1);
      } catch (err) {
        console.error('Error checking payment status:', err);
        setAttempts(prev => prev + 1);
      }
    };

    // Check immediately
    checkPaymentStatus();

    // Set up interval to check every second
    intervalId = setInterval(checkPaymentStatus, 1000);

    // Set up countdown timer
    const countdownId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (countdownId) clearInterval(countdownId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [searchParams, refreshUser, navigate, attempts]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto px-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-6"
          >
            <Loader2 className="w-16 h-16 text-[#E8D5A4]" />
          </motion.div>
          
          <h1 className="text-2xl font-bold mb-4">Processing Your Payment</h1>
          <p className="text-white/70 mb-6">
            Your payment was received by Stripe. We're now verifying it through our secure webhook system.
          </p>
          
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-blue-400 mr-2" />
              <span className="text-blue-400 font-semibold">Verification in progress</span>
            </div>
            <p className="text-white/70 text-sm">
              This usually takes a few seconds. Time remaining: <span className="font-mono">{timeLeft}s</span>
            </p>
          </div>
          
          <p className="text-white/50 text-sm">
            Attempt {attempts + 1} of 30
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto px-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mb-6"
          >
            <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl font-bold mb-4">Payment Verified!</h1>
            <p className="text-white/70 mb-6">
              Your payment has been successfully verified. Welcome to WanderRhodes!
            </p>
            
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-400 font-semibold">Redirecting you to chat...</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
      <div className="text-center text-white max-w-md mx-auto px-4">
        <div className="mb-6">
          <Logo className="text-4xl mx-auto mb-4" />
        </div>
        
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mb-6"
        >
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        </motion.div>
        
        <h1 className="text-2xl font-bold mb-4">Payment Verification Timeout</h1>
        <p className="text-white/70 mb-6">
          Your payment is being processed but verification is taking longer than expected. 
          Don't worry - if you paid, you'll receive access once our system confirms the payment.
        </p>
        
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-400 mb-2">What happens next?</h3>
          <ul className="text-white/70 text-sm text-left space-y-1">
            <li>• If you paid, you'll receive an email confirmation</li>
            <li>• Your access will be activated automatically</li>
            <li>• You can check your account status anytime</li>
          </ul>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-[#E8D5A4] text-[#1a1a2e] font-semibold rounded-lg hover:bg-[#CAB17B] transition-colors"
          >
            Check Again
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  );
} 