// AI Ask Journal — the Sprint 9.5 UI.
//
// Lives on the Analytics page (wired in Analytics.jsx) as a premium, read-only
// AI section. Contract:
//   - The AI request happens ONLY when the user explicitly clicks
//     "Analyze Journal" — never on mount, route change, filter change, typing,
//     login, or every render.
//   - Account isolation is inherited AND enforced: the Analyze action is only
//     available with a single concrete account selected. In "All Accounts"
//     mode the action is disabled and the user is told to pick an account.
//   - The analyzed scope (period / pair / session / setup) reuses the SAME
//     canonical journal filters the verified widgets use (applyJournalScope).
//     Nothing is silently mixed; nothing is computed a second time.
//   - A previous result is marked STALE the moment the scope fingerprint
//     changes; if the scope changes WHILE a request is loading the stale result
//     is discarded and a fresh explicit Ask is required.
//   - Loading disables the trigger (duplicate-request protection) + sets
//     aria-busy; errors surface only safe, human-readable messages via
//     aria-live (safeAskJournalErrorMessage), never raw provider data.
//   - READ-ONLY: no trade / balance / PnL / RR / risk / filter / plan /
//     reflection / goal writes exist anywhere in this component.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Activity,
  MessageCircleQuestion,
  Database,
  Info,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import {
  generateAIJournalAnswer,
  normalizeAskJournalQuestion,
  safeAskJournalErrorMessage,
  validateAskJournalQuestion,
  AI_INVALID_QUESTION,
  DATA_COVERAGE,
} from '../../lib/ai/askJournal';
import {
  applyJournalScope,
  createScopeFingerprint,
  analyzedScopeLabel,
  scopeLabel,
  AI_NOT_ENOUGH_DATA,
  dataCoverageLabel,
  buildJournalDataQuality,
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

const EXAMPLE_PROMPTS = [
  'What is my biggest recurring mistake?',
  'Which session performs best?',
  'What changed this month?',
  'Which setup is strongest?',
  'What should I improve next?',
];

const RED = '#c1121f';

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
  background: 'rgba(193,18,31,0.14)',
  borderColor: 'rgba(193,18,31,0.45)',
  color: 'var(--text)',
};

function FilterSelect({ label, options, value, onChange, disabled }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)' }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
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

