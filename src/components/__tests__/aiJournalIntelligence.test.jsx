// AI Journal Intelligence UI flow — (Sprint 9.3)
//
// Proves the production consumer contract of the journal-level AI feature
// as wired into the Analytics page:
//   - The AI section mounts in IDLE and NEVER auto-fires — the only trigger
//     is the explicit "Analyze Journal" button.
//   - In "All Accounts" mode the Analyze action is disabled and the user is
//     told to pick a single account (account isolation).
//   - Loading disables the trigger (duplicate-request protection) and the
//     container is marked aria-busy.
//   - Success renders ONLY the allow-listed journal sections from the
//     sanitized analysis, plus the canonical Data Quality block.
//   - The default disabled provider resolves to the safe, human-readable
//     AI_NOT_CONFIGURED message — never a raw provider error.
//   - The moment the analyzed scope changes after a result, the result is
//     marked STALE until the user re-runs the analysis.
//   - READ-ONLY: this component has no write path for trades, balances,
//     PnL, RR, risk, filters, or journal data.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIJournalIntelligence from '../ai/AIJournalIntelligence';
import { safeJournalErrorMessage } from '../../lib/ai/journalIntelligence';

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

vi.mock('../../context/DataContext', () => ({ useData: () => state.data }));
vi.mock('../../context/AccountContext', () => ({ useAccounts: () => state.accounts }));

