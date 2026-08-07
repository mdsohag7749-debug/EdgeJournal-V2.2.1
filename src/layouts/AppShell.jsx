import { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DataProvider, useData } from '../context/DataContext';
import { AccountProvider } from '../context/AccountContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import LoadingScreen from '../components/LoadingScreen';
import OfflineBanner from '../components/OfflineBanner';
import { SyncPendingIndicator, SyncCompletedToast } from '../components/SyncStatus';
import InstallPrompt from '../components/InstallPrompt';
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
  return (
    <AccountProvider>
      <DataProvider>
        <AppShellContent />
      </DataProvider>
    </AccountProvider>
  );
}

// Split out so it can read `trades.loading`/`goals.loading`/`plans.loading`/
// `reflections.loading`/`study.loading` from DataContext — gates the
// shell behind the first Supabase fetch for each so pages never render
// a misleading empty state before real data arrives.
function AppShellContent() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760);
  const location = useLocation();
  const navigate = useNavigate();
  const { trades, goals, plans, reflections, study, challenges } = useData();

  // Auto-collapse the sidebar on phones/tablets even after the app has
  // mounted (rotation / window resize), so the nav never consumes the
  // whole screen. Only auto-COLLAPSES — if the user has manually expanded
  // the drawer on a small screen it stays expanded until they collapse it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onResize() {
      if (window.innerWidth < 760) setCollapsed(true);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Show the full-screen loader only on the very first data resolution.
  // After the app has loaded once, later re-loads (e.g. switching
  // accounts or a background refetch) update in place instead of flashing
  // a loader screen — this is what made navigation feel laggy/stuck.
  const anyLoading = trades.loading || goals.loading || plans.loading || reflections.loading || study.loading || challenges.loading;
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!anyLoading) setInitialized(true);
  }, [anyLoading]);

  // Watchdog: if a first fetch hangs (Supabase unreachable but the
  // request never rejects), the shell must NOT trap the user on the
  // loading screen forever. Force past the gate after 15s so the app
  // renders with whatever is already cached locally.
  useEffect(() => {
    const t = setTimeout(() => setInitialized(true), 15000);
    return () => clearTimeout(t);
  }, []);

  const activeRoute = routes.find((r) => r.path === location.pathname) || defaultRoute;

  function handleNavigate(id) {
    const target = routes.find((r) => r.id === id);
    if (target) navigate(target.path);
  }

  if (!initialized && anyLoading) {
    return <LoadingScreen message="Loading your trades, goals, plans, reflections, study notes, and challenges…" />;
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <OfflineBanner />
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          active={activeRoute.id}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <main id="main-content" className="app-main" style={{ flex: 1, minWidth: 0, padding: '28px 32px 60px' }}>
          {!activeRoute.hideHeader && <Header title={activeRoute.title} subtitle={activeRoute.subtitle} />}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {routes.map(({ path, Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <PageTransition>
                      <Suspense fallback={<LoadingScreen message="Loading page..." />}>
                        <Component onNavigate={handleNavigate} />
                      </Suspense>
                    </PageTransition>
                  }
                />
              ))}
              {/* Alias: login redirects here per spec; Dashboard itself
                  still lives at "/" so nothing about its route changes. */}
              <Route path="/dashboard" element={<Navigate to={defaultRoute.path} replace />} />
              <Route path="*" element={<Navigate to={defaultRoute.path} replace />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      <SyncPendingIndicator />
      <SyncCompletedToast />
      <InstallPrompt />
    </>
  );
}
