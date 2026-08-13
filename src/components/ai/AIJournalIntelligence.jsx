// AI Journal Intelligence — the Sprint 9.3 UI.
//
// Lives on the Analytics page (wired in Analytics.jsx) as a premium,
// read-only AI section. Contract:
//   - The AI request happens ONLY when the user explicitly clicks the
//     "Analyze Journal" button — never on mount, route change, filter change,
//     login, or every render.
//   - Account isolation is inherited AND enforced: the Analyze action is only
//     available with a single concrete account selected. In "All Accounts"
//     mode the action is disabled and the user is told to pick an account.
//   - The analyzed scope (period / pair / session / setup) is chosen here and
//     applied to trades using the SAME canonical filters the verified
//     analytics widgets use (applyJournalScope). Nothing is silently mixed.
//   - A previous result is marked STALE the moment the scope fingerprint
//     changes, so stale AI output can never masquerade as current analysis.
//   - Loading disables the trigger (duplicate-request protection) + sets
//     aria-busy; errors surface only safe, human-readable messages via
//     aria-live. READ-ONLY: no trade / balance / PnL / RR / risk / filter
//     writes exist anywhere in this component.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import {
  analyzeJournalIntelligence,
  applyJournalScope,
  createScopeFingerprint,
  analyzedScopeLabel,
  scopeLabel,
  safeJournalErrorMessage,
  AI_NOT_ENOUGH_DATA,
  dataCoverageLabel,
} from '../../lib/ai/journalIntelligence';
import { confidenceLabel } from '../../lib/ai/tradeReview';
import { UNASSIGNED_LABEL } from '../../lib/setupPerformance';
import { sessionKey } from '../../lib/heatmap';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: '30', label: 'Last 30 Days' },
];

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
  borderColor: 'rgba(124,58,237,0.4)',
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

// Shared data-coverage tone map (mirrors the canonical engines' color use).
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

export default function AIJournalIntelligence({ provider, accountIdOverride, accountNameOverride, reportState }) {
  const { trades, models, riskCriteria, checklistCriteria, reflections } = useData();
  const { allAccounts, selectedAccount, getAccountName } = useAccounts();

  const [period, setPeriod] = useState('all');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [setup, setSetup] = useState('All');

  const [phase, setPhase] = useState('idle'); // idle | loading | success | error
  const [errorCode, setErrorCode] = useState(null);
  const [result, setResult] = useState(null);
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState(null);
  const [analyzedLabel, setAnalyzedLabel] = useState('');
  const busyRef = useRef(false);

  const accountId = accountIdOverride || (allAccounts ? null : selectedAccount?.id || null);
  const accountName =
    (accountNameOverride !== undefined ? accountNameOverride : getAccountName?.(accountId)) || selectedAccount?.name || null;

  const scope = { period, pair, session, setup };

  // Scoped dataset — the SAME canonical journal scope the verified widgets use.
  const focusedTrades = useMemo(
    () => applyJournalScope(trades.items, { period, pair, session, setup }),
    [trades.items, period, pair, session, setup]
  );

  const currentFingerprint = useMemo(
    () => createScopeFingerprint(trades.items, { accountId, period, pair, session, setup }),
    [trades.items, accountId, period, pair, session, setup]
  );

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

  async function onAnalyze() {
    // Duplicate-request guard + explicit-trigger-only contract.
    if (busyRef.current || !accountId) return;
    busyRef.current = true;
    setPhase('loading');
    setErrorCode(null);
    setResult(null);
    try {
      const outcome = await analyzeJournalIntelligence({
        trades: trades.items,
        accountId,
        accountName,
        period,
        pair: safePair,
        session: safeSession,
        setup: safeSetup,
        provider,
        system: { models, riskCriteria, checklistCriteria, reflections: reflections.items },
      });
      if (outcome.ok && outcome.analysis) {
        setResult(outcome.analysis);
        setAnalyzedFingerprint(currentFingerprint);
        setAnalyzedLabel(analyzedScopeLabel({ ...scope, pair: safePair, session: safeSession, setup: safeSetup }, focusedTrades.length));
        setPhase('success');
      } else {
        setErrorCode(outcome.status || 'AI_PROVIDER_ERROR');
        setPhase('error');
      }
    } catch (err) {
      // analyze*() never throws for user-facing reasons; this is a hard backup.
      setErrorCode('AI_PROVIDER_ERROR');
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <section
      aria-label="EdgeJournal AI — Journal Intelligence"
      aria-busy={busy}
      className="card card-lift"
      style={{ padding: 22, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Sparkles size={16} color="#7c3aed" /> AI Journal Intelligence
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>
              · {allAccounts ? '(All Accounts)' : selectedAccount?.name || '—'}
            </span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 700, marginBottom: 0 }}>
            A read-only, journal-level read of your recorded analytics — which setups and pairs show the strongest recorded performance, which mistakes recur, and which discipline areas deserve attention. Advisory only; never a signal generator.
          </p>
        </div>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={{ ...chipBase, ...(period === p.value ? chipActive : {}) }}>
              {p.label}
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
            {allAccounts ? 'Scope: All Accounts' : analyzedLabel || `Scope: ${scopeLabel(scope)}`}
            {' · '}
            <strong style={{ color: 'var(--text)' }}>
              {scopedCount} trade{scopedCount === 1 ? '' : 's'}
            </strong>
          </span>
          <button
            type="button"
            className="btn btn-accent"
            onClick={onAnalyze}
            disabled={busy || noSingleAccount}
            aria-disabled={busy || noSingleAccount}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={14} aria-hidden /> Analyze Journal
          </button>
        </div>
      </div>

      {allAccounts ? (
        <Notice tone="warn">Journal Intelligence requires a single account. Select one account to analyze — it never mixes accounts.</Notice>
      ) : noSingleAccount ? (
        <Notice tone="warn">Select an account to run Journal Intelligence.</Notice>
      ) : null}

      <div aria-live="polite">
        {stale && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.10)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} aria-hidden />
            <span>Journal scope changed — run AI analysis again.</span>
          </div>
        )}

        {phase === 'idle' && !busy && <IdleState count={scopedCount} />}
        {busy && <LoadingState />}
        {phase === 'success' && result && !busy && <SuccessState result={result} />}
        {phase === 'error' && !busy && <ErrorState code={errorCode} message={safeJournalErrorMessage(errorCode)} onRetry={onAnalyze} />}
      </div>
    </section>
  );
}

