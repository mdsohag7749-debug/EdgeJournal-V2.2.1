import { Loader2 } from 'lucide-react';

// Shown for two brief moments only: while Supabase checks for a
// persisted session (AuthContext.isLoading, used by ProtectedRoute /
// GuestRoute) and while the first Supabase trades fetch is in flight
// (DataContext's trades.loading, used by AppShell). Keeps either check
// from flashing an empty/incorrect state before real data arrives.
export default function LoadingScreen({ message = 'Loading EdgeJournal…' }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text-muted)',
        gap: 10,
      }}
    >
      <Loader2 size={18} className="auth-spin" color="var(--red)" />
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{message}</span>
    </div>
  );
}
