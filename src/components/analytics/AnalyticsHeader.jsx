// Analytics page hero (Sprint 9.6). A compact, technical "command center"
// header: the ANALYTICS wordmark, a small TRADING INTELLIGENCE eyebrow, the
// main heading line, supporting text and a scope indicator built purely from
// the existing account state (no invented data). The main heading is an h2 —
// the AppShell Header already renders the page's single h1.

import { ScanSearch } from 'lucide-react';

export default function AnalyticsHeader({ scopeLabel }) {
  return (
    <header className="analytics-hero">
      <div className="analytics-hero-eyebrow" aria-hidden>
        <span className="analytics-hero-eyebrow-dot" />
        TRADING INTELLIGENCE
      </div>

      <div className="analytics-hero-word">ANALYTICS</div>

      <h2 className="analytics-hero-heading">See the system behind your trades.</h2>
      <p className="analytics-hero-text">
        Performance, risk, execution, psychology, and AI intelligence — organized in one command center.
      </p>

      {scopeLabel && (
        <div className="analytics-scope" role="status">
          <ScanSearch size={13} aria-hidden />
          <span className="analytics-scope-key">SCOPE</span>
          <span className="analytics-scope-value">{scopeLabel}</span>
        </div>
      )}
    </header>
  );
}
