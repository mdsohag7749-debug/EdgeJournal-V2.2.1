import { Loader2 } from 'lucide-react';

// Shown only for the brief moment while Supabase checks for a persisted
// session (see AuthContext's isLoading). Keeps ProtectedRoute from
// redirecting to /login before auto-login has had a chance to resolve.
export default function AuthLoading() {
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
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>Loading EdgeJournal…</span>
    </div>
  );
}
