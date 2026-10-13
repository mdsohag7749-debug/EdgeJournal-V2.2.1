import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Bell, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AccountSwitcher from './accounts/AccountSwitcher';

export default function Header({ title, subtitle }) {
  const { logout, user, profile } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const userName = profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Trader';

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleSearchClick() {
    navigate('/journal');
  }

  return (
    <motion.header
      className="app-header"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 26,
        paddingBottom: 4,
      }}
    >
      {/* Title & Subtitle */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Right Controls & Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Quick Search Bar (inspired by design reference) */}
        <button
          type="button"
          className="header-search"
          onClick={handleSearchClick}
          aria-label="Search symbols or trades"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 14px',
            borderRadius: 999,
            background: 'rgba(13, 20, 36, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'var(--text-muted)',
            fontSize: 12.5,
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(66, 217, 255, 0.3)';
            e.currentTarget.style.background = 'rgba(18, 28, 50, 0.75)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.background = 'rgba(13, 20, 36, 0.65)';
          }}
        >
          <Search size={14} color="#42d9ff" />
          <span style={{ color: 'var(--text-faint)' }}>Search symbols, trades…</span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              padding: '2px 5px',
              borderRadius: 5,
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-faint)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            ⌘K
          </span>
        </button>

        {/* Date & Market Status pill */}
        <span
          className="header-date-pill"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontWeight: 600,
            padding: '7px 13px',
            background: 'rgba(13, 20, 36, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
          }}
        >
          <Calendar size={13} color="var(--text-faint)" />
          {today}
        </span>

        {/* Notifications Icon Button */}
        <button
          type="button"
          className="header-icon-button"
          onClick={() => navigate('/challenges')}
          title="Notifications & Challenges"
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'rgba(13, 20, 36, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(66, 217, 255, 0.3)';
            e.currentTarget.style.color = '#42d9ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <Bell size={15} />
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 8,
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#42d9ff',
              boxShadow: '0 0 6px #42d9ff',
            }}
          />
        </button>

        {/* Account Switcher */}
        <AccountSwitcher />

        {/* User Pill / Logout */}
        <div
          className="header-user-surface"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 6px 4px 10px',
            background: 'rgba(13, 20, 36, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 999,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text)',
            }}
            title="View Profile"
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(66, 217, 255, 0.25), rgba(54, 224, 192, 0.25))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#42d9ff',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="Log out"
            style={{
              padding: '4px 8px',
              fontSize: 11.5,
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
