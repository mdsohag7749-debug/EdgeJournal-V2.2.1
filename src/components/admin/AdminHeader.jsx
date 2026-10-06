import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Bell, Menu, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminHeader({ title = 'Overview', subtitle = 'Platform health and operational telemetry', onOpenMobile }) {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  const adminName = profile?.fullName || user?.user_metadata?.full_name || 'Administrator';
  const adminEmail = profile?.email || user?.email || 'admin@edgejournal.com';
  const initials = adminName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'AD';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        paddingBottom: 20,
        marginBottom: 24,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onOpenMobile && (
          <button
            onClick={onOpenMobile}
            className="btn btn-ghost btn-sm admin-mobile-menu-btn"
            aria-label="Open navigation menu"
            style={{ padding: '8px' }}
          >
            <Menu size={18} />
          </button>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {title}
            </h1>
            <span
              className="tag tag-red"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ShieldCheck size={12} />
              Admin
            </span>
          </div>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Quick Link to Trader App */}
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm"
          title="Return to trader workspace"
          style={{
            fontSize: 12.5,
            padding: '7px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            gap: 6,
          }}
        >
          <ArrowLeft size={14} />
          <span>Trader App</span>
        </button>

        {/* System Notifications Placeholder */}
        <button
          className="btn btn-ghost btn-sm"
          title="System notifications: All systems operational"
          aria-label="System notifications"
          style={{
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            position: 'relative',
          }}
        >
          <Bell size={15} />
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--win)',
            }}
          />
        </button>

        {/* Current Admin Identity */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 10px 4px 6px',
            borderRadius: 999,
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={adminName}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--border)',
              }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {initials}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.2,
                maxWidth: 130,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={adminName}
            >
              {adminName}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--text-faint)',
                maxWidth: 130,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={adminEmail}
            >
              {adminEmail}
            </span>
          </div>
        </div>

        {/* Logout Button (uses existing auth mechanism) */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          title="Sign out of Admin Console"
          style={{
            fontSize: 12.5,
            color: 'var(--loss)',
            padding: '7px 12px',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            borderRadius: 'var(--radius-sm)',
            gap: 6,
          }}
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
