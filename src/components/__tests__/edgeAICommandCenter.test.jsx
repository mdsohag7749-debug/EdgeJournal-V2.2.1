// Edge AI Command Center UI — (Sprint 9.5)
//
// Proves the production orchestration contract of the Command Center as
// wired into the Analytics page:
//   - The EDGE AI header renders with its subtitle, supporting text and a
//     safe status indicator ("AI NOT CONFIGURED" / "AI READY") — never
//     provider names, keys or plans.
//   - All four feature cards are visible: Journal Intelligence, Trade Review,
//     AI Coach, Ask Journal.
//   - ONLY the selected feature expands into its detailed content; the others
//     stay collapsed cards.
//   - Switching features NEVER auto-fires AI — no provider call on mount or
//     on any card switch. Only each feature's own explicit CTA triggers AI.
//   - Account isolation: in "All Accounts" mode the account-scoped features
//     are disabled and the user is told to pick a single account.
//   - Trade Review remains an entry point: no selected trade → "Select a
//     trade to start a review."; a selected trade → "Review Selected Trade"
//     reusing the existing TradeReviewPanel unchanged.
//   - READ-ONLY: no write path for trades, balances, PnL, RR, risk, scores,
//     filters or saved views exists in the Command Center.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import EdgeAICommandCenter from '../ai/EdgeAICommandCenter';

const ACC = 'acc-0001';

// Injectable fakes for the two modules the status effect depends on, so the
// READY / UNAVAILABLE badge states can be driven deterministically without
// any network call (the real modules' other exports are preserved).
const aiMocks = vi.hoisted(() => ({
  fetchRemoteHealth: vi.fn(),
  resolveAIConfig: vi.fn(),
}));

vi.mock('../../lib/ai/remote', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchRemoteHealth: aiMocks.fetchRemoteHealth };
});

vi.mock('../../lib/ai/provider', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, resolveAIConfig: aiMocks.resolveAIConfig };
});

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

vi.mock('../../context/DataContext', () => ({ useData: () => state.data }));
vi.mock('../../context/AccountContext', () => ({ useAccounts: () => state.accounts }));

function trade(id = 't-0', overrides = {}) {
  return {
    id,
    accountId: ACC,
    date: '2024-01-15',
    entryTime: '09:00',
    exitTime: '09:45',
    instrument: 'EURUSD',
    direction: 'Buy',
    session: 'London',
    timeframe: 'M15',
    model: 'Pullback',
    result: 'Win',
    netPnl: 80,
    rr: 2,
    riskPercent: 1,
    ...overrides,
  };
}

function makeTrades(n) {
  return Array.from({ length: n }, (_, i) => trade(`t-${i}`));
}

function cardButton(name) {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  state.data.trades.items = makeTrades(12);
  state.data.models = [];
  state.data.riskCriteria = [];
  state.data.checklistCriteria = [];
  state.data.reflections = { items: [] };
  state.accounts.allAccounts = false;
  state.accounts.selectedAccount = { id: ACC, name: 'Main' };
  state.accounts.accounts = [{ id: ACC, name: 'Main' }];
  // Default: closed, disabled provider config (the foundation default).
  aiMocks.resolveAIConfig.mockReturnValue({ enabled: false, provider: 'none' });
  aiMocks.fetchRemoteHealth.mockReset();
});

function detailRegion() {
  return screen.getByRole('region', { name: /expanded detail/i });
}

