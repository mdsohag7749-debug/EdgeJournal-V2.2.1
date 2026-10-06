import { Routes, Route, useLocation } from 'react-router-dom';
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

  return (
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
  );
}
