import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function SidePanel({ open, onClose, title, subtitle, width = 'narrow', children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pxWidth = width === 'wide' ? 'var(--panel-wide)' : 'var(--panel-narrow)';

  return (
    <AnimatePresence>
      {open && (
        <div aria-hidden={!open} style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(17,24,39,0.35)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <motion.div
            role="dialog"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: pxWidth,
              maxWidth: '100vw',
              background: 'var(--bg-elevated)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-24px 0 60px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h2>
                {subtitle && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>
                )}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close panel">
                <X size={18} />
              </button>
            </div>
            <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {children}
            </div>
            {footer && (
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  flexShrink: 0,
                  background: 'var(--bg-elevated)',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
