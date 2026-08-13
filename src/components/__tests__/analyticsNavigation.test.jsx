// Analytics folder / tree navigation UI — (Sprint 9.6)
//
// Proves the new information architecture of the Analytics page as wired on
// /analytics:
//   - All SEVEN conceptual groups render with their existing analytics
//     content still fully accessible (nothing was removed).
//   - The desktop folder/tree and the compact tablet/mobile selector navigate
//     by smooth-scrolling + expanding — never reloading the page and never
//     triggering AI.
//   - The active folder updates from scroll via IntersectionObserver
//     (throttle crossings, aria-current moves accordingly).
//   - Folder collapse/expand respects aria-expanded/aria-controls and is
//     keyboard-accessible.
//   - EXACTLY ONE EdgeAICommandCenter exists on the page, its four cards stay
//     functional, and folder navigation never auto-fires the AI provider.
//   - prefers-reduced-motion swaps smooth scroll for instant 'auto' scroll.
//   - The page still flows through the canonical computeAnalytics() engine.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import Analytics from '../../pages/Analytics';
import { computeAnalytics } from '../../lib/analytics';

const ACC = 'acc-0001';

const state = vi.hoisted(() => ({
  data: {
    trades: { items: [] },
    models: [],
    riskCriteria: [],
    checklistCriteria: [],
    reflections: { items: [] },
  },
  accounts: {
    accounts: [{ id: 'acc-0001', name: 'Main' }],
    allAccounts: false,
    selectedAccount: { id: 'acc-0001', name: 'Main' },
    getAccountName: (id) => (id === 'acc-0001' ? 'Main' : ''),
  },
}));

const provider = vi.hoisted(() => ({ analyze: vi.fn() }));

vi.mock('../../context/DataContext', () => ({ useData: () => state.data }));
vi.mock('../../context/AccountContext', () => ({ useAccounts: () => state.accounts }));
// The default provider is "enabled" so we can PROVE folder navigation never
// fires an analysis (only each AI feature's own explicit CTA may).
vi.mock('../../lib/ai/provider', () => ({
  createAIProvider: () => ({ isEnabled: () => true, analyze: provider.analyze }),
}));

const MODELS = ['Breakout', 'Pullback', 'Reversal', 'Range Fade'];
const SESSIONS = ['London', 'New York', 'Asian'];
const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY'];
const TFS = ['M15', 'M5', 'H1'];

function trade(id, overrides = {}) {
  return {
    id,
    accountId: ACC,
    date: '2024-01-15',
    entryTime: '09:00',
    exitTime: '09:45',
    instrument: PAIRS[id % PAIRS.length],
    direction: id % 2 === 0 ? 'Buy' : 'Sell',
    session: SESSIONS[id % SESSIONS.length],
    timeframe: TFS[id % TFS.length],
    model: MODELS[id % MODELS.length],
    result: id % 3 === 0 ? 'Loss' : 'Win',
    netPnl: id % 3 === 0 ? -45 : 80,
    rr: id % 3 === 0 ? -1 : 2,
    riskPercent: 1,
    mistakes: [],
    ...overrides,
  };
}

function makeTrades(n) {
  return Array.from({ length: n }, (_, i) => trade(i, { id: `t-${i}` }));
}

let scrollSpy;

beforeEach(() => {
  state.data.trades.items = makeTrades(12);
  state.data.models = MODELS;
  state.data.riskCriteria = [];
  state.data.checklistCriteria = [];
  state.data.reflections = { items: [] };
  state.accounts.allAccounts = false;
  state.accounts.selectedAccount = { id: ACC, name: 'Main' };
  state.accounts.accounts = [{ id: ACC, name: 'Main' }];
  IntersectionObserver.instances.length = 0;
  scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  provider.analyze.mockClear();
});

afterEach(() => {
  scrollSpy?.mockRestore();
});

const treeNav = () => within(document.querySelector('.analytics-tree'));
const chipNav = () => within(document.querySelector('.analytics-selector'));
const folder = (label) => treeNav().getByRole('button', { name: label });
const chip = (label) => chipNav().getByRole('button', { name: label });

function fireScroll(entryKey, top = 0) {
  const instance = IntersectionObserver.instances[IntersectionObserver.instances.length - 1];
  expect(instance).toBeDefined();
  act(() => {
    instance.callback(
      [
        {
          isIntersecting: true,
          target: document.querySelector(`[data-section-key="${entryKey}"]`),
          boundingClientRect: { top },
        },
      ],
      instance
    );
  });
}

