// AI Ask Journal — Sprint 9.5 production feature.
//
// An ANALYTICAL JOURNAL ASSISTANT: the user asks a natural-language question
// about THEIR OWN journal data, answerable ONLY from the explicitly scoped
// journal data supplied to it. It is not a signal generator, a market
// predictor, a financial advisor, an autonomous agent, a trade executor, or a
// replacement for the calculation engine.
//
// Built ENTIRELY on the Sprint 9.1 AI foundation, exactly like Sprint 9.3 and
// 9.4. It consumes the SAME canonical Sprint 8 engine outputs the verified
// widgets already produce:
//   - computeAnalytics()          → summary + pair/session/strategy metrics
//   - computeSetupPerformance()   → per-setup recorded performance
//   - computePairSessionHeatmap() → pair/session recorded performance
//   - computeMistakePattern()     → recurrent recorded mistakes
//   - computeDisciplineScore20()  → Discipline Score 2.0 (never re-calculated)
//   - computeRiskAnalytics()      → risk / drawdown metrics
//   - computeEmotionAnalytics()   → recorded emotion distribution
//   - computePatternDetection()   → observed behavior patterns
//   - buildJournalDataQuality()   → canonical coverage guardrails
//
// Transfer guarantees enforced here (mirroring the rest of the AI module):
//   - ACCOUNT ISOLATION (NON-NEGOTIABLE): the asked context only ever contains
//     trades belonging to the explicitly requested account. Mixed / cross-
//     account sets throw AI_ACCOUNT_SCOPE_ERROR; the feature never analyzes or
//     sends "all accounts" data.
//   - READ-ONLY: nothing here writes trades, balances, PnL, RR, risk, filters,
//     plans, reflections, or goals.
//   - CANONICAL AUTHORITATIVE: every number arrives pre-computed from the
//     verified engines. Missing values stay missing; statistics are never
//     fabricated.
//   - EXPLICIT TRIGGER ONLY: generateAIJournalAnswer() only runs when called —
//     never on render, login, typing, or filter change.
//   - QUESTION SAFETY: the user question is untrusted input. It is normalized
//     and validated; prompt-injection / directive / cross-account / guarantee
//     language is rejected (AI_INVALID_QUESTION) before any provider contact.
//   - DATA GROUNDING: the model is instructed to distinguish FACT (directly
//     supported), OBSERVATION (enough journal evidence) and LIMITATION
//     (insufficient data), and to never fabricate trades, dates, sessions,
//     pairs, setups, percentages, PnL, RR, streaks, or psychological states.
//   - SMALL DATA GUARDRAILS: 0 in-scope trades → AI_NOT_ENOUGH_DATA (no
//     provider call). 1–4 / 5–9 / 10+ reuse Sprint 9.3's canonical coverage
//     classification (classifyAskJournalState) and are surfaced verbatim.
//   - RESPONSE CONTRACT: only analytical fields (answer, summary, observations,
//     supportingEvidence, strengths, weaknesses, risks, improvements,
//     confidence, disclaimer). No buy/sell/signal/entry/guarantee shape, and
//     directive/guarantee language is rejected at the module boundary.
//
// The React UI lives in src/components/ai/AIAskJournal.jsx; this module owns
// orchestration, prompt design and the Ask Journal response contract.

