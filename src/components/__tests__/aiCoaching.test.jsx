// AI Coaching & Action Plan UI flow — (Sprint 9.4)
//
// Proves the production consumer contract of the coaching feature as wired
// into the Analytics page:
//   - The AI section mounts in IDLE and NEVER auto-fires — the only trigger
//     is the explicit "Generate Coaching Plan" button.
//   - In "All Accounts" mode the Generate action is disabled and the user is
//     told to pick a single account (account isolation).
//   - Loading disables the trigger (duplicate-request protection) and the
//     container is marked aria-busy.
//   - Success renders ONLY the allow-listed coaching sections — focus areas,
//     strengths, recurring patterns, period comparison, action plan (local
//     checklist state), watch items and the canonical Data Quality block.
//   - The blueprint horizon filter affects the analyzed scope; changing the
//     scope after a result marks it STALE.
//   - The default disabled provider resolves to the safe, human-readable
//     AI_NOT_CONFIGURED message — never a raw provider error.
//   - READ-ONLY: no write path for trades, balances, PnL, RR, risk, scores,
//     filters or saved views exists in this component.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AICoaching from '../ai/AICoaching';
import { safeCoachingErrorMessage } from '../../lib/ai/coaching';

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

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mon of the week containing `d` (matches the app's calendar bucketing).
function monday(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  return m;
}

// Trade dates within the CURRENT week so the default Weekly horizon includes
// them and the canonical data-quality counter stays accurate.
const MON = monday(new Date());

function withinWeek(offset) {
  const d = new Date(MON);
  d.setDate(d.getDate() + offset);
  return localKey(d);
}

function trade(id, overrides = {}) {
  return {
    id,
    accountId: ACC,
    date: withinWeek(0),
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
  return Array.from({ length: n }, (_, i) => trade(`t-${i}`, { id: `t-${i}`, date: withinWeek(i % 7), result: i % 2 === 0 ? 'Win' : 'Loss' }));
}

const successProvider = {
  analyze: async () => ({
    ok: true,
    status: 'ok',
    analysis: {
      summary: 'Your journal points to checklist adherence as the next improvement cycle.',
      focusAreas: [
        {
          title: 'Checklist discipline',
          reason: 'Weakest recorded discipline component.',
          evidence: 'Plan & Checklist scored lowest in Discipline Score 2.0.',
          priority: 'HIGH',
          confidence: 0.7,
          action: 'Review checklist habits before execution',
          source: 'disciplineScore',
        },
      ],
      strengths: ['Records risk on every trade'],
      recurringPatterns: [{ title: 'Late entries', observation: 'Recorded several times.', evidence: 'Mistake intelligence lists late entry.' }],
      periodComparison: [{ metric: 'Win rate', current: 60, previous: 50, direction: 'IMPROVING', observation: 'Small sample.' }],
      actionPlan: [
        { title: 'Complete checklist on every trade', why: 'Weakest area.', evidence: 'Recorded in journal.', timeframe: 'THIS_WEEK', measurable: true, completionHint: 'Tick each item before entry.' },
      ],
      watchItems: ['Watch the win-streak sample size'],
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

describe('AI Coaching — production Analytics flow (Sprint 9.4)', () => {
  it('renders in IDLE with an explicit Generate trigger and never auto-fires', () => {
    render(<AICoaching />);
    expect(screen.getByRole('button', { name: /generate coaching plan/i })).toBeInTheDocument();
    expect(screen.getByText(/generate a weekly coaching plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/building your coaching plan/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('starts in the multi-account view with Generate disabled and an isolation notice', () => {
    state.accounts.allAccounts = true;
    state.accounts.selectedAccount = null;
    render(<AICoaching />);
    expect(screen.getByRole('button', { name: /generate coaching plan/i })).toBeDisabled();
    expect(screen.getByText(/requires a single account/i)).toBeInTheDocument();
  });

  it('exposes the Daily / Weekly / Monthly horizon switch', () => {
    render(<AICoaching />);
    expect(screen.getByRole('button', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument();
  });

  it('clicking Generate with the default disabled provider shows the safe NOT_CONFIGURED state', async () => {
    render(<AICoaching />);
    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));

    expect(screen.getByText(/building your coaching plan/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/not configured/i);
    expect(alert).toHaveTextContent(/no journal data was sent/i);
    expect(alert.textContent).not.toMatch(/api[_-]?key|stack|undefined|http/i);
  });

  it('renders the safe error copy for every controlled coaching AI code', () => {
    const codes = ['AI_NOT_CONFIGURED', 'AI_ACCOUNT_SCOPE_ERROR', 'AI_RATE_LIMITED', 'AI_TIMEOUT', 'AI_UNAVAILABLE', 'AI_PROVIDER_ERROR', 'AI_INVALID_RESPONSE', 'AI_NOT_ENOUGH_DATA', 'ANOTHER_THING'];
    for (const code of codes) {
      const message = safeCoachingErrorMessage(code);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/api[_-]?key|stack|secret|undefined|http/i);
    }
  });

  it('prevents duplicate AI requests while loading and surfaces aria-busy', async () => {
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
            summary: 'done planning the week',
            confidence: 0.5,
            disclaimer: 'Not financial advice.',
          },
        };
      },
    };

    render(<AICoaching provider={provider} />);
    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));

    await waitFor(() => expect(screen.getByText(/building your coaching plan/i)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /generate coaching plan/i })).toBeDisabled();
    expect(screen.getByLabelText(/coaching plan/i)).toHaveAttribute('aria-busy', 'true');

    resolveRequest();
    await waitFor(() => expect(screen.getByText(/done planning the week/i)).toBeInTheDocument());

    expect(analyzeCalls).toBe(1);
  });

  it('success renders only allow-listed coaching sections plus the canonical Data Quality block', async () => {
    render(<AICoaching provider={successProvider} />);
    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));

    await waitFor(() => expect(screen.getByText(/checklist adherence as the next improvement cycle/i)).toBeInTheDocument());

    // Focus areas + strengths + recurring patterns.
    expect(screen.getByText(/your focus/i)).toBeInTheDocument();
    expect(screen.getByText('Checklist discipline')).toBeInTheDocument();
    expect(screen.getByText(/what you're doing well/i)).toBeInTheDocument();
    expect(screen.getByText(/recurring patterns/i)).toBeInTheDocument();
    expect(screen.getByText('Late entries')).toBeInTheDocument();

    // Period comparison.
    expect(screen.getByText(/period comparison/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Period comparison')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByLabelText('Trend Improving')).toBeInTheDocument();

    // Action plan (local checklist state).
    expect(screen.getByText(/your action plan/i)).toBeInTheDocument();
    expect(screen.getByText('Complete checklist on every trade')).toBeInTheDocument();

    // Worth monitoring.
    expect(screen.getByText(/worth monitoring/i)).toBeInTheDocument();

    // Canonical Data Quality block — trade count is a fact about the scope.
    expect(screen.getByText(/12 trades analyzed/i)).toBeInTheDocument();
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument();

    // Never any unsanitized signal / guarantee language.
    expect(screen.queryByText(/buy now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/100% profit/i)).not.toBeInTheDocument();
  });

  it('action-plan checklist toggles LOCALLY (no writes), honoring progress in-session only', async () => {
    render(<AICoaching provider={successProvider} />);
    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));
    await waitFor(() => expect(screen.getByText('Complete checklist on every trade')).toBeInTheDocument());

    const checkbox = screen.getByRole('checkbox', { name: /toggle action/i });
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(checkbox);
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(checkbox);
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  it('marks a previous result STALE the moment the horizon or a filter changes', async () => {
    render(<AICoaching provider={successProvider} />);
    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));

    await waitFor(() => expect(screen.getByText(/checklist adherence as the next improvement cycle/i)).toBeInTheDocument());
    expect(screen.queryByText(/your journal scope changed/i)).not.toBeInTheDocument();

    // Change the analyzed horizon → prior result is now stale.
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText(/your journal scope changed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss stale plan/i })).toBeInTheDocument();

    // Dismissing returns to idle.
    fireEvent.click(screen.getByRole('button', { name: /dismiss stale plan/i }));
    expect(screen.queryByText(/your journal scope changed/i)).not.toBeInTheDocument();
  });

  it('NOT_ENOUGH_DATA surfaces through the safe error state with no provider call', async () => {
    let providerCalls = 0;
    const provider = {
      analyze: async () => {
        providerCalls += 1;
        return successProvider.analyze();
      },
    };
    state.data.trades.items = [];
    render(<AICoaching provider={provider} />);
    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/not enough trades/i);
    expect(providerCalls).toBe(0);
  });

  it('sets a11y landmarks: aria-busy on the section, semantic headings, no auto region errors', async () => {
    render(<AICoaching provider={successProvider} />);
    const section = screen.getByLabelText(/coaching plan/i);
    expect(section).toHaveAttribute('aria-busy', 'false');

    fireEvent.click(screen.getByRole('button', { name: /generate coaching plan/i }));
    await waitFor(() => expect(screen.getByText(/checklist adherence as the next improvement cycle/i)).toBeInTheDocument());

    // Semantic sub-headings are real heading elements.
    expect(screen.getByRole('heading', { name: /your action plan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your focus/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /period comparison/i })).toBeInTheDocument();
  });
});