export default function AIAskJournal({ provider, accountIdOverride, accountNameOverride, reportState }) {
  const { trades, models, riskCriteria, checklistCriteria, reflections } = useData();
  const { allAccounts, selectedAccount, getAccountName } = useAccounts();

  const [question, setQuestion] = useState('');
  const [period, setPeriod] = useState('all');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [setup, setSetup] = useState('All');

  const [phase, setPhase] = useState('idle'); // idle | loading | success | error
  const [errorCode, setErrorCode] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState(null);
  const [analyzedLabel, setAnalyzedLabel] = useState('');
  const [analyzedQuestion, setAnalyzedQuestion] = useState('');
  const busyRef = useRef(false);
  const requestFingerprintRef = useRef(null);

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

  function scopeText() {
    if (stale) return scopeLabel({ period, pair: safePair, session: safeSession, setup: safeSetup });
    return analyzedLabel || scopeLabel({ period, pair: safePair, session: safeSession, setup: safeSetup });
  }

  async function onAnalyze() {
    // Duplicate-request guard + explicit-trigger-only contract.
    if (busyRef.current || !accountId) return;
    const normalized = normalizeAskJournalQuestion(question);
    // Quick validation check: empty/directive questions are still routed to the
    // safe controlled state by the module (never a raw provider call), but we
    // skip the whole round-trip for an empty question.
    const preflight = validateAskJournalQuestion(normalized);
    if (!preflight.ok && preflight.reason === 'empty') {
      setResult(null);
      setErrorCode(AI_INVALID_QUESTION);
      setPhase('error');
      return;
    }

    busyRef.current = true;
    requestFingerprintRef.current = currentFingerprint;
    setPhase('loading');
    setErrorCode(null);
    setResult(null);
    setNotice(null);
    try {
      const outcome = await generateAIJournalAnswer({
        question: normalized,
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

      // Scope changed while the request was loading → discard the stale result
      // and require a fresh explicit Ask action.
      if (requestFingerprintRef.current !== currentFingerprint) {
        setPhase('idle');
        setNotice('Your journal scope changed while analyzing. Run a fresh Ask to analyze the current scope.');
        return;
      }

      if (outcome.ok && outcome.analysis) {
        setResult(outcome.analysis);
        setAnalyzedFingerprint(currentFingerprint);
        setAnalyzedQuestion(normalized);
        setAnalyzedLabel(
          analyzedScopeLabel({ period, pair: safePair, session: safeSession, setup: safeSetup }, scopedCount)
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
    setAnalyzedQuestion('');
    setNotice(null);
  }

  return (
    <section
      aria-label="EdgeJournal AI — Ask Your Journal"
      aria-busy={busy}
      className="card card-lift"
      style={{ padding: 22, overflow: 'hidden', position: 'relative' }}
    >
      <div className="ej-ask-grid" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <MessageCircleQuestion size={16} color={RED} aria-hidden /> Ask Your Journal
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>
                · {allAccounts ? '(All Accounts)' : selectedAccount?.name || '—'}
              </span>
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 720, marginBottom: 0 }}>
              Turn your trading history into actionable insight. Ask any question about your recorded journal — answers come only from the selected account's data, never from market predictions.
            </p>
          </div>
          <div role="group" aria-label="Ask journal period" style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {PERIODS.map((p) => (
              <button key={p.value} type="button" onClick={() => setPeriod(p.value)} disabled={busy} style={{ ...chipBase, ...(period === p.value ? chipActive : {}) }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <FilterSelect label="Pair" options={pairOptions} value={safePair} onChange={setPair} disabled={busy} />
          <FilterSelect label="Session" options={sessionOptions} value={safeSession} onChange={setSession} disabled={busy} />
          <FilterSelect label="Setup" options={setupOptions} value={safeSetup} onChange={setSetup} disabled={busy} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {allAccounts ? 'Scope: All Accounts' : `Analyzing: ${accountName || '—'} · ${scopeText()}`}
            {' · '}
            <strong style={{ color: 'var(--text)' }}>
              {scopedCount} trade{scopedCount === 1 ? '' : 's'}
            </strong>
          </span>
        </div>

        {allAccounts ? (
          <Notice tone="warn">Select a single account to analyze your journal — AI never mixes account data.</Notice>
        ) : noSingleAccount ? (
          <Notice tone="warn">Select an account to analyze your journal.</Notice>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label htmlFor="ej-ask-question" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            What would you like to understand about your trading?
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              id="ej-ask-question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={busy}
              placeholder="e.g. What was my best trading session this month?"
              autoComplete="off"
              style={{
                flex: 1,
                minWidth: 260,
                background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
                border: '1.5px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                padding: '10px 12px',
                fontSize: 13.5,
                fontWeight: 500,
              }}
            />
            <button
              type="button"
              className="btn btn-accent"
              onClick={onAnalyze}
              disabled={busy || noSingleAccount}
              aria-disabled={busy || noSingleAccount}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <Sparkles size={14} aria-hidden /> Analyze Journal
            </button>
          </div>

          <div role="group" aria-label="Example questions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setQuestion(p)}
                disabled={busy}
                aria-label={`Try example: ${p}`}
                style={{ ...chipBase, border: '1px solid var(--border)', color: 'var(--text-faint)', background: 'var(--bg-elevated, rgba(255,255,255,0.01))', ...(question === p ? chipActive : {}) }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite">
          {notice && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.10)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} aria-hidden />
              <span>{notice}</span>
            </div>
          )}

          {stale && (
            <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.10)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              <AlertTriangle size={14} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} aria-hidden />
              <div style={{ flex: 1 }}>
                <span>Your journal scope changed — this answer belongs to an earlier scope. Run a fresh Ask.</span>
              </div>
              <button type="button" onClick={onDismissStale} style={{ border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }} aria-label="Dismiss stale answer">
                Dismiss
              </button>
            </div>
          )}

          {phase === 'idle' && !busy && <IdleState count={scopedCount} />}
          {busy && <LoadingState />}
          {phase === 'success' && result && !busy && <SuccessState result={result} analyzedQuestion={analyzedQuestion} />}
          {phase === 'error' && !busy && (
            <ErrorState code={errorCode} message={safeAskJournalErrorMessage(errorCode)} onRetry={onAnalyze} />
          )}
        </div>
      </div>
    </section>
  );
}

function Notice({ tone = 'info', children }) {
  const bg = tone === 'warn' ? 'rgba(245,158,11,0.10)' : 'rgba(193,18,31,0.10)';
  const color = tone === 'warn' ? '#f59e0b' : RED;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 10, background: bg, fontSize: 12.5, color: 'var(--text-muted)' }}>
      <Info size={14} style={{ color, marginTop: 2, flexShrink: 0 }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function IdleState({ count }) {
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.95 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Ask a question about the <strong>{count}</strong> trade{count === 1 ? '' : 's'} currently in scope. Your journal assistant answers only from this recorded data — nothing is changed, and no trading is suggested.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="ej-ask-fade" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Loader2 size={15} className="ejs-spin" aria-hidden />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing journal…</span>
    </div>
  );
}

function ErrorState({ code, message, onRetry }) {
  if (code === 'AI_NOT_CONFIGURED') {
    return <NotConfiguredState message={message} />;
  }
  if (code === AI_NOT_ENOUGH_DATA) {
    return <LimitedDataState />;
  }
  if (code === AI_INVALID_QUESTION) {
    return (
      <div role="status" className="ej-ask-fade" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={15} style={{ color: RED, marginTop: 2, flexShrink: 0 }} aria-hidden />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{message}</p>
        </div>
      </div>
    );
  }
  return (
    <div role="alert" aria-live="assertive" className="ej-ask-fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <ShieldAlert size={15} style={{ color: 'var(--red)', marginTop: 2, flexShrink: 0 }} aria-hidden />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{message}</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
        Try again
      </button>
    </div>
  );
}

function NotConfiguredState({ message }) {
  return (
    <div role="status" className="ej-ask-fade" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Database size={15} style={{ color: 'var(--text-faint)', marginTop: 2, flexShrink: 0 }} aria-hidden />
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{message}</p>
    </div>
  );
}

function LimitedDataState() {
  return (
    <div role="status" className="ej-ask-fade" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Info size={15} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} aria-hidden />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Your journal does not contain enough data for a reliable conclusion in this scope. Log more trades or widen the filters, then ask again.
        </p>
      </div>
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

function SuccessState({ result, analyzedQuestion }) {
  const keys = (arr) => (Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : []);
  const observations = keys(result.observations);
  const evidence = keys(result.supportingEvidence);
  const strengths = keys(result.strengths);
  const weaknesses = keys(result.weaknesses);
  const risks = keys(result.risks);
  const improvements = keys(result.improvements);
  const dq = result.dataQuality && typeof result.dataQuality === 'object' ? result.dataQuality : buildJournalDataQuality(0);
  const coverage = normalizeCoverage(dq);

  const showAnything =
    !!result.answer || !!result.summary || observations.length || evidence.length || strengths.length || weaknesses.length || improvements.length || risks.length;

  if (!showAnything) {
    return (
      <div role="status" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
        No answer was returned for the selected scope.
      </div>
    );
  }

  return (
    <div className="ej-ask-fade" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {analyzedQuestion && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Question: <strong style={{ color: 'var(--text-muted)' }}>“{analyzedQuestion}”</strong>
        </div>
      )}

      {coverage !== DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} aria-hidden />
            <span>
              Your journal does not contain enough data in this scope for a reliable conclusion ({dq.tradeCount} trade{dq.tradeCount === 1 ? '' : 's'}).
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Treat the answer below as an early observation, not a proven edge.
          </span>
        </div>
      )}

      {result.answer && (
        <section>
          <SectionHeading>Answer</SectionHeading>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.6, fontWeight: 600 }}>{result.answer}</p>
        </section>
      )}

      {result.summary && (
        <section>
          <SectionHeading>Summary</SectionHeading>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{result.summary}</p>
        </section>
      )}

      {evidence.length > 0 && (
        <section>
          <SectionHeading>Supporting Evidence</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {evidence.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Database size={13} style={{ color: RED, marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {observations.length > 0 && <InsightList title="Observations" items={observations} accent={RED} />}
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

      {weaknesses.length > 0 && (
        <section>
          <SectionHeading>Weaknesses</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {weaknesses.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ color: 'var(--loss)', marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {improvements.length > 0 && (
        <section>
          <SectionHeading>Improvement Ideas</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {improvements.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ArrowRight size={14} style={{ color: RED, marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {risks.length > 0 && (
        <section>
          <SectionHeading>Risks</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 720 }}>
            {risks.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Activity size={14} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} aria-hidden />
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
            <CoverageChip coverage={coverage} />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {dq.tradeCount} trade{dq.tradeCount === 1 ? '' : 's'} analyzed
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              AI Confidence: <strong style={{ color: 'var(--text-muted)' }}>{confidenceLabel(result.confidence)}</strong>
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