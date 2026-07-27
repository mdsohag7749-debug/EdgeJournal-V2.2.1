import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps any protected subtree. Not authenticated -> redirect to /login,
// remembering where the visitor was headed so it could be resumed later
// (not required by the current spec, but harmless and future-friendly).
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
