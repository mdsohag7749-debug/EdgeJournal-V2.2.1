import { useEffect, useMemo, useRef, useState } from 'react';
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
  Tag,
  Timer,
  Wallet,
} from 'lucide-react';
import SidePanel from '../../components/SidePanel';
import ImageUpload from '../../components/ImageUpload';
import { TradeScreenshotManager } from '../../components/TradeScreenshots';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { sortTradeAccounts } from '../../components/accounts/accounts';
import TagChip from '../../components/TagChip';
import { todayISO, formatMoney } from '../../lib/utils';

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
const MISTAKES = ['Overtrading', 'Early Entry', 'Late Entry', 'Moved SL', 'Moved TP', 'FOMO', 'Revenge', 'Ignored Plan', 'News Trade'];

// Used to convert JPY-quoted pip values into USD for non-USDJPY JPY pairs
// (e.g. EURJPY, GBPJPY) when no live feed is available.
const DEFAULT_USDJPY = 150;

const INDICES = ['US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225'];
const CRYPTO = ['BTCUSD', 'ETHUSD', 'SOLUSD'];
const METALS = ['XAUUSD', 'XAGUSD'];

function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

function num(value) {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Per-asset pip/point value (USD per 1 pip × 1.0 lot) — the heart of the
// position size engine. Everything else derives from these two numbers.
function getLotConfig(instrument, entryPrice) {
  if (instrument === 'XAUUSD') return { pip: 0.1, pipValue: 10, unit: 'Pips' };
  if (instrument === 'XAGUSD') return { pip: 0.01, pipValue: 50, unit: 'Pips' };
  if (INDICES.includes(instrument)) return { pip: 1, pipValue: 1, unit: 'Points' };
  if (CRYPTO.includes(instrument)) return { pip: 1, pipValue: 1, unit: 'Points' };

  // Forex — standard 100,000-unit lot.
  if (instrument.endsWith('JPY')) {
    const usdJpy = instrument === 'USDJPY' && entryPrice > 0 ? entryPrice : DEFAULT_USDJPY;
    return { pip: 0.01, pipValue: 1000 / usdJpy, unit: 'Pips' };
  }
  if (instrument.startsWith('USD') && entryPrice > 0) {
    // USDCAD / USDCHF: $10/pip in the quote currency, converted to USD.
    return { pip: 0.0001, pipValue: 10 / entryPrice, unit: 'Pips' };
  }
  return { pip: 0.0001, pipValue: 10, unit: 'Pips' };
}

// All live trade math lives here — the trader never calculates anything.
// Everything updates instantly on every keystroke.
function computeDerived(form) {
  const entry = num(form.entryPrice);
  const exit = num(form.exitPrice);
  const sl = num(form.stopLoss);
  const tp = num(form.takeProfit);
  const riskPct = num(form.riskPercent);
  const balance = num(form.accountBalance);
  const lot = num(form.contracts);

  const cfg = getLotConfig(form.instrument, entry || 0);

  const hasEntry = entry !== null;
  const hasExit = exit !== null;
  const hasSL = sl !== null;
  const hasTP = tp !== null;
  const hasRisk = riskPct !== null && riskPct > 0;
  const hasBalance = balance !== null && balance > 0;

  // Friendly warnings that never block logging, but keep the user honest.
  const warnings = [];
  if (hasEntry && hasSL && Math.abs(entry - sl) < 0.000000001) {
    warnings.push('Stop Loss cannot be equal to Entry Price.');
  }
  if (hasRisk && riskPct <= 0) warnings.push('Risk % must be greater than 0.');
  if (hasBalance && balance <= 0) warnings.push('Account Balance must be greater than 0.');
  if (hasEntry && entry <= 0) warnings.push('Entry Price must be greater than 0.');
  if (hasSL && sl <= 0) warnings.push('Stop Loss must be greater than 0.');
  if (hasTP && tp <= 0) warnings.push('Take Profit must be greater than 0.');

  // Risk Amount ($) = Balance × Risk %
  let riskAmount = 0;
  if (hasRisk && hasBalance) riskAmount = (balance * riskPct) / 100;

  // Stop distance in price, pips/points, and pip value
  const riskPerUnit = hasEntry && hasSL ? Math.abs(entry - sl) : 0;
  const stopPips = riskPerUnit > 0 && cfg.pip > 0 ? riskPerUnit / cfg.pip : 0;
  const riskValue = stopPips * cfg.pipValue;

  // Planned R:R from SL / TP (and reward distance)
  const rewardPerUnit = hasEntry && hasTP ? Math.abs(tp - entry) : 0;
  const rewardPips = rewardPerUnit > 0 && cfg.pip > 0 ? rewardPerUnit / cfg.pip : 0;
  let plannedRR = 0;
  if (riskValue > 0 && riskAmount > 0) {
    plannedRR = (rewardPerUnit > 0 ? rewardPips * cfg.pipValue : 0) / riskValue;
  }

  // Lot / position size — fully automatic, but ONLY emitted once a stop
  // distance and a risk budget are both known. Until then the position is
  // unsized, so lot size, RR, PnL and PnL % stay uncomputed (shown as "—")
  // rather than silently collapsing to 0.00 or assuming a single lot.
  const manualLot = lot !== null && lot > 0;
  const autoLot = riskValue > 0 && riskAmount > 0 ? riskAmount / riskValue : 0;
  const canSize = manualLot || autoLot > 0;
  const qty = canSize ? (manualLot ? lot : autoLot) : 0;

  // A closed (won/lost) trade is only computable once a lot size is known.
  const canComputePnL = hasEntry && hasExit && qty > 0;

  // Potential profit at the take profit level.
  const potentialProfit = plannedRR > 0 && riskAmount > 0 ? plannedRR * riskAmount : 0;

  // PnL ($) — (exit - entry) scaled to the instrument's per-price-point,
  // per-lot dollar value, then multiplied by the position's lot size.
  // Built from the same cfg.pipValue/pip used to size the position, so the
  // displayed PnL always matches the calculator and the saved record.
  let pnl = 0;
  if (canComputePnL) {
    const directionMultiplier = form.direction === 'Buy' ? 1 : -1;
    const valuePerPricePoint = cfg.pipValue / cfg.pip; // $ per 1.0 price move, per 1.0 lot
    pnl = (exit - entry) * directionMultiplier * valuePerPricePoint * qty;
  }

  // PnL (%) vs account balance
  let pnlPct = 0;
  if (canComputePnL && hasBalance) pnlPct = (pnl / balance) * 100;

  // Realized R multiple (how many R the trade actually returned)
  let realizedRR = 0;
  if (riskAmount > 0) realizedRR = pnl / riskAmount;

  // Result (auto) — only once the trade is sized and closed, so an unsized
  // trade is never mislabeled as a break-even.
  let result = '';
  if (canComputePnL) result = pnl > 0 ? 'Win' : pnl < 0 ? 'Loss' : 'BE';

  // Trade duration (HH:MM)
  let duration = '';
  if (form.entryTime && form.exitTime) {
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    let diff = toMin(form.exitTime) - toMin(form.entryTime);
    if (diff < 0) diff += 24 * 60;
    if (diff > 0) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  }

  return {
    cfg,
    riskAmount,
    stopPips,
    rewardPips,
    plannedRR,
    realizedRR,
    potentialProfit,
    qty,
    autoLot,
    canComputePnL,
    pnl,
    pnlPct,
    result,
    duration,
    warnings,
  };
}

// Persists the computed fields into the form so the saved trade always
// carries real, derived numbers.
function applyAutoCalc(next) {
  const d = computeDerived(next);
  const patch = {};
  if (num(next.entryPrice) !== null && num(next.exitPrice) !== null) {
    patch.netPnl = Math.round(d.pnl * 100) / 100;
    patch.result = d.result;
  }
  if (d.plannedRR > 0) patch.rr = Math.round(d.plannedRR * 100) / 100;
  const manualLot = num(next.contracts) !== null && num(next.contracts) > 0;
  if (!manualLot && d.autoLot > 0) patch.contracts = Math.round(d.autoLot * 10000) / 10000;
  return { ...next, ...patch };
}

function validateTrade(form) {
  const errors = {};
  if (!form.accountId) errors.accountId = 'Select an account for this trade';

  const riskPct = num(form.riskPercent);
  if (!isBlank(form.riskPercent)) {
    if (riskPct === null) errors.riskPercent = 'Enter a valid number';
    else if (riskPct <= 0) errors.riskPercent = 'Must be greater than 0';
    else if (riskPct > 100) errors.riskPercent = 'Cannot exceed 100%';
  }

  const lot = num(form.contracts);
  if (!isBlank(form.contracts) && (lot === null || lot <= 0)) {
    errors.contracts = 'Enter a valid lot size';
  }

  const entry = num(form.entryPrice);
  const entryIsValid = entry !== null;

  const sl = num(form.stopLoss);
  if (!isBlank(form.stopLoss)) {
    if (sl === null) errors.stopLoss = 'Enter a valid number';
    else if (sl <= 0) errors.stopLoss = 'Must be greater than 0';
    else if (entryIsValid && form.direction === 'Buy' && sl >= entry) errors.stopLoss = 'Must be below Entry for a Buy';
    else if (entryIsValid && form.direction === 'Sell' && sl <= entry) errors.stopLoss = 'Must be above Entry for a Sell';
  }

  const tp = num(form.takeProfit);
  if (!isBlank(form.takeProfit)) {
    if (tp === null) errors.takeProfit = 'Enter a valid number';
    else if (tp <= 0) errors.takeProfit = 'Must be greater than 0';
    else if (entryIsValid && form.direction === 'Buy' && tp <= entry) errors.takeProfit = 'Must be above Entry for a Buy';
    else if (entryIsValid && form.direction === 'Sell' && tp >= entry) errors.takeProfit = 'Must be below Entry for a Sell';
  }

  return errors;
}

const BLANK = {
  accountId: '',
  date: todayISO(),
  entryTime: '',
  exitTime: '',
  instrument: 'EURUSD',
  direction: 'Buy',
  session: '',
  timeframe: '',
  model: '',
  entryPrice: '',
  exitPrice: '',
  contracts: '',
  stopLoss: '',
  takeProfit: '',
  riskPercent: '',
  rr: '',
  positionSize: '',
  netPnl: '',
  commission: '',
  result: '',
  planId: '',
  rating: 6,
  riskChecklist: {},
  tradeChecklist: {},
  tradeGrade: '',
  emotion: '',
  mistakes: {},
  confluences: '',
  tradeManagement: '',
  notes: '',
  lessonsLearned: '',
  screenshot: '',
  tags: [],
};

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

function ChecklistBlock({ title, criteria, values, onChange }) {
  const [open, setOpen] = useState(false);
  const checkedCount = criteria.filter((c) => values[c]).length;

  return (
    <div className="card" style={{ padding: 0, background: 'var(--card)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
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
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  const [confidence, setConfidence] = useState(3);
  const balanceRef = useRef('');

  const derived = useMemo(() => computeDerived({ ...form, accountBalance }), [form, accountBalance]);

  useEffect(() => {
    if (open) {
      const accountId = initial?.accountId || preferredAccountId || '';
      const acc = accounts.find((a) => a.id === accountId);
      const bal = acc?.currentBalance ?? acc?.startingBalance ?? '';
      balanceRef.current = bal;
      setAccountBalance(bal);
      setConfidence(Math.min(5, Math.max(1, Math.round((initial?.rating || 6) / 2))));
      setForm(
        initial
          ? { ...BLANK, ...initial, accountId, riskChecklist: initial.riskChecklist || {}, tradeChecklist: initial.tradeChecklist || {}, mistakes: initial.mistakes || {} }
          : { ...BLANK, accountId, model: models[0] || '' }
      );
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, preferredAccountId]);

  function set(key, value) {
    // The shared engine must always see the same account balance as the
    // preview, or the persisted netPnl/lot diverges from what's shown.
    setForm((f) => applyAutoCalc({ ...f, [key]: value, accountBalance: balanceRef.current }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setBalance(value) {
    setAccountBalance(value);
    balanceRef.current = value;
    setForm((f) => applyAutoCalc({ ...f, accountBalance: value }));
  }

  function handleSave() {
    const nextErrors = validateTrade(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Save EXACTLY the values shown in the preview. `derived` is the
    // single calculation engine's live output — no recalculation here,
    // so Preview PnL === Saved PnL === Supabase PnL === Dashboard PnL.
    const hasExitOutcome = num(form.entryPrice) !== null && num(form.exitPrice) !== null;
    const toSave = {
      ...form,
      rating: confidence * 2,
      netPnl: hasExitOutcome ? Math.round(derived.pnl * 100) / 100 : form.netPnl,
      result: hasExitOutcome ? derived.result : form.result,
      rr: derived.plannedRR > 0 ? Math.round(derived.plannedRR * 100) / 100 : form.rr,
      contracts: derived.qty > 0 ? Math.round(derived.qty * 10000) / 10000 : form.contracts,
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 300 }}>
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
                  <SummaryStat label="PnL $" value={derived.canComputePnL ? formatMoney(derived.pnl) : '—'} color={pnlColor} />
                  <SummaryStat label="PnL %" value={derived.canComputePnL ? `${derived.pnlPct >= 0 ? '+' : ''}${derived.pnlPct.toFixed(2)}%` : '—'} color={pnlColor} />
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
                  <label>Account *</label>
                  <select
                    value={form.accountId}
                    onChange={(e) => set('accountId', e.target.value)}
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
                  <label>Broker (optional)</label>
                  <input type="text" value={selectedAccount?.broker || ''} placeholder="From selected account" readOnly />
                </div>
              </div>
            </Section>

            <Section icon={<Crosshair size={14} />} title="Trade">
              <div className="field-row cols-2">
                <div className="field">
                  <label>Pair</label>
                  <select value={form.instrument} onChange={(e) => set('instrument', e.target.value)}>
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
                  <label>Direction</label>
                  <div style={{ display: 'flex', gap: 6, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, border: '1.5px solid var(--border)' }}>
                    <button
                      type="button"
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
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
                </div>
                <div className="field">
                  <label>Entry Time</label>
                  <input type="time" value={form.entryTime} onChange={(e) => set('entryTime', e.target.value)} />
                </div>
                <div className="field">
                  <label>Exit Time</label>
                  <input type="time" value={form.exitTime} onChange={(e) => set('exitTime', e.target.value)} />
                </div>
              </div>
            </Section>

            <Section icon={<ScanLine size={14} />} title="Price">
              <div className="field-row cols-4">
                <div className="field">
                  <label>Entry Price</label>
                  <input type="number" step="any" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} placeholder="1.25000" />
                </div>
                <div className="field">
                  <label>Stop Loss</label>
                  <input
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
                  <label>Take Profit</label>
                  <input
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
                  <label>Exit Price</label>
                  <input type="number" step="any" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} placeholder="1.25200" />
                </div>
              </div>
            </Section>

            {/* Risk + Auto Position Size Calculator */}
            <Section icon={<Gauge size={14} />} title="Risk & Position Size">
              <div className="field-row cols-2">
                <div className="field">
                  <label>Risk %</label>
                  <input
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
                  <label>Account Balance ($)</label>
                  <input type="number" step="any" value={accountBalance} onChange={(e) => setBalance(e.target.value)} placeholder="10000" />
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
          </div>

          {/* RIGHT: tags, media, notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Section icon={<Tag size={14} />} title="Tags">
              <div className="field-row cols-2">
                <div className="field">
                  <label>Setup</label>
                  <select value={form.model} onChange={(e) => set('model', e.target.value)}>
                    <option value="">Select setup</option>
                    {models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Session</label>
                  <select value={form.session} onChange={(e) => set('session', e.target.value)}>
                    <option value="">Select session</option>
                    {SESSIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row cols-2">
                <div className="field">
                  <label>Emotion</label>
                  <select value={form.emotion} onChange={(e) => set('emotion', e.target.value)}>
                    <option value="">Select emotion</option>
                    {EMOTIONS.map((em) => (
                      <option key={em}>{em}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Confidence: {confidence}/5</label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setConfidence(n)}
                        aria-label={`Confidence ${n}`}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 7,
                          fontSize: 13,
                          fontWeight: 700,
                          background: confidence >= n ? 'rgba(47,214,110,0.14)' : 'var(--bg-elevated)',
                          color: confidence >= n ? 'var(--win)' : 'var(--text-faint)',
                          border: confidence >= n ? '1.5px solid rgba(47,214,110,0.35)' : '1.5px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Mistake Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {MISTAKES.map((m) => {
                    const active = !!form.mistakes[m];
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('mistakes', { ...form.mistakes, [m]: !active })}
                        className={`tag ${active ? 'tag-red' : 'tag-neutral'}`}
                        style={{ cursor: 'pointer', fontSize: 11 }}
                      >
                        {m}
                      </button>
                    );
                  })}
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
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Trade notes…"
                style={{ minHeight: 90 }}
              />
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
      <label>Tags</label>
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
