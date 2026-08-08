import { Routes, Route } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ProtectedRoute from './routes/ProtectedRoute';
import GuestRoute from './routes/GuestRoute';
import TradingCursor from './components/cursor/TradingCursor';

// Top-level router.
// - /login, /register, /forgot-password: standalone auth pages, guarded
//   by GuestRoute so an already-authenticated (auto-logged-in) visitor
//   skips straight to the dashboard instead of seeing the form again.
// - everything else: AppShell, guarded by ProtectedRoute so the whole
//   authenticated app is protected in one place.
export default function App() {
  return (
    <>
      <TradingCursor />
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
