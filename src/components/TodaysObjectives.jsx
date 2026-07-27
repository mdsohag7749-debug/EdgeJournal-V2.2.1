import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import EmptyState from './EmptyState';

export default function TodaysObjectives({ goals, onNavigate }) {
  const daily = (goals || []).filter((g) => g.period === 'Daily');
  const completedCount = daily.filter((g) => g.completed).length;
  const completionPct = daily.length ? Math.round((completedCount / daily.length) * 100) : 0;
  const activeDaily = daily.filter((g) => !g.completed).slice(0, 4);

  return (
    <div className="card card-lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          <ListChecks size={16} color="var(--red)" /> Today's Objectives
        </h3>
        {daily.length > 0 && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
            {completedCount}/{daily.length} · {completionPct}%
          </span>
        )}
      </div>

      {daily.length > 0 && (
        <div style={{ height: 8, borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', background: 'linear-gradient(90deg, var(--red), var(--red-strong))', borderRadius: 999 }}
          />
        </div>
      )}

      {daily.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No daily goals set"
          message="Add a daily goal to keep today's trading focused."
          actionLabel="Set a Goal"
          onAction={() => onNavigate?.('goals')}
        />
      ) : activeDaily.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--win)', fontWeight: 600 }}>All daily objectives complete. 🎯</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeDaily.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              {g.completed ? (
                <CheckCircle2 size={16} color="var(--win)" style={{ flexShrink: 0 }} />
              ) : (
                <Circle size={16} color="var(--red)" style={{ flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.title || 'Untitled goal'}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
