import { motion } from 'framer-motion';
import { PlusCircle, Sunrise, GraduationCap, MessageSquareText, Target, Zap } from 'lucide-react';

const ACTIONS = [
  { id: 'journal', label: 'Add Trade', icon: PlusCircle, color: '#C1121F' },
  { id: 'premarket', label: 'Pre-Market Plan', icon: Sunrise, color: '#7c3aed' },
  { id: 'study', label: 'Study Note', icon: GraduationCap, color: '#2563eb' },
  { id: 'reflections', label: 'Reflection', icon: MessageSquareText, color: '#0d9488' },
  { id: 'goals', label: 'Goals', icon: Target, color: '#16a34a' },
];

export default function QuickActions({ onNavigate }) {
  return (
    <div className="card card-lift" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 className="section-title">
        <Zap size={16} color="var(--red)" /> Quick Actions
      </h3>
      <div className="dash-quick-actions">
        {ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.28 }}
              whileHover={{ y: -3, boxShadow: '0 14px 32px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onNavigate?.(a.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 10,
                padding: '14px 14px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: `${a.color}1a`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={16} color={a.color} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
