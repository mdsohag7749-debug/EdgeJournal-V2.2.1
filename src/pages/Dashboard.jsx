import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../context/AccountContext';
import { computeDashboardStats } from '../lib/calculations';
import { computeChallengeMetrics } from '../lib/challengeStats';
import { formatMoney } from '../lib/utils';
import AccountSwitcher from '../components/accounts/AccountSwitcher';
import KpiCardsGrid from '../components/dashboard/KpiCardsGrid';
import EquityAndPnLCharts from '../components/dashboard/EquityAndPnLCharts';
import CalendarHeatmapWidget from '../components/dashboard/CalendarHeatmapWidget';
import PerformanceRadarChart from '../components/dashboard/PerformanceRadarChart';
import BreakdownGrids from '../components/dashboard/BreakdownGrids';
import RecentTradesTable from '../components/dashboard/RecentTradesTable';
import TradingInsightsWidget from '../components/dashboard/TradingInsightsWidget';
import DayTradesModal from '../components/dashboard/DayTradesModal';
import TradeFormPanel from './panels/TradeFormPanel';
import { Plus, Download, Calendar, Filter, Sparkles, User, Bell, Trophy, TrendingUp, ArrowUpRight, ArrowDownRight, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

export default function Dashboard({ onNavigate }) {
  const { trades, challenges } = useData();
  const { user } = useAuth();
  const { accounts, selectedAccountId } = useAccounts();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('ALL'); // 'ALL' | '30D' | 'MONTH' | 'WEEK'
  const [tradePanelOpen, setTradePanelOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [dayModal, setDayModal] = useState({ open: false, date: null, trades: [] });

  // Filter trades by selected date range
  const filteredTrades = useMemo(() => {
    if (!trades.items.length) return [];
    if (dateRange === 'ALL') return trades.items;

    const now = new Date();
    const cutoff = new Date(now);

    if (dateRange === '30D') cutoff.setDate(now.getDate() - 30);
    else if (dateRange === 'WEEK') cutoff.setDate(now.getDate() - 7);
    else if (dateRange === 'MONTH') cutoff.setDate(1);

    const cutoffISO = cutoff.toISOString().split('T')[0];
    return trades.items.filter((t) => t.date >= cutoffISO);
  }, [trades.items, dateRange]);

  const stats = useMemo(() => computeDashboardStats(filteredTrades), [filteredTrades]);

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId)
    : accounts.find((a) => a.isDefault) || accounts[0] || null;

  const accountTrades = useMemo(() => {
    if (!selectedAccount) return trades.items;
    return trades.items.filter((t) => t.accountId === selectedAccount.id);
  }, [trades.items, selectedAccount]);

  const activeChallenges = useMemo(() => {
    return challenges.items.filter((c) => c.status === 'active' || c.status === 'paused');
  }, [challenges.items]);

  const challengeStats = useMemo(() => {
    return activeChallenges.map((c) => {
      const acc = c.accountId ? accounts.find((a) => a.id === c.accountId) : selectedAccount;
      const cTrades = c.accountId ? accountTrades.filter((t) => t.accountId === c.accountId) : accountTrades;
      return { ...c, ...computeChallengeMetrics(c, cTrades, acc) };
    });
  }, [activeChallenges, accounts, accountTrades, selectedAccount]);

  function handleSaveTrade(form) {
    if (editingTrade) trades.update(editingTrade.id, form);
    else trades.add(form);
    setTradePanelOpen(false);
    setEditingTrade(null);
  }

  function handleSelectTrade(trade) {
    setEditingTrade(trade);
    setTradePanelOpen(true);
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Trader';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Header Controls Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="card"
        style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              fontWeight: 700,
            }}
          >
            <User size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Welcome back, {userName} <Sparkles size={16} color="#f59e0b" />
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Account:</span>
              <AccountSwitcher />
            </div>
          </div>
        </div>

        {/* Date Filter & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Date Range Selector */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--card-hover)', padding: 3, borderRadius: 8 }}>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'MONTH', label: 'This Month' },
              { id: '30D', label: '30 Days' },
              { id: 'WEEK', label: 'This Week' },
            ].map((r) => (
              <button
                key={r.id}
                className={`btn btn-sm ${dateRange === r.id ? 'btn-accent' : 'btn-ghost'}`}
                onClick={() => setDateRange(r.id)}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/settings?section=backup')}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Import / Backup
          </button>

          <button
            className="btn btn-accent btn-sm"
            onClick={() => {
              setEditingTrade(null);
              setTradePanelOpen(true);
            }}
            style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Log Trade
          </button>
        </div>
      </motion.div>

      {/* Row 1: KPI Cards Grid */}
      <KpiCardsGrid stats={stats} />

      {/* Row 1.5: Active Challenge Widget */}
      {challengeStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="card"
          style={{ padding: 20, border: '1px solid var(--border)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={16} color="var(--red)" /> Active Challenges
            </h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/challenges')}
              style={{ fontSize: 12 }}
            >
              View All
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {challengeStats.map((c) => {
              const statusStyle =
                c.status === 'completed'
                  ? { bg: 'rgba(47,214,110,0.12)', color: 'var(--win)' }
                  : c.status === 'failed'
                  ? { bg: 'rgba(255,77,94,0.12)', color: 'var(--loss)' }
                  : c.status === 'pass'
                  ? { bg: 'rgba(47,214,110,0.12)', color: 'var(--win)' }
                  : c.status === 'warning'
                  ? { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
                  : { bg: 'var(--red-dim)', color: 'var(--red)' };
              return (
                <div
                  key={c.id}
                  style={{
                    padding: 14,
                    background: 'var(--card-hover)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: statusStyle.bg, color: statusStyle.color }}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Balance</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{formatMoney(c.currentBalance)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Profit</span>
                      <span className="mono" style={{ color: c.netPnl >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                        {formatMoney(c.netPnl)}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, c.profitProgress * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: c.profitProgress >= 1 ? 'var(--win)' : c.profitProgress >= 0.7 ? '#f59e0b' : 'var(--red)',
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    {c.profitTarget > 0 && (
                      <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                        {formatMoney(Math.max(0, c.profitRemaining))} to target
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Drawdown</span>
                    <span className="mono" style={{ color: c.maxDDProgress >= 1 ? 'var(--loss)' : c.maxDDProgress >= 0.7 ? '#f59e0b' : 'var(--text)' }}>
                      {formatMoney(Math.max(0, c.maxDDRemaining))} left
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, c.maxDDProgress * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        background: c.maxDDProgress >= 1 ? 'var(--loss)' : c.maxDDProgress >= 0.7 ? '#f59e0b' : 'var(--red)',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)' }}>
                    <span>
                      {c.minTradingDays > 0 ? `${c.tradingDaysCompleted} / ${c.minTradingDays} days` : `${c.tradingDaysCompleted} trading day${c.tradingDaysCompleted === 1 ? '' : 's'}`}
                    </span>
                    {c.daysRemaining !== null && c.daysRemaining >= 0 && (
                      <span>{c.daysRemaining} day{c.daysRemaining === 1 ? '' : 's'} left</span>
                    )}
                    {c.daysRemaining !== null && c.daysRemaining < 0 && (
                      <span style={{ color: 'var(--loss)' }}>{Math.abs(c.daysRemaining)}d overdue</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Row 2: Equity Curve, Daily PnL & Distribution */}
      <EquityAndPnLCharts stats={stats} />

      {/* Row 3: Trading Calendar Heatmap */}
      <CalendarHeatmapWidget
        dayMap={stats.dayMap}
        onSelectDay={(date, dateTrades) => setDayModal({ open: true, date, trades: dateTrades })}
      />

      {/* Row 4: Performance Radar Chart */}
      <PerformanceRadarChart radarScores={stats.radarScores} />

      {/* Row 5: Edge Performance Breakdowns */}
      <BreakdownGrids stats={stats} />

      {/* Row 6: Recent Trades Execution Log Table */}
      <RecentTradesTable trades={filteredTrades} onNavigate={onNavigate} onSelectTrade={handleSelectTrade} />

      {/* Row 7: Algorithmic Edge Insights */}
      <TradingInsightsWidget insights={stats.insights} />

      {/* Modals & Slide-over Panels */}
      <TradeFormPanel
        open={tradePanelOpen}
        onClose={() => setTradePanelOpen(false)}
        onSave={handleSaveTrade}
        initial={editingTrade}
      />

      <DayTradesModal
        open={dayModal.open}
        date={dayModal.date}
        trades={dayModal.trades}
        onClose={() => setDayModal({ open: false, date: null, trades: [] })}
        onSelectTrade={handleSelectTrade}
      />
    </div>
  );
}
