import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import SidePanel from '../../components/SidePanel';
import { useAccounts } from '../../context/AccountContext';
import { todayISO } from '../../lib/utils';

const CHALLENGE_TYPES = ['FTMO', 'Maven', 'FundingPips', 'Alpha Capital', 'The5ers', 'E8', 'FundedNext', 'Custom'];
const CHALLENGE_STATUSES = ['active', 'paused', 'completed', 'archived'];

const EMPTY = {
  name: '',
  propFirm: '',
  accountId: '',
  challengeType: 'Custom',
  startingBalance: '',
  profitTarget: '',
  dailyDrawdown: '',
  maximumDrawdown: '',
  minTradingDays: '',
  startDate: todayISO(),
  endDate: '',
  status: 'active',
};

export default function ChallengeFormPanel({ open, onClose, onSave, initial }) {
  const { accounts } = useAccounts();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (initial) {
      setForm({
        ...EMPTY,
        ...initial,
        startingBalance: initial.startingBalance ?? '',
        profitTarget: initial.profitTarget ?? '',
        dailyDrawdown: initial.dailyDrawdown ?? '',
        maximumDrawdown: initial.maximumDrawdown ?? '',
        minTradingDays: initial.minTradingDays ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, initial]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    const next = { ...form, name: form.name.trim() };
    const errs = {};
    if (!next.name) errs.name = 'Challenge name is required.';
    if (!next.propFirm) errs.propFirm = 'Prop firm is required.';

    const numErr = (v, label) => {
      if (v === '' || v === null || v === undefined) return undefined;
      const n = Number(v);
      if (Number.isNaN(n)) return `${label} must be a valid number.`;
      if (n < 0) return `${label} cannot be negative.`;
      return undefined;
    };
    const sb = numErr(next.startingBalance, 'Starting balance');
    const pt = numErr(next.profitTarget, 'Profit target');
    const dd = numErr(next.dailyDrawdown, 'Daily drawdown');
    const md = numErr(next.maximumDrawdown, 'Maximum drawdown');
    if (sb) errs.startingBalance = sb;
    if (pt) errs.profitTarget = pt;
    if (dd) errs.dailyDrawdown = dd;
    if (md) errs.maximumDrawdown = md;

    if (next.minTradingDays !== '' && Number(next.minTradingDays) < 0) {
      errs.minTradingDays = 'Must be 0 or greater.';
    }

    if (next.startDate && next.endDate && next.endDate < next.startDate) {
      errs.endDate = 'End date must be after start date.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSave({
      ...next,
      startingBalance: next.startingBalance === '' ? 0 : Number(next.startingBalance),
      profitTarget: next.profitTarget === '' ? 0 : Number(next.profitTarget),
      dailyDrawdown: next.dailyDrawdown === '' ? 0 : Number(next.dailyDrawdown),
      maximumDrawdown: next.maximumDrawdown === '' ? 0 : Number(next.maximumDrawdown),
      minTradingDays: next.minTradingDays === '' ? 0 : Number(next.minTradingDays),
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') onClose?.();
  }
  useEffect(() => {
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Challenge' : 'New Challenge'}
      subtitle="Define a prop firm challenge and track progress from real trades"
      width="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={handleSubmit}>
            {initial ? 'Save Changes' : 'Create Challenge'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label>Challenge Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. FTMO Challenge 2026"
          />
          {errors.name && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.name}</span>}
        </div>

        <div className="field">
          <label>Prop Firm</label>
          <input
            type="text"
            value={form.propFirm}
            onChange={(e) => set('propFirm', e.target.value)}
            placeholder="e.g. FTMO, Maven, FundedNext"
          />
          {errors.propFirm && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.propFirm}</span>}
        </div>

        <div className="field-row cols-2">
          <div className="field">
            <label>Account</label>
            <select value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Challenge Type</label>
            <select value={form.challengeType} onChange={(e) => set('challengeType', e.target.value)}>
              {CHALLENGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row cols-2">
          <div className="field">
            <label>Starting Balance</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.startingBalance}
              onChange={(e) => set('startingBalance', e.target.value)}
              placeholder="0.00"
            />
            {errors.startingBalance && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.startingBalance}</span>}
          </div>
          <div className="field">
            <label>Profit Target</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.profitTarget}
              onChange={(e) => set('profitTarget', e.target.value)}
              placeholder="0.00"
            />
            {errors.profitTarget && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.profitTarget}</span>}
          </div>
        </div>

        <div className="field-row cols-2">
          <div className="field">
            <label>Daily Drawdown</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.dailyDrawdown}
              onChange={(e) => set('dailyDrawdown', e.target.value)}
              placeholder="0.00"
            />
            {errors.dailyDrawdown && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.dailyDrawdown}</span>}
          </div>
          <div className="field">
            <label>Maximum Drawdown</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.maximumDrawdown}
              onChange={(e) => set('maximumDrawdown', e.target.value)}
              placeholder="0.00"
            />
            {errors.maximumDrawdown && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.maximumDrawdown}</span>}
          </div>
        </div>

        <div className="field-row cols-2">
          <div className="field">
            <label>Min Trading Days</label>
            <input
              type="number"
              min="0"
              value={form.minTradingDays}
              onChange={(e) => set('minTradingDays', e.target.value)}
              placeholder="0"
            />
            {errors.minTradingDays && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.minTradingDays}</span>}
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {CHALLENGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row cols-2">
          <div className="field">
            <label>Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="field">
            <label>End Date</label>
            <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            {errors.endDate && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{errors.endDate}</span>}
          </div>
        </div>
      </div>
    </SidePanel>
  );
}