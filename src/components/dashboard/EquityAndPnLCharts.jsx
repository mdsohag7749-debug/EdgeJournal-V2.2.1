import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatMoney, formatMoneyShort, pnlClass } from '../../lib/utils';
import { TrendingUp, BarChart2, PieChart as PieIcon } from 'lucide-react';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].payload.equity ?? payload[0].value;
  return (
    <div
      style={{
        padding: '10px 14px',
        fontSize: 12.5,
        background: 'rgba(10, 16, 29, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(66, 217, 255, 0.28)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(66, 217, 255, 0.15)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginBottom: 4 }}>{label}</div>
      <div className={pnlClass(val)} style={{ fontWeight: 700, fontSize: 14 }}>
        {formatMoney(val)}
      </div>
    </div>
  );
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: 12.5,
        background: 'rgba(10, 16, 29, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(66, 217, 255, 0.25)',
        borderRadius: 10,
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{payload[0].value} trades</div>
    </div>
  );
}

export default function EquityAndPnLCharts({ stats }) {
  const [activeTab, setActiveTab] = useState('doughnut'); // 'doughnut' | 'pairs'

  const doughnutData = stats.breakdown || [];
  const pairData = (stats.pairPerformance || []).slice(0, 5);
  const strokeColor = stats.netPnl >= 0 ? '#42d9ff' : '#ff4d5e';
  const equityCurveWithZeroCrossings = [];
  (stats.equityCurve || []).forEach((point, index, curve) => {
    const equity = Number(point.equity) || 0;
    const previousEquity = Number(curve[index - 1]?.equity) || 0;
    if ((previousEquity < 0 && equity > 0) || (previousEquity > 0 && equity < 0)) {
      equityCurveWithZeroCrossings.push({ ...point, date: '', equity: 0, profitLine: 0, lossLine: 0 });
    }
    equityCurveWithZeroCrossings.push({
      ...point,
      profitLine: equity >= 0 ? equity : null,
      lossLine: equity <= 0 ? equity : null,
    });
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 18 }}>
      {/* Cumulative Equity Curve (Portfolio Performance) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card card-lift"
        style={{
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(13, 20, 36, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 18,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
              <TrendingUp size={18} color="#42d9ff" /> Portfolio Performance
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Cumulative P&L over time</p>
          </div>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: '#42d9ff',
              background: 'rgba(66, 217, 255, 0.1)',
              border: '1px solid rgba(66, 217, 255, 0.22)',
              borderRadius: 999,
              padding: '3px 9px',
            }}
          >
            {stats.equityCurve.length} trades
          </span>
        </div>

        {stats.equityCurve.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>Log trades to plot your equity curve.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={equityCurveWithZeroCrossings} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={strokeColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="equityLossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff6876" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ff6876" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(66, 217, 255, 0.2)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="profitLine" stroke="none" fillOpacity={1} fill="url(#equityGrad)" />
                <Area type="monotone" dataKey="lossLine" stroke="none" fillOpacity={1} fill="url(#equityLossGrad)" />
                <Line type="monotone" dataKey="profitLine" stroke="#42d9ff" strokeWidth={2.8} dot={false} activeDot={false} />
                <Line type="monotone" dataKey="lossLine" stroke="#ff4d5e" strokeWidth={2.8} dot={false} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Daily PnL Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="card card-lift"
        style={{
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(13, 20, 36, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 18,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
              <BarChart2 size={18} color="#36e0c0" /> Daily P&L Breakdown
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Session outcome distribution</p>
          </div>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '3px 9px',
            }}
          >
            {stats.dailyPnLData.length} sessions
          </span>
        </div>

        {stats.dailyPnLData.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>No daily P&L data recorded yet.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={stats.dailyPnLData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {stats.dailyPnLData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#36e0c0' : '#ff4d5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Win/Loss & Pair Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card card-lift"
        style={{
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(13, 20, 36, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 18,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc' }}>
              <PieIcon size={18} color="#a78bfa" /> Trade Distribution
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Breakdown by execution result</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(10, 16, 29, 0.7)', padding: 3, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <button
              className={`btn btn-sm ${activeTab === 'doughnut' ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setActiveTab('doughnut')}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Win/Loss
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'pairs' ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setActiveTab('pairs')}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Pairs
            </button>
          </div>
        </div>

        {activeTab === 'doughnut' ? (
          doughnutData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>No trades logged yet.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 260, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={doughnutData} cx="50%" cy="50%" innerRadius={65} outerRadius={92} paddingAngle={4} dataKey="value">
                    {doughnutData.map((entry, index) => {
                      const color = entry.name?.toLowerCase().includes('win')
                        ? '#36e0c0'
                        : entry.name?.toLowerCase().includes('loss')
                        ? '#ff4d5e'
                        : '#94a3b8';
                      return <Cell key={`pie-${index}`} fill={color} stroke="rgba(10, 16, 29, 0.8)" strokeWidth={2} />;
                    })}
                  </Pie>
                  <Tooltip content={<CountTooltip />} cursor={false} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Donut Trade Count */}
              <div
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
                  {stats.total}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Total Trades
                </span>
              </div>
            </div>
          )
        ) : pairData.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>No pair history available.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={pairData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <YAxis dataKey="label" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                <Bar dataKey="netPnl" radius={[0, 4, 4, 0]}>
                  {pairData.map((entry, index) => (
                    <Cell key={`pair-${index}`} fill={entry.netPnl >= 0 ? '#36e0c0' : '#ff4d5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  );
}
