import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { lazy } from 'react';

import HomePage       from './pages/HomePage';
import FeaturesPage   from './pages/FeaturesPage';
import ChatRegionPage from './pages/ChatPage';
import PaywallPage    from './pages/PaywallPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentProcessingPage from './pages/PaymentProcessingPage';
import TravelPlansPage from './pages/TravelPlansPage';
import TravelPlanViewPage from './pages/TravelPlanViewPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));

// Wrapper components for protected routes
const ProtectedChatPage = () => (
  <ProtectedRoute requirePaid={false} requireAuth={false}>
    <ChatRegionPage />
  </ProtectedRoute>
);

const ProtectedTravelPlansPage = () => (
  <ProtectedRoute requirePaid={false} requireAuth={false}>
    <TravelPlansPage />
  </ProtectedRoute>
);

const ProtectedTravelPlanViewPage = () => (
  <ProtectedRoute requirePaid={true} requireAuth={true}>
    <TravelPlanViewPage />
  </ProtectedRoute>
);

// iOS-style depth transition
const pageVariants = {
  initial: { opacity: 0, scale: 0.96 },
  in: { opacity: 1, scale: 1 },
  out: { opacity: 0, scale: 1.04 },
};

const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

// 404 component for production
const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center text-white">
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl mb-4">Page not found</p>
      <button 
        onClick={() => window.history.back()} 
        className="px-4 py-2 bg-[#E8D5A4] text-[#242b50] rounded-lg hover:bg-[#CAB17B] transition"
      >
        Go Back
      </button>
    </div>
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();
  
  // Debug environment mode
  console.log('Current environment mode:', import.meta.env.MODE);
  console.log('Is development?', import.meta.env.DEV);

  const routes = [
    { path: '/', element: HomePage },
    { path: '/features', element: FeaturesPage },
    { path: '/chat', element: ProtectedChatPage },
    { path: '/paywall', element: PaywallPage },
    { path: '/payment-success', element: PaymentSuccessPage },
    { path: '/payment-processing', element: PaymentProcessingPage },
    { path: '/login', element: LoginPage },
    { path: '/plans', element: ProtectedTravelPlansPage },
    { path: '/plans/:id', element: ProtectedTravelPlanViewPage },
    ...(import.meta.env.DEV ? [
      { path: '/admin/users', element: AdminUsersPage }
    ] : [
      { path: '/admin/users', element: NotFoundPage }
    ]),
  ];

  console.log('Available routes:', routes.map(r => r.path));

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {routes.map(({ path, element: Component }) => (
          <Route
            key={path}
            path={path}
            element={
              <motion.div
                className="absolute inset-0"
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={pageTransition}
              >
                <Component />
              </motion.div>
            }
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      {/* Persistent sea background */}
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/sea-bg.png')" }} />
      {/* Route container above background */}
      <div className="relative min-h-screen overflow-hidden">
        <AnimatedRoutes />
      </div>
    </Router>
  );
}
