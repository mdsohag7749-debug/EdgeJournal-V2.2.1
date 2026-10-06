import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  ShieldCheck,
  User,
  Mail,
  Calendar,
  Clock,
  Globe,
  FileText,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function UserDetailsDrawer({
  open,
  user,
  currentAdminId,
  onClose,
  onRequestRoleChange,
}) {
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && drawerRef.current) {
      const els = Array.from(drawerRef.current.querySelectorAll(FOCUSABLE));
      if (els.length) els[0].focus();
    }
  }, [open]);

  if (!open || !user) return null;

  const isSelf = user.id === currentAdminId;
  const isAdmin = user.role === 'admin';

  function handleCopyId() {
    navigator.clipboard?.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const initials = (user.fullName || user.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 320,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 5, 8, 0.65)',
            backdropFilter: 'blur(3px)',
          }}
          aria-hidden="true"
        />

        {/* Drawer Panel */}
        <motion.aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-details-title"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          style={{
            position: 'relative',
            width: 440,
            maxWidth: '100vw',
            height: '100%',
            background: 'var(--bg-elevated)',
            borderLeft: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lifted)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 330,
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 id="user-details-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                User Profile Details
              </h2>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Platform identity & administrative metadata
              </span>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              aria-label="Close details panel"
              style={{ padding: 6 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
            {/* Identity Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
              }}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName || 'User'}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: isAdmin
                      ? 'linear-gradient(135deg, var(--red), var(--red-strong))'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.fullName || 'Anonymous User'}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}
                >
                  {user.email}
                </p>
                <div style={{ marginTop: 6 }}>
                  <span className={isAdmin ? 'tag tag-red' : 'tag tag-neutral'} style={{ fontSize: 11 }}>
                    {isAdmin ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Fields List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* User ID */}
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>User Identifier (UUID)</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {user.id}
                  </code>
                  <button
                    onClick={handleCopyId}
                    className="btn btn-ghost btn-sm"
                    title="Copy UUID"
                    style={{ padding: 4 }}
                    aria-label="Copy user ID"
                  >
                    {copied ? <Check size={14} color="var(--win)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Username */}
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Username</span>
                <p style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 4 }}>
                  {user.username ? `@${user.username}` : 'Not configured'}
                </p>
              </div>

              {/* Timezone */}
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Timezone</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Globe size={14} color="var(--text-faint)" />
                  <span style={{ fontSize: 13.5, color: 'var(--text)' }}>
                    {user.timezone || 'Not specified (UTC)'}
                  </span>
                </div>
              </div>

              {/* Bio */}
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Biography</span>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  {user.bio || 'No biography entered.'}
                </p>
              </div>

              {/* Registration Date */}
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Account Created</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Calendar size={14} color="var(--text-faint)" />
                  <span style={{ fontSize: 13.5, color: 'var(--text)' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }) : '—'}
                  </span>
                </div>
              </div>

              {/* Last Updated */}
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Last Profile Update</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Clock size={14} color="var(--text-faint)" />
                  <span style={{ fontSize: 13.5, color: 'var(--text)' }}>
                    {user.updatedAt ? new Date(user.updatedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Role Management Card */}
            <div
              className="card"
              style={{
                padding: '16px 18px',
                marginTop: 'auto',
                border: '1px solid var(--border)',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <span className="drawer-label" style={{ fontSize: 11 }}>Role Administration</span>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>
                Elevate or revoke platform administrator privileges.
              </p>

              {isSelf ? (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <ShieldAlert size={16} color="#eab308" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Self-demotion is restricted for the currently authenticated administrator.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestRoleChange?.(user, isAdmin ? 'user' : 'admin')}
                  className="btn btn-sm"
                  style={{
                    width: '100%',
                    background: isAdmin ? 'rgba(234, 179, 8, 0.15)' : 'var(--red)',
                    color: isAdmin ? '#eab308' : '#fff',
                    border: isAdmin ? '1px solid rgba(234, 179, 8, 0.3)' : 'none',
                    fontWeight: 600,
                    gap: 8,
                  }}
                >
                  <ShieldCheck size={15} />
                  <span>{isAdmin ? 'Demote to Standard User' : 'Promote to Administrator'}</span>
                </button>
              )}
            </div>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>,
    document.body
  );
}
