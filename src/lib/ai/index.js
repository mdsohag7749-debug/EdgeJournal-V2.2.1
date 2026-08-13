// EdgeJournal AI foundation — public surface area for the AI domain module.
//
// This barrel is the ONLY thing future Sprint 9 features should import. It
// re-exports the context builder, provider abstraction, controlled errors,
// response contract, and safety utilities without exposing any internals.
//
// Default state is DISABLED (AI_ENABLED=false) — everything here fails closed
// and gracefully until a later sprint wires a server-side provider in.

// Context builder — pure, account-isolated, READ-ONLY structure for analysis.
export { buildAITradeContext, assertAccountScoped } from './context';

// Provider abstraction — swap-in adapters; browser sees no secrets.
export { createAIProvider, registerAIAdapter, resolveAIConfig, AI_DEFAULT_CONFIG } from './provider';

// Controlled error model — normalized AIError codes, never raw provider data.
export {
  AIError,
  isAIError,
  aiError,
  toSafeAIError,
  toSafeAIResult,
  aiAccountScopeError,
  aiNotConfiguredError,
} from './errors';

// Domain vocabulary — codes, plans, response contract, disclaimer.
export { RESPONSE_CONTRACT, AI_DISCLAIMER, AI_ERROR_CODES, AI_PLANS } from './types';

// Safety layer — response sanitization + validation, deep-freeze helpers.
export {
  AI_SAFETY_RULES,
  sanitizeResponse as sanitizeAIResponse,
  validateResponseContract,
  assertResponseContract,
  freezeDeep,
  isDeepFrozen,
} from './safety';

// AI Trade Review — production feature orchestration (prompt kept separate).
export {
  analyzeTradeReview,
  buildTradeReviewCalculations,
  toReviewResult,
  safeErrorMessage,
  confidenceLabel,
  TRADE_REVIEW_INSTRUCTION,
  AI_REQUEST_KIND_TRADE_REVIEW,
} from './tradeReview';

// AI Journal Intelligence — Sprint 9.3 journal-level analytical intelligence.
// Read-only, account-isolated, built entirely on the canonical Sprint 8
// analytics engines. Exposes the analyzers the Analytics page wires to its
// explicit "Analyze Journal" action.
export {
  AI_REQUEST_KIND_JOURNAL_INTELLIGENCE,
  AI_NOT_ENOUGH_DATA,
  DATA_COVERAGE,
  DATA_LIMITED_MAX,
  DATA_EARLY_MAX,
  DATA_NORMAL_MIN,
  AI_JOURNAL_MAX_RECENT_TRADES,
  JOURNAL_FORBIDDEN_FIELDS,
  JOURNAL_RESPONSE_KEYS,
  JOURNAL_RESPONSE_LIST_KEYS,
  JOURNAL_INSIGHT_SCHEMA,
  JOURNAL_INTELLIGENCE_INSTRUCTION,
  classifyDataCoverage,
  dataCoverageLabel,
  buildJournalDataQuality,
  scopeLabel,
  analyzedScopeLabel,
  applyJournalScope,
  createScopeFingerprint,
  assertJournalAccountScope,
  buildAIJournalContext,
  sanitizeJournalResponse,
  validateJournalResponse,
  assertJournalResponse,
  analyzeJournalIntelligence,
  toJournalResult,
  safeJournalErrorMessage,
} from './journalIntelligence';

// AI Coaching & Action Plan — Sprint 9.4 process coaching.
// Read-only, account-isolated, horizon-scoped (Daily/Weekly/Monthly). Consumes
// the same Sprint 8 canonical engines as Sprint 9.3; the selected horizon drives
// a deterministic current-vs-previous window pair passed to the model.
export {
  AI_REQUEST_KIND_COACHING,
  COACHING_HORIZONS,
  COACHING_DEFAULT_HORIZON,
  coachingHorizonLabel,
  COACHING_RESPONSE_KEYS,
  COACHING_LIST_KEYS,
  COACHING_FOCUS_SCHEMA,
  COACHING_PATTERN_SCHEMA,
  COACHING_COMPARISON_SCHEMA,
  COACHING_ACTION_SCHEMA,
  COACHING_PRIORITIES,
  COACHING_DIRECTIONS,
  COACHING_TIMEFRAMES,
  COACHING_SOURCES,
  COACHING_FORBIDDEN_FIELDS,
  COACHING_INSTRUCTION,
  buildCoachingPeriods,
  scopeCoachingTrades,
  buildAICoachingContext,
  sanitizeCoachingResponse,
  validateCoachingResponse,
  assertCoachingResponseContract,
  generateAICoaching,
  toCoachingResult,
  safeCoachingErrorMessage,
} from './coaching';

// AI Ask Journal — Sprint 9.5 analytical journal assistant.
// The user asks a natural-language question about THEIR OWN journal data; the
// answer is grounded only in the explicitly scoped, account-isolated, canonical
// journal context supplied to it. Read-only, explicit-trigger only, and never
// a signal generator / market predictor / trade executor.
export {
  AI_REQUEST_KIND_ASK_JOURNAL,
  AI_INVALID_QUESTION,
  AI_LIMITED_DATA,
  AI_EARLY_PATTERN,
  AI_NORMAL_ANALYSIS,
  ASK_JOURNAL_DATA_STATES,
  ASK_JOURNAL_QUESTION_MAX_LENGTH,
  ASK_JOURNAL_RESPONSE_KEYS,
  ASK_JOURNAL_LIST_KEYS,
  ASK_JOURNAL_FORBIDDEN_FIELDS,
  ASK_JOURNAL_DIRECTIVE_PATTERN,
  ASK_QUESTION_INJECTION_PATTERN,
  ASK_JOURNAL_INSTRUCTION,
  normalizeAskJournalQuestion,
  validateAskJournalQuestion,
  classifyAskJournalState,
  askJournalStateLabel,
  buildAIAskJournalContext,
  sanitizeAskJournalResponse,
  validateAskJournalResponse,
  assertAskJournalResponse,
  generateAIJournalAnswer,
  toAskJournalResult,
  safeAskJournalErrorMessage,
  // Shared canonical scope/filter/coverage helpers re-exported for Ask Journal
  // consumers so they keep a single source of truth with Sprint 9.3/9.4.
  applyJournalScope,
  createScopeFingerprint,
  assertJournalAccountScope,
  scopeLabel,
  analyzedScopeLabel,
  dataCoverageLabel,
  buildJournalDataQuality,
  AI_NOT_ENOUGH_DATA,
  DATA_COVERAGE,
} from './askJournal';