// Edge AI Command Center — the Sprint 9.5 presentation shell.
//
// A premium orchestration layer that organizes the four read-only AI features
// (Journal Intelligence, Trade Review, AI Coach, Ask Journal) into ONE cohesive
// terminal instead of a vertical stack of independent cards.
//
// Contract (inherited from the individual Sprint 9.1–9.5 modules):
//   - EXPLICIT TRIGGER ONLY: selecting a feature card only expands its detail.
//     No AI request ever fires on mount, card switch, typing, route change or
//     filter change. Only each feature's own explicit CTA triggers AI.
//   - ONLY ONE FEATURE EXPANDS: the detailed content of a single feature is
//     mounted at a time; switching cards swaps the panel. Nothing auto-fires.
//   - ACCOUNT ISOLATION (NON-NEGOTIABLE): account-scoped features (Journal
//     Intelligence, AI Coach, Ask Journal) are disabled in "All Accounts" mode
//     and the user is told to pick a single account. Mixed-account data is
//     never analyzed. The authoritative per-feature guards still apply inside.
//   - AI STATUS WITHOUT DETAILS: the header shows only "AI READY" /
//     "AI NOT CONFIGURED" — no provider names, no keys, no plans.
//   - READ-ONLY: this shell writes no trades, balances, PnL, RR, risk, scores,
//     filters, or saved views. Trade Review remains an entry point only.
//
// Each feature component keeps its own state machine (IDLE / LOADING /
// SUCCESS / LIMITED DATA / NOT CONFIGURED / ERROR / STALE RESULT) and reports
// it upward via the optional reportState prop so the card chips stay live
// without ever creating a parallel state system.

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShieldAlert,
  Activity,
  BarChart3,
  ClipboardList,
  MessageCircleQuestion,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useAccounts } from '../../context/AccountContext';
import { resolveAIConfig } from '../../lib/ai/provider';
import { fetchRemoteHealth, interpretHealthProbe } from '../../lib/ai/remote';
import { AI_NOT_ENOUGH_DATA } from '../../lib/ai/journalIntelligence';
import AIJournalIntelligence from './AIJournalIntelligence';
import AICoaching from './AICoaching';
import AIAskJournal from './AIAskJournal';
import TradeReviewPanel from '../tradeReview/TradeReviewPanel';

const RED = '#c1121f';

// Safe public AI status vocabulary — READY / NOT_CONFIGURED / UNAVAILABLE.
// Never provider names, keys, plans, or diagnostics.
const AI_STATUS_META = {
  READY: {
    label: 'AI READY',
    ready: true,
    color: 'var(--win)',
    background: 'rgba(47,214,110,0.06)',
  },
  NOT_CONFIGURED: {
    label: 'AI NOT CONFIGURED',
    ready: false,
    color: 'var(--text-faint)',
    background: 'rgba(255,255,255,0.02)',
  },
  UNAVAILABLE: {
    label: 'AI UNAVAILABLE',
    ready: false,
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.08)',
  },
};

const FEATURES = [
  {
    id: 'journal',
    title: 'Journal Intelligence',
    icon: BarChart3,
    blurb: 'Find recurring patterns across your trading history.',
    cta: 'Analyze Journal',
    requiresAccount: true,
  },
  {
    id: 'trade',
    title: 'Trade Review',
    icon: Activity,
    blurb: 'Understand what happened in a specific trade.',
    cta: 'Review Trade',
    requiresAccount: false,
  },
  {
    id: 'coach',
    title: 'AI Coach',
    icon: ClipboardList,
    blurb: 'Turn your journal data into a focused action plan.',
    cta: 'Generate Plan',
    requiresAccount: true,
  },
  {
    id: 'ask',
    title: 'Ask Journal',
    icon: MessageCircleQuestion,
    blurb: 'Ask natural-language questions about your trading history.',
    cta: 'Ask Your Journal',
    requiresAccount: true,
  },
];

