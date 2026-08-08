import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

// Decorative supporting visual for the auth landing page. It is a
// presentational composition inspired by trading-journal language
// (equity curve, R-multiples, discipline score, expectancy) — NOT a real
// chart and NOT wired to any data. Floating metric cards drift at their
// own parallax speeds as the section scrolls so the scene has depth;
// everything collapses under prefers-reduced-motion.

const CURVE =
  'M 0 316 C 46 304 72 310 116 298 C 164 278 196 298 240 282 ' +
  'C 288 256 322 272 368 250 C 416 228 448 240 500 218 C 544 228 572 208 616 188 ' +
  'C 650 176 690 190 726 168 C 766 158 800 172 838 152 C 876 132 908 146 946 124 C 968 116 984 114 1000 112';

const ACCENT = 'M 716 170 C 748 158 782 172 822 150 C 862 124 890 140 930 122 C 958 108 982 112 1000 112';

const CARDS = [
  { label: 'R-multiples', value: '+0.42R', left: '5%', right: 'auto', top: '14%', bottom: 'auto', speed: 44, delay: 0.1 },
  { label: 'Discipline', value: '92 / 100', left: 'auto', right: '6%', top: '10%', bottom: 'auto', speed: 24, delay: 0.22 },
  { label: 'Expectancy', value: '+0.38R', left: '13%', right: 'auto', top: 'auto', bottom: '15%', speed: 34, delay: 0.36 },
  { label: 'Max drawdown', value: '−2.1%', left: 'auto', right: '7%', top: 'auto', bottom: '12%', speed: 20, delay: 0.5 },
];

function MetricCard({ progress, label, value, speed, delay, ...pos }) {
  const reduceMotion = useReducedMotion();
  const shift = useTransform(progress, [0, 1], [speed * 0.5, -speed * 0.5]);

  return (
    <motion.div
      className="auth-visual-card"
      style={{ ...pos, y: reduceMotion ? 0 : shift, left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom }}
    >
      <motion.div
        className="auth-visual-card-inner"
        initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="auth-visual-card-label">{label}</span>
        <strong className="auth-visual-card-value">{value}</strong>
        <span className="auth-visual-card-tick" aria-hidden="true" />
      </motion.div>
    </motion.div>
  );
}

export default function AuthVisual() {
  const reduceMotion = useReducedMotion();
  const sceneRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sceneRef, offset: ['start end', 'end start'] });
  const frameY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 26, reduceMotion ? 0 : -34]);

  return (
    <motion.div
      ref={sceneRef}
      className="auth-visual"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div className="auth-visual-frame" style={{ y: frameY }} aria-hidden="true">
        <svg
          className="auth-visual-svg"
          viewBox="0 0 1000 340"
          preserveAspectRatio="none"
          focusable="false"
          aria-hidden="true"
        >
          <line className="auth-svg-base" x1="0" y1="316" x2="1000" y2="316" />
          <line className="auth-svg-base auth-svg-base-dash" x1="0" y1="112" x2="1000" y2="112" />
          <motion.path
            d={CURVE}
            className="auth-svg-curve"
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            initial={reduceMotion ? {} : { pathLength: 0, opacity: 0 }}
            whileInView={reduceMotion ? {} : { pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.7, ease: 'easeInOut' }}
          />
          <motion.path
            d={ACCENT}
            className="auth-svg-accent"
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            initial={reduceMotion ? {} : { pathLength: 0, opacity: 0 }}
            whileInView={reduceMotion ? {} : { pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.1, delay: 0.9, ease: 'easeInOut' }}
          />
          <line className="auth-svg-tick" x1="1000" y1="112" x2="1000" y2="330" />
          <circle className="auth-svg-dot" cx="1000" cy="112" r="4" />
        </svg>
      </motion.div>

      {CARDS.map((c) => (
        <MetricCard key={c.label} progress={scrollYProgress} {...c} />
      ))}
    </motion.div>
  );
}