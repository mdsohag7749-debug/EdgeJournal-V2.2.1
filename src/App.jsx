import { Routes, Route, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import { MotionConfig } from 'framer-motion';
import AppShell from './layouts/AppShell';
import AdminShell from './layouts/AdminShell';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import GuestRoute from './routes/GuestRoute';
import TradingCursor from './components/cursor/TradingCursor';

// Top-level router.
// - /login, /register, /forgot-password: standalone auth pages, guarded
//   by GuestRoute so an already-authenticated (auto-logged-in) visitor
//   skips straight to the dashboard instead of seeing the form again.
// - /admin/*: Admin Panel shell, guarded by AdminRoute (Phase 1 security foundation).
// - everything else: AppShell, guarded by ProtectedRoute so the whole
//   authenticated app is protected in one place.
export default function App() {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const markWorkspaceReady = useCallback(() => setWorkspaceReady(true), []);
  const isGuestPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const showStartupLoader = !isGuestPage && !location.pathname.startsWith('/admin')
    && (authLoading || (isAuthenticated && !workspaceReady));
  useEffect(() => {
    if (!isAuthenticated) setWorkspaceReady(false);
  }, [isAuthenticated]);

  const showTradingCursor = location.pathname === '/login';
  const [graphicsMode, setGraphicsMode] = useState(() => {
    try {
      const savedMode = window.localStorage.getItem('edgejournal-graphics-mode');
      return ['low', 'high', 'ultra', 'ultra-water'].includes(savedMode) ? savedMode : 'high';
    } catch {
      return 'high';
    }
  });
  const [waterGlassTransparent, setWaterGlassTransparent] = useState(() => {
    try {
      return window.localStorage.getItem('edgejournal-water-glass-transparent') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.graphicsMode = graphicsMode;
  }, [graphicsMode]);

  useEffect(() => {
    document.documentElement.dataset.waterGlassTransparent = String(waterGlassTransparent);
  }, [waterGlassTransparent]);

  useEffect(() => {
    const normalizeMode = (value) => (['low', 'ultra', 'ultra-water'].includes(value) ? value : 'high');
    const onGraphicsModeChange = (event) => setGraphicsMode(normalizeMode(event.detail));
    const syncGraphicsMode = (event) => {
      if (event.key === 'edgejournal-graphics-mode') setGraphicsMode(normalizeMode(event.newValue));
    };
    const onWaterGlassTransparentChange = (event) => setWaterGlassTransparent(Boolean(event.detail));
    const syncWaterGlassTransparent = (event) => {
      if (event.key === 'edgejournal-water-glass-transparent') setWaterGlassTransparent(event.newValue === 'true');
    };
    window.addEventListener('edgejournal-graphics-mode-change', onGraphicsModeChange);
    window.addEventListener('storage', syncGraphicsMode);
    window.addEventListener('edgejournal-water-glass-transparent-change', onWaterGlassTransparentChange);
    window.addEventListener('storage', syncWaterGlassTransparent);
    return () => {
      window.removeEventListener('edgejournal-graphics-mode-change', onGraphicsModeChange);
      window.removeEventListener('storage', syncGraphicsMode);
      window.removeEventListener('edgejournal-water-glass-transparent-change', onWaterGlassTransparentChange);
      window.removeEventListener('storage', syncWaterGlassTransparent);
    };
  }, []);

  return (
    <MotionConfig reducedMotion={graphicsMode === 'low' ? 'always' : 'never'} transition={graphicsMode === 'low' ? { duration: 0 } : undefined}>
      <>
        {showTradingCursor && <TradingCursor />}
        {showStartupLoader && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', background: 'rgba(8, 12, 22, 0.96)' }}>
            <LoadingScreen message="Loading your trading desk…" />
          </div>
        )}
        <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <AdminShell />
            </AdminRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell onInitialReady={markWorkspaceReady} />
            </ProtectedRoute>
          }
        />
        </Routes>
      </>
    </MotionConfig>
  );
}
