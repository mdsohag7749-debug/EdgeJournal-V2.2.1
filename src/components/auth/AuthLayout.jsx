import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { TrendingUp, ChevronDown, Crosshair, Gauge, LineChart, NotebookPen } from 'lucide-react';
import AuthVisual from './AuthVisual';
import AnimatedBrandSection from './AnimatedBrandSection';
import AuthFAQ from './AuthFAQ';
import { TRADING_QUOTES } from '../../lib/quotes';

const EASE = [0.22, 1, 0.36, 1];

// Shared premium landing shell for every guest auth page (Login /
// Register / Forgot Password). Large headline and supporting copy on the
// left, the existing auth card on the right, then a long-form scroll
// experience (decorative visual + reveal cards). All motion is
// transform / opacity / filter only and collapses under
// prefers-reduced-motion (checked both in JS and via CSS).
//
// The card, the form and every prop (eyebrow, title, subtitle, children,
// footer) are composed unchanged — pages keep their exact structure, so
// the authentication behavior they wrap is untouched.

const FEATURES = [
  {
    icon: NotebookPen,
    title: 'Journal the execution',
    body: 'Setup, size, timing, and the thought behind each trade — recorded the moment you make it.',
  },
  {
    icon: Gauge,
    title: 'Score the discipline',
    body: 'Discipline, plan compliance, and emotional state become visible from the very first entries.',
  },
  {
    icon: LineChart,
    title: 'Measure the edge',
    body: 'R-multiples, expectancy, and win rate are computed from your real trades — nothing invented.',
  },
];

