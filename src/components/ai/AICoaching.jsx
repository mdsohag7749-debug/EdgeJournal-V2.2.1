// AI Coaching & Action Plan — the Sprint 9.4 UI.
//
// Lives on the Analytics page (wired in Analytics.jsx) as a premium, read-only
// AI section. Contract:
//   - The AI request happens ONLY when the user explicitly clicks
//     "Generate Coaching Plan" — never on mount, route change, filter change,
//     login, or every render.
//   - Account isolation is inherited AND enforced: the Generate action is only
//     available with a single concrete account selected. In "All Accounts"
//     mode the action is disabled and the user is told to pick an account.
//   - The analyzed horizon (Daily / Weekly / Monthly) is chosen here and drives
//     a deterministic current-vs-previous window pair. Pair / session / setup
//     filters reuse the SAME canonical journal filters the verified widgets
//     use. Nothing is silently mixed.
//   - A previous result is marked STALE the moment the scope fingerprint
//     changes, so stale AI output can never masquerade as current analysis.
//   - Loading disables the trigger (duplicate-request protection) + sets
//     aria-busy; errors surface only safe, human-readable messages via
//     aria-live. Action-plan checkboxes are LOCAL component state only — no
//     completion data is written anywhere.
//   - READ-ONLY: no trade / balance / PnL / RR / risk / filter / score writes
//     exist anywhere in this component.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import {
  buildCoachingPeriods,
  scopeCoachingTrades,
  generateAICoaching,
  safeCoachingErrorMessage,
  coachingHorizonLabel,
  COACHING_HORIZONS,
} from '../../lib/ai/coaching';
import { scopeLabel, dataCoverageLabel, AI_NOT_ENOUGH_DATA } from '../../lib/ai/journalIntelligence';
import { confidenceLabel } from '../../lib/ai/tradeReview';
import { UNASSIGNED_LABEL } from '../../lib/setupPerformance';
import { sessionKey } from '../../lib/heatmap';

const chipBase = {
  padding: '6px 12px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 700,
  border: '1.5px solid transparent',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'background .15s ease, color .15s ease, border-color .15s ease',
  background: 'transparent',
  whiteSpace: 'nowrap',
};
const chipActive = {
  background: 'rgba(124,58,237,0.15)',
  border: '1.5px solid rgba(124,58,237,0.4)',
  color: 'var(--text)',
};

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)' }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          padding: '5px 8px',
          fontSize: 12,
          fontWeight: 600,
          maxWidth: 190,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Data-coverage tone map (mirrors the canonical engines' color use).
const COVERAGE_TONE = {
  NOT_ENOUGH_DATA: '#94a3b8',
  LIMITED_DATA: '#f59e0b',
  EARLY_PATTERN: '#f59e0b',
  NORMAL_PATTERN_ANALYSIS: '#16a34a',
};

function CoverageChip({ coverage }) {
  const color = COVERAGE_TONE[coverage] || '#94a3b8';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 7,
        background: `${color}14`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <Activity size={11} aria-hidden /> {dataCoverageLabel(coverage)}
    </span>
  );
}

