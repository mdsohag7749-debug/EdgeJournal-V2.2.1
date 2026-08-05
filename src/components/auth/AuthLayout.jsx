import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { TRADING_QUOTES } from '../../lib/quotes';

// Shared shell for every auth page: a premium animated brand panel on the
// left (hidden on small screens, replaced by a compact mobile lockup above
// the form) and a centered form card on the right. All animations are
// transform/opacity only (GPU friendly) and collapse under
// prefers-reduced-motion.

// Decorative candlestick silhouettes — pure CSS, no data behind them.
const CANDLES = [
  { left: '8%', bottom: '14%', wick: 78, body: 44, width: 12, dir: 'up' },
  { left: '18%', bottom: '22%', wick: 96, body: 58, width: 14, dir: 'down' },
  { left: '30%', bottom: '10%', wick: 64, body: 34, width: 10, dir: 'up' },
  { left: '42%', bottom: '28%', wick: 110, body: 70, width: 16, dir: 'neutral' },
  { left: '56%', bottom: '12%', wick: 70, body: 40, width: 11, dir: 'up' },
  { left: '68%', bottom: '32%', wick: 84, body: 46, width: 13, dir: 'down' },
  { left: '80%', bottom: '16%', wick: 60, body: 30, width: 9, dir: 'up' },
  { left: '90%', bottom: '26%', wick: 92, body: 54, width: 14, dir: 'down' },
  { left: '13%', bottom: '64%', wick: 52, body: 26, width: 8, dir: 'up' },
  { left: '47%', bottom: '60%', wick: 66, body: 36, width: 10, dir: 'neutral' },
  { left: '74%', bottom: '58%', wick: 58, body: 30, width: 9, dir: 'down' },
];

const PARTICLES = [
  { left: '12%', top: '22%', size: 3, dur: 9, delay: 0 },
  { left: '26%', top: '70%', size: 2, dur: 11, delay: 1.2 },
  { left: '40%', top: '30%', size: 3, dur: 8, delay: 0.6 },
  { left: '55%', top: '78%', size: 2, dur: 12, delay: 2 },
  { left: '66%', top: '26%', size: 3, dur: 10, delay: 0.3 },
  { left: '80%', top: '64%', size: 2, dur: 9.5, delay: 1.6 },
  { left: '91%', top: '34%', size: 3, dur: 11.5, delay: 0.9 },
  { left: '18%', top: '48%', size: 2, dur: 8.5, delay: 2.4 },
  { left: '34%', top: '12%', size: 2, dur: 10.5, delay: 1.1 },
  { left: '60%', top: '10%', size: 3, dur: 9.2, delay: 0.4 },
  { left: '48%', top: '55%', size: 2, dur: 12.5, delay: 2.8 },
  { left: '85%', top: '12%', size: 2, dur: 8.8, delay: 1.8 },
  { left: '6%', top: '78%', size: 3, dur: 10.2, delay: 0.7 },
  { left: '70%', top: '46%', size: 2, dur: 11.8, delay: 2.2 },
];

// Subtle radial light that follows the cursor inside the card. Updates CSS
// custom properties (--mx/--my) via rAF so the glow is painted with a pure
// GPU transform and never triggers layout thrash.
function useMouseGlow(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rect = el.getBoundingClientRect();
    let raf = 0;
    const onResize = () => {
      rect = el.getBoundingClientRect();
    };
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
      });
    };
    window.addEventListener('resize', onResize);
    el.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('resize', onResize);
      el.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef(null);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * TRADING_QUOTES.length));
  useMouseGlow(cardRef);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setQuoteIndex((i) => (i + 1) % TRADING_QUOTES.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const cardIn = { duration: reduceMotion ? 0 : 0.6, ease: 'easeOut', delay: reduceMotion ? 0 : 0.15 };
  const logoIn = { duration: reduceMotion ? 0 : 0.7, ease: 'easeOut' };
  const quoteFade = { duration: reduceMotion ? 0 : 0.45 };

  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        <div className="auth-aurora" aria-hidden="true" />
        <div className="auth-grid" aria-hidden="true" />
        <div className="auth-candles" aria-hidden="true">
          {CANDLES.map((c, i) => (
            <div key={i} className="auth-candle" style={{ left: c.left, bottom: c.bottom }}>
              <div className="auth-candle-wick" style={{ height: c.wick }} />
              <div className={`auth-candle-body ${c.dir}`} style={{ height: c.body, width: c.width }} />
            </div>
          ))}
        </div>
        <div className="auth-particles" aria-hidden="true">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="auth-particle"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="auth-brand-content">
          <motion.div
            className="auth-brand-logo"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={logoIn}
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
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut', delay: reduceMotion ? 0 : 0.25 }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={quoteIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={quoteFade}
              >
                &ldquo;{TRADING_QUOTES[quoteIndex]}&rdquo;
              </motion.p>
            </AnimatePresence>
          </motion.div>

          <div className="auth-brand-footer">
            © {new Date().getFullYear()} EdgeJournal. Trade with discipline.
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <motion.div className="auth-mobile-brand" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={logoIn}>
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

          <motion.div className="auth-card-anim" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={cardIn}>
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