describe('Edge AI Command Center — production Analytics flow (Sprint 9.5)', () => {
  it('renders the EDGE AI header, subtitle, supporting text and a safe status indicator', () => {
    render(<EdgeAICommandCenter />);
    expect(screen.getByText('EDGE AI')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your trading intelligence layer/i })).toBeInTheDocument();
    expect(screen.getByText(/analyze your journal, review execution, and build better habits/i)).toBeInTheDocument();
    // Default (disabled) provider → "AI NOT CONFIGURED", no technical detail.
    const status = screen.getByText('AI NOT CONFIGURED');
    expect(status).toBeInTheDocument();
    expect(status.textContent).not.toMatch(/api[_-]?key|sk-|gemini|provider|secret|token/i);
  });

  it('shows all four feature cards with their explicit CTAs', () => {
    render(<EdgeAICommandCenter />);
    expect(cardButton('Open Journal Intelligence')).toBeInTheDocument();
    expect(cardButton('Open Trade Review')).toBeInTheDocument();
    expect(cardButton('Open AI Coach')).toBeInTheDocument();
    expect(cardButton('Open Ask Journal')).toBeInTheDocument();
    expect(screen.getByText('Journal Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Trade Review')).toBeInTheDocument();
    expect(screen.getByText('AI Coach')).toBeInTheDocument();
    expect(screen.getByText('Ask Journal')).toBeInTheDocument();
  });

  it('expands ONLY the selected feature; the others stay collapsed', () => {
    render(<EdgeAICommandCenter />);
    // Default: Journal Intelligence expanded.
    expect(within(detailRegion()).getByRole('button', { name: 'Analyze Journal' })).toBeInTheDocument();
    expect(within(detailRegion()).queryByRole('button', { name: 'Generate Coaching Plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate Coaching Plan' })).not.toBeInTheDocument();

    fireEvent.click(cardButton('Open AI Coach'));
    expect(within(detailRegion()).getByRole('button', { name: 'Generate Coaching Plan' })).toBeInTheDocument();
    expect(within(detailRegion()).queryByRole('button', { name: 'Analyze Journal' })).not.toBeInTheDocument();

    fireEvent.click(cardButton('Open Ask Journal'));
    expect(within(detailRegion()).getByLabelText(/what would you like to understand/i)).toBeInTheDocument();
    expect(within(detailRegion()).queryByRole('button', { name: 'Generate Coaching Plan' })).not.toBeInTheDocument();
  });

  it('switching features NEVER auto-fires the AI provider', () => {
    const analyze = vi.fn(async () => ({ ok: false, status: 'AI_NOT_CONFIGURED', analysis: null }));
    const provider = { analyze };
    render(<EdgeAICommandCenter provider={provider} />);

    expect(analyze).not.toHaveBeenCalled();

    fireEvent.click(cardButton('Open AI Coach'));
    fireEvent.click(cardButton('Open Ask Journal'));
    fireEvent.click(cardButton('Open Trade Review'));
    fireEvent.click(cardButton('Open Journal Intelligence'));

    expect(analyze).not.toHaveBeenCalled();
    expect(screen.queryByText(/analyzing journal|building your coaching plan|analyzing trade/i)).not.toBeInTheDocument();
  });

  it('disables account-scoped features in All Accounts mode with an isolation message', () => {
    state.accounts.allAccounts = true;
    state.accounts.selectedAccount = null;
    render(<EdgeAICommandCenter />);

    expect(cardButton('Open Journal Intelligence')).toBeDisabled();
    expect(cardButton('Open AI Coach')).toBeDisabled();
    expect(cardButton('Open Ask Journal')).toBeDisabled();
    // Trade Review is per-trade and stays available.
    expect(cardButton('Open Trade Review')).not.toBeDisabled();

    expect(screen.getByText(/select a single account to analyze your journal/i)).toBeInTheDocument();
    // Default panel explains the gate for the account-scoped feature.
    expect(screen.getByText(/requires a single account/i)).toBeInTheDocument();
  });

  it('reports live state chips upward from the expanded feature', async () => {
    let resolveRequest;
    const provider = {
      analyze: async () => {
        await new Promise((resolve) => {
          resolveRequest = resolve;
        });
        return {
          ok: true,
          status: 'ok',
          analysis: {
            summary: 'Executive read shows consistent execution quality.',
            keyInsights: [{ title: 'Pullback strength', observation: 'Positive recorded results.', evidence: 'Setup performance lists positive net PnL.', confidence: 0.7 }],
            strengths: ['Follows the plan'],
            confidence: 0.6,
            disclaimer: 'Not financial advice.',
          },
        };
      },
    };

    render(<EdgeAICommandCenter provider={provider} />);
    const journalTab = cardButton('Open Journal Intelligence');
    expect(journalTab).toHaveAttribute('aria-pressed', 'true');

    // Trigger the journal feature's own explicit CTA inside the panel.
    fireEvent.click(within(detailRegion()).getByRole('button', { name: 'Analyze Journal' }));
    // Loading: the trigger is protected from duplicate requests and the card
    // chip reports the live state.
    await waitFor(() => {
      expect(screen.getAllByText('Analyzing').length).toBeGreaterThan(0);
    });
    expect(within(detailRegion()).getByRole('button', { name: 'Analyze Journal' })).toBeDisabled();

    resolveRequest();
    await screen.findByText(/executive read shows consistent execution quality/i);
    expect(within(detailRegion()).getByRole('button', { name: 'Analyze Journal' })).not.toBeDisabled();
    await waitFor(() => {
      expect(screen.getAllByText('Result ready').length).toBeGreaterThan(0);
    });
  });

  it('Trade Review entry: no selected trade → guidance + jump to journal', () => {
    const onNavigate = vi.fn();
    render(<EdgeAICommandCenter onNavigate={onNavigate} />);
    fireEvent.click(cardButton('Open Trade Review'));

    expect(within(detailRegion()).getByText(/select a trade to start a review/i)).toBeInTheDocument();
    fireEvent.click(within(detailRegion()).getByRole('button', { name: 'Review Trade' }));
    expect(onNavigate).toHaveBeenCalledWith('journal');
  });

  it('Trade Review entry: a selected trade → Review Selected Trade reuses the panel', () => {
    const onCloseReview = vi.fn();
    render(<EdgeAICommandCenter selectedTrade={trade('t-1')} onCloseReview={onCloseReview} />);
    fireEvent.click(cardButton('Open Trade Review'));

    expect(within(detailRegion()).getByText(/a trade is selected for review/i)).toBeInTheDocument();
    const open = within(detailRegion()).getByRole('button', { name: /open review selected trade/i });
    fireEvent.click(open);

    // The reused TradeReviewPanel renders its AI Trade Review section.
    expect(screen.getByRole('button', { name: /analyze with ai/i })).toBeInTheDocument();
  });

  it('sets accessible landmarks: named buttons, aria-pressed, labelled region', () => {
    render(<EdgeAICommandCenter />);

    const journalTab = cardButton('Open Journal Intelligence');
    expect(journalTab).toHaveAttribute('aria-pressed', 'true');
    expect(journalTab).toHaveAttribute('aria-controls', 'ejc-panel');
    expect(cardButton('Open AI Coach')).toHaveAttribute('aria-pressed', 'false');

    const region = detailRegion();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region.querySelector('.ejc-panel-fade')).not.toBeNull();

    // Semantic headings present.
    expect(screen.getByRole('heading', { name: /your trading intelligence layer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Journal Intelligence' })).toBeInTheDocument();
  });

  it('keeps a responsive grid structure for the feature cards', () => {
    render(<EdgeAICommandCenter />);
    const grid = document.querySelector('.ejc-grid');
    expect(grid).not.toBeNull();
    expect(document.querySelector('.ejc-shell')).not.toBeNull();
  });

  it('shows the AI READY badge when the remote bridge reports ready', async () => {
    aiMocks.resolveAIConfig.mockReturnValue({ enabled: true, provider: 'remote' });
    aiMocks.fetchRemoteHealth.mockResolvedValue({ ok: true, enabled: true, ready: true });
    render(<EdgeAICommandCenter />);
    expect(await screen.findByText('AI READY')).toBeInTheDocument();
    expect(screen.queryByText('AI NOT CONFIGURED')).not.toBeInTheDocument();
  });

  it('shows the AI UNAVAILABLE badge when the bridge is unreachable', async () => {
    aiMocks.resolveAIConfig.mockReturnValue({ enabled: true, provider: 'remote' });
    aiMocks.fetchRemoteHealth.mockResolvedValue({ ok: false, enabled: false, ready: false });
    render(<EdgeAICommandCenter />);
    expect(await screen.findByText('AI UNAVAILABLE')).toBeInTheDocument();
    expect(screen.queryByText('AI NOT CONFIGURED')).not.toBeInTheDocument();
  });

  it('an enabled-but-non-remote config stays AI NOT CONFIGURED (no false READY)', () => {
    aiMocks.resolveAIConfig.mockReturnValue({ enabled: true, provider: 'gemini' });
    render(<EdgeAICommandCenter />);
    expect(aiMocks.fetchRemoteHealth).not.toHaveBeenCalled();
    expect(screen.getByText('AI NOT CONFIGURED')).toBeInTheDocument();
    expect(screen.queryByText('AI READY')).not.toBeInTheDocument();
  });
});