import { TrendingUp } from 'lucide-react';
import { getDailyQuote } from '../../lib/quotes';

// Shared shell for every auth page: a brand panel on the left (hidden on
// small screens, replaced by a compact mobile lockup above the form) and
// a centered form card on the right. Keeps the same red/graphite identity
// and card/button primitives used across the rest of the app.

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  const quote = getDailyQuote();

  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="auth-mark">
            <TrendingUp size={20} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>
            EdgeJournal
          </span>
        </div>

        <div style={{ position: 'relative', maxWidth: 380 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
            &ldquo;{quote}&rdquo;
          </p>
        </div>

        <div style={{ position: 'relative', fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
          © {new Date().getFullYear()} EdgeJournal. Trade with discipline.
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <div
              className="auth-mark"
              style={{ background: 'var(--red-glow)', border: '1px solid rgba(193, 18, 31, 0.25)' }}
            >
              <TrendingUp size={18} color="var(--red)" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
              EdgeJournal
            </span>
          </div>

          <div className="card" style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
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

          {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
