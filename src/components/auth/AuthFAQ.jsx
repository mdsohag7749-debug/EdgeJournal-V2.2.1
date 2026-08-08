import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

// Premium FAQ section for the public auth landing pages. Presentational
// only — no auth logic, calculations, or paid functionality. Uses native
// <details>/<summary> for accessible, keyboard-friendly accordions with a
// subtle slide-into-view reveal.

const FAQS = [
  {
    q: 'What does EdgeJournal record for me?',
    a: 'Setup, size, timing, the thought behind the trade, and the emotional state at execution — captured the moment you take the trade. Everything lands in the same record so the pattern reads, not guesses.',
  },
  {
    q: 'Where do R-multiple, expectancy, and win rate come from?',
    a: 'They are computed from your real, logged trades. Nothing is invented: every metric is derived from the entries you record, so the numbers reflect your actual execution.',
  },
  {
    q: 'How is discipline measured?',
    a: 'Plan compliance, position sizing, and emotional state are turned into a visible discipline score per trade and over time — so drift in your process shows up before it costs you.',
  },
  {
    q: 'Does my data sync or leave my device?',
    a: 'Your journal is stored with a secure sign-in. It is only ever associated with your account and is never used for anything beyond your own journaling and analytics.',
  },
  {
    q: 'Can I track multiple accounts?',
    a: 'Yes. Each account keeps its own journal, metrics, and reflections so results are evaluated separately — the way your edge actually behaves across your style.',
  },
];

export default function AuthFAQ() {
  const reduceMotion = useReducedMotion();
  const dur = (duration, delay = 0) => (reduceMotion ? { duration: 0 } : { duration, delay, ease: EASE });

  return (
    <section className="auth-faq" aria-labelledby="auth-faq-heading">
      <div className="auth-faq-inner">
        <motion.span
          className="auth-section-eyebrow"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={dur(0.5)}
        >
          Questions
        </motion.span>
        <h2 id="auth-faq-heading" className="auth-section-title">
          Asked before the first trade.
        </h2>
        <p className="auth-section-text">
          A few things traders ask before they start journaling their execution.
        </p>

        <div className="auth-faq-list">
          {FAQS.map((item, i) => (
            <motion.details
              key={item.q}
              className="auth-faq-item"
              name="auth-faq"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={dur(0.5, 0.06 * i)}
            >
              <summary className="auth-faq-question">
                <span>{item.q}</span>
                <span className="auth-faq-icon" aria-hidden="true">
                  <ChevronDown size={16} />
                </span>
              </summary>
              <div className="auth-faq-answer">
                <p>{item.a}</p>
              </div>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}