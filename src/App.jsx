import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  const showTradingCursor = location.pathname === '/login';
  const [graphicsMode, setGraphicsMode] = useState(() => {
    try {
      const savedMode = window.localStorage.getItem('edgejournal-graphics-mode');
      return ['low', 'high', 'ultra'].includes(savedMode) ? savedMode : 'high';
    } catch {
      return 'high';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.graphicsMode = graphicsMode;
  }, [graphicsMode]);

  useEffect(() => {
    const normalizeMode = (value) => (['low', 'ultra'].includes(value) ? value : 'high');
    const onGraphicsModeChange = (event) => setGraphicsMode(normalizeMode(event.detail));
    const syncGraphicsMode = (event) => {
      if (event.key === 'edgejournal-graphics-mode') setGraphicsMode(normalizeMode(event.newValue));
    };
    window.addEventListener('edgejournal-graphics-mode-change', onGraphicsModeChange);
    window.addEventListener('storage', syncGraphicsMode);
    return () => {
      window.removeEventListener('edgejournal-graphics-mode-change', onGraphicsModeChange);
      window.removeEventListener('storage', syncGraphicsMode);
    };
  }, []);

  return (
    <MotionConfig reducedMotion={graphicsMode === 'low' ? 'always' : 'never'} transition={graphicsMode === 'low' ? { duration: 0 } : undefined}>
      <>
        {showTradingCursor && <TradingCursor />}
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
              <AppShell />
            </ProtectedRoute>
          }
        />
        </Routes>
      </>
    </MotionConfig>
  );
}
