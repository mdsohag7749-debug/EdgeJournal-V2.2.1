// Server-side AI system instructions (Sprint 9.6).
//
// The full EdgeJournal system prompt is composed HERE, on the server, keyed by
// the validated request kind. The browser never sends a system prompt to the
// bridge and never sees this master instruction.
//
// The feature-specific guard rails ARE the existing Sprint 9.x instructions
// (single source of truth); the server prepends the Sprint 9.6 master
// instruction on top so every provider call carries the full contract.

import { TRADE_REVIEW_INSTRUCTION } from '../../src/lib/ai/tradeReview';
import { JOURNAL_INTELLIGENCE_INSTRUCTION } from '../../src/lib/ai/journalIntelligence';
import { COACHING_INSTRUCTION } from '../../src/lib/ai/coaching';
import { ASK_JOURNAL_INSTRUCTION } from '../../src/lib/ai/askJournal';

// The canonical EdgeJournal analytical-assistant instruction. Deliberately
// server-side ONLY — never exposed to the browser bundle.
export const AI_MASTER_SYSTEM_INSTRUCTION =
  'You are EdgeJournal\'s analytical trading journal assistant.\n\n' +
  'Analyze recorded journal data only.\n' +
  'Do not provide trading signals, predictions, guarantees, or direct execution instructions.\n' +
  'Do not fabricate missing information.\n' +
  'If the journal lacks enough information, explicitly say so.\n' +
  'Discuss patterns, process quality, risk behavior, execution discipline, mistakes, and areas for improvement.\n' +
  'Treat all calculations supplied by EdgeJournal as canonical.\n' +
  'Do not recompute or alter canonical metrics.\n' +
  'Never claim certainty about future market outcomes.';

const FEATURE_INSTRUCTIONS = {
  tradeReview: TRADE_REVIEW_INSTRUCTION,
  journalIntelligence: JOURNAL_INTELLIGENCE_INSTRUCTION,
  coaching: COACHING_INSTRUCTION,
  askJournal: ASK_JOURNAL_INSTRUCTION,
};

export function systemPromptFor(kind) {
  const feature = FEATURE_INSTRUCTIONS[kind];
  const master = AI_MASTER_SYSTEM_INSTRUCTION;
  return feature ? `${master}\n\n${feature}` : master;
}

// Frames the account-scoped journal context before it reaches any provider so
// the model always understands the numbers it is reading are canonical, already
// computed data — never something to recompute, alter, or second-guess. The
// raw context itself (and its canonical keys) is passed through unchanged.
export function frameContextForProvider(context) {
  const body = typeof context === 'string' ? context : JSON.stringify(context || {});
  const canonicalLine =
    'The JSON payload below contains canonical EdgeJournal metrics — recorded facts and ' +
    'already-computed calculations. Treat every value as authoritative; never recompute, ' +
    'reinterpret, or invent figures.';
  return `${canonicalLine}\n\n${body}`;
}