import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  RefreshCw,
  Search,
  MessageCircleQuestion,
  HelpCircle,
  Database,
  Sliders,
  Award,
  Zap,
  Target,
  DollarSign,
  Scale,
  Calendar,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAccounts } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { resolveAIConfig } from '../lib/ai/provider';
import { fetchRemoteHealth, interpretHealthProbe } from '../lib/ai/remote';
import { computeQuickAnalytics } from '../lib/ai/aiAnalytics';
import { QUICK_QUESTION_PROMPTS, validateAIUserQuery } from '../lib/ai/aiPrompts';
import { askEdgeAI } from '../lib/ai/aiClient';
import { AI_ERROR_CODES, AI_DISCLAIMER } from '../lib/ai/types';
import { safeAskJournalErrorMessage } from '../lib/ai/askJournal';
import AIAskJournal from '../components/ai/AIAskJournal';
import AIJournalIntelligence from '../components/ai/AIJournalIntelligence';
import AICoaching from '../components/ai/AICoaching';

export default function EdgeAI({ onNavigate }) {
  const { trades } = useData();
  const { allAccounts, selectedAccount, accounts } = useAccounts();
  const auth = useAuth();

  const [activeTab, setActiveTab] = useState('command');
  const [aiStatus, setAiStatus] = useState('NOT_CONFIGURED');
  const [lastAnalysisTime, setLastAnalysisTime] = useState(null);

  // Question state
  const [question, setQuestion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const abortControllerRef = useRef(null);

  // Check remote AI health on mount
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

  // Filter trades for currently selected account
  const accountTrades = useMemo(() => {
    const list = Array.isArray(trades?.items) ? trades.items : [];
    if (allAccounts || !selectedAccount?.id) return [];
    return list.filter((t) => t.accountId === selectedAccount.id);
  }, [trades?.items, allAccounts, selectedAccount]);

  // Compute deterministic metrics
  const quickMetrics = useMemo(() => {
    return computeQuickAnalytics(accountTrades);
  }, [accountTrades]);

  // Check entitlement
  const isEntitled = Boolean(auth.canUse?.('edge_ai'));
  const currentPlanName = auth?.currentPlan?.name || (isEntitled ? 'Pro' : 'Free');

  // Cancel any running analysis on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function handleAskQuestion(customQuery = null) {
    const queryToUse = customQuery || question;
    const queryCheck = validateAIUserQuery(queryToUse);
    if (!queryCheck.valid) {
      setAnalysisError(queryCheck.error);
      return;
    }

    if (allAccounts || !selectedAccount?.id) {
      setAnalysisError('Please select a specific trading account from the header to analyze.');
      return;
    }

    if (!isEntitled) {
      setAnalysisError('Your active plan does not include Edge AI. Please upgrade to Pro.');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await askEdgeAI({
        question: queryCheck.normalized,
        trades: accountTrades,
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        signal: controller.signal,
      });

      setAnalysisResult(result);
      setLastAnalysisTime(new Date());
    } catch (err) {
      if (err?.name === 'AbortError' || /abort/i.test(String(err?.message || ''))) {
        setAnalysisError('Analysis cancelled.');
      } else {
        const code = err?.code || AI_ERROR_CODES.AI_PROVIDER_ERROR;
        setAnalysisError(safeAskJournalErrorMessage(code));
      }
    } finally {
      setAnalyzing(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  function handleSelectPrompt(promptQuery) {
    setQuestion(promptQuery);
    handleAskQuestion(promptQuery);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1300, margin: '0 auto' }}>
      {/* Top Command Center Header */}
      <div
        style={{
          padding: '24px 28px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(193, 18, 31, 0.08) 0%, rgba(20, 20, 25, 0.95) 100%)',
          border: '1px solid var(--border)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, var(--red), var(--red-strong))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(193, 18, 31, 0.35)',
                }}
              >
                <Brain size={20} color="#fff" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Edge AI Command Center
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', maxWidth: 680 }}>
              AI-powered trading intelligence and deep journal analytics grounded strictly in your verified trading data.
              Edge AI assists your post-trade analysis without placing or modifying trades.
            </p>
          </div>

          {/* AI Status & Plan Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background:
                  aiStatus === 'READY'
                    ? 'rgba(34, 197, 94, 0.12)'
                    : aiStatus === 'UNAVAILABLE'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(255, 255, 255, 0.05)',
                color:
                  aiStatus === 'READY'
                    ? 'var(--win)'
                    : aiStatus === 'UNAVAILABLE'
                    ? '#f59e0b'
                    : 'var(--text-faint)',
                border: '1px solid currentColor',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'currentColor',
                }}
              />
              {aiStatus === 'READY' ? 'AI READY' : aiStatus === 'UNAVAILABLE' ? 'AI UNAVAILABLE' : 'AI NOT CONFIGURED'}
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: isEntitled ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: isEntitled ? 'var(--blue, #3b82f6)' : 'var(--loss)',
                border: '1px solid currentColor',
              }}
            >
              {isEntitled ? <ShieldCheck size={14} /> : <Lock size={14} />}
              {currentPlanName} Plan {isEntitled ? '(Eligible)' : '(Locked)'}
            </div>
          </div>
        </div>

        {/* Command Center Tabs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16, overflowX: 'auto' }}>
          {[
            { id: 'command', label: 'Command & Quick Insights', icon: Sparkles },
            { id: 'ask', label: 'Ask Journal', icon: MessageCircleQuestion },
            { id: 'intelligence', label: 'Journal Intelligence', icon: BarChart3 },
            { id: 'coach', label: 'AI Coach & Plan', icon: Target },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: active ? '1px solid rgba(193, 18, 31, 0.5)' : '1px solid transparent',
                  background: active ? 'rgba(193, 18, 31, 0.15)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} color={active ? 'var(--red)' : 'currentColor'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan Entitlement Warning if Free user */}
      {!isEntitled && (
        <div
          style={{
            padding: '18px 22px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(20, 20, 25, 0.8) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Lock size={20} color="var(--loss)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Edge AI Command Center is an exclusive Pro feature
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Your active {currentPlanName} plan allows trade logging and basic analytics. Upgrade to Pro to unlock natural-language journal queries, pattern intelligence, and coaching action plans.
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('subscription')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 8,
              background: 'var(--red)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Upgrade to Pro
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Account Isolation Notice if "All Accounts" is active */}
      {allAccounts && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#f59e0b',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Account Isolation Guard:</strong> Edge AI requires a specific account context to ensure accurate, unmixed analytics. Please select a single account from the account dropdown to enable AI analysis.
          </span>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'command' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* SECTION A: AI STATUS CARDS */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Activity size={18} color="var(--red)" />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>SECTION A · AI Status & Telemetry</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  AI Provider Status
                </span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {aiStatus === 'READY' ? <CheckCircle2 size={18} color="var(--win)" /> : <AlertTriangle size={18} color="#f59e0b" />}
                  {aiStatus === 'READY' ? 'Ready for Analysis' : aiStatus === 'UNAVAILABLE' ? 'Temporarily Offline' : 'Not Configured'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                  Backend serverless provider
                </div>
              </div>

              <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Plan Eligibility
                </span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: isEntitled ? 'var(--win)' : 'var(--loss)' }}>
                  {isEntitled ? 'Authorized & Active' : 'Upgrade Required'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                  Feature key: <code style={{ fontSize: 11 }}>edge_ai</code>
                </div>
              </div>

              <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Data Availability
                </span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
                  {accountTrades.length} Trades Recorded
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                  Quality: {quickMetrics.dataCoverage.label} ({quickMetrics.dataCoverage.isSufficient ? 'Sufficient' : 'Limited Sample'})
                </div>
              </div>

              <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Last Analysis Time
                </span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="var(--text-muted)" />
                  {lastAnalysisTime ? lastAnalysisTime.toLocaleTimeString() : 'No query yet'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                  {lastAnalysisTime ? lastAnalysisTime.toLocaleDateString() : 'This session'}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION B: QUICK INSIGHTS */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="var(--red)" />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>SECTION B · Grounded Quick Insights</h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                Deterministic canonical calculations · Zero hallucination
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {/* Insight 1: Recent Performance */}
              <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Overall Performance</span>
                  <span style={{ fontSize: 12, color: quickMetrics.totalPnl >= 0 ? 'var(--win)' : 'var(--loss)', fontWeight: 700 }}>
                    {quickMetrics.totalPnl >= 0 ? `+$${quickMetrics.totalPnl.toFixed(2)}` : `-$${Math.abs(quickMetrics.totalPnl).toFixed(2)}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>{quickMetrics.winRate}%</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Win Rate ({quickMetrics.wins}W / {quickMetrics.losses}L)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  Trend: <strong>{quickMetrics.recentTrend.momentum}</strong> · Last 10 WR: {quickMetrics.recentTrend.last10WinRate}%
                </div>
                <button
                  onClick={() => handleSelectPrompt('Why did my performance drop recently? What does my journal indicate?')}
                  disabled={!isEntitled || allAccounts}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={12} />
                  Analyze Performance Trend
                </button>
              </div>

              {/* Insight 2: Win/Loss & Average R */}
              <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Average Realized R</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Profit Factor: {quickMetrics.profitFactor || 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>{quickMetrics.avgR > 0 ? `${quickMetrics.avgR}R` : 'N/A'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg P&L: ${quickMetrics.avgPnl.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  Best: ${quickMetrics.bestTrade?.netPnl?.toFixed(2) || '0.00'} · Worst: ${quickMetrics.worstTrade?.netPnl?.toFixed(2) || '0.00'}
                </div>
                <button
                  onClick={() => handleSelectPrompt('How consistent is my risk discipline and percentage per trade?')}
                  disabled={!isEntitled || allAccounts}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={12} />
                  Analyze R:R Consistency
                </button>
              </div>

              {/* Insight 3: Risk Consistency */}
              <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Risk Consistency</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: quickMetrics.riskConsistency.isConsistent ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      color: quickMetrics.riskConsistency.isConsistent ? 'var(--win)' : '#f59e0b',
                    }}
                  >
                    {quickMetrics.riskConsistency.isConsistent ? 'Consistent' : 'Fluctuating'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>{quickMetrics.riskConsistency.avgRiskPercent}%</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg Risk per Trade</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  Max risk: {quickMetrics.riskConsistency.maxRiskPercent}% · Adherence: {quickMetrics.riskConsistency.adherenceRate}%
                </div>
                <button
                  onClick={() => handleSelectPrompt('How consistent is my risk?')}
                  disabled={!isEntitled || allAccounts}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={12} />
                  Inspect Risk Discipline
                </button>
              </div>

              {/* Insight 4: Instrument Performance */}
              <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Instrument Edge</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {quickMetrics.instrumentPerformance.list.length} pairs logged
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>
                    {quickMetrics.instrumentPerformance.best?.instrument || 'None'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--win)', fontWeight: 600 }}>
                    {quickMetrics.instrumentPerformance.best ? `+$${quickMetrics.instrumentPerformance.best.netPnl.toFixed(2)}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  Worst: {quickMetrics.instrumentPerformance.worst?.instrument || 'None'} ({quickMetrics.instrumentPerformance.worst ? `$${quickMetrics.instrumentPerformance.worst.netPnl.toFixed(2)}` : 'N/A'})
                </div>
                <button
                  onClick={() => handleSelectPrompt('Which pair performs best for me?')}
                  disabled={!isEntitled || allAccounts}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={12} />
                  Analyze Symbol Edge
                </button>
              </div>

              {/* Insight 5: Session Performance */}
              <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Session Performance</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Time-of-day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>
                    {quickMetrics.sessionPerformance.best?.session || 'No session data'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--win)', fontWeight: 600 }}>
                    {quickMetrics.sessionPerformance.best ? `${quickMetrics.sessionPerformance.best.winRate.toFixed(1)}% WR` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  {quickMetrics.sessionPerformance.best?.trades || 0} trades logged in top session
                </div>
                <button
                  onClick={() => handleSelectPrompt('What session gives me the best results?')}
                  disabled={!isEntitled || allAccounts}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={12} />
                  Evaluate Session Timing
                </button>
              </div>

              {/* Insight 6: Drawdown & Streaks */}
              <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Drawdown Behavior</span>
                  <span style={{ fontSize: 12, color: 'var(--loss)' }}>
                    Max DD: ${quickMetrics.drawdownBehavior.maxDrawdown.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: quickMetrics.drawdownBehavior.currentDrawdown > 0 ? 'var(--loss)' : 'var(--win)' }}>
                    ${quickMetrics.drawdownBehavior.currentDrawdown.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current from Equity Peak</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                  Max consecutive losses: {quickMetrics.drawdownBehavior.maxConsecutiveLosses}
                </div>
                <button
                  onClick={() => handleSelectPrompt('What mistakes appear most often in my losing trades?')}
                  disabled={!isEntitled || allAccounts}
                  style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Search size={12} />
                  Review Losing Streaks
                </button>
              </div>
            </div>
          </section>

          {/* SECTION C: ASK EDGE AI */}
          <section
            style={{
              padding: '24px 26px',
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircleQuestion size={20} color="var(--red)" />
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>SECTION C · Ask Edge AI</h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                Grounded in your account trades · Never predicts future market prices
              </span>
            </div>

            {/* Quick Prompt Suggestion Chips */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Suggested Questions:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_QUESTION_PROMPTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPrompt(p.query)}
                    disabled={analyzing || !isEntitled || allAccounts}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text)',
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: analyzing || !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Ask a question about your trading journal (e.g. 'What mistakes appear most often in my losing trades?')"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={analyzing || !isEntitled || allAccounts}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: 9,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                {analyzing ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    style={{
                      padding: '11px 20px',
                      borderRadius: 9,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--loss)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!question.trim() || !isEntitled || allAccounts}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '11px 22px',
                      borderRadius: 9,
                      background: 'var(--red)',
                      color: '#fff',
                      fontSize: 13.5,
                      fontWeight: 700,
                      border: 'none',
                      cursor: !question.trim() || !isEntitled || allAccounts ? 'not-allowed' : 'pointer',
                      opacity: !question.trim() || !isEntitled || allAccounts ? 0.6 : 1,
                    }}
                  >
                    <Sparkles size={16} />
                    Ask Edge AI
                  </button>
                )}
              </div>
            </form>

            {/* Error Display */}
            {analysisError && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--loss)',
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{analysisError}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {analyzing && (
              <div
                style={{
                  marginTop: 20,
                  padding: '30px 20px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  color: 'var(--text-muted)',
                }}
              >
                <RefreshCw size={24} className="animate-spin" color="var(--red)" />
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Analyzing verified journal data…
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Interpreting deterministic performance metrics and patterns
                </div>
              </div>
            )}

            {/* Structured AI Response View */}
            {analysisResult && !analyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  marginTop: 20,
                  padding: '24px 26px',
                  borderRadius: 12,
                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(20, 20, 25, 0.98) 100%)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* 1. Direct Answer */}
                {analysisResult.answer && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Direct Answer
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>
                      {analysisResult.answer}
                    </div>
                  </div>
                )}

                {/* 2. Summary */}
                {analysisResult.summary && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Summary
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                      {analysisResult.summary}
                    </div>
                  </div>
                )}

                {/* 3. Evidence from Your Data */}
                {Array.isArray(analysisResult.supportingEvidence) && analysisResult.supportingEvidence.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Evidence from Your Data
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {analysisResult.supportingEvidence.map((ev, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Observations / Strengths */}
                {Array.isArray(analysisResult.observations) && analysisResult.observations.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      What This May Mean
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {analysisResult.observations.map((obs, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{obs}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. Potential Improvement Areas */}
                {Array.isArray(analysisResult.improvements) && analysisResult.improvements.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Potential Improvement Areas
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {analysisResult.improvements.map((imp, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 6. Important Caveat & Educational Disclaimer */}
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: '1px solid var(--border)',
                    fontSize: 11.5,
                    color: 'var(--text-faint)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldCheck size={14} color="var(--text-faint)" style={{ flexShrink: 0 }} />
                  <span>
                    {analysisResult.disclaimer || AI_DISCLAIMER}
                  </span>
                </div>
              </motion.div>
            )}
          </section>
        </div>
      )}

      {/* RENDER EMBEDDED TAB: ASK JOURNAL */}
      {activeTab === 'ask' && (
        <AIAskJournal
          accountIdOverride={selectedAccount?.id}
          accountNameOverride={selectedAccount?.name}
        />
      )}

      {/* RENDER EMBEDDED TAB: JOURNAL INTELLIGENCE */}
      {activeTab === 'intelligence' && (
        <AIJournalIntelligence
          accountIdOverride={selectedAccount?.id}
          accountNameOverride={selectedAccount?.name}
        />
      )}

      {/* RENDER EMBEDDED TAB: AI COACH */}
      {activeTab === 'coach' && (
        <AICoaching
          accountIdOverride={selectedAccount?.id}
          accountNameOverride={selectedAccount?.name}
        />
      )}
    </div>
  );
}
