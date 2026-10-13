// Analytics page hero (Sprint 9.6). A compact, technical "command center"
// header: the ANALYTICS wordmark, a small TRADING INTELLIGENCE eyebrow, the
// main heading line, supporting text and a scope indicator built purely from
// the existing account state (no invented data). The main heading is an h2 —
// the AppShell Header already renders the page's single h1.

import { ScanSearch } from 'lucide-react';

export default function AnalyticsHeader({ scopeLabel }) {
  return (
    <header className="analytics-hero">
      <div className="analytics-hero-copy">
        <div className="analytics-hero-eyebrow" aria-hidden>
          <span className="analytics-hero-eyebrow-dot" />
          TRADING INTELLIGENCE
        </div>

        <div className="analytics-hero-word">ANALYTICS</div>

        <h2 className="analytics-hero-heading">See the system behind your trades.</h2>
        <p className="analytics-hero-text">
          Performance, risk, setups, market context, and mistakes — all drawn from your trade history.
        </p>

        {scopeLabel && (
          <div className="analytics-scope" role="status">
            <ScanSearch size={13} aria-hidden />
            <span className="analytics-scope-key">SCOPE</span>
            <span className="analytics-scope-value">{scopeLabel}</span>
          </div>
        )}
      </div>

      <div className="analytics-hero-visual" aria-hidden="true">
        <div className="analytics-hero-visual-label">PERFORMANCE OVERVIEW</div>
        <svg viewBox="0 0 320 124" preserveAspectRatio="none">
          <defs>
            <linearGradient id="analytics-wave-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#64e6d5" stopOpacity=".24" />
              <stop offset="100%" stopColor="#64e6d5" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="analytics-wave-line" x1="0" x2="1">
              <stop offset="0%" stopColor="#71d9ff" />
              <stop offset="100%" stopColor="#68f0cf" />
            </linearGradient>
          </defs>
          <path className="analytics-hero-gridline" d="M0 30H320M0 62H320M0 94H320" />
          <path d="M0 100 C24 94 31 83 53 88 S83 74 105 78 S140 57 161 67 S198 48 218 55 S255 36 274 44 S302 25 320 22 V124 H0Z" fill="url(#analytics-wave-fill)" />
          <path className="analytics-hero-wave" d="M0 100 C24 94 31 83 53 88 S83 74 105 78 S140 57 161 67 S198 48 218 55 S255 36 274 44 S302 25 320 22" />
          <circle className="analytics-hero-wave-point" cx="218" cy="55" r="3.5" />
          <circle className="analytics-hero-wave-point analytics-hero-wave-point-last" cx="320" cy="22" r="4" />
        </svg>
        <div className="analytics-hero-visual-foot"><span>PERFORMANCE</span><i /> <span>RISK</span><i /> <span>CONSISTENCY</span></div>
      </div>
    </header>
  );
}
