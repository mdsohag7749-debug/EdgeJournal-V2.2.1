import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { computeDashboardStats } from '../lib/calculations';
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
import { Plus, Download, Calendar, Filter, Sparkles, User, Bell } from 'lucide-react';

export default function Dashboard({ onNavigate }) {
  const { trades } = useData();
  const { user } = useAuth();
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