import { AIError } from './errors.js';
import { AI_ERROR_CODES, AI_DISCLAIMER } from './types.js';
import { createAIProvider } from './provider.js';
import { freezeDeep, AI_DIRECTIVE_PATTERN, rejectDirectiveText as rejectDirectiveLanguage } from './safety.js';
import {
  AI_NOT_ENOUGH_DATA,
  applyJournalScope,
  analyzedScopeLabel,
  createScopeFingerprint,
  scopeLabel,
} from './journalIntelligence.js';
import {
  AI_JOURNAL_MAX_RECENT_TRADES,
  assertJournalAccountScope,
  buildJournalDataQuality,
  buildCanonicalJournalContext,
  classifyDataCoverage,
  classifyJournalQuestionIntent,
  collectRecentTrades,
  DATA_COVERAGE,
  dataCoverageLabel,
  pickAnalytics,
  pickDisciplineScore,
  pickEmotion,
  pickHeatmap,
  pickMistake,
  pickPatterns,
  pickRisk,
  pickSetupPerformance,
  pickSummary,
} from './canonicalContext.js';
import { computeAnalytics } from '../analytics.js';
import { computeSetupPerformance } from '../setupPerformance.js';
import { computePairSessionHeatmap, sessionKey } from '../heatmap.js';
import { computeMistakePattern } from '../mistakePattern.js';
import { computeDisciplineScore20 } from '../disciplineScore.js';
import { computeRiskAnalytics } from '../riskAnalytics.js';
import { computeEmotionAnalytics } from '../emotionAnalytics.js';
import { computePatternDetection } from '../patternDetection.js';

export const AI_REQUEST_KIND_ASK_JOURNAL = 'askJournal';
const ASK_JOURNAL_KIND = AI_REQUEST_KIND_ASK_JOURNAL;

// Controlled question state: the user asked something the journal assistant
// cannot answer (empty, directive / injection / cross-account / guarantee
// language). Kept as a local constant (like Sprint 9.3's AI_NOT_ENOUGH_DATA)
// and handled through the same controlled-result shaping.
export const AI_INVALID_QUESTION = 'AI_INVALID_QUESTION';

// Deterministic Ask Journal data states (aliases of the canonical coverage
// classification, so the FEATURE-level vocabulary matches the sprint spec).
export const AI_LIMITED_DATA = 'AI_LIMITED_DATA';
export const AI_EARLY_PATTERN = 'AI_EARLY_PATTERN';
export const AI_NORMAL_ANALYSIS = 'AI_NORMAL_ANALYSIS';

export const ASK_JOURNAL_DATA_STATES = {
  [AI_NOT_ENOUGH_DATA]: AI_NOT_ENOUGH_DATA,
  [AI_LIMITED_DATA]: AI_LIMITED_DATA,
  [AI_EARLY_PATTERN]: AI_EARLY_PATTERN,
  [AI_NORMAL_ANALYSIS]: AI_NORMAL_ANALYSIS,
};

export const ASK_JOURNAL_QUESTION_MAX_LENGTH = 400;

// The Ask Journal response contract — the complete allow-list. Analytical
// journal information ONLY. Nothing here can carry a signal, an entry trigger,
// a broker action or a guarantee.
export const ASK_JOURNAL_RESPONSE_KEYS = [
  'answer',
  'summary',
  'observations',
  'supportingEvidence',
  'strengths',
  'weaknesses',
  'risks',
  'improvements',
  'confidence',
  'disclaimer',
];

export const ASK_JOURNAL_LIST_KEYS = [
  'observations',
  'supportingEvidence',
  'strengths',
  'weaknesses',
  'risks',
  'improvements',
];

// Structural fields that MUST NEVER appear in an Ask Journal response. The
// allow-list sanitizer drops them; directive language in the text is rejected
// by a content scan before a response can reach the UI.
export const ASK_JOURNAL_FORBIDDEN_FIELDS = [
  'buy',
  'sell',
  'signal',
  'tradeSignal',
  'entry',
  'entrySignal',
  'exitSignal',
  'recommendedEntry',
  'recommendedExit',
  'guaranteedProfit',
  'profitGuarantee',
  'guaranteedReturns',
  'guaranteedOutcome',
  'prediction',
  'marketPrediction',
  'pricePrediction',
  'futurePrice',
  'tradeExecution',
  'executeTrade',
  'automatedTrade',
  'brokerAction',
  'financialGuarantee',
  'lotRecommendation',
  'riskIncrease',
  'riskDecrease',
];

