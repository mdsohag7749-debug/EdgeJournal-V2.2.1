import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

// Guard for the /admin subtree.
// 1. While auth session or profile role is loading: show loading screen to prevent flash of redirect.
// 2. Unauthenticated: redirect to /login (preserving destination in location state).
// 3. Authenticated but role != 'admin': redirect safely to main application (/), preventing access.
// 4. Authorized admin (role === 'admin'): render admin children.
export default function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, profileLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading || profileLoading) {
    return <LoadingScreen message="Verifying administrative access…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
