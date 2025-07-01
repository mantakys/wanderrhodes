import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '../components/ui/Logo';
import { useUser } from '@/components/ThemeProvider';
import { toast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useUser();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const hasVerifiedRef = useRef(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No token provided');
      return;
    }

    // Prevent multiple verification attempts
    if (hasVerifiedRef.current) {
      console.log('🚫 Token already verified, skipping...');
      return;
    }

    console.log('🔄 Starting token verification...');
    hasVerifiedRef.current = true;
    verifyToken(token);
  }, [token]);

  const verifyToken = async (token) => {
    console.log('🔍 Verifying token:', token);
    
    try {
      const res = await fetch('/api/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      console.log('📡 Verify response status:', res.status);
      
      let data;
      try {
        data = await res.json();
        console.log('📡 Verify response data:', data);
      } catch (e) {
        console.error('❌ Failed to parse response JSON:', e);
        data = {};
      }

      if (res.ok) {
        setStatus('success');
        setMessage('Successfully logged in!');
        
        console.log('🔄 Refreshing user data...');
        // Refresh user data to get updated authentication status
        await refreshUser();
        console.log('✅ User data refreshed');
        
        toast({
          title: "Welcome back! 🎉",
          description: "You have been successfully logged in.",
          duration: 4000,
        });

        // Redirect to home after a brief delay
        setTimeout(() => {
          console.log('🏠 Redirecting to homepage...');
          navigate('/', { replace: true });
        }, 2000);
      } else {
        console.error('❌ Login verification failed:', data);
        
        // If the error is "Invalid or expired token", it might mean the token was already used
        // Let's check if we're actually logged in now
        console.log('🔄 Checking if login actually succeeded despite error response...');
        await refreshUser();
        
        // Wait a bit for the user context to update
        setTimeout(async () => {
          await refreshUser();
          console.log('🔍 Final user check after refresh');
        }, 1000);
        
        setStatus('error');
        setMessage(data.error || 'Invalid or expired login link');
      }
    } catch (err) {
      console.error('❌ Network error during login verification:', err);
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  // If user is already authenticated, redirect to home
  useEffect(() => {
    if (user && status === 'verifying') {
      navigate('/', { replace: true });
    }
  }, [user, navigate, status]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 bg-cover bg-center bg-[url('/sea-bg.png')] lg:bg-[url('/sea-bg-dp.png')]">
      <motion.div
        className="text-center max-w-md mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Logo />
        </motion.div>

        {/* Status Card */}
        <motion.div
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {status === 'verifying' && (
            <div className="text-center">
              <div className="mb-4">
                <Loader className="w-12 h-12 text-blue-400 mx-auto animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Verifying Login
              </h2>
              <p className="text-white/70">
                Please wait while we verify your magic link...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mb-4">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              </div>
              <h2 className="text-xl font-semibold text-green-100 mb-2">
                Login Successful!
              </h2>
              <p className="text-green-200/80 mb-4">
                {message}
              </p>
              <p className="text-white/60 text-sm">
                Redirecting you to the homepage...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mb-4">
                <XCircle className="w-12 h-12 text-red-400 mx-auto" />
              </div>
              <h2 className="text-xl font-semibold text-red-100 mb-2">
                Login Failed
              </h2>
              <p className="text-red-200/80 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                >
                  Go to Homepage
                </button>
                <p className="text-white/60 text-sm">
                  You can request a new magic link from the homepage
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-white/40 text-sm">
            Secure login powered by magic links ✨
          </p>
        </motion.div>
      </motion.div>

      <Toaster />
    </div>
  );
} 