// Shared directive / guarantee vocabulary (see safety.js). Exported here so the
// public API surface keeps its existing name; the value is the product-wide
// strict union reused by every feature.
export const ASK_JOURNAL_DIRECTIVE_PATTERN = AI_DIRECTIVE_PATTERN;

// Prompt-injection / directive language in the USER QUESTION. The question is
// untrusted input: anything that tries to break the system boundary, access
// another account, execute trades or demand guaranteed outcomes is rejected
// before it can reach the provider.
export const ASK_QUESTION_INJECTION_PATTERN =
  /\b(?:ignore (all |any )?(previous|prior|earlier|above)? ?(instructions|prompts?|commands|rules|context)|ignore everything (above|before)|disregard (your|all|the) (instructions|prompts?|rules|context)|forget your (instructions|rules|restrictions|prompts?|guidelines|boundaries)|you are now|act as|pretend (to be|you are)|new system prompt|reveal (your|the) (system prompt|hidden instructions|internal instructions|prompt(s|ing)?|instructions|rules|guidelines)|show (me|us) your (system prompt|hidden instructions|internal instructions|instructions|prompts|rules|guidelines)|print your (system prompt|hidden instructions|instructions|prompts)|what are your (instructions|rules|prompts)|expose (your|the) ((api.? ?)?(key|secret|token|password|credentials|api.?key))|show (me|us) (your|the) (password|((api.? ?)?(key|secret|token|credentials)))|give (me|us) (your|the) ((api.? ?)?(key|secret|token|password|credentials))|(read|leak) (your|the) ((api.? ?)?(key|secret|token|password)) (from|in) (env|environment|config)|bypass (your |the )?(rules|restrictions|safety|guardrails|filters|controls)|jailbreak|override (your|the) (rules|instructions|restrictions|safety)|switch to (another|the other|a different|account b|accounts? two) account|access ((another|the other|their|a different|any|all) (account|user|trades?|data|journal)|account b|accounts?|other accounts?)|access (that|the other) account|another (user|account)(['\u2019]|i)?s (trades|data|journal|account)|other (account|user)(['\u2019]|i)?s? (trades|data|journal)|place (a|an|my) (buy|sell|trade|order)|execute (a|an|my) (buy|sell|trade|order)|trade (for me|my money|my account)|guarantee ((me |my )?a? ?(profit|return|outcome|win)|(profit|return|outcome|win) !?guaranteed?)|predict (tomorrow|next (week|month|session|trade))|what will (the )?(market|price|pair|btc|forex) ?do (next|tomorrow)|will my (next )?trade (win|profit))\b/i;

// System instruction sent to the model alongside the Ask Journal context. Kept
// OUT of the React component on purpose; future features reuse or extend it.
export const ASK_JOURNAL_INSTRUCTION = (
  'You are EdgeJournal AI, an analytical journal assistant.\n' +
  'Answer the user\'s question about THEIR OWN recorded trading journal using only the supplied scope.\n\n' +
  'GROUNDING RULES:\n' +
  '- FACT: only state what is directly supported by the supplied journal data.\n' +
  '- OBSERVATION: only describe a pattern when enough journal evidence supports it.\n' +
  '- LIMITATION: when the data is insufficient to establish a reliable pattern, explicitly say the data is insufficient.\n\n' +
  'NEVER fabricate trades, dates, sessions, pairs, setups, percentages, PnL, RR, win/loss, streaks, or psychological states.\n' +
  'NEVER invent missing values — use the numbers exactly as supplied.\n' +
  'NEVER recompute or reinterpret canonical metrics.\n' +
  'NEVER make causal claims from observational journal data.\n\n' +
  'SAMPLE-SIZE CAUTION:\n' +
  '- 1-4 trades: limited data, conclusions carry very low confidence.\n' +
  '- 5-9 trades: early pattern only, not a proven edge.\n' +
  '- 10+ trades: analysis can describe the pattern conservatively.\n' +
  'A pattern from 2 trades is never a proven strategy edge.\n\n' +
  'DO NOT provide buy/sell signals.\n' +
  'DO NOT recommend entering, exiting, going long or short.\n' +
  'DO NOT predict future prices, profits, or market direction.\n' +
  'DO NOT guarantee any outcome.\n' +
  'DO NOT recommend increasing or decreasing financial risk.\n' +
  'DO NOT suggest trades or provide broker actions.\n' +
  'Your purpose is to help the user understand their recorded behavior and journal patterns — not to make trading decisions.\n\n' +
  'Answer the user\'s actual question first, then support it with evidence.\n\n' +
  'REPLY ONLY with a JSON object using SOME or ALL of these keys:\n' +
  '  answer: string (the direct answer to the question)\n' +
  '  summary: string\n' +
  '  observations: string[] (patterns with enough evidence, or state data is limited)\n' +
  '  supportingEvidence: string[] (evidence tied to the answer)\n' +
  '  strengths: string[]\n' +
  '  weaknesses: string[]\n' +
  '  risks: string[]\n' +
  '  improvements: string[]\n' +
  '  confidence: number between 0 and 1 or null\n' +
  '  disclaimer: string\n'
);

