import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@/components/ThemeProvider';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useUser();
  const [status, setStatus] = useState('checking'); // 'checking', 'success', 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setError('No session ID found');
      setStatus('error');
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const res = await fetch(`/api/session-status?session_id=${sessionId}`);
        if (!res.ok) throw new Error('Failed to check payment status');
        
        const data = await res.json();
        
        if (data.status === 'complete') {
          // Payment was successful, refresh user data
          await refreshUser();
          setStatus('success');
          
          // Redirect to chat after a short delay
          setTimeout(() => {
            navigate('/chat');
          }, 2000);
        } else {
          setError('Payment not completed');
          setStatus('error');
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    checkPaymentStatus();
  }, [searchParams, refreshUser, navigate]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
        <div className="text-center text-white">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-4"
          >
            <Loader2 className="w-12 h-12 text-[#E8D5A4]" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Processing Payment...</h1>
          <p className="text-white/70">Please wait while we confirm your payment.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto px-4">
          <div className="mb-6">
            <Logo className="text-4xl mx-auto mb-4" />
          </div>
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6 mb-6">
            <h1 className="text-xl font-bold mb-2 text-red-400">Payment Error</h1>
            <p className="text-white/70 mb-4">{error || 'Something went wrong with your payment.'}</p>
          </div>
          <button
            onClick={() => navigate('/paywall')}
            className="px-6 py-3 bg-[#E8D5A4] text-[#1a1a2e] font-semibold rounded-lg hover:bg-[#CAB17B] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
          <p className="text-white/70 mb-6">
            Welcome to WanderRhodes! You now have unlimited access to our AI travel assistant.
          </p>
          
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
            <p className="text-green-400 font-semibold">Redirecting you to chat...</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 