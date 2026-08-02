import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SidePanel from '../../components/SidePanel';
import ImageUpload from '../../components/ImageUpload';
import { TradeScreenshotManager } from '../../components/TradeScreenshots';
import { useData } from '../../context/DataContext';
import { todayISO } from '../../lib/utils';

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
const DIRECTIONS = ['Buy', 'Sell'];
const SESSIONS = ['Asia', 'London', 'New York', 'London + New York'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];
const PROTOCOLS = ['LRLRC', 'HRLRC'];
const RESULTS = ['Win', 'Loss', 'BE'];
const GRADES = ['A+', 'A', 'B', 'C', 'F'];
const EMOTIONS = ['Confident', 'Calm', 'Fear', 'Greed', 'FOMO', 'Revenge', 'Hesitation'];
const MISTAKES = ['Overtrading', 'Early Entry', 'Late Entry', 'Moved SL', 'Moved TP', 'FOMO', 'Revenge', 'Ignored Plan', 'News Trade'];

function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

// Validates the new risk-management fields (Risk %, RR, Stop Loss, Take
// Profit, Position Size). All five stay optional — same as the other
// numeric fields on this form — but whatever is entered has to be a
// sane number, and Stop Loss / Take Profit are checked against Entry
// Price + Direction so they can't be entered backwards.
function validateTrade(form) {
  const errors = {};

  if (!isBlank(form.riskPercent)) {
    const n = Number(form.riskPercent);
    if (Number.isNaN(n)) errors.riskPercent = 'Enter a valid number';
    else if (n <= 0) errors.riskPercent = 'Must be greater than 0';
    else if (n > 100) errors.riskPercent = 'Cannot exceed 100%';
  }

  if (!isBlank(form.rr)) {
    const n = Number(form.rr);
    if (Number.isNaN(n)) errors.rr = 'Enter a valid number';
    else if (n <= 0) errors.rr = 'Must be greater than 0';
  }

  if (!isBlank(form.positionSize)) {
    const n = Number(form.positionSize);
    if (Number.isNaN(n)) errors.positionSize = 'Enter a valid number';
    else if (n <= 0) errors.positionSize = 'Must be greater than 0';
  }

  const entry = isBlank(form.entryPrice) ? null : Number(form.entryPrice);
  const entryIsValid = entry !== null && !Number.isNaN(entry);

  if (!isBlank(form.stopLoss)) {
    const n = Number(form.stopLoss);
    if (Number.isNaN(n)) errors.stopLoss = 'Enter a valid number';
    else if (n <= 0) errors.stopLoss = 'Must be greater than 0';
    else if (entryIsValid && form.direction === 'Buy' && n >= entry) errors.stopLoss = 'Must be below Entry Price for a Buy';
    else if (entryIsValid && form.direction === 'Sell' && n <= entry) errors.stopLoss = 'Must be above Entry Price for a Sell';
  }

  if (!isBlank(form.takeProfit)) {
    const n = Number(form.takeProfit);
    if (Number.isNaN(n)) errors.takeProfit = 'Enter a valid number';
    else if (n <= 0) errors.takeProfit = 'Must be greater than 0';
    else if (entryIsValid && form.direction === 'Buy' && n <= entry) errors.takeProfit = 'Must be above Entry Price for a Buy';
    else if (entryIsValid && form.direction === 'Sell' && n >= entry) errors.takeProfit = 'Must be below Entry Price for a Sell';
  }

  return errors;
}