// ---------------------------------------------------------------------------
// Question safety — untrusted input handling.
// ---------------------------------------------------------------------------

export function normalizeAskJournalQuestion(question) {
  if (typeof question !== 'string') return '';
  return question.replace(/\s+/g, ' ').trim().slice(0, ASK_JOURNAL_QUESTION_MAX_LENGTH);
}

// Validates a normalized question. Returns { ok: true, question } or
// { ok: false, code: AI_INVALID_QUESTION, reason }. Empty, over-long, and
// injection/directive questions are rejected before any provider contact.
export function validateAskJournalQuestion(question) {
  const q = normalizeAskJournalQuestion(question);
  if (!q) return { ok: false, code: AI_INVALID_QUESTION, reason: 'empty', question: q };
  if (ASK_QUESTION_INJECTION_PATTERN.test(q)) {
    return { ok: false, code: AI_INVALID_QUESTION, reason: 'directive', question: q };
  }
  return { ok: true, question: q };
}

// ---------------------------------------------------------------------------
// Deterministic data-state classification (mirrors Sprint 9.3 coverage).
// ---------------------------------------------------------------------------
export function classifyAskJournalState(tradeCount) {
  const coverage = classifyDataCoverage(tradeCount);
  switch (coverage) {
    case DATA_COVERAGE.NOT_ENOUGH_DATA:
      return AI_NOT_ENOUGH_DATA;
    case DATA_COVERAGE.LIMITED_DATA:
      return AI_LIMITED_DATA;
    case DATA_COVERAGE.EARLY_PATTERN:
      return AI_EARLY_PATTERN;
    default:
      return AI_NORMAL_ANALYSIS;
  }
}

