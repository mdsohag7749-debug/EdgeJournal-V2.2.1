import { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Wallet, Settings, Archive, Star, Layers } from 'lucide-react';
import { useAccounts } from '../../context/AccountContext';
import { formatBalance, STATUS_META } from './accounts';

// Top-navigation account switcher. Shows the current view as a pill;
// expands to a dropdown with:
//   All Accounts      -> combined view (aggregates every account)
//   Individual accounts
//   Archived accounts
//   Settings          -> jump to the Accounts management page
// Selecting updates global state (AccountContext), which is what scopes
// (or combines) the trades shown across every page.

function useClickOutside(ref, onClose, active) {
  useEffect(() => {
    if (!active) return undefined;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, onClose, ref]);
}

export default function AccountSwitcher() {
  const { accounts, selectedAccountId, selectedAccount, allAccounts, selectAccount, selectAllAccounts } = useAccounts();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useClickOutside(ref, () => setOpen(false), open);

  const active = accounts.filter((a) => a.status !== 'archived');
  const archived = accounts.filter((a) => a.status === 'archived');

  function pick(id) {
    selectAccount(id);
    setOpen(false);
  }
  function pickAll() {
    selectAllAccounts();
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 220 }}
        title="Switch account"
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--red-glow)',
            color: 'var(--red)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Wallet size={12} />
        </span>
        <span
          style={{
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          {allAccounts ? 'All Accounts' : selectedAccount?.name || 'Select account'}
        </span>
        {allAccounts ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)' }}>{active.length}</span>
        ) : (
          selectedAccount?.isDefault && <Star size={11} fill="var(--red)" color="var(--red)" />
        )}
        <ChevronDown size={13} style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="card"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 300,
              maxWidth: '80vw',
              zIndex: 80,
              padding: 8,
              boxShadow: 'var(--shadow-lifted)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
              {/* All Accounts (combined) */}
              <button
                onClick={pickAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: allAccounts ? 'var(--red-glow)' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Layers size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>All Accounts</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Combined · {active.length} account{active.length === 1 ? '' : 's'}</div>
                </div>
                {allAccounts && <Check size={15} color="var(--red)" />}
              </button>

              <div style={{ padding: '10px 10px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-faint)' }}>
                Individual Accounts
              </div>
              {active.length === 0 && (
                <div style={{ padding: '8px 10px 14px', fontSize: 12.5, color: 'var(--text-faint)' }}>
                  No accounts yet. Create one in Settings.
                </div>
              )}
              {active.map((a) => {
                const isSel = a.id === selectedAccountId;
                return (
                  <button
                    key={a.id}
                    onClick={() => pick(a.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: isSel ? 'var(--red-glow)' : 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: a.isDefault ? 'var(--red)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Wallet size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                        {a.isDefault && <Star size={10} fill="var(--red)" color="var(--red)" />}
                      </div>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {formatBalance(a.currentBalance, a.currency) || formatBalance(0, a.currency)}
                      </div>
                    </div>
                    {isSel && <Check size={15} color="var(--red)" />}
                  </button>
                );
              })}

              {archived.length > 0 && (
                <>
                  <div style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Archive size={11} /> Archived · {archived.length}
                  </div>
                  {archived.map((a) => {
                    const isSel = a.id === selectedAccountId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => pick(a.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: 'none',
                          background: isSel ? 'var(--red-glow)' : 'transparent',
                          color: 'var(--text-faint)',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        <Wallet size={13} />
                        <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                        {a.status && <span style={{ fontSize: 10.5, fontWeight: 700 }}>{STATUS_META[a.status]?.label}</span>}
                        {isSel && <Check size={14} color="var(--red)" />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/settings');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Settings size={15} /> Account Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}