export default function EdgeAICommandCenter({
  provider,
  accountIdOverride,
  accountNameOverride,
  selectedTrade,
  onReviewTrade,
  onCloseReview,
  onNavigate,
}) {
  const { allAccounts, selectedAccount } = useAccounts();
  const [active, setActive] = useState('journal');
  const [featureState, setFeatureState] = useState({
    journal: { phase: 'idle' },
    coach: { phase: 'idle' },
    ask: { phase: 'idle' },
  });

  const accountId = accountIdOverride || (allAccounts ? null : selectedAccount?.id || null);
  const gated = !accountId;

  // Status indicator only: READY / NOT_CONFIGURED / UNAVAILABLE, with no
  // technical detail. Default (VITE flags unset, or NOT the remote bridge) is
  // "AI NOT CONFIGURED" — the same closed default the whole foundation ships
  // with. When the remote bridge is enabled (VITE_AI_ENABLED + remote) a
  // single, lightweight health probe on mount decides the safe state; this is
  // a status probe only — it never fires an AI analysis, and it is never
  // re-fetched on render, account change, filter change or login.
  const [aiStatus, setAiStatus] = useState('NOT_CONFIGURED');

  useEffect(() => {
    let cancelled = false;
    let cfg;
    try {
      cfg = resolveAIConfig();
    } catch (_) {
      cfg = { enabled: false, provider: 'none' };
    }
    if (cfg.enabled !== true || cfg.provider !== 'remote') {
      setAiStatus('NOT_CONFIGURED');
      return undefined;
    }
    fetchRemoteHealth()
      .then((probe) => {
        if (!cancelled) setAiStatus(interpretHealthProbe(probe));
      })
      .catch(() => {
        if (!cancelled) setAiStatus('UNAVAILABLE');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable per-feature reporters: the child components receive these as props,
  // so their identity must be stable across renders or the child's reportState
  // effect would re-fire forever.
  const reporterCache = useRef({});
  function report(key) {
    if (!reporterCache.current[key]) {
      reporterCache.current[key] = (derived) => {
        setFeatureState((prev) => ({ ...prev, [key]: derived }));
      };
    }
    return reporterCache.current[key];
  }

  const activeFeature = FEATURES.find((f) => f.id === active);

  function chipFor(id) {
    if (id === 'trade') {
      return selectedTrade
        ? { label: 'Trade selected', tone: 'ok' }
        : { label: 'Select a trade', tone: 'muted' };
    }
    const meta = FEATURES.find((f) => f.id === id);
    if (meta.requiresAccount && gated) return { label: 'Account required', tone: 'warn' };
    const s = featureState[id] || { phase: 'idle' };
    switch (s.phase) {
      case 'loading':
        return { label: 'Analyzing', tone: 'active' };
      case 'success':
        return s.stale ? { label: 'Stale result', tone: 'warn' } : { label: 'Result ready', tone: 'ok' };
      case 'error':
        if (s.status === 'AI_NOT_CONFIGURED') return { label: 'Not configured', tone: 'muted' };
        if (s.status === AI_NOT_ENOUGH_DATA || (typeof s.status === 'string' && s.status.includes('LIMITED'))) {
          return { label: 'Limited data', tone: 'warn' };
        }
        return { label: 'Needs attention', tone: 'warn' };
      default:
        return { label: 'Ready', tone: 'muted' };
    }
  }

  function renderDetail() {
    switch (active) {
      case 'trade':
        return (
          <TradeReviewDetail
            selectedTrade={selectedTrade}
            onReviewTrade={onReviewTrade}
            onCloseReview={onCloseReview}
            onNavigate={onNavigate}
          />
        );
      case 'journal':
        if (gated) return <GateDetail label="Journal Intelligence" />;
        return (
          <AIJournalIntelligence
            provider={provider}
            accountIdOverride={accountIdOverride}
            accountNameOverride={accountNameOverride}
            reportState={report('journal')}
          />
        );
      case 'coach':
        if (gated) return <GateDetail label="AI Coach" />;
        return (
          <AICoaching
            provider={provider}
            accountIdOverride={accountIdOverride}
            accountNameOverride={accountNameOverride}
            reportState={report('coach')}
          />
        );
      case 'ask':
        if (gated) return <GateDetail label="Ask Journal" />;
        return (
          <AIAskJournal
            provider={provider}
            accountIdOverride={accountIdOverride}
            accountNameOverride={accountNameOverride}
            reportState={report('ask')}
          />
        );
      default:
        return null;
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      aria-label="Edge AI Command Center"
      className="card ejc-shell"
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      <div className="ejc-grid-bg" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', padding: '22px 22px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div className="ejc-eyebrow" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.22em', color: RED, textTransform: 'uppercase' }}>
              EDGE AI
            </div>
            <h2 style={{ margin: '6px 0 0', fontSize: 23, fontWeight: 800, color: 'var(--text)', letterSpacing: '0.01em' }}>
              Your trading intelligence layer
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-faint)', maxWidth: 640, lineHeight: 1.5 }}>
              Analyze your journal, review execution, and build better habits.
            </p>
          </div>
          <span
            className="ejc-status"
            data-ready={AI_STATUS_META[aiStatus]?.ready === true}
            data-state={aiStatus}
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: AI_STATUS_META[aiStatus]?.color || 'var(--text-faint)',
              border: '1px solid var(--border)',
              background: AI_STATUS_META[aiStatus]?.background || 'rgba(255,255,255,0.02)',
              padding: '5px 10px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            <span className="ejc-dot" aria-hidden />
            {AI_STATUS_META[aiStatus]?.label || 'AI NOT CONFIGURED'}
          </span>
        </div>

        {gated && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 14,
              padding: '9px 12px',
              borderRadius: 10,
              background: 'rgba(245,158,11,0.10)',
              fontSize: 12.5,
              color: 'var(--text-muted)',
            }}
          >
            <AlertTriangle size={14} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} aria-hidden />
            <span>Select a single account to analyze your journal — AI never mixes account data.</span>
          </div>
        )}

        <div className="ejc-grid" role="group" aria-label="Edge AI features" style={{ marginTop: 16 }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const isActive = active === f.id;
            const disabled = f.requiresAccount && gated;
            const chip = chipFor(f.id);
            return (
              <div
                key={f.id}
                className={`ejc-card${isActive ? ' ejc-card-active' : ''}${disabled ? ' ejc-card-disabled' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 9 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      border: '1px solid rgba(193,18,31,0.35)',
                      background: 'rgba(193,18,31,0.08)',
                      color: RED,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    <Icon size={15} />
                  </span>
                  <span className="ejc-chip" data-tone={chip.tone}>
                    {chip.label}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.blurb}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm ejc-card-cta"
                  aria-label={`Open ${f.title}`}
                  aria-pressed={isActive}
                  aria-controls="ejc-panel"
                  disabled={disabled}
                  onClick={() => setActive(f.id)}
                  style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}
                >
                  <Sparkles size={13} aria-hidden />
                  {f.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div
        id="ejc-panel"
        role="region"
        aria-live="polite"
        aria-label={`${activeFeature.title} — expanded detail`}
        className="ejc-panel"
        style={{ position: 'relative', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.18)', padding: 22 }}
      >
        <div key={active} className="ejc-panel-fade" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {renderDetail()}
        </div>
      </div>
    </motion.section>
  );
}

function GateDetail({ label }) {
  return (
    <div role="status" className="ejc-fade" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
      <ShieldAlert size={15} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} aria-hidden />
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        {label} requires a single account. Select one account to analyze its data — AI never mixes accounts.
      </p>
    </div>
  );
}

// Trade Review stays an ENTRY POINT in the Command Center. The full read-only
// panel (TradeReviewPanel + AITradeReview) is reused unchanged; nothing here
// recomputes canonical metrics.
function TradeReviewDetail({ selectedTrade, onReviewTrade, onCloseReview, onNavigate }) {
  const [panelOpen, setPanelOpen] = useState(false);

  if (selectedTrade) {
    return (
      <div className="ejc-fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          A trade is selected for review. Open the full read-only review panel to inspect execution and run the AI review on this trade.
        </p>
        <button
          type="button"
          className="btn btn-accent btn-sm"
          aria-label="Open Review Selected Trade"
          onClick={() => setPanelOpen(true)}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowRight size={14} aria-hidden /> Review Selected Trade
        </button>
        {panelOpen && (
          <TradeReviewPanel
            trade={selectedTrade}
            plan={{}}
            index={1}
            total={1}
            canPrev={false}
            canNext={false}
            onPrev={() => {}}
            onNext={() => {}}
            onClose={() => {
              setPanelOpen(false);
              onCloseReview?.();
            }}
            onOpenFull={() => {}}
            getAccountName={() => ''}
          />
        )}
        {typeof onReviewTrade === 'function' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReviewTrade(selectedTrade)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Activity size={13} aria-hidden /> Review in Journal
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ejc-fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }} role="status">
        Select a trade to start a review. Trade Review is a read-only deep view of a single real trade; every metric comes from the canonical journal engines.
      </p>
      <button
        type="button"
        className="btn btn-accent btn-sm"
        onClick={() => onNavigate?.('journal')}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Activity size={14} aria-hidden /> Review Trade
      </button>
    </div>
  );
}