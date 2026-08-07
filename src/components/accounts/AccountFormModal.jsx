import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Wallet, Check } from 'lucide-react';
import {
  ACCOUNT_TYPES,
  BROKERS,
  PLATFORMS,
  CURRENCIES,
  ACCOUNT_STATUSES,
} from './accounts';

const EMPTY = {
  name: '',
  broker: '',
  accountType: '',
  platform: '',
  currency: 'USD',
  startingBalance: '',
  currentBalance: '',
  status: 'active',
};

export default function AccountFormModal({ open, mode, account, isFirst = false, busy = false, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (mode === 'edit' && account) {
      setForm({
        name: account.name || '',
        broker: account.broker || '',
        accountType: account.accountType || '',
        platform: account.platform || '',
        currency: account.currency || 'USD',
        startingBalance: account.startingBalance ?? '',
        currentBalance: account.currentBalance ?? '',
        status: account.status || 'active',
      });
    } else {
      setForm((f) => ({ ...EMPTY, status: 'active' }));
    }
  }, [open, mode, account]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    const next = { ...form, name: form.name.trim() };
    const errs = {};
    if (!next.name) errs.name = 'Account name is required.';

    const numErr = (v, label) => {
      if (v === '' || v === null || v === undefined) return undefined;
      const n = Number(v);
      if (Number.isNaN(n)) return `${label} must be a valid number.`;
      return undefined;
    };
    const se = numErr(next.startingBalance, 'Starting balance');
    const ce = numErr(next.currentBalance, 'Current balance');
    if (se) errs.startingBalance = se;
    if (ce) errs.currentBalance = ce;

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      ...next,
      startingBalance: next.startingBalance === '' ? null : Number(next.startingBalance),
      currentBalance: next.currentBalance === '' ? null : Number(next.currentBalance),
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') onClose?.();
  }
  useEffect(() => {
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,6,0.6)', backdropFilter: 'blur(3px)' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="card"
            style={{ position: 'relative', width: 560, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--red-glow)',
                    color: 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700 }}>{mode === 'edit' ? 'Edit Account' : 'Create Account'}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                    {isFirst
                      ? 'Your first account — it will be set as the default.'
                      : 'Set up your broker, platform, and balances.'}
                  </p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
              <div className="field" style={{ marginBottom: 16 }}>
                <label htmlFor="account-name">Account Name *</label>
                <input
                  id="account-name"
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Prop Firm Main, Forex Live, Paper"
                  style={errors.name ? { borderColor: 'var(--loss)' } : undefined}
                />
                {errors.name && <span className="auth-error-text">{errors.name}</span>}
              </div>

              <div className="field-row cols-2" style={{ marginBottom: 16 }}>
                <div className="field">
                  <label htmlFor="account-type">Account Type</label>
                  <select id="account-type" value={form.accountType} onChange={(e) => set('accountType', e.target.value)}>
                    <option value="">Select type</option>
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="account-currency">Currency</label>
                  <select id="account-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-row cols-2" style={{ marginBottom: 16 }}>
                <div className="field">
                  <label htmlFor="account-broker">Broker</label>
                  <input id="account-broker" type="text" list="acct-broker-list" value={form.broker} onChange={(e) => set('broker', e.target.value)} placeholder="e.g. Interactive Brokers" />
                  <datalist id="acct-broker-list">
                    {BROKERS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label htmlFor="account-platform">Platform</label>
                  <input id="account-platform" type="text" list="acct-platform-list" value={form.platform} onChange={(e) => set('platform', e.target.value)} placeholder="e.g. TradingView" />
                  <datalist id="acct-platform-list">
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="field-row cols-2" style={{ marginBottom: 16 }}>
                <div className="field">
                  <label htmlFor="account-starting-balance">Starting Balance</label>
                  <input
                    id="account-starting-balance"
                    type="number"
                    step="any"
                    value={form.startingBalance}
                    onChange={(e) => set('startingBalance', e.target.value)}
                    placeholder="0.00"
                    style={errors.startingBalance ? { borderColor: 'var(--loss)' } : undefined}
                  />
                  {errors.startingBalance && <span className="auth-error-text">{errors.startingBalance}</span>}
                </div>
                <div className="field">
                  <label htmlFor="account-current-balance">Current Balance</label>
                  <input
                    id="account-current-balance"
                    type="number"
                    step="any"
                    value={form.currentBalance}
                    onChange={(e) => set('currentBalance', e.target.value)}
                    placeholder="0.00"
                    style={errors.currentBalance ? { borderColor: 'var(--loss)' } : undefined}
                  />
                  {errors.currentBalance && <span className="auth-error-text">{errors.currentBalance}</span>}
                </div>
              </div>

              <div className="field">
                <label htmlFor="account-status">Status</label>
                <select id="account-status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {ACCOUNT_STATUSES.filter((s) => s.value !== 'archived').map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
              <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-accent" onClick={handleSubmit} disabled={busy}>
                <Check size={15} /> {mode === 'edit' ? 'Save Changes' : isFirst ? 'Create Default Account' : 'Create Account'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}