export function askJournalStateLabel(state) {
  switch (state) {
    case AI_NOT_ENOUGH_DATA:
      return dataCoverageLabel(DATA_COVERAGE.NOT_ENOUGH_DATA);
    case AI_LIMITED_DATA:
      return dataCoverageLabel(DATA_COVERAGE.LIMITED_DATA);
    case AI_EARLY_PATTERN:
      return dataCoverageLabel(DATA_COVERAGE.EARLY_PATTERN);
    case AI_NORMAL_ANALYSIS:
    case DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS:
      return dataCoverageLabel(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
    default:
      return 'No data';
  }
}

export { AI_NOT_ENOUGH_DATA, scopeLabel, analyzedScopeLabel, applyJournalScope, createScopeFingerprint } from './journalIntelligence.js';
export { DATA_COVERAGE, dataCoverageLabel, assertJournalAccountScope, buildJournalDataQuality } from './canonicalContext.js';

// ---------------------------------------------------------------------------
// Ask Journal context builder — pure, deterministic, deeply frozen.
// All numbers arrive pre-computed from the canonical engines; the canonical
// blocks and projections live in canonicalContext.js (single source of truth).
// The deterministic intelligence blocks (performance / riskBlock / completeness)
// are included ONLY for measurable-performance questions; purely qualitative
// questions avoid that unnecessary context (audit P1, goal 3).
// ---------------------------------------------------------------------------
export function buildAIAskJournalContext({
  question = '',
  trades = [],
  accountId,
  accountName,
  analytics,
  setupPerformance,
  heatmap,
  mistakeIntelligence,
  disciplineScore,
  risk,
  emotion,
  patterns,
  scope = {},
  dataQuality,
} = {}) {
  if (!Array.isArray(trades)) {
    throw new AIError(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, 'A trades array is required to build an Ask Journal context.');
  }
  assertJournalAccountScope(trades, accountId);

  const normalized = normalizeAskJournalQuestion(question);
  const dq = dataQuality || buildJournalDataQuality(trades.length);
  const measurable = classifyJournalQuestionIntent(normalized) === 'performance';

  const account = {
    id: accountId || null,
    name: accountName === null || accountName === undefined ? null : accountName,
  };
  const scoped = {
    label: scopeLabel(scope),
    period: scope.period || 'all',
    pair: scope.pair || 'All',
    session: scope.session || 'All',
    setup: scope.setup || 'All',
    dateFrom: scope.dateFrom || null,
    dateTo: scope.dateTo || null,
  };

  let body;
  if (measurable) {
    body = buildCanonicalJournalContext({
      trades,
      accountId,
      analytics,
      setupPerformance,
      heatmap,
      mistakeIntelligence,
      disciplineScore,
      risk,
      emotion,
      patterns,
      dataQuality: dq,
    });
  } else {
    body = {
      dataQuality: dq,
      summary: pickSummary(analytics),
      analytics: pickAnalytics(analytics),
      setupPerformance: pickSetupPerformance(setupPerformance),
      heatmap: pickHeatmap(heatmap),
      mistakeIntelligence: pickMistake(mistakeIntelligence),
      disciplineScore: pickDisciplineScore(disciplineScore),
      risk: pickRisk(risk),
      emotion: pickEmotion(emotion),
      patterns: pickPatterns(patterns),
      recentTrades: collectRecentTrades(trades, AI_JOURNAL_MAX_RECENT_TRADES),
    };
  }

  const context = {
    mode: 'askJournal',
    question: normalized,
    account,
    scope: scoped,
    ...body,
  };

  return freezeDeep(context);
}

// ---------------------------------------------------------------------------
// Response sanitization (Ask Journal contract) + forbidden-field enforcement.
// ---------------------------------------------------------------------------
export function sanitizeAskJournalResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a non-object Ask Journal response.');
  }

  const source = raw;
  const out = {
    answer: toStr(source.answer),
    summary: toStr(source.summary),
    observations: toTextList(source.observations, 8),
    supportingEvidence: toTextList(source.supportingEvidence, 8),
    strengths: toTextList(source.strengths, 5),
    weaknesses: toTextList(source.weaknesses, 5),
    risks: toTextList(source.risks, 5),
    improvements: toTextList(source.improvements, 6),
    confidence: toConfidence(source.confidence),
    disclaimer: typeof source.disclaimer === 'string' && source.disclaimer.trim() ? source.disclaimer.trim() : AI_DISCLAIMER,
  };

  rejectDirectiveText(out);

  return freezeDeep(out);
}

function toStr(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function toTextList(value, cap = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, cap);
}