export default function AICoaching({ provider, accountIdOverride, accountNameOverride, reportState }) {
  const { trades, models, riskCriteria, checklistCriteria, reflections } = useData();
  const { allAccounts, selectedAccount, getAccountName } = useAccounts();

  const [horizon, setHorizon] = useState('weekly');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [setup, setSetup] = useState('All');

  const [phase, setPhase] = useState('idle'); // idle | loading | success | error
  const [errorCode, setErrorCode] = useState(null);
  const [result, setResult] = useState(null);
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState(null);
  const [analyzedLabel, setAnalyzedLabel] = useState('');
  const [doneActions, setDoneActions] = useState(() => new Set());
  const busyRef = useRef(false);

  const accountId = accountIdOverride || (allAccounts ? null : selectedAccount?.id || null);
  const accountName =
    (accountNameOverride !== undefined ? accountNameOverride : getAccountName?.(accountId)) || selectedAccount?.name || null;

  const periods = useMemo(() => buildCoachingPeriods(horizon), [horizon]);

  // Scoped dataset — the SAME canonical journal filters the verified widgets
  // use, constrained to the selected horizon's window.
  const focusedTrades = useMemo(
    () => scopeCoachingTrades(trades.items, { ...periods.current, pair, session, setup }),
    [trades.items, periods, pair, session, setup]
  );

  const currentFingerprint = useMemo(() => {
    const ids = Array.isArray(trades.items) ? trades.items.map((t) => t.id).sort() : [];
    return JSON.stringify({ accountId: accountId || null, horizon, pair, session, setup, ids });
  }, [trades.items, accountId, horizon, pair, session, setup]);

  // Safe option lists derived from the FULL visible dataset so a currently-
  // visible value is always selectable — never invented.
  const optionData = useMemo(() => {
    const pairSet = new Set();
    const sessionSet = new Set();
    const setupSet = new Set();
    trades.items.forEach((t) => {
      pairSet.add(t.instrument || UNASSIGNED_LABEL);
      sessionSet.add(sessionKey(t));
      const m = t.model && String(t.model).trim();
      if (m) setupSet.add(m);
    });
    return {
      pairOptions: [...pairSet].sort((a, b) => a.localeCompare(b)),
      sessionOptions: [...sessionSet].filter(Boolean).sort((a, b) => a.localeCompare(b)),
      setupOptions: [...setupSet].sort((a, b) => a.localeCompare(b)),
    };
  }, [trades.items]);

  const pairOptions = [{ value: 'All', label: 'All Pairs' }, ...optionData.pairOptions.map((p) => ({ value: p, label: p }))];
  const sessionOptions = [{ value: 'All', label: 'All Sessions' }, ...optionData.sessionOptions.map((s) => ({ value: s, label: s }))];
  const setupOptions = [{ value: 'All', label: 'All Setups' }, ...optionData.setupOptions.map((s) => ({ value: s, label: s }))];
  const safePair = optionData.pairOptions.includes(pair) || pair === 'All' ? pair : 'All';
  const safeSession = optionData.sessionOptions.includes(session) || session === 'All' ? session : 'All';
  const safeSetup = optionData.setupOptions.includes(setup) || setup === 'All' ? setup : 'All';

  const busy = phase === 'loading';
  const noSingleAccount = !accountId;
  const scopedCount = focusedTrades.length;
  const stale = phase === 'success' && analyzedFingerprint !== null && analyzedFingerprint !== currentFingerprint;

  // Reports the feature's own state upward (optional — the Edge AI Command
  // Center listens to drive its card chips). Never a duplicate state system.
  useEffect(() => {
    reportState?.({ phase, status: errorCode, stale, gated: noSingleAccount });
  }, [phase, errorCode, stale, noSingleAccount, reportState]);

  function scopeText() {
    const base = `${coachingHorizonLabel(horizon)} · ${scopeLabel({ pair: safePair, session: safeSession, setup: safeSetup })}`;
    if (stale) return base;
    return analyzedLabel || `${base} · ${periods.current.label}`;
  }

  async function onGenerate() {
    // Duplicate-request guard + explicit-trigger-only contract.
    if (busyRef.current || !accountId) return;
    busyRef.current = true;
    setPhase('loading');
    setErrorCode(null);
    setResult(null);
    setDoneActions(new Set());
    try {
      const outcome = await generateAICoaching({
        trades: trades.items,
        accountId,
        accountName,
        horizon,
        pair: safePair,
        session: safeSession,
        setup: safeSetup,
        provider,
        system: { models, riskCriteria, checklistCriteria, reflections: reflections.items },
      });
      if (outcome.ok && outcome.analysis) {
        setResult(outcome.analysis);
        setAnalyzedFingerprint(currentFingerprint);
        setAnalyzedLabel(
          `${coachingHorizonLabel(horizon)} · ${scopeLabel({ pair: safePair, session: safeSession, setup: safeSetup })} · ${periods.current.label} · ${scopedCount} trade${scopedCount === 1 ? '' : 's'}`
        );
        setPhase('success');
      } else {
        setErrorCode(outcome.status || 'AI_PROVIDER_ERROR');
        setPhase('error');
      }
    } catch (err) {
      // generate*() never throws for user-facing reasons; this is a hard backup.
      setErrorCode('AI_PROVIDER_ERROR');
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  }

  function onDismissStale() {
    setPhase('idle');
    setResult(null);
    setAnalyzedFingerprint(null);
    setAnalyzedLabel('');
  }

  return (
    <section
      aria-label="EdgeJournal AI — Coaching Plan"
      aria-busy={busy}
      className="card card-lift"
      style={{ padding: 22, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Sparkles size={16} color="#7c3aed" /> AI Coach
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>
              · Your next improvement cycle · {allAccounts ? '(All Accounts)' : selectedAccount?.name || '—'}
            </span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 700, marginBottom: 0 }}>
            A structured personal trading coach based only on recorded journal evidence — which process habits to review next, what is working, and a short action plan. Advisory only; never a signal generator.
          </p>
        </div>
        <div role="group" aria-label="Coaching horizon" style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {COACHING_HORIZONS.map((h) => (
            <button key={h} type="button" onClick={() => setHorizon(h)} style={{ ...chipBase, ...(horizon === h ? chipActive : {}) }}>
              {coachingHorizonLabel(h)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <FilterSelect label="Pair" options={pairOptions} value={safePair} onChange={setPair} />
        <FilterSelect label="Session" options={sessionOptions} value={safeSession} onChange={setSession} />
        <FilterSelect label="Setup" options={setupOptions} value={safeSetup} onChange={setSetup} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {allAccounts ? 'Scope: All Accounts' : `Scope: ${scopeText()}`}
            {' · '}
            <strong style={{ color: 'var(--text)' }}>
              {scopedCount} trade{scopedCount === 1 ? '' : 's'}
            </strong>
          </span>
          <button
            type="button"
            className="btn btn-accent"
            onClick={onGenerate}
            disabled={busy || noSingleAccount}
            aria-disabled={busy || noSingleAccount}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={14} aria-hidden /> Generate Coaching Plan
          </button>
        </div>
      </div>

      {allAccounts ? (
        <Notice tone="warn">AI Coach requires a single account. Select one account to generate a coaching plan — it never mixes accounts.</Notice>
      ) : noSingleAccount ? (
        <Notice tone="warn">Select an account to generate a coaching plan.</Notice>
      ) : null}

      <div aria-live="polite">
        {stale && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.10)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} aria-hidden />
            <span>Your journal scope changed. Generate a new coaching plan.</span>
            <button type="button" onClick={onDismissStale} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }} aria-label="Dismiss stale plan">
              Dismiss
            </button>
          </div>
        )}

        {phase === 'idle' && !busy && <IdleState count={scopedCount} horizon={coachingHorizonLabel(horizon)} periodLabel={periods.current.label} />}
        {busy && <LoadingState />}
        {phase === 'success' && result && !busy && <SuccessState result={result} doneActions={doneActions} onToggleAction={toggleAction} previousLabel={periods.previous.label} />}
        {phase === 'error' && !busy && <ErrorState code={errorCode} message={safeCoachingErrorMessage(errorCode)} onRetry={onGenerate} />}
      </div>
    </section>
  );

  function toggleAction(index) {
    setDoneActions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }
}