function Notice({ tone = 'info', children }) {
  const bg = tone === 'warn' ? 'rgba(245,158,11,0.10)' : 'rgba(124,58,237,0.10)';
  const color = tone === 'warn' ? '#f59e0b' : '#7c3aed';
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 10, background: bg, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
      <BarChart3 size={14} style={{ color, marginTop: 2, flexShrink: 0 }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function IdleState({ count }) {
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Run Journal Intelligence to get an executive read of <strong>{count}</strong> trade{count === 1 ? '' : 's'} in the current scope. It only reads your recorded journal data — nothing is changed.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Loader2 size={15} className="ejs-spin" aria-hidden />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing your journal…</span>
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
    <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function SuccessState({ result }) {
  const keys = (arr) => (Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : []);
  const strengths = keys(result.strengths);
  const improvementAreas = keys(result.improvementAreas);
  const watchlist = keys(result.watchlist);
  const setupInsights = keys(result.setupInsights);
  const pairSessionInsights = keys(result.pairSessionInsights);
  const disciplineInsights = keys(result.disciplineInsights);
  const keyInsights = Array.isArray(result.keyInsights) ? result.keyInsights : [];
  const recurringIssues = Array.isArray(result.recurringIssues) ? result.recurringIssues : [];
  const dq = result.dataQuality && typeof result.dataQuality === 'object' ? result.dataQuality : {};

  const showAnything = !!result.summary || keyInsights.length || strengths.length || recurringIssues.length || setupInsights.length || pairSessionInsights.length || disciplineInsights.length || improvementAreas.length || watchlist.length;

  if (!showAnything) {
    return (
      <div role="status" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
        No journal-level findings were returned for the selected scope.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {result.summary && (
        <section>
          <SectionHeading>Executive Summary</SectionHeading>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{result.summary}</p>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
            AI Confidence: <strong style={{ color: 'var(--text)' }}>{confidenceLabel(result.confidence)}</strong>
          </div>
        </section>
      )}

      {keyInsights.length > 0 && (
        <section>
          <SectionHeading>Key Insights</SectionHeading>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {keyInsights.map((ins, i) => (
              <li key={i} style={{ display: 'flex', gap: 10 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(124,58,237,0.14)',
                    color: '#7c3aed',
                    fontSize: 11.5,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  {ins.title && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ins.title}</div>}
                  {ins.observation && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{ins.observation}</div>}
                  {ins.evidence && <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45, marginTop: 3 }}>{ins.evidence}</div>}
                  {ins.confidence !== undefined && ins.confidence !== null && (
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                      Confidence: <strong style={{ color: 'var(--text-muted)' }}>{confidenceLabel(ins.confidence)}</strong>
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
          <SectionHeading>Strengths</SectionHeading>
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

      {recurringIssues.length > 0 && (
        <section>
          <SectionHeading>Recurring Issues</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recurringIssues.map((ins, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ color: 'var(--loss)', marginTop: 2, flexShrink: 0 }} aria-hidden />
                <div style={{ minWidth: 0 }}>
                  {ins.title && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ins.title}</div>}
                  {ins.observation && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{ins.observation}</div>}
                  {ins.evidence && <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45, marginTop: 3 }}>{ins.evidence}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {setupInsights.length > 0 && <InsightList title="Setup Intelligence" items={setupInsights} accent="#c026d3" />}
      {pairSessionInsights.length > 0 && <InsightList title="Pair & Session Intelligence" items={pairSessionInsights} accent="#e07b00" />}
      {disciplineInsights.length > 0 && <InsightList title="Discipline" items={disciplineInsights} accent="#f59e0b" />}

      {improvementAreas.length > 0 && (
        <section>
          <SectionHeading>Improvement Areas</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {improvementAreas.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ArrowRight size={14} style={{ color: 'var(--red)', marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {watchlist.length > 0 && (
        <section>
          <SectionHeading>Worth Monitoring</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {watchlist.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <BarChart3 size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} aria-hidden />
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
            <CoverageChip coverage={normalizeCoverage(dq)} />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {dq.tradeCount} trade{dq.tradeCount === 1 ? '' : 's'} analyzed
            </span>
          </div>
          {Array.isArray(dq.limitations) && dq.limitations.length > 0 && (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dq.limitations.map((l, i) => (
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
          {result.disclaimer || 'AI-generated analysis based only on recorded journal data. Not financial advice.'}
        </p>
      </footer>
    </div>
  );
}

function normalizeCoverage(dq) {
  const known = ['NOT_ENOUGH_DATA', 'LIMITED_DATA', 'EARLY_PATTERN', 'NORMAL_PATTERN_ANALYSIS'];
  if (known.includes(dq.coverage)) return dq.coverage;
  const clean = typeof dq.coverage === 'string' ? dq.coverage.toUpperCase().replace(/[^A-Z_]/g, '') : '';
  return known.find((k) => k === clean) || 'LIMITED_DATA';
}

function InsightList({ title, items, accent }) {
  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: accent, marginTop: 5, flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}