export default function AuthLayout({ eyebrow, title, subtitle, children, footer, headline, headlineText }) {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef(null);

  // Global scroll progress -> nav backdrop + background parallax.
  const { scrollYProgress } = useScroll();
  const navBack = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
  const bgGlowY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 0, reduceMotion ? 0 : -70]);
  const bgGridY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 0, reduceMotion ? 0 : -130]);
  const bgAxesY = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 0, reduceMotion ? 0 : -200]);

  // Hero compresses and fades as it scrolls away.
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroScale = useTransform(heroProgress, [0, 1], [reduceMotion ? 1 : 1, reduceMotion ? 1 : 0.93]);
  const heroOpacity = useTransform(heroProgress, [0, 0.72], [1, reduceMotion ? 1 : 0.55]);

  // Fresh mount always starts at the top (a scrolled document must never
  // leak into a newly opened auth page).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const dur = (duration, delay = 0) => (reduceMotion ? { duration: 0 } : { duration, delay, ease: EASE });

  const heading = headline || 'Own the process, not the outcome.';
  const blurb =
    headlineText ||
    'EdgeJournal captures your execution, discipline, performance, and the decisions behind every trade — so patterns become measurable and the edge compounds.';

  const chipContainer = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: reduceMotion ? 0 : 0.5 },
    },
  };
  const chipItem = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' } },
  };

  return (
    <div className="auth-landing">
      {/* ---- Layer 1: fixed background (subtle scroll parallax) ---- */}
      <motion.div
        className="auth-bg"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={dur(0.9)}
      >
        <motion.div className="auth-bg-glow" style={{ y: bgGlowY }} />
        <motion.div className="auth-bg-grid" style={{ y: bgGridY }} />
        <motion.div className="auth-bg-axes" style={{ y: bgAxesY }} />
        <div className="auth-bg-vignette" />
      </motion.div>

      {/* Top navigation / brand */}
      <nav className="auth-nav" aria-label="Primary">
        <motion.div className="auth-nav-back" style={{ opacity: navBack }} aria-hidden="true" tabIndex={-1} />
        <motion.div
          className="auth-nav-brand"
          initial={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={dur(0.55, 0.05)}
        >
          <span className="auth-brand-mark" aria-hidden="true">
            <TrendingUp size={17} />
          </span>
          <span className="auth-brand-name">EdgeJournal</span>
        </motion.div>
        <motion.p
          className="auth-nav-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={dur(0.55, 0.2)}
        >
          Discipline · Precision · Data
        </motion.p>
      </nav>

      {/* Hero: headline copy + the existing auth card */}
      <motion.section
        ref={heroRef}
        className="auth-hero"
        style={{ scale: heroScale, opacity: heroOpacity }}
        aria-label="Sign in"
      >
        <div className="auth-hero-inner">
          <div className="auth-hero-copy">
            <motion.span
              className="auth-hero-eyebrow"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={dur(0.5, 0.26)}
            >
              <span className="auth-hero-eyebrow-dot" aria-hidden="true" />
              Trading journal
            </motion.span>

            <motion.h1
              className="auth-hero-title"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 26, filter: reduceMotion ? 'none' : 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'none' }}
              transition={dur(0.7, 0.34)}
            >
              {heading}
            </motion.h1>

            <motion.p
              className="auth-hero-text"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={dur(0.6, 0.46)}
            >
              {blurb}
            </motion.p>

            <motion.ul className="auth-hero-chips" variants={chipContainer} initial={reduceMotion ? false : 'hidden'} animate="show">
              <motion.li className="auth-chip" variants={chipItem}>
                <Crosshair size={13} />
                Execution
              </motion.li>
              <motion.li className="auth-chip" variants={chipItem}>
                <Gauge size={13} />
                Discipline
              </motion.li>
              <motion.li className="auth-chip" variants={chipItem}>
                <LineChart size={13} />
                Data
              </motion.li>
            </motion.ul>
          </div>

          <div className="auth-panel-col">
            <motion.div
              className="auth-panel"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 20, scale: reduceMotion ? 1 : 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={dur(0.65, 0.5)}
            >
              <div className="auth-panel-head">
                {eyebrow && (
                  <span className="tag tag-red" style={{ marginBottom: 14 }}>
                    {eyebrow}
                  </span>
                )}
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h2>
                {subtitle && <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6 }}>{subtitle}</p>}
              </div>
              <div className="auth-panel-form">{children}</div>
            </motion.div>

            {footer && (
              <motion.div
                className="auth-panel-footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={dur(0.5, 0.68)}
              >
                {footer}
              </motion.div>
            )}

            <p className="auth-panel-quote" aria-hidden="true">
              {TRADING_QUOTES[0]}
            </p>
          </div>
        </div>

        <motion.div
          className="auth-scroll-cue"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={dur(0.6, 1.15)}
          aria-hidden="true"
        >
          <ChevronDown size={18} />
        </motion.div>
      </motion.section>

      {/* Supporting visual — decorative market/journal composition */}
      <section className="auth-visual-band" aria-label="What EdgeJournal records">
        <div className="auth-visual-wrap">
          <motion.span
            className="auth-section-eyebrow"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={dur(0.5)}
          >
            The record
          </motion.span>
          <motion.h2
            className="auth-section-title"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={dur(0.65, 0.06)}
          >
            Every execution becomes a measurable point.
          </motion.h2>
          <motion.p
            className="auth-section-text"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={dur(0.55, 0.14)}
          >
            Entry, risk, emotion, and outcome land in the same record — so the pattern in your trading is something you can
            read, not guess.
          </motion.p>
        </div>
        <div className="auth-visual-outer">
          <AuthVisual />
        </div>
      </section>

      {/* Scroll-reveal value cards */}
      <section className="auth-features" aria-labelledby="auth-features-heading">
        <div className="auth-features-inner">
          <h2 id="auth-features-heading" className="auth-features-heading" aria-hidden="true">
            How EdgeJournal builds the edge
          </h2>
          <div className="auth-features-grid">
            {FEATURES.map((f, i) => (
              <motion.article
                key={f.title}
                className="auth-feature-card"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={dur(0.6, 0.08 * i)}
              >
                <div className="auth-feature-icon">
                  <f.icon size={18} />
                </div>
                <h3 className="auth-feature-title">{f.title}</h3>
                <p className="auth-feature-body">{f.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Frequently asked questions */}
      {/* FAQ (unchanged) */}
      <AuthFAQ />

      {/* Premium footer — 3-column closing section */}
      <footer className="auth-footer">
        <div className="auth-footer-inner">
          <div className="auth-footer-grid">
            <div className="auth-footer-col auth-footer-brand">
              <span className="auth-brand-mark auth-brand-mark-sm" aria-hidden="true">
                <TrendingUp size={17} />
              </span>
              <div>
                <p className="auth-footer-brand-name">EdgeJournal</p>
                <p className="auth-footer-tagline">
                  The trading journal for intentional execution — discipline, precision, and data.
                </p>
              </div>
            </div>
            <nav className="auth-footer-col auth-footer-nav" aria-label="Product">
              <h3 className="auth-footer-col-heading">Product</h3>
              <a className="auth-footer-link" href="/">Journal</a>
              <a className="auth-footer-link" href="/">Discipline</a>
              <a className="auth-footer-link" href="/">Analytics</a>
            </nav>
            <nav className="auth-footer-col auth-footer-nav" aria-label="Legal">
              <h3 className="auth-footer-col-heading">Legal</h3>
              <a className="auth-footer-link" href="/">Privacy</a>
              <a className="auth-footer-link" href="/">Terms</a>
              <a className="auth-footer-link" href="/">Contact</a>
            </nav>
          </div>

          <div className="auth-footer-social">
            <p className="auth-footer-disclaimer">
              EdgeJournal records trading for informational purposes only — not financial advice.
            </p>
            <div className="auth-footer-social-icons" aria-hidden="true">
              <span className="auth-social-glyph" aria-label="X">𝕏</span>
              <span className="auth-social-glyph" aria-label="Discord">◈</span>
              <span className="auth-social-glyph" aria-label="GitHub">⌥</span>
            </div>
          </div>

          <div className="auth-footer-bottom">
            <p>© {new Date().getFullYear()} EdgeJournal — trade with discipline.</p>
          </div>
        </div>
      </footer>

      {/* Breath + transition into the final cinematic brand section */}
      <div className="auth-footer-gap" aria-hidden="true" />
      <AnimatedBrandSection />
    </div>
  );
}