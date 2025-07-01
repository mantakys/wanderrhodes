import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@/components/ThemeProvider';

export default function ProtectedRoute({ children, requirePaid = false, requireAuth = false }) {
  const { user, loading } = useUser();

  // Show loading spinner while fetching user data
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8D5A4] mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If route requires authentication and user is not authenticated, redirect to paywall
  if (requireAuth && !user) {
    return <Navigate to="/paywall" replace />;
  }

  // If route requires paid status and user hasn't paid, redirect to paywall
  if (requirePaid && !user?.has_paid) {
    return <Navigate to="/paywall" replace />;
  }

  // User meets requirements, render the protected content
  return <>{children}</>;
} 