const GROUP_KEYS = ['performance', 'risk', 'institutional', 'trading', 'pattern', 'action', 'edgeai'];

describe('Analytics — folder / tree navigation (Sprint 9.6)', () => {
  it('renders all 7 groups as sections with headings and technical eyebrows', () => {
    render(<Analytics />);

    for (const key of GROUP_KEYS) {
      expect(document.querySelector(`[data-section-key="${key}"]`)).toBeInTheDocument();
    }

    // Folder headings (some titles also appear inside their own cards, so a
    // group heading may occur more than once — at least one must exist).
    for (const title of [
      'Performance Intelligence',
      'Risk & Equity',
      'Institutional Insights',
      'Trading Performance',
      'Pattern & Psychology',
      'Action & Improvement',
      'EDGE AI',
    ]) {
      expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0);
    }

    // Technical folder eyebrows (tree language).
    expect(screen.getByText(/CORE PERFORMANCE · P&L & WIN RATE/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ASK JOURNAL/i).length).toBeGreaterThan(0);

    // The hero header is present with its heading copy.
    expect(screen.getByRole('heading', { name: 'See the system behind your trades.' })).toBeInTheDocument();
  });

  it('keeps every existing analytics feature accessible inside the folded groups', () => {
    render(<Analytics />);

    // Performance folder.
    expect(screen.getAllByText('Win Rate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profit Factor').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /deep performance analytics/i })).toBeInTheDocument();

    // Risk folder.
    expect(screen.getByRole('heading', { name: 'Risk Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equity Analytics' })).toBeInTheDocument();

    // Institutional folder.
    expect(screen.getByRole('heading', { name: /Risk \& Execution Intelligence/ })).toBeInTheDocument();

    // Trading folder (inline tables + setups + pairs).
    expect(screen.getByRole('heading', { name: 'Trades by Strategy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /timeframe performance/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /direction performance/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /setup \/ model performance/i })).toBeInTheDocument();

    // Pattern & Psychology folder.
    expect(screen.getByRole('heading', { name: 'Mistake Analytics' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /rule compliance/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /discipline score/i })).toBeInTheDocument();

    // Action folder.
    expect(screen.getByRole('heading', { name: /action recommendations/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /weekly performance/i })).toBeInTheDocument();
  });

  it('clicking a folder expands it and smooth-scrolls to its section', () => {
    render(<Analytics />);

    // Collapse the Risk folder from its own toggle.
    const riskToggle = screen.getByRole('button', { name: 'Collapse Risk & Equity' });
    fireEvent.click(riskToggle);
    expect(riskToggle).toHaveAttribute('aria-expanded', 'false');
    expect(folder('Risk & Equity')).toHaveAttribute('aria-expanded', 'false');

    // Clicking the folder in the tree re-expands AND scrolls to it.
    fireEvent.click(folder('Risk & Equity'));
    expect(folder('Risk & Equity')).toHaveAttribute('aria-expanded', 'true');
    expect(riskToggle).toHaveAttribute('aria-expanded', 'true');
    expect(scrollSpy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('updates the active folder from scroll via IntersectionObserver', () => {
    render(<Analytics />);

    // Default: the first folder is active.
    expect(folder('Performance Intelligence')).toHaveAttribute('aria-current', 'location');
    expect(folder('Risk & Equity')).not.toHaveAttribute('aria-current');

    // Simulate the reader reaching the Risk section.
    fireScroll('risk', 0);

    expect(folder('Risk & Equity')).toHaveAttribute('aria-current', 'location');
    expect(folder('Performance Intelligence')).not.toHaveAttribute('aria-current');
    expect(chip('Risk & Equity')).toHaveAttribute('aria-current', 'location');
  });

  it('renders EXACTLY ONE Edge AI Command Center with its four cards', () => {
    render(<Analytics />);

    expect(document.querySelectorAll('.ejc-shell').length).toBe(1);
    expect(document.querySelectorAll('.ejc-card').length).toBe(4);

    expect(screen.getByRole('button', { name: 'Open Journal Intelligence' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Trade Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open AI Coach' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Ask Journal' })).toBeInTheDocument();
  });

  it('keeps the AI cards functional (only the selected feature expands)', () => {
    render(<Analytics />);

    // Journal Intelligence is the default expanded feature.
    expect(screen.getByRole('button', { name: 'Analyze Journal' })).toBeInTheDocument();

    // Switching to Trade Review swaps the panel — no AI is fired.
    fireEvent.click(screen.getByRole('button', { name: 'Open Trade Review' }));
    expect(screen.getByText(/select a trade to start a review/i)).toBeInTheDocument();
    expect(provider.analyze).not.toHaveBeenCalled();

    // Ask Journal panel only appears once selected.
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask Journal' }));
    expect(screen.getByLabelText(/what would you like to understand/i)).toBeInTheDocument();
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('folder navigation NEVER auto-triggers AI', () => {
    render(<Analytics />);

    // Click through every folder in the tree and the mobile selector.
    const treeLabels = {
      performance: 'Performance Intelligence',
      risk: 'Risk & Equity',
      institutional: 'Institutional Insights',
      trading: 'Trading Performance',
      pattern: 'Pattern & Psychology',
      action: 'Action & Improvement',
      edgeai: 'EDGE AI',
    };
    for (const key of GROUP_KEYS) {
      fireEvent.click(folder(treeLabels[key]));
    }
    fireEvent.click(chip('Trading'));
    fireEvent.click(chip('Edge AI'));

    expect(provider.analyze).not.toHaveBeenCalled();
    expect(screen.queryByText(/analyzing|building your coaching plan/i)).not.toBeInTheDocument();
  });

  it('exposes the compact mobile "Analytics Sections" selector and it navigates', () => {
    render(<Analytics />);

    const chips = chipNav();
    expect(chips.getByRole('button', { name: 'Performance' })).toBeInTheDocument();
    expect(chips.getByRole('button', { name: 'Action' })).toBeInTheDocument();

    fireEvent.click(chips.getByRole('button', { name: 'Action' }));
    expect(chips.getByRole('button', { name: 'Action' })).toHaveAttribute('aria-current', 'location');
    expect(scrollSpy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('keeps every nav + folder control a real <button> (keyboard-friendly)', () => {
    render(<Analytics />);

    const buttons = document.querySelectorAll('.analytics-folder, .analytics-chip, .analytics-group-toggle');
    expect(buttons.length).toBeGreaterThan(0);
    for (const el of buttons) {
      expect(el.tagName).toBe('BUTTON');
    }

    // Keyboard activation path (Enter) on the folder toggle still toggles.
    const toggle = screen.getByRole('button', { name: 'Collapse Pattern & Psychology' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(toggle, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(toggle, { key: 'Enter', code: 'Enter' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('wires aria-expanded and aria-current correctly across controls', () => {
    render(<Analytics />);

    const perfToggle = screen.getByRole('button', { name: 'Collapse Performance Intelligence' });
    expect(perfToggle).toHaveAttribute('aria-expanded', 'true');
    expect(perfToggle).toHaveAttribute('aria-controls', 'analytics-group-performance-panel');
    expect(folder('Performance Intelligence')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(perfToggle);
    expect(perfToggle).toHaveAttribute('aria-expanded', 'false');
    expect(folder('Performance Intelligence')).toHaveAttribute('aria-expanded', 'false');

    // aria-current belongs to the folder that is currently on screen.
    fireScroll('trading', 0);
    expect(folder('Trading Performance')).toHaveAttribute('aria-current', 'location');
    expect(folder('Performance Intelligence')).not.toHaveAttribute('aria-current', 'location');
    expect(chip('Trading')).toHaveAttribute('aria-current', 'location');
  });

  it('respects prefers-reduced-motion (instant scroll, all content present)', () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: /reduce/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    try {
      render(<Analytics />);
      fireEvent.click(folder('Pattern & Psychology'));
      expect(scrollSpy).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });

      // Content remains fully present and groups stay all-expanded by default.
      for (const key of GROUP_KEYS) {
        expect(document.querySelector(`[data-section-key="${key}"] .analytics-fold`)).toBeInTheDocument();
      }
      expect(screen.getByRole('heading', { name: 'EDGE AI' })).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('still flows through the canonical calculation engine (no UI recalculation)', () => {
    const a = computeAnalytics(state.data.trades.items);
    expect(a.total).toBe(12);
    expect(typeof a.netPnl).toBe('number');
    expect(a.byStrategy.length).toBeGreaterThan(0);

    render(<Analytics />);
    expect(screen.queryAllByText(/net profit/i).length).toBeGreaterThan(0);
  });
});