import { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DataProvider } from '../context/DataContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { routes, defaultRoute } from '../routes/routes';

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// The authenticated application shell: Sidebar + Header + the main
// dashboard/journal/etc. page tree. Everything under this shell shares
// the data store (DataProvider) and the persistent nav chrome.
// Auth pages (Login/Register/ForgotPassword) live outside this shell
// entirely — see src/App.jsx.
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const activeRoute = routes.find((r) => r.path === location.pathname) || defaultRoute;

  function handleNavigate(id) {
    const target = routes.find((r) => r.id === id);
    if (target) navigate(target.path);
  }

  return (
    <DataProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          active={activeRoute.id}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 60px' }}>
          {!activeRoute.hideHeader && <Header title={activeRoute.title} subtitle={activeRoute.subtitle} />}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {routes.map(({ path, Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <PageTransition>
                      <Component onNavigate={handleNavigate} />
                    </PageTransition>
                  }
                />
              ))}
              <Route path="*" element={<Navigate to={defaultRoute.path} replace />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </DataProvider>
  );
}
