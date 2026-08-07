import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Gauge,
  Plus,
  Ruler,
  ScanLine,
  Sparkles,
  StickyNote,
  Brain,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import SidePanel from '../../components/SidePanel';
import ImageUpload from '../../components/ImageUpload';
import { TradeScreenshotManager } from '../../components/TradeScreenshots';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { sortTradeAccounts } from '../../components/accounts/accounts';
import TagChip from '../../components/TagChip';
import { MISTAKE_NAMES, formatMoney } from '../../lib/utils';
import { num, BLANK, computeDerived, validateTrade } from '../../lib/tradeCalc';

const INSTRUMENT_GROUPS = [
  {
    label: 'Forex',
    options: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'GBPCHF', 'GBPCAD', 'EURNZD', 'AUDJPY', 'CADJPY'],
  },
  { label: 'Metals', options: ['XAUUSD', 'XAGUSD'] },
  { label: 'Indices', options: ['US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225'] },
  { label: 'Crypto', options: ['BTCUSD', 'ETHUSD', 'SOLUSD'] },
  { label: 'Futures', options: ['NQ', 'ES', 'YM', 'CL', 'GC', 'SI'] },
];
const SESSIONS = ['Asia', 'London', 'New York', 'London + New York'];
const EMOTIONS = ['Confident', 'Calm', 'Fear', 'Greed', 'FOMO', 'Revenge', 'Hesitation'];

// Trading Psychology — the 8 institutional emotions tracked on a 1–5 scale
// for every trade. "pos" emotions score higher = better; "neg" emotions score
// higher = more of that disruptive state present (so lower is healthier). The
// default rating biases positive emotions to a neutral 3 and negative ones to
// a mild 1, so a freshly-opened form reads as balanced and the trader shifts
// the knobs to match how they actually felt.
const PSYCH_EMOTIONS = [
  { key: 'Confidence', tone: 'pos' },
  { key: 'Patience', tone: 'pos' },
  { key: 'Focus', tone: 'pos' },
  { key: 'Fear', tone: 'neg' },
  { key: 'Greed', tone: 'neg' },
  { key: 'FOMO', tone: 'neg' },
  { key: 'Revenge', tone: 'neg' },
  { key: 'Stress', tone: 'neg' },
];

function Section({ icon, title, accent = { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text-muted)' }, children }) {
  return (
    <div
      className="card"
      style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--card)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: accent.bg,
            color: accent.fg,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <h4 style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function CalcStat({ label, value, sub, color, accent }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 11, color: accent || 'var(--text-faint)' }}>{sub}</span>}
    </div>
  );
}

function SummaryStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}