function toConfidence(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function rejectDirectiveText(out) {
  const text = [
    out.answer,
    out.summary,
    ...out.observations,
    ...out.supportingEvidence,
    ...out.strengths,
    ...out.weaknesses,
    ...out.risks,
    ...out.improvements,
  ]
    .filter(Boolean)
    .join(' \n ');

  rejectDirectiveLanguage(text);
}

// Structural validation of an already-sanitized Ask Journal response.
export function validateAskJournalResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { ok: false, errors: ['Ask Journal AI response must be a single object.'], response: null };
  }
  const target = response;
  const errors = [];
  ['answer', 'summary'].forEach((k) => {
    if (typeof target[k] !== 'string') errors.push(`${k} must be a string`);
  });
  ASK_JOURNAL_LIST_KEYS.forEach((k) => {
    if (target[k] !== undefined && !Array.isArray(target[k])) errors.push(`${k} must be an array`);
  });
  if (target.confidence !== undefined && target.confidence !== null && (typeof target.confidence !== 'number' || target.confidence < 0 || target.confidence > 1)) {
    errors.push('confidence must be a number between 0 and 1, or null');
  }
  if (target.disclaimer !== undefined && typeof target.disclaimer !== 'string') errors.push('disclaimer must be a string');
  return { ok: errors.length === 0, errors, response: target };
}

export function assertAskJournalResponse(response) {
  const check = validateAskJournalResponse(response);
  if (!check.ok) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned an Ask Journal response outside the allowed contract.');
  }
  return check.response;
}

// ---------------------------------------------------------------------------
// Orchestration — one read-only flow the UI wires to its Analyze button.
// ---------------------------------------------------------------------------
export async function generateAIJournalAnswer({
  question,
  trades,
  accountId,
  accountName,
  period = 'all',
  pair = 'All',
  session = 'All',
  setup = 'All',
  dateFrom,
  dateTo,
  provider,
  system = {},
} = {}) {
  // Account isolation is non-negotiable. A concrete account must be selected —
  // Ask Journal never analyzes mixed-account data and never sends all-account
  // history to the provider.
  if (typeof accountId !== 'string' || accountId === '') {
    return {
      ok: false,
      status: AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
      message: safeAskJournalErrorMessage(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR),
      analysis: null,
    };
  }

  // Question safety: normalize + validate BEFORE any provider contact.
  const questionCheck = validateAskJournalQuestion(question);
  if (!questionCheck.ok) {
    return {
      ok: false,
      status: AI_INVALID_QUESTION,
      message: safeAskJournalErrorMessage(AI_INVALID_QUESTION),
      analysis: null,
    };
  }

  const scope = { period, pair, session, setup, dateFrom, dateTo };
  const focused = applyJournalScope(trades, scope);
  const dataQuality = buildJournalDataQuality(focused.length);

  // Small-sample gate before any provider contact.
  if (focused.length === 0) {
    return {
      ok: false,
      status: AI_NOT_ENOUGH_DATA,
      message: safeAskJournalErrorMessage(AI_NOT_ENOUGH_DATA),
      analysis: null,
    };
  }

  // Canonical analytics — reuse the verified engines only. No formula is
  // recomputed by the AI layer.
  let context;
  try {
    assertJournalAccountScope(focused, accountId);
    const analytics = computeAnalytics(focused);
    const setupPerformance = computeSetupPerformance(focused, {});
    const heatmap = computePairSessionHeatmap(focused, {});
    const mistakeAnalysis = computeMistakePattern(focused, {});
    const disciplineScore = computeDisciplineScore20(focused, {
      models: system.models || [],
      riskCriteria: system.riskCriteria || [],
      checklistCriteria: system.checklistCriteria || [],
      reflections: system.reflections || [],
    });
    const risk = computeRiskAnalytics(focused);
    const emotion = computeEmotionAnalytics(focused);
    const patterns = computePatternDetection(focused, 'all');

    context = buildAIAskJournalContext({
      question: questionCheck.question,
      trades: focused,
      accountId,
      accountName,
      analytics,
      setupPerformance,
      heatmap,
      mistakeIntelligence: mistakeAnalysis,
      disciplineScore,
      risk,
      emotion,
      patterns,
      scope,
      dataQuality,
    });
  } catch (err) {
    return toAskJournalResult(err, { dataQuality });
  }

  const activeProvider = provider || createAIProvider();
  const request = {
    kind: ASK_JOURNAL_KIND,
    systemInstruction: ASK_JOURNAL_INSTRUCTION,
    context,
    sanitize: sanitizeAskJournalResponse,
  };

  try {
    const result = await activeProvider.analyze(request);
    return toAskJournalResult(result, { dataQuality });
  } catch (err) {
    return toAskJournalResult(err, { dataQuality });
  }
}

