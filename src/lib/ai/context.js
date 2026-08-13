// AI Context Builder — a pure function that converts ONE already-scoped trade
// into the structured context future AI features analyze.
//
// Guarantees:
//   - READ-ONLY: the input trade is never mutated and the output is deep-
//     frozen, so nothing downstream can mutate journal data either.
//   - ACCOUNT-ISOLATED: an explicit account scope is validated against the
//     trade's owner; a mismatch throws AI_ACCOUNT_SCOPE_ERROR instead of
//     mixing accounts.
//   - NO FABRICATION: missing values stay null (or are omitted). Nothing is
//     invented — no setup, RR, outcome, psychology, reason, or market call.
//   - CANONICAL AUTHORITATIVE: the `calculations` section only ever carries
//     values that were passed in from the existing calculation engine. This
//     module never computes PnL, RR, risk, or lot size itself.

import { AIError } from './errors';
import { AI_ERROR_CODES } from './types';
import { freezeDeep } from './safety';

// From `fromTradeRow` (src/lib/tradesApi.js) app-shape → AI key. Only what is
// necessary for analysis; no userId, screenshot, createdAt, tags, offline
// markers, etc. are allowed across the border.
const RECORDED_FIELDS = {
  id: 'id',
  pair: 'instrument',
  date: 'date',
  session: 'session',
  direction: 'direction',
  timeframe: 'timeframe',
  setup: 'model',
  entry: 'entryPrice',
  stopLoss: 'stopLoss',
  takeProfit: 'takeProfit',
  exit: 'exitPrice',
  result: 'result',
  rr: 'rr',
  mistakes: 'mistakes',
  emotion: 'emotion',
  psychology: 'psychology',
  notes: 'notes',
  lessonsLearned: 'lessonsLearned',
  review: 'review',
  tradeGrade: 'tradeGrade',
  rating: 'rating',
};

// The only metrics the AI may interpret. Each key arrives pre-computed by the
// app's canonical calculation engine; absent inputs stay absent — the AI layer
// is never the source of truth for these.
const CALCULATION_FIELDS = [
  'pnl',
  'pnlPercent',
  'riskDollar',
  'riskPercent',
  'lotSize',
  'winLoss',
  'duration',
  'plannedRR',
  'realizedRR',
  'potentialProfit',
];

function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

// Coerces a recorded value to AI-safe form: blank → null; empty containers →
// null; containers cloned (so freezing the context can never freeze the live
// trade record); primitives pass through untouched.
function recordValue(value) {
  if (isBlank(value)) return null;
  if (Array.isArray(value)) return value.length === 0 ? null : [...value];
  if (typeof value === 'object') return Object.keys(value).length === 0 ? null : { ...value };
  return value;
}

// Defensive scope check: the requested (selected) account must match the
// trade's owner.
function assertAccountScope(trade, accountId) {
  const tradeAccountId = typeof trade?.accountId === 'string' && trade.accountId !== '' ? trade.accountId : null;
  if (accountId && tradeAccountId && accountId !== tradeAccountId) {
    throw new AIError(
      AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
      'Account border crossed: a trade outside the requested account reached the AI context builder.',
      { detail: `expected=${accountId}, trade=${tradeAccountId}` }
    );
  }
}

// Validates/rejects a trade that does not belong to the requested account.
// Exported so future features can pre-flight account-scoped batches.
export function assertAccountScoped(trade, accountId) {
  assertAccountScope(trade, accountId);
}

export function buildAITradeContext({ trade, accountId, accountName, calculations } = {}) {
  if (!trade || typeof trade !== 'object' || Array.isArray(trade)) {
    throw new AIError(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, 'A single trade object is required to build an AI context.');
  }

  assertAccountScope(trade, accountId);

  const scopedAccountId = typeof trade.accountId === 'string' && trade.accountId !== '' ? trade.accountId : null;

  const tradeContext = {};
  for (const [outKey, inKey] of Object.entries(RECORDED_FIELDS)) {
    tradeContext[outKey] = recordValue(trade[inKey]);
  }

  const calculationsContext = {};
  if (calculations && typeof calculations === 'object' && !Array.isArray(calculations)) {
    for (const key of CALCULATION_FIELDS) {
      const value = calculations[key];
      if (!isBlank(value)) calculationsContext[key] = recordValue(value);
    }
  }

  const metadata = {
    accountId: accountId || scopedAccountId || null,
    accountName: accountName === undefined || accountName === null ? null : accountName,
  };

  return freezeDeep({ trade: tradeContext, calculations: calculationsContext, metadata });
}