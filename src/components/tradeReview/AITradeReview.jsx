// AI Trade Review — production-grade UI for the read-only Sprint 9.2 feature.
//
// Lives INSIDE the existing TradeReviewPanel; the manual review stays intact.
// The AI request happens ONLY when the user explicitly clicks "Analyze with
// AI" — never on trade open, render, typing, or filter changes.
//
// State machine: IDLE → LOADING → SUCCESS | ERROR(code)
//   - LOADING disables the trigger (duplicate-request protection) + aria-busy.
//   - ERROR surfaces only a safe, human-readable message — never a raw
//     provider error, API key, stack trace, or endpoint — via aria-live.
//
// READ-ONLY: the trade is only ever read. It is passed to the domain
// orchestrator (analyzeTradeReview → buildAITradeContext), which builds the
// frozen, account-scoped context — no write path exists in this component.

import { useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, ShieldAlert, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { analyzeTradeReview, buildTradeReviewCalculations, safeErrorMessage, confidenceLabel } from '../../lib/ai/tradeReview';

const LIST_SECTIONS = [
  { key: 'strengths', label: 'Strengths', icon: CheckCircle, tone: 'var(--win)' },
  { key: 'observations', label: 'Observations', icon: Sparkles, tone: 'var(--text-muted)' },
  { key: 'weaknesses', label: 'Areas to Improve', icon: AlertTriangle, tone: 'var(--loss)' },
  { key: 'risks', label: 'Risk & Discipline', icon: ShieldAlert, tone: 'var(--red)' },
  { key: 'improvements', label: 'Improvement Suggestions', icon: ArrowRight, tone: 'var(--red)' },
];

export default function AITradeReview({ trade, accountId, accountName, provider, duration }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | success | error
  const [errorCode, setErrorCode] = useState(null);
  const [result, setResult] = useState(null);
  const busyRef = useRef(false);

  // Canonical pass-through only: recorded fields + the panel's canonical
  // duration. Nothing (PnL / RR / risk / lot / duration) is recomputed here.
  // The single source of truth is tradeReview.buildTradeReviewCalculations.
  const calculations = useMemo(() => buildTradeReviewCalculations(trade, { duration }), [trade, duration]);

  const busy = phase === 'loading';

  async function onAnalyze() {
    // Duplicate-request guard: also keeps the button disabled while loading.
    if (!trade || busyRef.current) return;
    busyRef.current = true;
    setPhase('loading');
    setErrorCode(null);
    setResult(null);
    try {
      const scopedAccountId = accountId ?? trade.accountId ?? null;
      const reviewed = await analyzeTradeReview({
        trade,
        accountId: scopedAccountId,
        accountName: accountName ?? null,
        calculations,
        provider,
      });
      if (reviewed.ok && reviewed.analysis) {
        setResult(reviewed.analysis);
        setPhase('success');
      } else {
        setErrorCode(reviewed.status || 'AI_PROVIDER_ERROR');
        setPhase('error');
      }
    } catch (err) {
      // analyze() never throws for user-facing reasons; this is a hard backup.
      setErrorCode('AI_PROVIDER_ERROR');
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <section
      aria-label="AI Trade Review"
      style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(193,18,31,0.08)',
        }}
      >
        <Sparkles size={15} style={{ color: 'var(--red)', flexShrink: 0 }} aria-hidden />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em' }}>AI Trade Review</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>EdgeJournal AI · advisory only</div>
        </div>
      </div>

      <div style={{ padding: 16 }} aria-busy={busy}>
        {phase === 'idle' && !busy && (
          <IdleState onAnalyze={onAnalyze} />
        )}
        {busy && <LoadingState />}
        {phase === 'success' && result && !busy && <SuccessState result={result} />}
        {phase === 'error' && !busy && (
          <ErrorState
            code={errorCode}
            message={safeErrorMessage(errorCode)}
            onRetry={onAnalyze}
          />
        )}
      </div>
    </section>
  );
}

function IdleState({ onAnalyze }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Analyze this trade with EdgeJournal AI — a read-only review of execution, risk discipline, and improvement areas. Your trade is never changed.
      </p>
      <div>
        <button
          type="button"
          className="btn btn-accent btn-sm"
          onClick={onAnalyze}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Sparkles size={14} aria-hidden />
          Analyze with AI
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Loader2 size={14} className="ejs-spin" aria-hidden />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing trade…</span>
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
      {code !== 'AI_NOT_CONFIGURED' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          Try again
        </button>
      )}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 7 }}>
      {children}
    </div>
  );
}

function SuccessState({ result }) {
  const sections = LIST_SECTIONS.map((meta) => ({
    ...meta,
    items: (Array.isArray(result[meta.key]) ? result[meta.key] : []).filter((x) => typeof x === 'string' && x.trim()),
  }));
  const listVisible = sections.filter((s) => s.items.length > 0);
  const visibleAny = !!result.summary || listVisible.length > 0;

  if (!visibleAny) {
    return (
      <div role="status" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
        No AI findings were returned for this trade.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {result.summary && (
        <section>
          <SectionHeading>Summary</SectionHeading>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{result.summary}</p>
        </section>
      )}

      {listVisible.map(({ key, label, icon: Icon, tone, items }) => (
        <section key={key}>
          <SectionHeading>{label}</SectionHeading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {items.map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Icon size={14} style={{ color: tone, marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          AI Confidence: <strong style={{ color: 'var(--text)' }}>{confidenceLabel(result.confidence)}</strong>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
          {result.disclaimer || 'AI-generated analysis based only on recorded journal data. Not financial advice.'}
        </p>
      </footer>
    </div>
  );
}
