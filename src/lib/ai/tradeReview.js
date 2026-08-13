// AI Trade Review — the first production-facing EdgeJournal AI feature.
//
// Built entirely on the Sprint 9.1 AI foundation:
//   - buildAITradeContext()  → account-isolated, READ-ONLY context
//   - createAIProvider()     → provider-agnostic, secret-safe analyze()
//   - AI_ERROR_CODES         → controlled application states
//
// This module owns:
//   - the AI Trade Review system instruction ("the prompt"), kept OUT of the
//     React component so future sprints can reuse or extend it
//   - the canonical-value pass-through map (existing recorded/engine fields,
//     nothing recomputed here)
//   - analyzeTradeReview() orchestration (context → provider → safe result)
//     which FUTURE features (weekly performance, mistake patterns, psychology,
//     askJournal) can either wrap with their own prompts or follow as a pattern
//
// Anything crossing this module is read-only. It never touches trades,
// balances, PnL, RR, risk, or stored journal data, and it never computes a
// canonical metric itself (they arrive pre-recorded / pre-computed).

import { buildAITradeContext } from './context';
import { createAIProvider } from './provider';
import { AI_ERROR_CODES } from './types';

export const AI_REQUEST_KIND_TRADE_REVIEW = 'tradeReview';
const TRADE_REVIEW_KIND = AI_REQUEST_KIND_TRADE_REVIEW;

// ---------------------------------------------------------------------------
// 1. SYSTEM INSTRUCTION ("the prompt") — kept separate from UI on purpose.
// ---------------------------------------------------------------------------
// These are the guard-rail instructions sent to the model alongside the
// context. The Safety Layer (src/lib/ai/safety.js) independently enforces the
// RESONSE shape on the way back out; these instruction win inside the model.
export const TRADE_REVIEW_INSTRUCTION = (
  'You are EdgeJournal AI, a trading journal analyst.\n' +
  'Your job is to analyze the user\'s recorded trade.\n\n' +
  'Use ONLY the supplied journal data.\n' +
  'Do not invent missing information.\n' +
  'Do not assume market conditions that were not supplied.\n' +
  'Do not claim causation from correlation.\n' +
  'Do not provide guaranteed outcomes.\n' +
  'Do not provide buy/sell signals.\n' +
  'Do not tell the user to enter, exit, long, or short a trade.\n' +
  'Do not provide financial guarantees.\n' +
  'Do not modify or reinterpret canonical calculations.\n' +
  'Treat PnL, RR, risk, lot size, result and duration as recorded authoritative values.\n' +
  'If a field is missing, explicitly say the information was not recorded.\n\n' +
  'Focus on: execution quality, risk discipline, setup adherence, mistakes, ' +
  'emotions, notes/review, strengths, improvement opportunities.\n\n' +
  'Use descriptive language. Distinguish recorded facts from observations ' +
  'and possible improvements, and avoid fake certainty.\n' +
  'Do not diagnose psychological or medical conditions.\n\n' +
  'REPLY ONLY with a JSON object using SOME or ALL of these keys:\n' +
  '  summary: string\n' +
  '  strengths: string[]\n' +
  '  observations: string[]\n' +
  '  weaknesses: string[]\n' +
  '  risks: string[]\n' +
  '  improvements: string[]\n' +
  '  confidence: number between 0 and 1 or null\n' +
  '  disclaimer: string\n'
);

// ---------------------------------------------------------------------------
// 2. Canonical pass-through. The AI layer never becomes the source of truth.
// ---------------------------------------------------------------------------
// Maps the EXISTING recorded / engine-produced trade values to the AI
// context's `calculations` section. Nothing is recomputed here: netPnl, RR,
// risk %, lot size, result and duration arrive pre-recorded by the app. The
// journal does not persist a balance-at-the-time-of-trade (the review panel
// reports PnL% as "Not recorded"), so those stay unset — never fabricated.
export function buildTradeReviewCalculations(trade, { duration } = {}) {
  if (!trade || typeof trade !== 'object') return {};
  const has = (v) => v !== undefined && v !== null && v !== '';

  const out = {};

  if (has(trade.netPnl)) out.pnl = Number(trade.netPnl);
  if (has(trade.rr)) out.realizedRR = Number(trade.rr);
  if (has(trade.riskPercent)) out.riskPercent = Number(trade.riskPercent);
  if (has(trade.positionSize)) out.lotSize = Number(trade.positionSize);
  else if (has(trade.contracts)) out.lotSize = Number(trade.contracts);
  if (has(trade.result)) out.winLoss = trade.result;
  if (has(duration)) out.duration = duration;

  return out;
}

