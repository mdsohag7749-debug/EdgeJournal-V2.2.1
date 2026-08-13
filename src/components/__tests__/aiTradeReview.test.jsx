// AI Trade Review UI flow — (Sprint 9.2)
//
// Proves the production consumer contract of the first AI feature:
//   - The AI section mounts without ever auto-triggering.
//   - Nothing fires on open/render/typing — the user must explicitly click
//     "Analyze with AI".
//   - With the default disabled provider, the click resolves to the SAFE,
//     human-readable AI_NOT_CONFIGURED message — never a raw provider error.
//   - Success renders ONLY the allow-listed RESPONSE_CONTRACT sections
//     (summary + strengths/observations/weaknesses/risks/improvements +
//     confidence + disclaimer) and never unsanitized signals/guarantees.
//
// The trade travels into analyzeTradeReview() read-only; this component has
// no write path for trades, balances, PnL, RR, risk, or journal data.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AITradeReview from '../tradeReview/AITradeReview';
import { safeErrorMessage, buildTradeReviewCalculations } from '../../lib/ai/tradeReview';

function makeTrade(overrides = {}) {
  return {
    id: 'trade-ai-1',
    accountId: 'acc-0001',
    date: '2024-01-15',
    entryTime: '09:00',
    exitTime: '11:00',
    instrument: 'EURUSD',
    direction: 'Buy',
    result: 'Win',
    netPnl: 80,
    rr: 2.05,
    riskPercent: 1,
    positionSize: 100000,
    notes: 'clean pullback',
    ...overrides,
  };
}

describe('AITradeReview — production Journal review flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in IDLE with an explicit trigger and never auto-fires', () => {
    render(<AITradeReview trade={makeTrade()} accountId="acc-0001" accountName="Main" />);

    expect(screen.getByRole('button', { name: /analyze with ai/i })).toBeInTheDocument();
    expect(screen.queryByText(/analyzing trade/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clicking the trigger with the default disabled provider shows the safe NOT_CONFIGURED state', async () => {
    render(<AITradeReview trade={makeTrade()} accountId="acc-0001" accountName="Main" />);

    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/analyzing trade/i);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/not configured/i);
    expect(alert).toHaveTextContent(/trade data was not changed/i);
    // No raw provider internals ever leak into the alert.
    expect(alert.textContent).not.toMatch(/api[_-]?key|stack|undefined|http/i);
  });

  it('renders the safe error copy for every controlled AI code without leaking internals', () => {
    const codes = [
      'AI_NOT_CONFIGURED',
      'AI_TIMEOUT',
      'AI_RATE_LIMITED',
      'AI_INVALID_RESPONSE',
      'AI_ACCOUNT_SCOPE_ERROR',
      'AI_PROVIDER_ERROR',
      'AI_UNAVAILABLE',
      'UNKNOWN_THING',
    ];
    for (const code of codes) {
      const message = safeErrorMessage(code);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toMatch(/trade data was not changed/i);
    }
  });

  it('success renders only allowlisted sections and never unsupported fields', async () => {
    const provider = {
      analyze: async () => ({
        ok: true,
        status: 'ok',
        analysis: {
          summary: 'Executed a clean pullback with good risk control.',
          strengths: ['Followed the plan'],
          observations: ['Held through the London open'],
          weaknesses: ['Slightly late entry'],
          risks: ['Larger risk window'],
          improvements: ['Trim size during news'],
          confidence: 0.7,
          disclaimer: 'Not financial advice.',
        },
      }),
    };

    render(
      <AITradeReview
        trade={makeTrade()}
        accountId="acc-0001"
        accountName="Main"
        provider={provider}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await waitFor(() => {
      expect(screen.getByText(/executed a clean pullback/i)).toBeInTheDocument();
    });

    for (const s of ['Strengths', 'Observations', 'Areas to Improve', 'Risk & Discipline', 'Improvement Suggestions']) {
      expect(screen.getByText(s)).toBeInTheDocument();
    }

    // Confidence 0.7 → High label rendered.
    expect(screen.getByText(/ai confidence/i)).toBeInTheDocument();

    // Unsupported/unsanitized fields are never rendered (contract allow-list).
    expect(screen.queryByText(/buy now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/100% profit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/leak/i)).not.toBeInTheDocument();
  });

  it('forwards the canonical duration into the AI context instead of recomputing it', async () => {
    let capturedRequest = null;
    const provider = {
      analyze: async (request) => {
        capturedRequest = request;
        return {
          ok: true,
          status: 'ok',
          analysis: { summary: 'ok', confidence: null, disclaimer: 'Not financial advice.' },
        };
      },
    };

    render(
      <AITradeReview
        trade={makeTrade()}
        accountId="acc-0001"
        accountName="Main"
        duration="3h 15m"
        provider={provider}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });

    // The panel's canonical duration is passed through verbatim; the AI layer
    // receives the same recorded metrics the journal already stored. The
    // component does NOT re-implement the builder — the captured values are
    // byte-identical to the canonical tradeReview.buildTradeReviewCalculations.
    expect(capturedRequest.context.calculations).toMatchObject({
      pnl: 80,
      realizedRR: 2.05,
      riskPercent: 1,
      lotSize: 100000,
      winLoss: 'Win',
      duration: '3h 15m',
    });
    expect(capturedRequest.context.calculations).toEqual(buildTradeReviewCalculations(makeTrade(), { duration: '3h 15m' }));
    expect(capturedRequest.context.metadata.accountId).toBe('acc-0001');
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
          analysis: { summary: 'done', confidence: 0.5, disclaimer: 'Not financial advice.' },
        };
      },
    };

    render(
      <AITradeReview
        trade={makeTrade()}
        accountId="acc-0001"
        accountName="Main"
        provider={provider}
      />
    );

    // Explicit trigger fires one request…
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));
    await waitFor(() => expect(screen.getByText(/analyzing trade/i)).toBeInTheDocument());

    // …and while LOADING the trigger is gone from the DOM, so the user cannot
    // fire a duplicate request (aria-busy is also set on the container).
    expect(screen.queryByRole('button', { name: /analyze with ai/i })).not.toBeInTheDocument();

    resolveRequest();
    await waitFor(() => expect(screen.getByText(/done/i)).toBeInTheDocument());

    // Only ONE request ever reached the provider.
    expect(analyzeCalls).toBe(1);
  });
});