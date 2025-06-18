import React from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import HomePage       from './pages/HomePage';
import FeaturesPage   from './pages/FeaturesPage';
import ChatRegionPage from './pages/ChatPage';
import PaywallPage    from './pages/PaywallPage';
import ReturnPage     from './pages/ReturnPage'; // 👈 import the new page

// 1. Pure cross-fade variants
const pageVariants = {
  initial: { opacity: 0 },
  in:      { opacity: 1 },
  out:     { opacity: 0 }
};
// 2. Slow, smooth timing
const pageTransition = {
  duration: 0.8,
  ease: 'easeInOut'
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="sync" initial={false}>
      <Routes location={location} key={location.pathname}>
        {[
          { path: '/',         Component: HomePage       },
          { path: '/features', Component: FeaturesPage   },
          { path: '/chat',     Component: ChatRegionPage },
          { path: '/paywall',  Component: PaywallPage    },
          { path: '/return',   Component: ReturnPage     } // 👈 new route
        ].map(({ path, Component }) => (
          <Route
            key={path}
            path={path}
            element={
              <motion.div
                className="absolute inset-0"
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
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
      {/* sea-bg fixed under everything */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/sea-bg.png')" }}
      >
        <AnimatedRoutes />
      </div>
    </Router>
  );
}
