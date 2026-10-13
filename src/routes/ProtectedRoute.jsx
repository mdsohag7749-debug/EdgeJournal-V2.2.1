import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps any protected subtree. While Supabase is still checking for a
// persisted session (isLoading), let the shared startup loader stay visible instead of
// redirecting — this is what allows auto-login to work on refresh
// without a flash of the login page. Once resolved: not authenticated ->
// redirect to /login (remembering where the visitor was headed).
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
