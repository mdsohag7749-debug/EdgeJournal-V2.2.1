import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, SlidersHorizontal, User, ChevronRight } from 'lucide-react';
import AccountsManager from '../components/accounts/AccountsManager';

// Settings hub. "Accounts" is the primary section (rendered inline with
// the full account-management feature); System and Profile are quick
// entries that keep using their existing dedicated pages, so they never
// drift out of sync with the rest of the app.

const SECTIONS = [
  { key: 'accounts', label: 'Accounts', icon: Wallet },
  { key: 'system', label: 'System', icon: SlidersHorizontal, to: '/system' },
  { key: 'profile', label: 'Profile', icon: User, to: '/profile' },
];

export default function Settings() {
  const navigate = useNavigate();
  const [active, setActive] = useState('accounts');

  function handleSection(sec) {
    setActive(sec.key);
    if (sec.to) navigate(sec.to);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Manage your accounts and app configuration</p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Section rail */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = active === sec.key;
            return (
              <button
                key={sec.key}
                onClick={() => handleSection(sec)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid transparent',
                  background: isActive ? 'var(--red-glow)' : 'transparent',
                  borderColor: isActive ? 'rgba(193,18,31,0.3)' : 'var(--border)',
                  color: isActive ? 'var(--red)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span style={{ flex: 1 }}>{sec.label}</span>
                {sec.to && <ChevronRight size={14} />}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <motion.div
          layout
          style={{ flex: 1, minWidth: 0, maxWidth: 1200 }}
        >
          <AccountsManager />
        </motion.div>
      </div>
    </div>
  );
}