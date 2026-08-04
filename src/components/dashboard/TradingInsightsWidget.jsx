import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, AlertOctagon, Info } from 'lucide-react';

export default function TradingInsightsWidget({ insights }) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.35 }}
      className="card card-lift"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} color="#f59e0b" /> Algorithmic Edge Insights
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Automated Pattern Analysis</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {insights.map((item, idx) => {
          let bg = 'rgba(59, 130, 246, 0.08)';
          let border = '1px solid rgba(59, 130, 246, 0.2)';
          let iconColor = '#3b82f6';
          let Icon = Info;

          if (item.type === 'positive') {
            bg = 'rgba(47, 214, 110, 0.08)';
            border = '1px solid rgba(47, 214, 110, 0.2)';
            iconColor = 'var(--win)';
            Icon = CheckCircle2;
          } else if (item.type === 'negative') {
            bg = 'rgba(255, 77, 94, 0.08)';
            border = '1px solid rgba(255, 77, 94, 0.2)';
            iconColor = 'var(--loss)';
            Icon = AlertOctagon;
          }

          return (
            <div
              key={idx}
              style={{
                background: bg,
                border: border,
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ marginTop: 2, color: iconColor }}>
                <Icon size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{item.message}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
