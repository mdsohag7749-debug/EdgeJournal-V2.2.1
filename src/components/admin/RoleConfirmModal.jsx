import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, ShieldAlert, AlertTriangle, ArrowRight, X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function RoleConfirmModal({
  open,
  user,
  targetRole,
  loading = false,
  onConfirm,
  onClose,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !loading) {
        onClose?.();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  useEffect(() => {
    if (open && dialogRef.current) {
      const els = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      if (els.length) els[0].focus();
    }
  }, [open]);

  if (!open || !user) return null;

  const isPromotion = targetRole === 'admin';
  const userName = user.fullName || user.email || 'this user';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 5, 8, 0.7)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={() => {
        if (!loading) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-confirm-title"
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: 'var(--shadow-lifted)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: isPromotion ? 'rgba(193, 18, 31, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: isPromotion ? 'var(--red)' : '#eab308',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isPromotion ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
            </div>
            <div>
              <h3 id="role-confirm-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {isPromotion ? 'Promote to Administrator?' : 'Demote to Standard User?'}
              </h3>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Role privilege change
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{ padding: 6 }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Target User Summary Box */}
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {user.fullName || 'Anonymous User'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {user.email}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Role transition:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={user.role === 'admin' ? 'tag tag-red' : 'tag tag-neutral'} style={{ fontSize: 10.5 }}>
                {user.role}
              </span>
              <ArrowRight size={13} color="var(--text-faint)" />
              <span className={targetRole === 'admin' ? 'tag tag-red' : 'tag tag-neutral'} style={{ fontSize: 10.5, fontWeight: 700 }}>
                {targetRole}
              </span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {isPromotion
            ? `Are you sure you want to promote ${userName} to Administrator? This will grant elevated privileges to view all user profiles and access the Admin Panel.`
            : `Are you sure you want to demote ${userName} to Standard User? This user will immediately lose access to the Admin Panel and administrative tools.`}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={loading}
            onClick={() => onConfirm?.(user.id, targetRole)}
            style={{
              background: isPromotion ? 'var(--red)' : '#ca8a04',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
            }}
          >
            {loading ? 'Updating…' : isPromotion ? 'Confirm Promotion' : 'Confirm Demotion'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