function Notice({ tone = 'info', children }) {
  const bg = tone === 'warn' ? 'rgba(245,158,11,0.10)' : 'rgba(124,58,237,0.10)';
  const color = tone === 'warn' ? '#f59e0b' : '#7c3aed';
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 10, background: bg, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
      <Activity size={14} style={{ color, marginTop: 2, flexShrink: 0 }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function IdleState({ count, horizon, periodLabel }) {
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Generate a {horizon.toLowerCase()} coaching plan for <strong>{periodLabel}</strong> — based on <strong>{count}</strong> trade{count === 1 ? '' : 's'} in the current scope. It only reads your recorded journal data; nothing is changed.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Loader2 size={15} className="ejs-spin" aria-hidden />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Building your coaching plan…</span>
    </div>
  );
}

function ErrorState({ code, message, onRetry }) {
  return (
    <div role="alert" aria-live="assertive" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <ShieldAlert size={15} style={{ color: 'var(--red)', marginTop: 2, flexShrink: 0 }} aria-hidden />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{message}</p>
      </div>
      {code !== 'AI_NOT_CONFIGURED' && code !== AI_NOT_ENOUGH_DATA && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          Try again
        </button>
      )}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h4 style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', margin: '0 0 8px', padding: 0 }}>
      {children}
    </h4>
  );
}

// __UI_CONTINUE__