// ---------------------------------------------------------------------------
// Controlled result shaping — raw provider data never leaks to the UI.
// ---------------------------------------------------------------------------
export function toAskJournalResult(input, canonical = {}) {
  if (input && typeof input === 'object' && typeof input.ok === 'boolean') {
    if (input.ok && input.analysis) {
      // Defensive second gate: whatever a provider handed back must conform to
      // the Ask Journal contract before it is displayed.
      try {
        assertAskJournalResponse(input.analysis);
      } catch {
        return {
          ok: false,
          status: AI_ERROR_CODES.AI_INVALID_RESPONSE,
          message: safeAskJournalErrorMessage(AI_ERROR_CODES.AI_INVALID_RESPONSE),
          analysis: null,
        };
      }
      return {
        ok: true,
        status: input.status || 'ok',
        message: '',
        analysis: mergeCanonicalDataQuality(input.analysis, canonical),
      };
    }
    if (input.ok) {
      return {
        ok: false,
        status: AI_ERROR_CODES.AI_INVALID_RESPONSE,
        message: safeAskJournalErrorMessage(AI_ERROR_CODES.AI_INVALID_RESPONSE),
        analysis: null,
      };
    }
    const code = input.status || AI_ERROR_CODES.AI_PROVIDER_ERROR;
    return {
      ok: false,
      status: code,
      message: safeAskJournalErrorMessage(code),
      analysis: null,
    };
  }

  const code =
    input?.code && (AI_ERROR_CODES[input.code] || input.code === AI_NOT_ENOUGH_DATA || input.code === AI_INVALID_QUESTION)
      ? input.code
      : AI_ERROR_CODES.AI_PROVIDER_ERROR;
  return {
    ok: false,
    status: code,
    message: safeAskJournalErrorMessage(code),
    analysis: null,
  };
}

// Data quality is a fact from the canonical scope — never let the model present
// its own trade count / coverage.
function mergeCanonicalDataQuality(analysis, canonical) {
  const dq = canonical && canonical.dataQuality;
  if (!dq) return analysis;
  return { ...analysis, dataQuality: { ...dq } };
}

// Safe, human-readable Ask Journal messages — never provider internals.
export function safeAskJournalErrorMessage(code) {
  switch (code) {
    case AI_NOT_ENOUGH_DATA:
      return 'Your journal does not contain enough data in this scope for a reliable conclusion. Log more trades or widen the filters, then ask again.';
    case AI_INVALID_QUESTION:
      return 'I can only answer questions about your recorded journal data. Please rephrase your question so it stays within your journal scope.';
    case AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR:
      return 'Ask Journal is only available after selecting a single account. Your journal data was not changed.';
    case AI_ERROR_CODES.AI_NOT_CONFIGURED:
      return 'EdgeJournal AI is not configured yet. No journal data was sent to any provider.';
    case AI_ERROR_CODES.AI_RATE_LIMITED:
    case AI_ERROR_CODES.AI_TIMEOUT:
    case AI_ERROR_CODES.AI_UNAVAILABLE:
    case AI_ERROR_CODES.AI_PROVIDER_ERROR:
      return 'The journal assistant is temporarily unavailable. Please try again later. Your journal data was not changed.';
    case AI_ERROR_CODES.AI_INVALID_RESPONSE:
      return 'The journal assistant returned an unreadable response. Your journal data was not changed.';
    default:
      return 'The journal assistant could not complete the analysis. Your journal data was not changed.';
  }
}

// Convenience export: the kind constant used by the request.
export { ASK_JOURNAL_KIND };