const BLANK = {
  date: todayISO(),
  entryTime: '',
  exitTime: '',
  instrument: 'EURUSD',
  direction: 'Buy',
  session: '',
  timeframe: '',
  model: '',
  protocol: 'LRLRC',
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
  result: 'Win',
  planId: '',
  rating: 5,
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
};

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
          style={{ background: checkedCount === criteria.length && criteria.length > 0 ? 'rgba(47,214,110,0.12)' : 'rgba(255,255,255,0.06)', color: checkedCount === criteria.length && criteria.length > 0 ? 'var(--win)' : 'var(--text-muted)', borderColor: 'transparent' }}
        >
          {checkedCount}/{criteria.length}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {criteria.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No criteria defined yet. Add some in the System tab.</p>}
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
  const { models, riskCriteria, checklistCriteria, plans } = useData();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { ...BLANK, ...initial, riskChecklist: initial.riskChecklist || {}, tradeChecklist: initial.tradeChecklist || {}, mistakes: initial.mistakes || {} }
          : { ...BLANK, model: models[0] || '' }
      );
      setErrors({});
    }
  }, [open, initial, models]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function handleSave() {
    const nextErrors = validateTrade(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(form);
  }

  const sortedPlans = [...plans.items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Trade' : 'Log Trade'}
      subtitle="Record entry, execution and review details for this trade"
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 28 }}>
        {/* Left column: trade mechanics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          <div className="field-row cols-3">
            <div className="field">
              <label>Instrument</label>
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
              <label>Model</label>
              <select value={form.model} onChange={(e) => set('model', e.target.value)}>
                <option value="">Select model</option>
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Protocol</label>
              <select value={form.protocol} onChange={(e) => set('protocol', e.target.value)}>
                {PROTOCOLS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Direction</label>
              <select value={form.direction} onChange={(e) => set('direction', e.target.value)}>
                {DIRECTIONS.map((d) => (
                  <option key={d}>{d}</option>
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
            <div className="field">
              <label>Timeframe</label>
              <select value={form.timeframe} onChange={(e) => set('timeframe', e.target.value)}>
                <option value="">Select timeframe</option>
                {TIMEFRAMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Entry Price</label>
              <input type="number" step="any" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />
            </div>
            <div className="field">
              <label>Exit Price</label>
              <input type="number" step="any" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} />
            </div>
            <div className="field">
              <label>Contracts</label>
              <input type="number" step="1" value={form.contracts} onChange={(e) => set('contracts', e.target.value)} />
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Stop Loss</label>
              <input
                type="number"
                step="any"
                value={form.stopLoss}
                onChange={(e) => set('stopLoss', e.target.value)}
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
                style={errors.takeProfit ? { borderColor: 'var(--loss)' } : undefined}
              />
              {errors.takeProfit && <span className="auth-error-text">{errors.takeProfit}</span>}
            </div>
            <div className="field">
              <label>Position Size</label>
              <input
                type="number"
                step="any"
                value={form.positionSize}
                onChange={(e) => set('positionSize', e.target.value)}
                style={errors.positionSize ? { borderColor: 'var(--loss)' } : undefined}
              />
              {errors.positionSize && <span className="auth-error-text">{errors.positionSize}</span>}
            </div>
          </div>

          <div className="field-row cols-2">
            <div className="field">
              <label>Risk %</label>
              <input
                type="number"
                step="any"
                value={form.riskPercent}
                onChange={(e) => set('riskPercent', e.target.value)}
                style={errors.riskPercent ? { borderColor: 'var(--loss)' } : undefined}
              />
              {errors.riskPercent && <span className="auth-error-text">{errors.riskPercent}</span>}
            </div>
            <div className="field">
              <label>RR</label>
              <input
                type="number"
                step="any"
                value={form.rr}
                onChange={(e) => set('rr', e.target.value)}
                style={errors.rr ? { borderColor: 'var(--loss)' } : undefined}
              />
              {errors.rr && <span className="auth-error-text">{errors.rr}</span>}
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Net P&L ($)</label>
              <input type="number" step="any" value={form.netPnl} onChange={(e) => set('netPnl', e.target.value)} />
            </div>
            <div className="field">
              <label>Commission ($)</label>
              <input type="number" step="any" value={form.commission} onChange={(e) => set('commission', e.target.value)} />
            </div>
            <div className="field">
              <label>Result</label>
              <select value={form.result} onChange={(e) => set('result', e.target.value)}>
                {RESULTS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row cols-2">
            <div className="field">
              <label>Link Pre-Market Plan</label>
              <select value={form.planId} onChange={(e) => set('planId', e.target.value)}>
                <option value="">None</option>
                {sortedPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.date} · {p.bias}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Performance Rating: {form.rating}/10</label>
              <input
                type="range"
                min="1"
                max="10"
                value={form.rating}
                onChange={(e) => set('rating', Number(e.target.value))}
                style={{ accentColor: 'var(--red)', marginTop: 10 }}
              />
            </div>
          </div>

          <div className="field-row cols-2">
            <div className="field">
              <label>Trade Grade</label>
              <select value={form.tradeGrade} onChange={(e) => set('tradeGrade', e.target.value)}>
                <option value="">Select grade</option>
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Emotion</label>
              <select value={form.emotion} onChange={(e) => set('emotion', e.target.value)}>
                <option value="">Select emotion</option>
                {EMOTIONS.map((em) => (
                  <option key={em}>{em}</option>
                ))}
              </select>
            </div>
          </div>

          <ChecklistBlock title="Risk Management Checklist" criteria={riskCriteria} values={form.riskChecklist} onChange={(v) => set('riskChecklist', v)} />
          <ChecklistBlock title="Trade Checklist" criteria={checklistCriteria} values={form.tradeChecklist} onChange={(v) => set('tradeChecklist', v)} />
          <ChecklistBlock title="Mistakes" criteria={MISTAKES} values={form.mistakes} onChange={(v) => set('mistakes', v)} />
        </div>

        {/* Right column: narrative + screenshot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Confluences</label>
            <textarea value={form.confluences} onChange={(e) => set('confluences', e.target.value)} placeholder="What lined up to take this trade?" />
          </div>
          <div className="field">
            <label>Trade Management</label>
            <textarea value={form.tradeManagement} onChange={(e) => set('tradeManagement', e.target.value)} placeholder="How did you manage the trade after entry?" />
          </div>
          <div className="field">
            <label>Trade Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} style={{ minHeight: 120 }} />
          </div>
          <div className="field">
            <label>Lessons Learned</label>
            <textarea
              value={form.lessonsLearned}
              onChange={(e) => set('lessonsLearned', e.target.value)}
              placeholder="What will you take away from this trade?"
              style={{ minHeight: 120 }}
            />
          </div>
          <ImageUpload label="Execution Screenshot" value={form.screenshot} onChange={(v) => set('screenshot', v)} />
          <TradeScreenshotManager tradeId={initial?.id} />
        </div>
      </div>
    </SidePanel>
  );
}