// ---------------------------------------------------------------------------
// 3. Orchestration. One read-only pipeline future features can reuse.
// ---------------------------------------------------------------------------
// Analyze a single account-scoped trade.
//   { trade, accountId, accountName, calculations?, provider? }
//
// Returns a CONTROLLED result object (never throws for user-facing reasons):
//   { ok, status, message, analysis }
// where status is one of AI_ERROR_CODES / "ok" and analysis is the sanitized
// RESPONSE_CONTRACT object or null.
//
// `provider` is injectable for deterministic tests; default is
// createAIProvider() (disabled by default → AI_NOT_CONFIGURED, which is what
// production sees until a real provider is wired in).
export async function analyzeTradeReview({
  trade,
  accountId,
  accountName,
  calculations = {},
  provider,
} = {}) {
  // Merge server-record parameters; canonical recorded values win over any
  // display-only values the caller might pass, so AI can never reinterpret.
  const merged = buildTradeReviewCalculations(trade);
  const mergedCalculations = { ...calculations, ...merged };

  // buildAITradeContext() is the ONLY allowed context builder. It validates
  // the account scope and returns a deep-frozen context.
  let context;
  try {
    context = buildAITradeContext({
      trade,
      accountId,
      accountName,
      calculations: Object.keys(mergedCalculations).length ? mergedCalculations : undefined,
    });
  } catch (err) {
    return toReviewResult(err);
  }

  const activeProvider = provider || createAIProvider();
  const request = {
    kind: TRADE_REVIEW_KIND,
    systemInstruction: TRADE_REVIEW_INSTRUCTION,
    context,
  };

  try {
    const result = await activeProvider.analyze(request);
    return toReviewResult(result);
  } catch (err) {
    return toReviewResult(err);
  }
}

// ---------------------------------------------------------------------------
// 4. Controlled result shaping. Raw provider data never leaks to the UI.
// ---------------------------------------------------------------------------
export function toReviewResult(input) {
  // Already a provider-shaped result (the standard analyze() contract).
  if (input && typeof input === 'object' && typeof input.ok === 'boolean') {
    const ok = input.ok === true;
    return {
      ok,
      status: ok ? input.status || 'ok' : input.status || AI_ERROR_CODES.AI_PROVIDER_ERROR,
      message: ok ? '' : safeErrorMessage(input.status),
      analysis: ok && input.analysis ? input.analysis : null,
    };
  }

  // An AIError (or any thrown value) → normalized controlled error.
  const code = input?.code && AI_ERROR_CODES[input.code] ? input.code : AI_ERROR_CODES.AI_PROVIDER_ERROR;
  return {
    ok: false,
    status: code,
    message: safeErrorMessage(code),
    analysis: null,
  };
}

// Safe, human-readable, never leaks provider internals. The goal is a calm,
// actionable message — "your data was not changed" reassures the read-only
// promise every time an error path is surfaced.
export function safeErrorMessage(code) {
  switch (code) {
    case AI_ERROR_CODES.AI_NOT_CONFIGURED:
      return 'AI review is not configured yet. Your trade data was not changed.';
    case AI_ERROR_CODES.AI_RATE_LIMITED:
    case AI_ERROR_CODES.AI_TIMEOUT:
    case AI_ERROR_CODES.AI_UNAVAILABLE:
    case AI_ERROR_CODES.AI_PROVIDER_ERROR:
      return 'AI review is temporarily unavailable. Your trade data was not changed.';
    case AI_ERROR_CODES.AI_INVALID_RESPONSE:
      return 'AI review returned an unreadable response. Your trade data was not changed.';
    case AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR:
      return 'This trade was not available in the current account scope. Your trade data was not changed.';
    default:
      return 'AI review could not be completed. Your trade data was not changed.';
  }
}

// ---------------------------------------------------------------------------
// 6. Confidence label for display.
// ---------------------------------------------------------------------------
export function confidenceLabel(confidence) {
  if (confidence === null || confidence === undefined) return 'Unknown';
  const n = Number(confidence);
  if (!Number.isFinite(n)) return 'Unknown';
  if (n >= 0.66) return 'High';
  if (n >= 0.33) return 'Medium';
  return 'Low';
}

// convenience export: the kind constant used by the request
export { TRADE_REVIEW_KIND };