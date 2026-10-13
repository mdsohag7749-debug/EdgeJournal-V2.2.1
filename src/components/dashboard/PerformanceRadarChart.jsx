import { motion } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { ShieldCheck } from 'lucide-react';

export default function PerformanceRadarChart({ radarScores }) {
  const data = radarScores || [
    { subject: 'Discipline', score: 0 },
    { subject: 'Execution', score: 0 },
    { subject: 'Risk Management', score: 0 },
    { subject: 'Psychology', score: 0 },
    { subject: 'Consistency', score: 0 },
    { subject: 'Profitability', score: 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="card card-lift"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="dash-radar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color="#10b981" /> Institutional Performance Radar
        </h3>
        <span className="dash-radar-caption" style={{ fontSize: 12, color: 'var(--text-muted)' }}>6 Core Performance Pillars</span>
      </div>

      <div style={{ width: '100%', height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Trader Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
