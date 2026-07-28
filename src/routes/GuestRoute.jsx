import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

// Wraps Login/Register/ForgotPassword. If Supabase already has a
// persisted session (auto login), skip the form entirely and go
// straight to the dashboard instead of asking the visitor to sign in
// again.
export default function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