// Intuitive 1–5 selector for a single psychology emotion. Positive emotions
// (Confidence/Patience/Focus) light up green; disruptive ones (Fear/Greed/FOMO/
// Revenge/Stress) light up red so a high rating visually reads as "present".
function PsychRating({ emotion, value, onChange }) {
  const pos = emotion.tone === 'pos';
  const fg = pos ? 'var(--win)' : '#ff4d5e';
  const bg = pos ? 'rgba(47,214,110,0.16)' : 'rgba(255,77,94,0.16)';
  const borderColor = pos ? 'rgba(47,214,110,0.4)' : 'rgba(255,77,94,0.4)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{emotion.key}</span>
      <div style={{ display: 'flex', gap: 5 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (value || 0) >= n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${emotion.key} ${n} of 5`}
              aria-pressed={active}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                background: active ? bg : 'var(--bg-elevated)',
                color: active ? fg : 'var(--text-faint)',
                border: active ? `1.5px solid ${borderColor}` : '1.5px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistBlock({ title, criteria, values, onChange }) {
  const [open, setOpen] = useState(false);
  const checkedCount = criteria.filter((c) => values[c]).length;
  const blockId = useRef(`checklist-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`).current;

  return (
    <div className="card" style={{ padding: 0, background: 'var(--card)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={blockId}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
          {open ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
          {title}
        </span>
        <span
          className="tag"
          style={{
            background: checkedCount === criteria.length && criteria.length > 0 ? 'rgba(47,214,110,0.12)' : 'rgba(255,255,255,0.06)',
            color: checkedCount === criteria.length && criteria.length > 0 ? 'var(--win)' : 'var(--text-muted)',
            borderColor: 'transparent',
          }}
        >
          {checkedCount}/{criteria.length}
        </span>
      </button>
      {open && (
        <div id={blockId} style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {criteria.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No criteria defined yet. Add some in the System tab.</p>
          )}
          {criteria.map((c) => (
            <label key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!values[c]}
                onChange={(e) => onChange({ ...values, [c]: e.target.checked })}
                style={{ marginTop: 2, accentColor: 'var(--red)' }}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradeFormPanel({ open, onClose, onSave, initial }) {
  const { models, riskCriteria, checklistCriteria, tagLibrary, createTag } = useData();
  const { accounts, preferredAccountId } = useAccounts();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [accountBalance, setAccountBalance] = useState('');
  const balanceRef = useRef('');

  const derived = useMemo(() => computeDerived({ ...form, accountBalance }), [form, accountBalance]);

  useEffect(() => {
    if (open) {
      const accountId = initial?.accountId || preferredAccountId || '';
      const acc = accounts.find((a) => a.id === accountId);
      const bal = acc?.currentBalance ?? acc?.startingBalance ?? '';
      balanceRef.current = bal;
      setAccountBalance(bal);
      setForm(
        initial
          ? { ...BLANK, ...initial, accountId, riskChecklist: initial.riskChecklist || {}, tradeChecklist: initial.tradeChecklist || {}, mistakes: initial.mistakes || {}, psychology: initial.psychology || {} }
          : { ...BLANK, accountId, model: models[0] || '' }
      );
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, preferredAccountId]);

  // Raw field write. NEVER derives or persists computed values into form
  // while typing — computeDerived() is the single source of truth and always
  // recomputes from the live raw inputs, so there is no stale state and no
  // second calculation path.
  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setBalance(value) {
    setAccountBalance(value);
    balanceRef.current = value;
  }

  // Update a single Trading Psychology emotion score, keeping the rest intact.
  // Uses a functional update so a rapid second click on the same emotion can't
  // clobber the first, and clamps to the documented 1-5 range.
  function setPsych(key, value) {
    const clamp = (n) => Math.min(5, Math.max(1, Number.isFinite(Number(n)) ? Number(n) : 1));
    setForm((f) => {
      const next = { ...(f.psychology || {}), [key]: clamp(value) };
      return { ...f, psychology: next };
    });
    setErrors((e) => (e.psychology ? { ...e, psychology: undefined } : e));
  }

  function handleSave() {
    const nextErrors = validateTrade(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Single pipeline: Inputs -> computeDerived() -> Save. Nothing is ever
    // read back from previously-stored derived fields — computeDerived() is
    // re-run here (the same engine the preview uses) on the live raw inputs,
    // so Preview PnL === Saved PnL === Supabase PnL === Dashboard PnL.
    const d = computeDerived({ ...form, accountBalance });

    const hasExitOutcome = num(form.entryPrice) !== null && num(form.exitPrice) !== null;
    // A real lot exists if the trader typed one or the auto-sizer produced one.
    const manualLot = num(form.contracts) !== null && num(form.contracts) > 0;
    const sized = manualLot || d.autoLot > 0;

    const toSave = {
      ...form,
      // Rating (1-10, shown as "x/10" in the journal and used by analytics)
      // is driven by the single Confidence value in Trading Psychology (1-5),
      // scaled to the same 2-10 range it always used. Neutral 3 voices default
      // to 6 when the trader hasn't rated Confidence.
      rating: (() => {
        const c = Number(form.psychology?.Confidence);
        const conf = Number.isFinite(c) && c >= 1 && c <= 5 ? c : 3;
        return Math.max(2, Math.min(10, Math.round(conf * 2)));
      })(),
      // Derived P&L only belongs on a closed trade; otherwise leave blank
      // (no fabricated 0.00 or recycled stale value).
      netPnl: hasExitOutcome ? Math.round(d.pnl * 100) / 100 : '',
      result: hasExitOutcome ? d.result : '',
      rr: d.plannedRR > 0 ? Math.round(d.plannedRR * 100) / 100 : '',
      contracts: sized ? Math.round(d.qty * 10000) / 10000 : '',
    };
    onSave(toSave);
  }

  const selectedAccount = accounts.find((a) => a.id === form.accountId);
  const accent = {
    buy: { bg: 'rgba(47,214,110,0.12)', fg: 'var(--win)' },
    sell: { bg: 'rgba(255,77,94,0.12)', fg: 'var(--loss)' },
  };

  const resultColor = derived.result === 'Win' ? 'var(--win)' : derived.result === 'Loss' ? 'var(--loss)' : derived.result === 'BE' ? 'var(--be)' : 'var(--text-faint)';
  const pnlColor = derived.pnl > 0 ? 'var(--win)' : derived.pnl < 0 ? 'var(--loss)' : derived.result ? 'var(--be)' : 'var(--text-faint)';
  const distanceLabel = derived.cfg.unit === 'Pips' ? 'Pips' : 'Points';
  const showAutoLot = derived.qty > 0;

  // A trade is "closed" once an Exit (and exit-driven result) exists;
  // otherwise it's an open-trade preview. Both read the same engine.
  const isClosed = num(form.exitPrice) !== null && num(form.exitPrice) > 0;
  const closedColor = isClosed ? (resultColor === 'var(--win)' ? 'var(--win)' : resultColor === 'var(--loss)' ? 'var(--loss)' : resultColor === 'var(--be)' ? 'var(--be)' : 'var(--text-muted)') : 'var(--text-muted)';
  const closedBg = isClosed ? (resultColor === 'var(--win)' ? 'rgba(47,214,110,0.12)' : resultColor === 'var(--loss)' ? 'rgba(255,77,94,0.12)' : 'rgba(154,154,163,0.12)') : 'rgba(154,154,163,0.10)';

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Trade' : 'Log Trade'}
      subtitle="Fill the essentials — everything else is calculated for you"
      width="wide"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={handleSave}>
            {initial ? 'Save Changes' : 'Save Trade'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Trade Result — reads ONLY from the shared calculation engine
            (derived). Switches between an Open Trade Preview and a Closed
            Trade Result automatically, all in real time. */}
        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
            background: isClosed ? 'linear-gradient(135deg, rgba(18,18,26,0.92), rgba(24,20,26,0.92))' : 'linear-gradient(135deg, rgba(18,24,34,0.92), rgba(18,18,26,0.92))',
            border: isClosed ? '1px solid var(--border)' : '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span
              className="tag"
              style={{
                background: isClosed ? closedBg : 'rgba(59,130,246,0.12)',
                color: isClosed ? closedColor : '#60a5fa',
                borderColor: 'transparent',
                fontSize: 12.5,
                padding: '5px 12px',
              }}
            >
              {isClosed ? derived.result : '—'}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Win / Loss
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 'min(300px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="tag"
                style={{
                  background: isClosed ? 'rgba(47,214,110,0.12)' : 'rgba(59,130,246,0.12)',
                  color: isClosed ? 'var(--win)' : '#60a5fa',
                  borderColor: 'transparent',
                  fontSize: 11,
                  padding: '3px 10px',
                }}
              >
                {isClosed ? 'CLOSED RESULT' : 'OPEN PREVIEW'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {isClosed ? 'Closed trade — live outcome' : 'Enter Exit Price to close the trade'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 12 }}>
              <SummaryStat label="Risk Amount" value={derived.riskAmount > 0 ? formatMoney(derived.riskAmount) : '—'} color="var(--loss)" />
              <SummaryStat label="Risk %" value={form.riskPercent !== '' && Number(form.riskPercent) > 0 ? `${Number(form.riskPercent).toFixed(2)}%` : '—'} color="var(--text-muted)" />
              <SummaryStat label="Lot Size" value={showAutoLot ? `${derived.qty.toFixed(2)}` : '—'} color="var(--win)" />
              <SummaryStat label="RR" value={derived.realizedRR ? `+${derived.realizedRR.toFixed(2)}R` : derived.plannedRR > 0 ? `${derived.plannedRR.toFixed(2)}` : '—'} color="var(--text)" />

              {isClosed ? (
                <>
                  <SummaryStat label="PnL $" value={formatMoney(derived.pnl)} color={pnlColor} />
                  <SummaryStat label="PnL %" value={`${derived.pnlPct >= 0 ? '+' : ''}${derived.pnlPct.toFixed(2)}%`} color={pnlColor} />
                  <SummaryStat label="Duration" value={derived.duration || '—'} color="var(--text-muted)" />
                </>
              ) : (
                <>
                  <SummaryStat label="Potential Reward" value={derived.rewardPips > 0 ? `${Math.round(derived.rewardPips)} ${distanceLabel.toLowerCase()}` : '—'} color="var(--win)" />
                  <SummaryStat label="Potential Profit" value={derived.potentialProfit > 0 ? formatMoney(derived.potentialProfit) : '—'} color="var(--win)" />
                  <SummaryStat label="PnL $" value="—" color="var(--text-faint)" />
                  <SummaryStat label="PnL %" value="—" color="var(--text-faint)" />
                  <SummaryStat label="Duration" value="—" color="var(--text-faint)" />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="trade-form-grid" style={{ gridTemplateColumns: '1.02fr 0.98fr', gap: 16, alignItems: 'start' }}>
          {/* LEFT: mechanics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Section icon={<Building2 size={14} />} title="Account">
              <div className="field-row cols-2">
                <div className="field">
                  <label htmlFor="trade-account">Account *</label>
                  <select
                    id="trade-account"
                    value={form.accountId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const acc = accounts.find((a) => a.id === id);
                      const bal = acc?.currentBalance ?? acc?.startingBalance ?? '';
                      setAccountBalance(bal);
                      balanceRef.current = bal;
                      set('accountId', id);
                    }}
                    style={errors.accountId ? { borderColor: 'var(--loss)' } : undefined}
                  >
                    <option value="">Select account</option>
                    {sortTradeAccounts(accounts).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.isDefault ? ' · Default' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.accountId && <span className="auth-error-text">{errors.accountId}</span>}
                </div>
                <div className="field">
                  <label htmlFor="trade-broker">Broker (optional)</label>
                  <input id="trade-broker" type="text" value={selectedAccount?.broker || ''} placeholder="From selected account" readOnly />
                </div>
              </div>
            </Section>

            <Section icon={<Crosshair size={14} />} title="Trade">
              <div className="field-row cols-2">
                <div className="field">
                  <label htmlFor="trade-pair">Pair</label>
                  <select id="trade-pair" value={form.instrument} onChange={(e) => set('instrument', e.target.value)}>
                    {INSTRUMENT_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label id="trade-direction-label">Direction</label>
                  <div role="radiogroup" aria-labelledby="trade-direction-label" style={{ display: 'flex', gap: 6, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, border: '1.5px solid var(--border)' }}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.direction === 'Buy'}
                      onClick={() => set('direction', 'Buy')}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 7,
                        fontWeight: 700,
                        fontSize: 12.5,
                        background: form.direction === 'Buy' ? accent.buy.bg : 'transparent',
                        color: form.direction === 'Buy' ? accent.buy.fg : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.direction === 'Sell'}
                      onClick={() => set('direction', 'Sell')}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 7,
                        fontWeight: 700,
                        fontSize: 12.5,
                        background: form.direction === 'Sell' ? accent.sell.bg : 'transparent',
                        color: form.direction === 'Sell' ? accent.sell.fg : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>
              <div className="field-row cols-3">
                <div className="field">
                  <label htmlFor="trade-date">Date</label>
                  <input id="trade-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="trade-entry-time">Entry Time</label>
                  <input id="trade-entry-time" type="time" value={form.entryTime} onChange={(e) => set('entryTime', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="trade-exit-time">Exit Time</label>
                  <input id="trade-exit-time" type="time" value={form.exitTime} onChange={(e) => set('exitTime', e.target.value)} />
                </div>
              </div>
            </Section>

            <Section icon={<ScanLine size={14} />} title="Price">
              <div className="field-row cols-4">
                <div className="field">
                  <label htmlFor="trade-entry-price">Entry Price</label>
                  <input id="trade-entry-price" type="number" step="any" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} placeholder="1.25000" />
                </div>
                <div className="field">
                  <label htmlFor="trade-stop-loss">Stop Loss</label>
                  <input
                    id="trade-stop-loss"
                    type="number"
                    step="any"
                    value={form.stopLoss}
                    onChange={(e) => set('stopLoss', e.target.value)}
                    placeholder="1.24800"
                    style={errors.stopLoss ? { borderColor: 'var(--loss)' } : undefined}
                  />
                  {errors.stopLoss && <span className="auth-error-text">{errors.stopLoss}</span>}
                </div>
                <div className="field">
                  <label htmlFor="trade-take-profit">Take Profit</label>
                  <input
                    id="trade-take-profit"
                    type="number"
                    step="any"
                    value={form.takeProfit}
                    onChange={(e) => set('takeProfit', e.target.value)}
                    placeholder="1.25400"
                    style={errors.takeProfit ? { borderColor: 'var(--loss)' } : undefined}
                  />
                  {errors.takeProfit && <span className="auth-error-text">{errors.takeProfit}</span>}
                </div>
                <div className="field">
                  <label htmlFor="trade-exit-price">Exit Price</label>
                  <input id="trade-exit-price" type="number" step="any" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} placeholder="1.25200" />
                </div>
              </div>
            </Section>

            {/* Risk + Auto Position Size Calculator */}
            <Section icon={<Gauge size={14} />} title="Risk & Position Size">
              <div className="field-row cols-2">
                <div className="field">
                  <label htmlFor="trade-risk-percent">Risk %</label>
                  <input
                    id="trade-risk-percent"
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={form.riskPercent}
                    onChange={(e) => set('riskPercent', e.target.value)}
                    placeholder="1.0"
                    style={errors.riskPercent ? { borderColor: 'var(--loss)' } : undefined}
                  />
                  {errors.riskPercent && <span className="auth-error-text">{errors.riskPercent}</span>}
                </div>
                <div className="field">
                  <label htmlFor="trade-account-balance">Account Balance ($)</label>
                  <input id="trade-account-balance" type="number" step="any" value={accountBalance} onChange={(e) => setBalance(e.target.value)} placeholder="10000" />
                </div>
              </div>

              {/* Auto Position Size Calculator — never needs a save button */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(47,214,110,0.05), rgba(18,18,26,0.6))',
                  border: '1px solid var(--border-strong)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calculator size={14} color="var(--win)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--win)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Auto Position Size Calculator
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <CalcStat
                    label="Risk Amount"
                    value={derived.riskAmount ? formatMoney(derived.riskAmount) : '$0.00'}
                    sub={form.riskPercent ? `${Number(form.riskPercent).toFixed(2)}% of balance` : 'Enter risk %'}
                    color="var(--loss)"
                  />
                  <CalcStat
                    label="Lot Size"
                    value={showAutoLot ? `${derived.qty.toFixed(2)}` : '—'}
                    sub={showAutoLot ? 'Lots' : 'Auto from risk'}
                    color="var(--win)"
                  />
                  <CalcStat
                    label={`Distance (${distanceLabel})`}
                    value={derived.stopPips > 0 ? `${Math.round(derived.stopPips)}` : '—'}
                    sub={derived.stopPips > 0 ? `${distanceLabel} to stop` : 'Entry + SL required'}
                    color="var(--text)"
                  />
                  <CalcStat
                    label="RR"
                    value={derived.plannedRR > 0 ? derived.plannedRR.toFixed(2) : '—'}
                    sub={derived.rewardPips > 0 ? `Reward ${Math.round(derived.rewardPips)} ${distanceLabel.toLowerCase()}` : 'Set TP for RR'}
                    color="var(--text)"
                  />
                  <CalcStat
                    label="Potential Reward"
                    value={derived.potentialProfit > 0 ? formatMoney(derived.potentialProfit) : '—'}
                    sub={derived.plannedRR > 0 ? `${derived.plannedRR.toFixed(2)}R` : 'At take profit'}
                    color="var(--win)"
                  />
                  <CalcStat
                    label="Pip Value"
                    value={`$${derived.cfg.pipValue.toFixed(2)}`}
                    sub={`per ${derived.cfg.unit.toLowerCase().slice(0, -1)} / lot`}
                    color="var(--text-muted)"
                  />
                </div>

                {derived.warnings.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {derived.warnings.map((w) => (
                      <span key={w} style={{ fontSize: 11.5, color: 'var(--loss)' }}>
                        {w}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-faint)' }}>
                  <Sparkles size={12} color="var(--win)" />
                  <span>Updates instantly — no external lot size calculator needed.</span>
                </div>
              </div>
            </Section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ChecklistBlock
                title="Risk Management Checklist"
                criteria={riskCriteria}
                values={form.riskChecklist}
                onChange={(v) => set('riskChecklist', v)}
              />
              <ChecklistBlock
                title="Trade Checklist"
                criteria={checklistCriteria}
                values={form.tradeChecklist}
                onChange={(v) => set('tradeChecklist', v)}
              />
            </div>

            <Section icon={<AlertTriangle size={14} />} title="Mistakes">
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }}>
                Tick everything you did wrong on this trade — tracked live in Mistake Analytics.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {MISTAKE_NAMES.map((m) => {
                  const active = !!form.mistakes[m];
                  return (
                    <label
                      key={m}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 10,
                        fontSize: 13,
                        cursor: 'pointer',
                        color: 'var(--text)',
                        background: active ? 'rgba(255,77,94,0.10)' : 'var(--bg-elevated)',
                        border: active ? '1.5px solid rgba(255,77,94,0.4)' : '1.5px solid var(--border)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => set('mistakes', { ...form.mistakes, [m]: !active })}
                        style={{ accentColor: 'var(--loss)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span>{m}</span>
                    </label>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* RIGHT: psychology, tags, media, notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Section icon={<Brain size={14} />} title="Trading Psychology">
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }}>
                How you felt on this trade — before the fill. Saved with every trade and surfaced in Emotion Analytics.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {PSYCH_EMOTIONS.map((e) => (
                  <PsychRating key={e.key} emotion={e} value={form.psychology?.[e.key]} onChange={(v) => setPsych(e.key, v)} />
                ))}
              </div>
            </Section>

            <Section icon={<Tag size={14} />} title="Tags">
              <div className="field-row cols-2">
                <div className="field">
                  <label htmlFor="trade-setup">Setup</label>
                  <select id="trade-setup" value={form.model} onChange={(e) => set('model', e.target.value)}>
                    <option value="">Select setup</option>
                    {models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="trade-session">Session</label>
                  <select id="trade-session" value={form.session} onChange={(e) => set('session', e.target.value)}>
                    <option value="">Select session</option>
                    {SESSIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row cols-2">
                <div className="field">
                  <label htmlFor="trade-emotion">Emotion</label>
                  <select id="trade-emotion" value={form.emotion} onChange={(e) => set('emotion', e.target.value)}>
                    <option value="">Select emotion</option>
                    {EMOTIONS.map((em) => (
                      <option key={em}>{em}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row cols-1">
                <div className="field">
                  <TagSelect value={form.tags || []} onChange={(v) => set('tags', v)} library={tagLibrary} onCreate={createTag} />
                </div>
              </div>
            </Section>

            <Section icon={<Ruler size={14} />} title="Media">
              <div className="field-row cols-2">
                <ImageUpload label="Before Screenshot" value={form.screenshot} onChange={(v) => set('screenshot', v)} />
                <div className="field">
                  <label>After Screenshot</label>
                  <TradeScreenshotManager tradeId={initial?.id} />
                </div>
              </div>
            </Section>

<Section icon={<StickyNote size={14} />} title="Notes">
              <div className="field">
                <label htmlFor="trade-notes">Notes</label>
                <textarea
                  id="trade-notes"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Trade notes…"
                  style={{ minHeight: 90 }}
                />
              </div>
            </Section>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}

// Multi-select tag picker for the trade form. Renders the managed tag
// library as colored chips (toggled on/off) plus an inline input to type
// a brand-new tag, which also adds it to the library so it's reusable.
function TagSelect({ value, onChange, library, onCreate }) {
  const [draft, setDraft] = useState('');

  function toggle(name) {
    if (value.includes(name)) onChange(value.filter((x) => x !== name));
    else onChange([...value, name]);
  }

  function addNew() {
    const name = draft.trim();
    if (!name) return;
    if (!value.includes(name)) onChange([...value, name]);
    if (!library.some((t) => t.name.toLowerCase() === name.toLowerCase())) onCreate(name);
    setDraft('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor="trade-tags-input">Tags</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {library.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No tags yet — type one below to create it.</span>}
        {library.map((t) => (
          <TagChip
            key={t.id}
            name={t.name}
            color={t.color}
            active={value.includes(t.name)}
            onClick={() => toggle(t.name)}
          />
        ))}
        {value
          .filter((name) => !library.some((t) => t.name === name))
          .map((name) => (
            <TagChip key={name} name={name} active onClick={() => toggle(name)} />
          ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          id="trade-tags-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addNew();
            }
          }}
          placeholder="Type a tag and press Enter…"
        />
        <button className="btn btn-ghost btn-sm" type="button" onClick={addNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}
