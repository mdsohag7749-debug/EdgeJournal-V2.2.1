import { motion } from 'framer-motion';
import { ListOrdered, Image, ArrowRight } from 'lucide-react';
import { formatDate, formatMoney, pnlClass, resultTagClass, directionTagClass } from '../../lib/utils';

export default function RecentTradesTable({ trades, onNavigate, onSelectTrade }) {
  const recent = [...trades].sort((a, b) => (b.date + (b.entryTime || '')).localeCompare(a.date + (a.entryTime || ''))).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="card card-lift"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListOrdered size={18} color="#3b82f6" /> Recent Execution Log
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('journal')}
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          View All Trades <ArrowRight size={14} />
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
              <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <th scope="col" style={{ padding: '0 10px 10px 0' }}>Date</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>Pair</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>Direction</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>Model</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>R:R</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>Net P&L</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>Status</th>
                <th scope="col" style={{ padding: '0 10px 10px' }}>Media</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTrade(t)}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '12px 10px 12px 0', color: 'var(--text-muted)', minWidth: 84 }}>{formatDate(t.date)}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 700 }}>{t.instrument}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={`tag ${directionTagClass(t.direction)}`}>{t.direction}</span>
                  </td>
                  <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{t.model || '—'}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 600 }}>{t.rr ? `${t.rr}R` : '—'}</td>
                  <td className={`mono ${pnlClass(t.netPnl)}`} style={{ padding: '12px 10px', fontWeight: 700 }}>
                    {formatMoney(t.netPnl)}
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={`tag ${resultTagClass(t.result)}`}>{t.result}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    {t.screenshot ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#3b82f6', fontSize: 11.5 }}>
                        <Image size={14} /> Image
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>None</span>
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
