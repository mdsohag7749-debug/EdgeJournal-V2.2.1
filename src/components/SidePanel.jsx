import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function SidePanel({ open, onClose, title, subtitle, width = 'narrow', children, footer }) {
  const panelRef = useRef(null);
  const lastFocused = useRef(null);
  const titleId = useRef(`sidepanel-title-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const focusables = (el) => Array.from(el?.querySelectorAll?.(FOCUSABLE) || []).filter((n) => n.offsetParent !== null);

  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement;
      const panel = panelRef.current;
      if (panel) {
        const els = focusables(panel);
        if (els.length) els[0].focus();
        else panel.focus?.();
      }
    }
    return () => {
      if (!open && lastFocused.current?.focus) {
        try {
          lastFocused.current.focus();
        } catch (_) {
          /* element may no longer be in the document */
        }
      }
    };
  }, [open]);

  // Trap Tab inside the panel so keyboard focus cannot escape behind the
  // drawer's scrim; Shift+Tab wraps to the last control.
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    const els = focusables(panelRef.current);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const pxWidth = width === 'wide' ? 'var(--panel-wide)' : 'var(--panel-narrow)';

  return (
    <AnimatePresence>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(17,24,39,0.22)',
            }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            onKeyDown={handleKeyDown}
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
              outline: 'none',
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
                <h2 id={titleId} style={{ fontSize: 18, fontWeight: 600 }}>{title}</h2>
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
                  padding: '16px 24px calc(16px + env(safe-area-inset-bottom))',
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