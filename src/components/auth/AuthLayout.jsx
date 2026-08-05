import { useEffect, useRef, useState, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, Quote } from 'lucide-react';
import { TRADING_QUOTES } from '../../lib/quotes';

// Shared shell for every auth page: a premium animated brand panel on the
// left (hidden on small screens, replaced by a compact mobile lockup above
// the form) and a centered form card on the right. All animations are
// transform/opacity/filter only (GPU friendly) and collapse under
// prefers-reduced-motion.

// ---------------------------------------------------------------------------
// Small deterministic-random helpers (stable per mount, crypto not needed).
// ---------------------------------------------------------------------------
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// Layered trading-grid background is a pure CSS pattern; the remaining
// decorative layers (aurora gradient, lights, candles, particles) are
// generated here once so they hold still between re-renders while each
// layer drifts at its own speed (subtle parallax).

// Layer 3 — floating radial lights (a few large soft RGB blooms).
const LIGHTS = [
  { top: '10%', left: '16%', size: 540, dur: 20, delay: 0 },
  { top: '66%', left: '70%', size: 640, dur: 27, delay: 2 },
  { top: '34%', left: '86%', size: 400, dur: 16, delay: 4 },
  { top: '82%', left: '22%', size: 470, dur: 23, delay: 6 },
];

function makeCandles(count) {
  const dirs = ['up', 'down'];
  return Array.from({ length: count }, () => ({
    left: rand(2, 48),
    bottom: rand(6, 60),
    wick: randInt(40, 110),
    body: randInt(20, 70),
    width: rand(6, 16),
    dir: dirs[randInt(0, 1)],
    opacity: rand(0.3, 0.85),
  }));
}

function makeParticles(count) {
  return Array.from({ length: count }, () => ({
    left: rand(2, 97),
    top: rand(2, 96),
    size: rand(2, 5),
    dur: rand(9, 19),
    delay: rand(0, 7),
    opacity: rand(0.12, 0.4),
    dx: rand(-22, 22),
    dy: rand(-50, -90),
  }));
}

