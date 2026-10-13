import { motion } from 'framer-motion';
import { ListOrdered, Image, ArrowRight, Clock } from 'lucide-react';
import { formatDate, formatMoney, pnlClass, resultTagClass, directionTagClass } from '../../lib/utils';

export default function RecentTradesTable({ trades, onNavigate, onSelectTrade }) {
  const recent = [...trades].sort((a, b) => (b.date + (b.entryTime || '')).localeCompare(a.date + (a.entryTime || ''))).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
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
            <Clock size={18} color="#42d9ff" /> Recent Trades
          </h3>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Latest executions across all accounts</p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('journal')}
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#42d9ff' }}
        >
          View all <ArrowRight size={14} />
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <p>No recent trades logged yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  color: 'var(--text-muted)',
                  textAlign: 'left',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th scope="col" style={{ padding: '0 12px 12px 4px' }}>Date</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>Symbol</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>Direction</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>Model</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>R:R</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>Net P&L</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>Status</th>
                <th scope="col" style={{ padding: '0 12px 12px' }}>Media</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTrade(t)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '12px 12px 12px 4px', color: 'var(--text-muted)', minWidth: 84, fontSize: 12 }}>
                    {formatDate(t.date)}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: 'rgba(66, 217, 255, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#42d9ff',
                        }}
                      >
                        {t.instrument?.slice(0, 2)?.toUpperCase() || 'TR'}
                      </div>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{t.instrument}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span className={`tag ${directionTagClass(t.direction)}`}>{t.direction}</span>
                  </td>
                  <td style={{ padding: '12px 12px', color: 'var(--text-muted)' }}>{t.model || '—'}</td>
                  <td style={{ padding: '12px 12px', fontWeight: 600 }}>{t.rr ? `${t.rr}R` : '—'}</td>
                  <td className={`mono ${pnlClass(t.netPnl)}`} style={{ padding: '12px 12px', fontWeight: 700 }}>
                    {formatMoney(t.netPnl)}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span className={`tag ${resultTagClass(t.result)}`}>{t.result}</span>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    {t.screenshot ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#42d9ff', fontSize: 11.5 }}>
                        <Image size={14} /> View
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
