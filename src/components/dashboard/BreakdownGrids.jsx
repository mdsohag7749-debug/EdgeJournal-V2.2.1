import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Trophy, AlertTriangle, Clock, Compass } from 'lucide-react';
import { formatMoney, pnlClass } from '../../lib/utils';

function BreakdownTable({ items, title, icon: Icon, color }) {
  if (!items || items.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 20,
          background: 'rgba(13, 20, 36, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 16,
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
          <Icon size={16} color={color} /> {title}
        </h4>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No data logged.</div>
      </div>
    );
  }

  return (
    <div
      className="card card-lift"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: 'rgba(13, 20, 36, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 16,
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      }}
    >
      <h4 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
        <Icon size={16} color={color} /> {title}
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <th scope="col" style={{ paddingBottom: 10 }}>Name</th>
              <th scope="col" style={{ paddingBottom: 10 }}>Trades</th>
              <th scope="col" style={{ paddingBottom: 10 }}>Win %</th>
              <th scope="col" style={{ paddingBottom: 10 }}>Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="table-row-hover">
                <td style={{ padding: '9px 0', fontWeight: 600, color: '#f8fafc' }}>{row.label}</td>
                <td style={{ padding: '9px 0', color: 'var(--text-muted)' }}>{row.trades}</td>
                <td style={{ padding: '9px 0', color: row.winPct >= 50 ? '#36e0c0' : 'var(--text-muted)' }}>{row.winPct}%</td>
                <td className={`mono ${pnlClass(row.netPnl)}`} style={{ padding: '9px 0', fontWeight: 700 }}>
                  {formatMoney(row.netPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BreakdownGrids({ stats }) {
  const [activeTab, setActiveTab] = useState('pairs');

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
          <Layers size={18} color="#42d9ff" /> Edge Performance Breakdowns
        </h3>
        <div
          className="dashboard-breakdown-tabs"
          style={{
            display: 'flex',
            gap: 4,
            background: 'rgba(10, 16, 29, 0.7)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            flexWrap: 'wrap',
          }}
        >
          {['pairs', 'sessions', 'timeframes', 'direction', 'models'].map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${activeTab === t ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t)}
              style={{ fontSize: 11, padding: '4px 10px', textTransform: 'capitalize' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
        {activeTab === 'pairs' && (
          <>
            <BreakdownTable items={stats.topWinningPairs} title="Top Winning Pairs" icon={Trophy} color="#36e0c0" />
            <BreakdownTable items={stats.topLosingPairs} title="Top Losing Pairs" icon={AlertTriangle} color="#ff4d5e" />
          </>
        )}
        {activeTab === 'sessions' && (
          <BreakdownTable items={stats.sessionPerformance} title="Trading Session Breakdown" icon={Clock} color="#42d9ff" />
        )}
        {activeTab === 'timeframes' && (
          <BreakdownTable items={stats.timeframePerformance} title="Timeframe Breakdown" icon={Clock} color="#a78bfa" />
        )}
        {activeTab === 'direction' && (
          <BreakdownTable items={stats.directionPerformance} title="Direction Breakdown (Buy vs Sell)" icon={Compass} color="#36e0c0" />
        )}
        {activeTab === 'models' && (
          <BreakdownTable items={stats.modelPerformance} title="Model / Setup Performance" icon={Layers} color="#38bdf8" />
        )}
      </div>
    </motion.div>
  );
}