// ---------------------------------------------------------------------------
// Mouse light with Apple-like easing: the cursor sets a target, and a small
// rAF loop continuously interpolates the current glow toward it so the light
// never snaps but softly lags behind. Only runs while the pointer is over the
// card (started on mousemove, stopped on mouseleave) to keep idle FPS high.
// ---------------------------------------------------------------------------
function useMouseGlow(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rect = el.getBoundingClientRect();
    let tx = -999;
    let ty = -999;
    let cx = -999;
    let cy = -999;
    let raf = 0;
    let lastT = 0;
    let running = false;
    const lerp = (a, b, t) => a + (b - a) * t;
    const tick = (t) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.max(1, Math.min(32, t - lastT)) / 16.7; // normalize to ~60fps
      lastT = t;
      const f = 1 - Math.pow(0.82, dt); // frame-rate independent ease-out
      cx = lerp(cx, tx, f);
      cy = lerp(cy, ty, f);
      el.style.setProperty('--mx', `${cx}px`);
      el.style.setProperty('--my', `${cy}px`);
    };
    const onResize = () => {
      rect = el.getBoundingClientRect();
    };
    const onMove = (e) => {
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
      if (!running) {
        running = true;
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onLeave = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    };
    window.addEventListener('resize', onResize);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('resize', onResize);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

// Quote word-by-word entrance variants (legible even if reduced-motion swaps
// to durations of 0).
export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef(null);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * TRADING_QUOTES.length));
  useMouseGlow(cardRef);

  const candles = useMemo(() => makeCandles(12), []);
  const particles = useMemo(() => makeParticles(30), []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setQuoteIndex((i) => (i + 1) % TRADING_QUOTES.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const zero = reduceMotion ? 0 : undefined;
  const logoIn = { duration: zero ?? 0.6, ease: 'easeOut' };
  const cardIn = { duration: zero ?? 0.65, ease: [0.22, 1, 0.36, 1], delay: zero ?? 0.32 };

  const quoteWords = useMemo(() => TRADING_QUOTES[quoteIndex].split(' '), [quoteIndex]);

  const quoteContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.024,
        delayChildren: reduceMotion ? 0 : 0.05,
      },
    },
  };
  const quoteItem = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.34, ease: 'easeOut' } },
  };

  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        {/* Layer 1 — animated aurora gradient */}
        <div className="auth-aurora" aria-hidden="true" />
        {/* Layer 2 — soft vignette for depth */}
        <div className="auth-vignette" aria-hidden="true" />
        {/* Layer 3 — floating radial lights */}
        <div className="auth-lights" aria-hidden="true">
          {LIGHTS.map((l, i) => (
            <span
              key={i}
              className="auth-light"
              style={{
                top: l.top,
                left: l.left,
                width: l.size,
                height: l.size,
                animationDuration: `${l.dur}s`,
                animationDelay: `${l.delay}s`,
              }}
            />
          ))}
        </div>
        {/* Layer 4 — trading grid */}
        <div className="auth-grid" aria-hidden="true" />
        {/* Layer 5 — candlestick silhouettes scrolling right-to-left */}
        <div className="auth-candles" aria-hidden="true">
          <div className="auth-candle-track">
            {candles.map((c, i) => (
              <div
                key={i}
                className="auth-candle"
                style={{
                  left: `${c.left}%`,
                  bottom: `${c.bottom}%`,
                  opacity: c.opacity,
                }}
              >
                <div className="auth-candle-wick" style={{ height: c.wick }} />
                <div className={`auth-candle-body ${c.dir}`} style={{ height: c.body, width: c.width }} />
              </div>
            ))}
            {candles.map((c, i) => (
              <div
                key={i + candles.length}
                className="auth-candle"
                style={{
                  left: `${c.left + 50}%`,
                  bottom: `${c.bottom}%`,
                  opacity: c.opacity,
                }}
              >
                <div className="auth-candle-wick" style={{ height: c.wick }} />
                <div className={`auth-candle-body ${c.dir}`} style={{ height: c.body, width: c.width }} />
              </div>
            ))}
          </div>
        </div>
        {/* Layer 6 — floating particles */}
        <div className="auth-particles" aria-hidden="true">
          {particles.map((p, i) => (
            <span
              key={i}
              className="auth-particle"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                ['--po']: p.opacity,
                ['--dx']: `${p.dx}px`,
                ['--dy']: `${p.dy}px`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="auth-brand-content">
          <motion.div
            className="auth-brand-logo"
            initial={{ scale: reduceMotion ? 1 : 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...logoIn, delay: reduceMotion ? 0 : 0.05 }}
          >
            <div className="auth-mark">
              <TrendingUp size={20} color="#fff" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>
              EdgeJournal
            </span>
          </motion.div>

          <motion.div
            className="auth-brand-quote"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut', delay: reduceMotion ? 0 : 0.24 }}
            aria-live="polite"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex}
                className="auth-quote-block"
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.2 } }}
                variants={quoteContainer}
              >
                <motion.div variants={quoteItem} className="auth-quote-mark" aria-hidden="true">
                  <Quote size={16} />
                </motion.div>
                <motion.p variants={quoteContainer}>
                  {quoteWords.map((w, i) => (
                    <motion.span key={i} className="auth-quote-word" variants={quoteItem}>
                      {w}
                    </motion.span>
                  ))}
                </motion.p>
                <motion.div variants={quoteItem} className="auth-quote-divider" aria-hidden="true" />
                <motion.span variants={quoteItem} className="auth-quote-author">
                  — EdgeJournal
                </motion.span>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <div className="auth-brand-footer">
            © {new Date().getFullYear()} EdgeJournal. Trade with discipline.
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <motion.div
            className="auth-mobile-brand"
            initial={{ scale: reduceMotion ? 1 : 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...logoIn, delay: reduceMotion ? 0 : 0.05 }}
          >
            <div
              className="auth-mark"
              style={{ background: 'var(--red-glow)', border: '1px solid rgba(193, 18, 31, 0.25)' }}
            >
              <TrendingUp size={18} color="var(--red)" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
              EdgeJournal
            </span>
          </motion.div>

          <motion.div className="auth-card-anim" initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} transition={cardIn}>
            {/* Breathing ambient RGB glow (dark red -> crimson -> dark red) */}
            <div className="auth-card-glow" aria-hidden="true" />
            <div className="card auth-card" ref={cardRef} style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                {eyebrow && (
                  <span className="tag tag-red" style={{ marginBottom: 12 }}>
                    {eyebrow}
                  </span>
                )}
                <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: eyebrow ? 10 : 0 }}>{title}</h1>
                {subtitle && <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6 }}>{subtitle}</p>}
              </div>
              {children}
            </div>
          </motion.div>

          {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}