import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

// Scroll-driven oversized EDGEJOURNAL wordmark section. Purely
// presentational — no auth logic, calculations, or data.
//
// As the section scrolls through the viewport the wordmark settles from an
// oversized, slightly transparent, vertically offset state into a clean,
// fully readable final size. Layers behind it (grid, glow, decorative
// curve + red execution markers) drift at different rates for restrained
// depth. Everything is transform / opacity only and collapses to a static
//, fully-readable state under prefers-reduced-motion.

const CURVE = 'M 0 120 C 200 132, 340 96, 520 110 C 700 124, 860 74, 1200 96';
const ACCENT = 'M 920 92 C 1000 100, 1110 86, 1200 96';

export default function AnimatedBrandSection({ label = 'The trading journal for intentional execution' }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  // Cinematic closing signature. At section entry the wordmark is slightly
  // smaller, softly blurred, and dim; as the user scrolls it scales to full
  // size, letter-spacing tightens toward the final tracking, a subtle
  // parallax drift offsets it, and the glow settles. All values collapse to
  // the stable final state under prefers-reduced-motion.
  const wordScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 0.985, 1]);
  const wordScaleY = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [1, 1, 1] : [0.97, 0.99, 1]);
  const wordY = useTransform(scrollYProgress, [0, 0.5, 1], [reduceMotion ? 0 : 26, reduceMotion ? 0 : 8, 0]);
  const wordX = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 18, 0]);
  const wordOpacity = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [1, 1, 1] : [0.35, 0.88, 1]);
  const wordBlur = useTransform(scrollYProgress, [0, 0.6, 1], reduceMotion ? ['blur(0px)', 'blur(0px)', 'blur(0px)'] : ['blur(8px)', 'blur(3px)', 'blur(0px)']);
  const wordTrack = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? ['-0.04em', '-0.04em', '-0.04em'] : ['-0.01em', '-0.03em', '-0.06em']);
  const labelOpacity = useTransform(scrollYProgress, [0.55, 0.85], reduceMotion ? [1, 1] : [0, 1]);
  const labelY = useTransform(scrollYProgress, [0.55, 0.85], [reduceMotion ? 0 : 16, 0]);
  const gridY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 0, reduceMotion ? 0 : -36]);
  const curveY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 0, reduceMotion ? 0 : -14]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [reduceMotion ? 1 : 0.35, reduceMotion ? 1 : 0.85, 1]);
  const markerA = useTransform(scrollYProgress, [0.15, 0.45], [0, 1]);
  const markerB = useTransform(scrollYProgress, [0.3, 0.6], [0, 1]);

  return (
    <section className="auth-brand-section" ref={ref} aria-labelledby="auth-brand-wordmark">
      {/* Layer 1 — faint trading grid (moves slower than content) */}
      <motion.div className="auth-brand-layer-grid" style={{ y: gridY }} aria-hidden="true" />

      {/* Layer 2 — soft background glow behind the wordmark */}
      <motion.div className="auth-brand-layer-glow" style={{ opacity: glowOpacity }} aria-hidden="true" />

      {/* Layer 3 — decorative equity-curve line + red execution markers */}
      <motion.div className="auth-brand-layer-curve" style={{ y: curveY }} aria-hidden="true">
        <svg className="auth-brand-curve-svg" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax meet" focusable="false">
          <motion.path
            d={CURVE}
            className="auth-brand-curve-line"
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            initial={reduceMotion ? {} : { pathLength: 0, opacity: 0 }}
            whileInView={reduceMotion ? {} : { pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.6, ease: 'easeInOut' }}
          />
          <motion.path
            d={ACCENT}
            className="auth-brand-curve-accent"
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            initial={reduceMotion ? {} : { pathLength: 0, opacity: 0 }}
            whileInView={reduceMotion ? {} : { pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.1, delay: 0.7, ease: 'easeInOut' }}
          />
          <motion.line className="auth-brand-curve-tick" x1="1200" y1="96" x2="1200" y2="190" />
          <motion.circle className="auth-brand-curve-dot" cx="1200" cy="96" r="4" />
        </svg>
      </motion.div>

      {/* Red execution markers (reveal on scroll, no loop) */}
      <motion.span className="auth-brand-marker auth-brand-marker-a" style={{ opacity: markerA }} aria-hidden="true" />
      <motion.span className="auth-brand-marker auth-brand-marker-b" style={{ opacity: markerB }} aria-hidden="true" />

      {/* Small tagline sits above the wordmark */}
      <motion.p className="auth-brand-label" style={{ opacity: labelOpacity, y: labelY }}>
        {label}
      </motion.p>

      {/* Wordmark — cinematic closing signature */}
      <motion.h2
        id="auth-brand-wordmark"
        className="auth-brand-wordmark"
        style={{ scale: wordScale, scaleY: wordScaleY, y: wordY, x: wordX, opacity: wordOpacity, filter: wordBlur, letterSpacing: wordTrack }}
        aria-label="EdgeJournal"
      >
        <span className="auth-brand-word" aria-hidden="true">
          EDGE
        </span>
        <span className="auth-brand-word" aria-hidden="true">
          JOURNAL
        </span>
      </motion.h2>
    </section>
  );
}