import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Pencil, Check, LogOut } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function Header({ title, subtitle }) {
  const { accountName, setAccountName } = useData();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(accountName);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  function save() {
    setAccountName(draft.trim() || 'My Trading Account');
    setEditing(false);
  }

  async function handleLogout() {
    // Real Supabase sign-out. The auth-state listener in AuthContext
    // will clear the session automatically; we also navigate explicitly
    // so the redirect to /login happens immediately.
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

        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              style={{
                background: 'var(--white)',
                border: '1.5px solid var(--border-strong)',
                borderRadius: 10,
                padding: '8px 12px',
                color: 'var(--text)',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            />
            <button className="btn btn-accent btn-icon btn-sm" onClick={save}>
              <Check size={14} />
            </button>
          </>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDraft(accountName);
              setEditing(true);
            }}
          >
            <span style={{ fontWeight: 700 }}>{accountName}</span>
            <Pencil size={13} />
          </button>
        )}

        <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Log out">
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </motion.div>
  );
}
