import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Trophy, AlertTriangle, Clock, Compass } from 'lucide-react';
import { formatMoney, pnlClass } from '../../lib/utils';

function BreakdownTable({ items, title, icon: Icon, color }) {
  if (!items || items.length === 0) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <h4 style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={16} color={color} /> {title}
        </h4>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No data logged.</div>
      </div>
    );
  }

  return (
    <div className="card card-lift" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h4 style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={color} /> {title}
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ paddingBottom: 8 }}>Name</th>
              <th style={{ paddingBottom: 8 }}>Trades</th>
              <th style={{ paddingBottom: 8 }}>Win %</th>
              <th style={{ paddingBottom: 8 }}>Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '8px 0', fontWeight: 600 }}>{row.label}</td>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>{row.trades}</td>
                <td style={{ padding: '8px 0' }}>{row.winPct}%</td>
                <td className={`mono ${pnlClass(row.netPnl)}`} style={{ padding: '8px 0', fontWeight: 700 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={18} color="#6366f1" /> Edge Performance Breakdowns
        </h3>
        <div style={{ display: 'flex', gap: 4, background: 'var(--card-hover)', padding: 3, borderRadius: 6 }}>
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
            <BreakdownTable items={stats.topWinningPairs} title="Top Winning Pairs" icon={Trophy} color="var(--win)" />
            <BreakdownTable items={stats.topLosingPairs} title="Top Losing Pairs" icon={AlertTriangle} color="var(--loss)" />
          </>
        )}
        {activeTab === 'sessions' && (
          <BreakdownTable items={stats.sessionPerformance} title="Trading Session Breakdown" icon={Clock} color="#3b82f6" />
        )}
        {activeTab === 'timeframes' && (
          <BreakdownTable items={stats.timeframePerformance} title="Timeframe Breakdown" icon={Clock} color="#8b5cf6" />
        )}
        {activeTab === 'direction' && (
          <BreakdownTable items={stats.directionPerformance} title="Direction Breakdown (Buy vs Sell)" icon={Compass} color="#ec4899" />
        )}
        {activeTab === 'models' && (
          <BreakdownTable items={stats.modelPerformance} title="Model / Setup Performance" icon={Layers} color="#10b981" />
        )}
      </div>
    </motion.div>
  );
}
