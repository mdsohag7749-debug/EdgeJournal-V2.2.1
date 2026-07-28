import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

// Wraps any protected subtree. While Supabase is still checking for a
// persisted session (isLoading), show a brief loading state instead of
// redirecting — this is what allows auto-login to work on refresh
// without a flash of the login page. Once resolved: not authenticated ->
// redirect to /login (remembering where the visitor was headed).
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