const PRIORITY_TONE = {
  HIGH: '#dc2626',
  MEDIUM: '#f59e0b',
  LOW: '#3b82f6',
};

const DIR_META = {
  IMPROVING: { icon: 'up', color: 'var(--win)', label: 'Improving' },
  DECLINING: { icon: 'down', color: 'var(--loss)', label: 'Declining' },
  STABLE: { icon: 'flat', color: 'var(--text-muted)', label: 'Stable' },
  INCONCLUSIVE: { icon: 'n/a', color: 'var(--text-faint)', label: 'Inconclusive' },
};

const SOURCE_LABELS = {
  mistakeIntelligence: 'Mistakes',
  disciplineScore: 'Discipline',
  setupPerformance: 'Setup performance',
  heatmap: 'Pair & session',
  journalIntelligence: 'Journal intelligence',
  periodComparison: 'Period comparison',
  patterns: 'Behavior patterns',
};

function normalizeCoverage(dq) {
  const known = ['NOT_ENOUGH_DATA', 'LIMITED_DATA', 'EARLY_PATTERN', 'NORMAL_PATTERN_ANALYSIS'];
  if (known.includes(dq.coverage)) return dq.coverage;
  const clean = typeof dq.coverage === 'string' ? dq.coverage.toUpperCase().replace(/[^A-Z_]/g, '') : '';
  return known.find((k) => k === clean) || 'LIMITED_DATA';
}

function formatMetricValue(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function TrendBadge({ direction }) {
  const meta = DIR_META[direction] || DIR_META.INCONCLUSIVE;
  const Icon = meta.icon === 'up' ? TrendingUp : meta.icon === 'down' ? TrendingDown : Minus;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: meta.color, whiteSpace: 'nowrap' }} aria-label={`Trend ${meta.label}`}>
      <Icon size={13} aria-hidden /> {meta.label}
    </span>
  );
}

