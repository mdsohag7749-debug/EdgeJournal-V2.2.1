import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

function AnimatedValue({ value, format }) {
  const [display, setDisplay] = useState(typeof value === 'number' ? 0 : value);
  const frameRef = useRef();

  useEffect(() => {
    if (typeof value !== 'number' || !isFinite(value)) {
      setDisplay(value);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const from = 0;

    function tick(t) {
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{typeof value === 'number' ? format(display) : display}</>;
}

export default function StatCard({ label, value, valueClass, icon: Icon, sub, delay = 0, accent = '#C1121F', format = (v) => v, trend }) {
  return (
    <motion.div
      className="card card-lift"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay }}
      whileHover={{ y: -4 }}
      style={{
        position: 'relative',
        padding: '18px 18px 18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${accent}, var(--secondary, ${accent}))`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {Icon && (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              background: `${accent}1a`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={14} color={accent} />
          </span>
        )}
      </div>

      <div
        className={valueClass ? `mono ${valueClass}` : 'mono'}
        style={{ fontSize: 22, fontWeight: 700, color: valueClass ? undefined : 'var(--text)', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        <AnimatedValue value={value} format={format} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 16 }}>
        {sub ? <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{sub}</span> : <span />}
        {trend && trend.direction !== 'flat' && (
          <span
            className={trend.direction === 'up' ? 'pnl-pos' : 'pnl-neg'}
            style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 700 }}
          >
            {trend.direction === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {trend.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
