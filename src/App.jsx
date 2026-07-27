import { Routes, Route } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Top-level router: authentication pages render standalone (no Sidebar/
// Header, no data store); everything else falls through to AppShell,
// which owns the authenticated app's nav chrome and its own nested routes.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
