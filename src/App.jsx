import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { lazy } from 'react';

import HomePage       from './pages/HomePage';
import FeaturesPage   from './pages/FeaturesPage';
import ChatRegionPage from './pages/ChatPage';
import PaywallPage    from './pages/PaywallPage';
import TravelPlansPage from './pages/TravelPlansPage';
import TravelPlanViewPage from './pages/TravelPlanViewPage';
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));

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

function AnimatedRoutes() {
  const location = useLocation();

  const routes = [
    { path: '/', element: HomePage },
    { path: '/features', element: FeaturesPage },
    { path: '/chat', element: ChatRegionPage },
    { path: '/paywall', element: PaywallPage },
    { path: '/plans', element: TravelPlansPage },
    { path: '/plans/:id', element: TravelPlanViewPage },
    ...(import.meta.env.MODE !== 'production' ? [
      { path: '/admin/users', element: AdminUsersPage }
    ] : []),
  ];

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
