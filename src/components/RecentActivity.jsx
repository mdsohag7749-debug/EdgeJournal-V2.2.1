import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sunrise, MessageSquareText, GraduationCap, Target, History } from 'lucide-react';
import EmptyState from './EmptyState';
import { formatMoney, pnlClass } from '../lib/utils';

const TYPE_META = {
  trade: { icon: BookOpen, color: '#C1121F', label: 'Trade' },
  plan: { icon: Sunrise, color: '#7c3aed', label: 'Pre-Market Plan' },
  reflection: { icon: MessageSquareText, color: '#0d9488', label: 'Reflection' },
  study: { icon: GraduationCap, color: '#2563eb', label: 'Study Note' },
  goal: { icon: Target, color: '#16a34a', label: 'Goal' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function describe(item) {
  switch (item.kind) {
    case 'trade':
      return {
        title: `${item.instrument || 'Trade'} · ${item.result || '—'}`,
        detail: formatMoney(item.netPnl),
        detailClass: pnlClass(item.netPnl),
      };
    case 'plan':
      return { title: 'Pre-Market Plan', detail: item.bias || '' };
    case 'reflection':
      return { title: item.title || 'Reflection', detail: item.period || '' };
    case 'study':
      return { title: item.title || 'Study Note', detail: item.sessionType || '' };
    case 'goal':
      return { title: item.title || 'Goal', detail: item.completed ? 'Completed' : item.period || '' };
    default:
      return { title: 'Activity', detail: '' };
  }
}

export default function RecentActivity({ trades, plans, reflections, study, goals, onNavigate }) {
  const items = useMemo(() => {
    const merged = [
      ...trades.map((t) => ({ ...t, kind: 'trade' })),
      ...plans.map((p) => ({ ...p, kind: 'plan' })),
      ...reflections.map((r) => ({ ...r, kind: 'reflection' })),
      ...study.map((s) => ({ ...s, kind: 'study' })),
      ...goals.map((g) => ({ ...g, kind: 'goal' })),
    ];
    return merged
      .filter((i) => i.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
  }, [trades, plans, reflections, study, goals]);

  return (
    <div className="card card-lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 className="section-title">
        <History size={16} color="var(--red)" /> Recent Activity
      </h3>

      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing logged yet"
          message="Your trades, plans, and reflections will show up here as you add them."
          actionLabel="Log a Trade"
          onAction={() => onNavigate?.('journal')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => {
            const meta = TYPE_META[item.kind];
            const Icon = meta.icon;
            const { title, detail, detailClass } = describe(item);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.28 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 4px',
                  borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: `${meta.color}1a`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} color={meta.color} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>
                  {detail && (
                    <div className={detailClass ? `mono ${detailClass}` : ''} style={{ fontSize: 12, color: detailClass ? undefined : 'var(--text-faint)' }}>
                      {detail}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)', flexShrink: 0 }}>{timeAgo(item.createdAt)}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
