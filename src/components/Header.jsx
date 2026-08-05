import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AccountSwitcher from './accounts/AccountSwitcher';

export default function Header({ title, subtitle }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  async function handleLogout() {
    // Real Supabase sign-out. The auth-state listener in AuthContext
    // clears the session automatically; we also navigate explicitly so
    // the redirect to /login happens immediately.
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{title}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 5 }}>{subtitle || today}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--text-faint)',
            fontWeight: 600,
            padding: '8px 14px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          {today}
        </span>

        <AccountSwitcher />

        <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Log out">
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </motion.div>
  );
}