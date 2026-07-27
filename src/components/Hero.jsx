import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, Flame, Quote as QuoteIcon } from 'lucide-react';
import { getDailyQuote } from '../lib/quotes';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good Morning', emoji: '☀️' };
  if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', emoji: '🌤️' };
  if (hour >= 17 && hour < 21) return { text: 'Good Evening', emoji: '🌇' };
  return { text: 'Good Night', emoji: '🌙' };
}

export default function Hero({ accountName, setAccountName, streak, streakType }) {
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(accountName);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { text: greetingText, emoji } = getGreeting();
  const quote = getDailyQuote(now);

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  function save() {
    setAccountName(draft.trim() || 'My Trading Account');
    setEditing(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="dash-hero"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
        padding: '30px 32px',
        background: 'linear-gradient(120deg, var(--red) 0%, var(--red-strong) 100%)',
        boxShadow: '0 20px 48px rgba(120, 0, 0, 0.28)',
        color: '#fff',
      }}
    >
      {/* decorative glass motifs */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -60,
          right: -40,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          filter: 'blur(2px)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -90,
          right: 100,
          width: 170,
          height: 170,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 40%)',
          backdropFilter: 'blur(0.5px)',
        }}
      />

      <div className="dash-hero-top" style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
        <div style={{ minWidth: 0 }}>
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            style={{ fontSize: 14.5, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}
          >
            {greetingText} {emoji}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            style={{ fontSize: 32, fontWeight: 700, letterSpacing: '0.01em', color: '#fff', marginTop: 4 }}
          >
            EDGE JOURNAL
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(6px)',
              }}
            >
              {dateLabel}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(6px)',
              }}
            >
              {timeLabel}
            </span>
            {streak > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.14)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Flame size={13} />
                {streak}
                {streakType === 'Win' ? 'W' : 'L'} streak
              </span>
            )}
          </motion.div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {editing ? (
            <>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: 'var(--text)',
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              />
              <button
                onClick={save}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(255,255,255,0.92)',
                  color: 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Check size={14} />
              </button>
            </>
          ) : (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setDraft(accountName);
                setEditing(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                borderRadius: 10,
                padding: '9px 14px',
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(6px)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{accountName}</span>
              <Pencil size={13} />
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={quote}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 22,
            paddingTop: 18,
            borderTop: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <QuoteIcon size={16} style={{ flexShrink: 0, opacity: 0.85 }} />
          <p style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,0.92)', fontStyle: 'italic' }}>{quote}</p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