function SuccessState({ result, doneActions, onToggleAction, previousLabel }) {
  const keys = (arr) => (Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : []);
  const focusAreas = Array.isArray(result.focusAreas) ? result.focusAreas : [];
  const strengths = keys(result.strengths);
  const recurringPatterns = Array.isArray(result.recurringPatterns) ? result.recurringPatterns : [];
  const periodComparison = Array.isArray(result.periodComparison) ? result.periodComparison : [];
  const actionPlan = Array.isArray(result.actionPlan) ? result.actionPlan : [];
  const watchItems = keys(result.watchItems);
  const limitations = keys(result.limitations);
  const dq = result.dataQuality && typeof result.dataQuality === 'object' ? result.dataQuality : {};
  const dqCoverage = normalizeCoverage(dq);

  const showAnything =
    !!result.summary || focusAreas.length || strengths.length || recurringPatterns.length || periodComparison.length || actionPlan.length || watchItems.length;

  if (!showAnything) {
    return (
      <div role="status" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
        No coaching findings were returned for the selected scope.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {result.summary && (
        <section>
          <SectionHeading>Coach Overview</SectionHeading>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{result.summary}</p>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
            AI Confidence: <strong style={{ color: 'var(--text)' }}>{confidenceLabel(result.confidence)}</strong>
          </div>
        </section>
      )}

      {focusAreas.length > 0 && (
        <section>
          <SectionHeading>Your Focus</SectionHeading>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {focusAreas.map((f, i) => (
              <li key={i} className="card" style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--bg)' }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: 'rgba(124,58,237,0.14)',
                    color: '#7c3aed',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {f.title && <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{f.title}</span>}
                    {f.priority && <PriorityBadge priority={f.priority} />}
                    {f.source && SOURCE_LABELS[f.source] && <SourceTag label={SOURCE_LABELS[f.source]} />}
                  </div>
                  {f.reason && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4 }}>{f.reason}</div>}
                  {f.action && (
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, marginTop: 4 }}>
                      <span style={{ fontWeight: 700 }}>Focus on:</span> {f.action}
                    </div>
                  )}
                  {f.evidence && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 8, fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45 }}>
                      <ArrowRight size={12} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
                      <span>
                        <strong style={{ color: 'var(--text-muted)' }}>Evidence:</strong> {f.evidence}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {strengths.length > 0 && (
        <section>
          <SectionHeading>What You're Doing Well</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {strengths.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CheckCircle size={14} style={{ color: 'var(--win)', marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recurringPatterns.length > 0 && (
        <section>
          <SectionHeading>Recurring Patterns</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recurringPatterns.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} aria-hidden />
                <div style={{ minWidth: 0 }}>
                  {p.title && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.title}</div>}
                  {p.observation && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{p.observation}</div>}
                  {p.evidence && <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45, marginTop: 3 }}>{p.evidence}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {periodComparison.length > 0 && (
        <section>
          <SectionHeading>Period Comparison — Current vs {previousLabel || 'Previous'}</SectionHeading>
          <div style={{ overflowX: 'auto' }}>
            <table
              aria-label="Period comparison"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 480 }}
            >
              <thead>
                <tr style={{ color: 'var(--text-faint)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px', fontWeight: 700 }}>Metric</th>
                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>Current</th>
                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>{previousLabel || 'Previous'}</th>
                  <th style={{ padding: '6px 10px', fontWeight: 700 }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {periodComparison.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text)' }}>{row.metric}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text)', textAlign: 'right' }}>{formatMetricValue(row.current)}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-muted)', textAlign: 'right' }}>{formatMetricValue(row.previous)}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <TrendBadge direction={row.direction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {periodComparison.some((row) => row.observation) && (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {periodComparison.map((row, i) =>
                row.observation ? (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45 }}>
                    <strong style={{ color: 'var(--text-muted)' }}>{row.metric}:</strong> {row.observation}
                  </li>
                ) : null
              )}
            </ul>
          )}
        </section>
      )}

      {actionPlan.length > 0 && (
        <section>
          <SectionHeading>Your Action Plan</SectionHeading>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actionPlan.map((a, i) => {
              const done = doneActions && doneActions.has(i);
              return (
                <li key={i} className="card" style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'var(--bg)', alignItems: 'flex-start' }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`Toggle action: ${a.title}`}
                    onClick={() => onToggleAction(i)}
                    style={{
                      flexShrink: 0,
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: '1.5px solid var(--border)',
                      background: done ? 'rgba(22,163,74,0.2)' : 'transparent',
                      color: done ? 'var(--win)' : 'transparent',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                      marginTop: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <div style={{ minWidth: 0, flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.title}</span>
                      {a.timeframe && <TimeframeTag timeframe={a.timeframe} />}
                      {a.measurable && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-faint)' }}>
                          measurable
                        </span>
                      )}
                    </div>
                    {a.why && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 3 }}>
                        <span style={{ fontWeight: 700 }}>Why:</span> {a.why}
                      </div>
                    )}
                    {a.evidence && <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45, marginTop: 3 }}>{a.evidence}</div>}
                    {a.completionHint && (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45, marginTop: 3 }}>
                        <ClipboardList size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} aria-hidden />
                        {a.completionHint}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '8px 0 0' }}>
            Completion is tracked locally for this session only — nothing is written to your journal.
          </p>
        </section>
      )}

      {watchItems.length > 0 && (
        <section>
          <SectionHeading>Worth Monitoring</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {watchItems.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Activity size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeading>Data Quality</SectionHeading>
        <div className="card" style={{ padding: '12px 14px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CoverageChip coverage={dqCoverage} />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {dq.tradeCount} trade{dq.tradeCount === 1 ? '' : 's'} analyzed
            </span>
            {previousLabel && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>vs {previousLabel}</span>}
          </div>
          {limitations.length > 0 && (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {limitations.map((l, i) => (
                <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-faint)' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-faint)', marginTop: 6, flexShrink: 0 }} aria-hidden />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
          {result.disclaimer || 'AI coaching is based only on recorded journal data. Not financial advice.'}
        </p>
      </footer>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const color = PRIORITY_TONE[priority] || '#94a3b8';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 6,
        background: `${color}18`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {priority}
    </span>
  );
}

function SourceTag({ label }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-faint)', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function TimeframeTag({ timeframe }) {
  const labelMap = {
    TODAY: 'Today',
    THIS_WEEK: 'This week',
    NEXT_7_DAYS: 'Next 7 days',
    NEXT_REVIEW: 'Next review',
  };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.10)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {labelMap[timeframe] || timeframe}
    </span>
  );
}