function trade(id, overrides = {}) {
  return {
    id,
    accountId: ACC,
    date: '2024-01-15',
    entryTime: '09:00',
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
  return Array.from({ length: n }, (_, i) => trade(`t-${i}`, { id: `t-${i}` }));
}

// A provider that returns a contract-conforming journal analysis.
const successProvider = {
  analyze: async () => ({
    ok: true,
    status: 'ok',
    analysis: {
      summary: 'Executive read of your recorded journal shows consistent execution quality.',
      keyInsights: [{ title: 'Pullback strength', observation: 'Positive recorded results.', evidence: 'Setup performance lists positive net PnL.', confidence: 0.7 }],
      strengths: ['Follows the plan'],
      improvementAreas: ['Reduce late entries'],
      watchlist: ['Monitor the win streak'],
      confidence: 0.6,
      disclaimer: 'Not financial advice.',
    },
  }),
};

beforeEach(() => {
  state.data.trades.items = makeTrades(12);
  state.data.models = [];
  state.data.riskCriteria = [];
  state.data.checklistCriteria = [];
  state.data.reflections = { items: [] };
  state.accounts.allAccounts = false;
  state.accounts.selectedAccount = { id: ACC, name: 'Main' };
  state.accounts.accounts = [{ id: ACC, name: 'Main' }];
});

describe('AI Journal Intelligence — production Analytics flow (Sprint 9.3)', () => {
  it('renders in IDLE with an explicit Analyze trigger and never auto-fires', () => {
    render(<AIJournalIntelligence />);
    expect(screen.getByRole('button', { name: /analyze journal/i })).toBeInTheDocument();
    expect(screen.getByText(/run journal intelligence/i)).toBeInTheDocument();
    expect(screen.queryByText(/analyzing your journal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('starts in the multi-account view with the Analyze action disabled and an isolation notice', () => {
    state.accounts.allAccounts = true;
    state.accounts.selectedAccount = null;
    render(<AIJournalIntelligence />);
    expect(screen.getByRole('button', { name: /analyze journal/i })).toBeDisabled();
    expect(screen.getByText(/requires a single account/i)).toBeInTheDocument();
  });

  it('reports the in-scope trade count from the canonical journal filter', () => {
    render(<AIJournalIntelligence />);
    expect(screen.getByText(/12 trades/i)).toBeInTheDocument();
  });

  it('clicking Analyze with the default disabled provider shows the safe NOT_CONFIGURED state', async () => {
    render(<AIJournalIntelligence />);
    fireEvent.click(screen.getByRole('button', { name: /analyze journal/i }));

    expect(screen.getByText(/analyzing your journal/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/not configured/i);
    expect(alert).toHaveTextContent(/no journal data was sent/i);
    expect(alert.textContent).not.toMatch(/api[_-]?key|stack|undefined|http/i);
  });

  it('renders the safe error copy for every controlled journal AI code', () => {
    const codes = [
      'AI_NOT_CONFIGURED',
      'AI_ACCOUNT_SCOPE_ERROR',
      'AI_RATE_LIMITED',
      'AI_TIMEOUT',
      'AI_UNAVAILABLE',
      'AI_PROVIDER_ERROR',
      'AI_INVALID_RESPONSE',
      'AI_NOT_ENOUGH_DATA',
      'ANOTHER_THING',
    ];
    for (const code of codes) {
      const message = safeJournalErrorMessage(code);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      // Never raw provider internals or key material.
      expect(message).not.toMatch(/api[_-]?key|stack|secret|undefined|http/i);
    }
  });

  it('prevents duplicate AI requests while a request is loading', async () => {
    let analyzeCalls = 0;
    let resolveRequest;
    const provider = {
      analyze: async () => {
        analyzeCalls += 1;
        await new Promise((resolve) => {
          resolveRequest = resolve;
        });
        return {
          ok: true,
          status: 'ok',
          analysis: {
            summary: 'done reading the spectrum',
            confidence: 0.5,
            disclaimer: 'Not financial advice.',
          },
        };
      },
    };

    render(<AIJournalIntelligence provider={provider} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze journal/i }));

    await waitFor(() => expect(screen.getByText(/analyzing your journal/i)).toBeInTheDocument());

    // While LOADING the trigger is disabled (busyRef + disabled state), so no
    // duplicate request can be fired; the container is also aria-busy.
    expect(screen.getByRole('button', { name: /analyze journal/i })).toBeDisabled();
    expect(screen.getByLabelText(/journal intelligence/i)).toHaveAttribute('aria-busy', 'true');

    resolveRequest();
    await waitFor(() => expect(screen.getByText(/done reading the spectrum/i)).toBeInTheDocument());

    expect(analyzeCalls).toBe(1);
  });

  it('success renders only allow-listed journal sections plus the canonical Data Quality block', async () => {
    render(<AIJournalIntelligence provider={successProvider} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze journal/i }));

    await waitFor(() => {
      expect(screen.getByText(/executive read of your recorded journal/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/key insights/i)).toBeInTheDocument();
    expect(screen.getByText(/pullback strength/i)).toBeInTheDocument();
    expect(screen.getByText(/follows the plan/i)).toBeInTheDocument();
    expect(screen.getByText(/improvement areas/i)).toBeInTheDocument();
    expect(screen.getByText(/worth monitoring/i)).toBeInTheDocument();

    // Canonical Data Quality block — trade count is a fact about the scope.
    expect(screen.getByText(/12 trades analyzed/i)).toBeInTheDocument();
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument();

    // Never any unsanitized signal / guarantee language.
    expect(screen.queryByText(/buy now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/100% profit/i)).not.toBeInTheDocument();
  });

  it('marks a previous result STALE the moment the scope changes', async () => {
    render(<AIJournalIntelligence provider={successProvider} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze journal/i }));

    await waitFor(() => {
      expect(screen.getByText(/executive read of your recorded journal/i)).toBeInTheDocument();
    });

    // After success the result is current — no stale banner.
    expect(screen.queryByText(/journal scope changed/i)).not.toBeInTheDocument();

    // Change the analyzed scope via the canonical Pair filter.
    fireEvent.change(screen.getByLabelText(/^Pair/i), { target: { value: 'EURUSD' } });

    // The prior result is now visibly stale until the user re-runs.
    expect(screen.getByText(/journal scope changed — run ai analysis again/i)).toBeInTheDocument();
  });

  it('NOT_ENOUGH_DATA surfaces through the safe error state (no provider call)', async () => {
    let providerCalls = 0;
    const provider = {
      analyze: async () => {
        providerCalls += 1;
        return successProvider.analyze();
      },
    };
    state.data.trades.items = [];
    render(<AIJournalIntelligence provider={provider} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze journal/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/not enough trades/i);
    expect(providerCalls).toBe(0);
  });
});