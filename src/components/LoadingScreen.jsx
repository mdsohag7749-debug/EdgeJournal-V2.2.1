import { useEffect, useState } from 'react';
import { Activity, TrendingUp } from 'lucide-react';

// Keep the initial refresh loader visible until its one-shot chart animation ends.
export const TRADING_LOADER_FINISH_MS = 1700;
export const LOW_GRAPHICS_LOADER_FINISH_MS = 720;

function prefersLowGraphics() {
  try {
    return window.localStorage.getItem('edgejournal-graphics-mode') === 'low'
      || document.documentElement.dataset.graphicsMode === 'low';
  } catch {
    return document.documentElement.dataset.graphicsMode === 'low';
  }
}

// Shared by auth checks, first data sync, and lazy-loaded pages.
export default function LoadingScreen({ message = 'Loading EdgeJournal…' }) {
  const [lowGraphics, setLowGraphics] = useState(prefersLowGraphics);

  useEffect(() => {
    const syncMode = (event) => setLowGraphics(event.detail === 'low');
    const syncStorage = (event) => {
      if (event.key === 'edgejournal-graphics-mode') setLowGraphics(event.newValue === 'low');
    };
    window.addEventListener('edgejournal-graphics-mode-change', syncMode);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener('edgejournal-graphics-mode-change', syncMode);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);

  if (lowGraphics) {
    return (
      <div className="market-loading market-loading-low" role="status" aria-live="polite" aria-label={message}>
        <div className="market-loading-low-card">
          <div className="market-loading-low-heading">
            <span className="market-loading-low-mark"><Activity size={15} strokeWidth={2.3} /></span>
            <span>EDGEJOURNAL <small>• SYNC</small></span>
          </div>
          <div className="market-loading-low-chart" aria-hidden="true">
            {[18, 27, 14, 32, 22, 38].map((height, index) => (
              <i key={index} style={{ height, animationDelay: `${index * 45}ms` }} />
            ))}
            <b />
          </div>
          <div className="market-loading-low-copy">
            <span>Preparing your trading view</span>
            <small>{message}</small>
          </div>
          <div className="market-loading-low-progress" aria-hidden="true"><i /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="market-loading" role="status" aria-live="polite" aria-label={message}>
      <div className="market-loading-card">
        <div className="market-loading-heading">
          <div className="market-loading-mark"><Activity size={17} strokeWidth={2.4} /></div>
          <div>
            <div className="market-loading-brand">EDGEJOURNAL <span>• TRADING DESK</span></div>
            <div className="market-loading-caption">MARKET DATA SYNC</div>
          </div>
          <div className="market-live-indicator"><i /> SYNCING</div>
        </div>

        <div className="market-chart-wrap" aria-hidden="true">
          <div className="market-chart-label market-chart-label-top"><TrendingUp size={12} /> PRICE ACTION</div>
          <svg className="market-chart" viewBox="0 0 360 132" fill="none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="market-line-gradient" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#63d8d3" />
                <stop offset="1" stopColor="#9aa7ff" />
              </linearGradient>
              <linearGradient id="market-area-gradient" x1="180" y1="18" x2="180" y2="132" gradientUnits="userSpaceOnUse">
                <stop stopColor="#75d9e8" stopOpacity=".24" />
                <stop offset="1" stopColor="#75d9e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[28, 58, 88, 118].map((y) => <path key={`h${y}`} d={`M0 ${y}H360`} className="market-gridline" />)}
            {[60, 120, 180, 240, 300].map((x) => <path key={`v${x}`} d={`M${x} 14V126`} className="market-gridline market-gridline-vertical" />)}
            <path d="M0 100 C24 91 27 106 49 91 S78 80 96 87 S120 68 143 76 S169 85 187 62 S218 68 234 55 S258 65 276 43 S302 52 318 34 S341 43 360 20 V132 H0Z" fill="url(#market-area-gradient)" />
            <path className="market-price-line" pathLength="1" d="M0 100 C24 91 27 106 49 91 S78 80 96 87 S120 68 143 76 S169 85 187 62 S218 68 234 55 S258 65 276 43 S302 52 318 34 S341 43 360 20" stroke="url(#market-line-gradient)" />
            <circle className="market-price-dot-halo" cx="360" cy="20" r="8" />
            <circle className="market-price-dot" cx="360" cy="20" r="3" />
          </svg>
          <div className="market-chart-label market-chart-label-bottom"><span>SELL</span><span>BUY</span></div>
        </div>

        <div className="market-loading-footer">
          <div className="market-loading-copy"><span className="market-loading-title">Building your trading view</span><span className="market-loading-message">{message}</span></div>
          <div className="market-loading-signal" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>
        </div>
        <div className="market-loading-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
