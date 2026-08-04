import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
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
  const val = payload[0].value;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5, background: 'var(--card-hover)', border: '1px solid var(--border)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className={pnlClass(val)} style={{ fontWeight: 700 }}>
        {formatMoney(val)}
      </div>
    </div>
  );
}

export default function EquityAndPnLCharts({ stats }) {
  const [activeTab, setActiveTab] = useState('doughnut'); // 'doughnut' | 'pairs'

  const doughnutData = stats.breakdown || [];
  const pairData = (stats.pairPerformance || []).slice(0, 5);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
      {/* Equity Curve */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card card-lift"
        style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="var(--win)" /> Cumulative Equity Curve
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stats.equityCurve.length} trades</span>
        </div>

        {stats.equityCurve.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>Log trades to plot your equity curve.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={stats.equityCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={stats.netPnl >= 0 ? '#2fd66e' : '#ff4d5e'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={stats.netPnl >= 0 ? '#2fd66e' : '#ff4d5e'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={stats.netPnl >= 0 ? '#2fd66e' : '#ff4d5e'}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#equityGrad)"
                />
              </AreaChart>
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
        style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={18} color="#3b82f6" /> Daily P&L Breakdown
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stats.dailyPnLData.length} active days</span>
        </div>

        {stats.dailyPnLData.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>No daily P&L data recorded yet.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={stats.dailyPnLData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {stats.dailyPnLData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#2fd66e' : '#ff4d5e'} />
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
        style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieIcon size={18} color="#8b5cf6" /> Distribution
          </h3>
          <div style={{ display: 'flex', gap: 4, background: 'var(--card-hover)', padding: 3, borderRadius: 6 }}>
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
            <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={doughnutData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                    {doughnutData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatFormatter={(val, name) => [`${val} trades`, name]} />
                </PieChart>
              </ResponsiveContainer>
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
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatMoneyShort(v)} />
                <YAxis dataKey="label" type="category" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="netPnl" radius={[0, 4, 4, 0]}>
                  {pairData.map((entry, index) => (
                    <Cell key={`pair-${index}`} fill={entry.netPnl >= 0 ? '#2fd66e' : '#ff4d5e'} />
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
