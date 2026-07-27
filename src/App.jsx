import { Routes, Route } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ProtectedRoute from './routes/ProtectedRoute';

// Top-level router: authentication pages render standalone (no Sidebar/
// Header, no data store, no auth guard). Every other page falls through
// to AppShell, wrapped in a single ProtectedRoute — this protects the
// whole authenticated app (dashboard, journal, etc.) in one place rather
// than guarding each page individually.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
