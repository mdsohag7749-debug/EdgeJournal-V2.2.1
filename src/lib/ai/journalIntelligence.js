// AI Journal Intelligence — the Sprint 9.3 production feature.
//
// Built ENTIRELY on the Sprint 9.1 AI foundation and the Sprint 8 analytics
// engines. It does not re-implement a single PnL / RR / win-loss / drawdown /
// discipline formula: every metric that reaches the model is produced by the
// existing canonical analytics modules (analytics.js, setupPerformance.js,
// heatmap.js, mistakePattern.js, disciplineScore.js, riskAnalytics.js,
// emotionAnalytics.js, patternDetection.js) from the account-scoped trade set.
//
// Guarantees enforced here (mirroring the rest of the AI module):
//   - ACCOUNT ISOLATION (NON-NEGOTIABLE): the journal context only ever
//     contains trades that belong to the explicitly requested account. Any
//     cross-account trade throws AI_ACCOUNT_SCOPE_ERROR. The feature never
//     fetches "all accounts" for AI and never sends global trade history.
//   - READ-ONLY: nothing here writes trades, balances, PnL, RR, risk, the
//     discipline score, filters or saved views. It only reads and returns
//     analysis.
//   - CANONICAL AUTHORITATIVE: aggregations arrive pre-computed from the
//     verified engines. Missing values stay missing; statistics are never
//     fabricated.
//   - NO CAUSAL CLAIMS / NO EXECUTION: the prompt forbids causation claims,
//     buy/sell directives, price predictions and guaranteed outcomes; the
//     sanitizer independently drops forbidden fields and rejects directive
//     language before a response can reach the UI.
//   - SMALL DATA GUARDRAILS: 0 trades -> NOT_ENOUGH_DATA (no provider call),
//     1-4 -> LIMITED_DATA, 5-9 -> EARLY_PATTERN, 10+ -> NORMAL analysis.
//     The analyzed period/scope is always exposed and never silently mixed.
//
// The React UI lives in src/components/ai/AIJournalIntelligence.jsx; this
// module owns all orchestration, prompt design and the response contract.

import { AIError } from './errors.js';
import { AI_ERROR_CODES, AI_DISCLAIMER } from './types.js';
import { createAIProvider } from './provider.js';
import { freezeDeep, AI_DIRECTIVE_PATTERN, rejectDirectiveText as rejectDirectiveLanguage } from './safety.js';
import { computeAnalytics } from '../analytics.js';
import { applyPeriodFilter, computeSetupPerformance, UNASSIGNED_LABEL } from '../setupPerformance.js';
import { computePairSessionHeatmap, sessionKey } from '../heatmap.js';
import { computeMistakePattern } from '../mistakePattern.js';
import { computeDisciplineScore20 } from '../disciplineScore.js';
import { computeRiskAnalytics } from '../riskAnalytics.js';
import { computeEmotionAnalytics } from '../emotionAnalytics.js';
import { computePatternDetection } from '../patternDetection.js';
import {
  AI_JOURNAL_MAX_RECENT_TRADES,
  DATA_COVERAGE,
  DATA_LIMITED_MAX,
  DATA_EARLY_MAX,
  DATA_NORMAL_MIN,
  classifyDataCoverage,
  dataCoverageLabel,
  buildJournalDataQuality,
  buildJournalPerformance,
  buildJournalRiskBlock,
  buildJournalCompleteness,
  buildCompletenessLimitations,
  assertJournalAccountScope,
  buildCanonicalJournalContext,
} from './canonicalContext.js';

// Canonical single source of truth (audit P1). Every deterministic journal
// block, coverage classifier and projection now lives in canonicalContext.js;
// this module re-exports them so existing consumers keep a single surface.
export {
  AI_JOURNAL_MAX_RECENT_TRADES,
  DATA_COVERAGE,
  DATA_LIMITED_MAX,
  DATA_EARLY_MAX,
  DATA_NORMAL_MIN,
  classifyDataCoverage,
  dataCoverageLabel,
  buildJournalDataQuality,
  buildJournalPerformance,
  buildJournalRiskBlock,
  buildJournalCompleteness,
  buildCompletenessLimitations,
  assertJournalAccountScope,
} from './canonicalContext.js';

export const AI_REQUEST_KIND_JOURNAL_INTELLIGENCE = 'journalIntelligence';

// A journal-level state: too few trades to justify any AI analysis. Kept as a
// controlled code so consumers render one safe message for it without the
// provider ever being touched.
export const AI_NOT_ENOUGH_DATA = 'AI_NOT_ENOUGH_DATA';

// Response fields that MUST NEVER appear in a journal-level AI response.
// Structural fields are dropped by the allow-list sanitizer; directive
// language in the text is rejected by a content scan.
export const JOURNAL_FORBIDDEN_FIELDS = [
  'buy',
  'sell',
  'signal',
  'tradeSignal',
  'entrySignal',
  'exitSignal',
  'recommendedEntry',
  'recommendedExit',
  'guaranteedProfit',
  'profitGuarantee',
  'guaranteedReturns',
  'futureProfit',
  'marketPrediction',
  'pricePrediction',
  'lotRecommendation',
  'riskIncrease',
  'riskDecrease',
  'tradeExecution',
  'automatedTrade',
];

// The journal-level response contract. Distinct from the foundation's base
// RESPONSE_CONTRACT (which this feature extends with the journal sections).
export const JOURNAL_RESPONSE_KEYS = [
  'summary',
  'performance',
  'keyPatterns',
  'keyInsights',
  'strengths',
  'weaknesses',
  'recurringIssues',
  'risk',
  'psychology',
  'setupInsights',
  'pairSessionInsights',
  'disciplineInsights',
  'actionPlan',
  'improvementAreas',
  'watchlist',
  'dataQuality',
  'confidence',
  'disclaimer',
];

// Free-form list sections (arrays of strings).
export const JOURNAL_RESPONSE_LIST_KEYS = [
  'strengths',
  'weaknesses',
  'setupInsights',
  'pairSessionInsights',
  'disciplineInsights',
  'improvementAreas',
  'watchlist',
];

// Object-list sections (keyInsights / keyPatterns / recurringIssues) with the
// fields each item may carry.
export const JOURNAL_INSIGHT_SCHEMA = {
  keyInsights: ['title', 'observation', 'evidence', 'confidence'],
  keyPatterns: ['title', 'observation', 'evidence', 'confidence'],
  recurringIssues: ['title', 'observation', 'evidence'],
};

// Structured sub-objects: risk and psychology carry nested lists.
export const JOURNAL_RISK_SCHEMA = ['observations', 'flags'];
export const JOURNAL_PSYCHOLOGY_SCHEMA = ['summary', 'observations', 'possiblePatterns'];
export const JOURNAL_ACTION_PLAN_SCHEMA = ['keepDoing', 'stopDoing', 'startDoing', 'nextSessionFocus'];

// System instruction sent to the model alongside the journal context. Kept
// OUT of the React component on purpose; future features reuse or extend it.
export const JOURNAL_INTELLIGENCE_INSTRUCTION = (
  'You are EdgeJournal AI, a trading journal analyst.\n' +
  'Analyze only the supplied recorded journal data.\n\n' +
  'Do not invent statistics.\n' +
  'Do not infer missing values.\n' +
  'Do not make causal claims from observational journal data.\n' +
  'Do not provide buy/sell signals.\n' +
  'Do not predict future prices or profits.\n' +
  'Do not guarantee outcomes.\n' +
  'Use canonical metrics exactly as supplied.\n' +
  'Identify descriptive patterns and uncertainty.\n' +
  'If sample size is small, explicitly state that confidence is limited.\n' +
  'Prefer evidence-backed observations; when evidence is insufficient, say so.\n\n' +
  'Your purpose is to help the user understand their recorded behavior, execution and journal patterns — not to make trading decisions.\n\n' +
  'REPLY ONLY with a JSON object using SOME or ALL of these keys:\n' +
  '  summary: string\n' +
  '  keyPatterns: array of { title: string, observation: string, evidence: string, confidence?: number 0-1 }\n' +
  '  keyInsights: array of { title: string, observation: string, evidence: string, confidence?: number 0-1 }\n' +
  '  strengths: string[]\n' +
  '  weaknesses: string[]\n' +
  '  recurringIssues: array of { title: string, observation: string, evidence: string }\n' +
  '  risk: { observations: string[], flags: string[] } — observations only; the canonical risk metrics and discipline flags are supplied and must not be repeated as numbers\n' +
  '  psychology: { summary: string, observations: string[], possiblePatterns: string[] } — use careful, non-diagnostic language such as "possible pattern" or "may indicate"; never claim certainty about the user psychology\n' +
  '  setupInsights: string[]\n' +
  '  pairSessionInsights: string[]\n' +
  '  disciplineInsights: string[]\n' +
  '  actionPlan: { keepDoing: string[], stopDoing: string[], startDoing: string[], nextSessionFocus: string } — practical process improvements only, never trading directives\n' +
  '  improvementAreas: string[]\n' +
  '  watchlist: string[]\n' +
  '  dataQuality: { tradeCount: number, coverage: string, limitations: string[] }\n' +
  '  confidence: number between 0 and 1 or null\n' +
  '  disclaimer: string\n'
);

// Sample-coverage classification, data-quality block and the deterministic
// intelligence blocks (performance / risk / completeness / limitations) live
// in canonicalContext.js — see the re-export block at the top of this file.

// ---------------------------------------------------------------------------
// Scope / filter awareness — reuses the canonical period filter and the same
// session / setup / pair keys the verified analytics widgets use.
// ---------------------------------------------------------------------------

const PERIOD_LABELS = {
  all: 'All Time',
  month: 'This Month',
  week: 'This Week',
  30: 'Last 30 Days',
};

function periodLabel(period, dateFrom, dateTo) {
  if (PERIOD_LABELS[period] !== undefined) return PERIOD_LABELS[period];
  if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`;
  return 'All Time';
}

export function scopeLabel(scope = {}) {
  const parts = [periodLabel(scope.period, scope.dateFrom, scope.dateTo)];
  if (scope.pair && scope.pair !== 'All') parts.push(`Pair: ${scope.pair}`);
  if (scope.session && scope.session !== 'All') parts.push(`Session: ${scope.session}`);
  if (scope.setup && scope.setup !== 'All') parts.push(`Setup: ${scope.setup}`);
  return parts.join(' · ');
}

export function analyzedScopeLabel(scope = {}, tradeCount = 0) {
  return `${scopeLabel(scope)} · ${tradeCount} trade${tradeCount === 1 ? '' : 's'}`;
}

// Applies the current journal scope to the (already account-scoped) trades
// using the same canonical filters the verified widgets use — so the AI never
// silently mixes filtered and unfiltered data.
export function applyJournalScope(trades, { period = 'all', pair = 'All', session = 'All', setup = 'All', dateFrom, dateTo } = {}) {
  const list = Array.isArray(trades) ? trades : [];
  const periodFocus = applyPeriodFilter(list, period, dateFrom, dateTo);
  return periodFocus.filter(
    (t) =>
      (pair === 'All' || !pair ? true : (t.instrument || UNASSIGNED_LABEL) === pair) &&
      (session === 'All' || !session ? true : sessionKey(t) === session) &&
      (setup === 'All' || !setup ? true : (t.model || UNASSIGNED_LABEL) === setup)
  );
}

// A stable fingerprint of the analyzed scope + the underlying record set. Used
// by the UI to mark a previous AI result STALE the moment the scope changes.
export function createScopeFingerprint(trades, { accountId, period = 'all', pair = 'All', session = 'All', setup = 'All', dateFrom, dateTo } = {}) {
  const ids = Array.isArray(trades) ? trades.map((t) => t.id).sort() : [];
  return JSON.stringify({
    accountId: accountId || null,
    period,
    pair,
    session,
    setup,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    ids,
  });
}

// ---------------------------------------------------------------------------
// Journal context builder — pure, deterministic, deeply frozen.
// All numbers arrive pre-computed from the canonical engines; the deterministic
// blocks (performance / risk / completeness / data quality) and projections are
// the canonicalContext single source of truth.
// ---------------------------------------------------------------------------
export function buildAIJournalContext({
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
  performance,
  riskBlock,
  completeness,
} = {}) {
  if (!Array.isArray(trades)) {
    throw new AIError(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, 'A trades array is required to build a journal AI context.');
  }
  assertJournalAccountScope(trades, accountId);

  const canonical = buildCanonicalJournalContext({
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
    dataQuality,
    performance,
    riskBlock,
    completeness,
  });

  const context = {
    account: {
      id: accountId || null,
      name: accountName === null || accountName === undefined ? null : accountName,
    },
    scope: {
      label: scopeLabel(scope),
      period: scope.period || 'all',
      pair: scope.pair || 'All',
      session: scope.session || 'All',
      setup: scope.setup || 'All',
      dateFrom: scope.dateFrom || null,
      dateTo: scope.dateTo || null,
    },
    ...canonical,
  };

  return freezeDeep(context);
}

// ---------------------------------------------------------------------------
// Response sanitization (journal contract) + forbidden-field enforcement.
// ---------------------------------------------------------------------------
export function sanitizeJournalResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a non-object journal response.');
  }

  const source = raw;
  const out = {
    summary: typeof source.summary === 'string' ? source.summary.trim() : '',
    // performance is canonical-only: always null after sanitization, replaced
    // by the deterministic block in mergeCanonicalAnalysis(). The model is
    // never allowed to author numbers.
    performance: null,
    keyInsights: toInsightList(source.keyInsights, JOURNAL_INSIGHT_SCHEMA.keyInsights),
    keyPatterns: toInsightList(source.keyPatterns, JOURNAL_INSIGHT_SCHEMA.keyPatterns),
    strengths: toTextList(source.strengths),
    weaknesses: toTextList(source.weaknesses),
    recurringIssues: toInsightList(source.recurringIssues, JOURNAL_INSIGHT_SCHEMA.recurringIssues),
    risk: toSubobjectList(source.risk, JOURNAL_RISK_SCHEMA),
    psychology: toPsychologyBlock(source.psychology),
    actionPlan: toActionPlan(source.actionPlan),
    setupInsights: toTextList(source.setupInsights),
    pairSessionInsights: toTextList(source.pairSessionInsights),
    disciplineInsights: toTextList(source.disciplineInsights),
    improvementAreas: toTextList(source.improvementAreas),
    watchlist: toTextList(source.watchlist),
    // Structural hole for model limitation notes only. tradeCount / coverage
    // are recomputed from the canonical scope and override this in
    // mergeCanonicalAnalysis().
    dataQuality: source.dataQuality && typeof source.dataQuality === 'object' ? { limitations: toTextList(source.dataQuality.limitations) } : { limitations: [] },
    confidence: toConfidence(source.confidence),
    disclaimer: typeof source.disclaimer === 'string' && source.disclaimer.trim() ? source.disclaimer.trim() : AI_DISCLAIMER,
  };

  rejectDirectiveText(out);

  return freezeDeep(out);
}

function toTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function toConfidence(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function toInsightList(value, keys) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = {};
    keys.forEach((k) => {
      const v = item[k];
      if (k === 'confidence') row.confidence = toConfidence(v);
      else if (typeof v === 'string' && v.trim()) row[k] = v.trim();
    });
    if (row.title || row.observation || row.evidence || row.confidence) rows.push(row);
  });
  return rows;
}

// Structured sub-objects (risk / psychology) — only allow-listed string-list
// keys survive; anything else the model returns is dropped.
function toSubobjectList(value, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const empty = {};
    allowedKeys.forEach((k) => (empty[k] = []));
    return empty;
  }
  const out = {};
  allowedKeys.forEach((k) => (out[k] = toTextList(value[k])));
  return out;
}

// Psychology block — summary is a single string; observations / possiblePatterns
// are string lists. Non-allow-listed keys are dropped.
function toPsychologyBlock(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { summary: '', observations: [], possiblePatterns: [] };
  }
  return {
    summary: typeof value.summary === 'string' ? value.summary.trim() : '',
    observations: toTextList(value.observations),
    possiblePatterns: toTextList(value.possiblePatterns),
  };
}

// Action plan — four specific string fields; the rest is dropped.
function toActionPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { keepDoing: [], stopDoing: [], startDoing: [], nextSessionFocus: '' };
  }
  return {
    keepDoing: toTextList(value.keepDoing),
    stopDoing: toTextList(value.stopDoing),
    startDoing: toTextList(value.startDoing),
    nextSessionFocus: typeof value.nextSessionFocus === 'string' ? value.nextSessionFocus.trim() : '',
  };
}

function rejectDirectiveText(out) {
  const text = [
    out.summary,
    ...out.strengths,
    ...out.weaknesses,
    ...out.setupInsights,
    ...out.pairSessionInsights,
    ...out.disciplineInsights,
    ...out.improvementAreas,
    ...out.watchlist,
    ...out.keyInsights.flatMap((i) => [i.title, i.observation, i.evidence]),
    ...out.keyPatterns.flatMap((i) => [i.title, i.observation, i.evidence]),
    ...out.recurringIssues.flatMap((i) => [i.title, i.observation, i.evidence]),
    ...out.risk.observations,
    ...out.risk.flags,
    ...out.psychology.summary,
    ...out.psychology.observations,
    ...out.psychology.possiblePatterns,
    ...out.actionPlan.keepDoing,
    ...out.actionPlan.stopDoing,
    ...out.actionPlan.startDoing,
    out.actionPlan.nextSessionFocus,
  ]
    .filter(Boolean)
    .join(' \n ');

  rejectDirectiveLanguage(text);
}

// Structural validation of an already-sanitized journal response.
export function validateJournalResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { ok: false, errors: ['Journal AI response must be a single object.'], response: null };
  }
  const target = response;
  const errors = [];
  if (typeof target.summary !== 'string') errors.push('summary must be a string');
  JOURNAL_RESPONSE_LIST_KEYS.forEach((k) => {
    if (target[k] !== undefined && !Array.isArray(target[k])) errors.push(`${k} must be an array`);
  });
  Object.keys(JOURNAL_INSIGHT_SCHEMA).forEach((k) => {
    if (target[k] !== undefined && !Array.isArray(target[k])) errors.push(`${k} must be an array`);
  });
  if (target.performance !== undefined && target.performance !== null && (typeof target.performance !== 'object' || Array.isArray(target.performance))) {
    errors.push('performance must be null or an object');
  }
  if (target.risk !== undefined && (typeof target.risk !== 'object' || Array.isArray(target.risk))) errors.push('risk must be an object');
  if (target.psychology !== undefined && (typeof target.psychology !== 'object' || Array.isArray(target.psychology))) errors.push('psychology must be an object');
  if (target.actionPlan !== undefined && (typeof target.actionPlan !== 'object' || Array.isArray(target.actionPlan))) errors.push('actionPlan must be an object');
  if (target.confidence !== undefined && target.confidence !== null && (typeof target.confidence !== 'number' || target.confidence < 0 || target.confidence > 1)) {
    errors.push('confidence must be a number between 0 and 1, or null');
  }
  if (target.disclaimer !== undefined && typeof target.disclaimer !== 'string') errors.push('disclaimer must be a string');
  return { ok: errors.length === 0, errors, response: target };
}

export function assertJournalResponse(response) {
  const check = validateJournalResponse(response);
  if (!check.ok) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a journal response outside the allowed contract.');
  }
  return check.response;
}

// ---------------------------------------------------------------------------
// Orchestration — one read-only flow the UI wires to its Analyze button.
// ---------------------------------------------------------------------------
export async function analyzeJournalIntelligence({
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
  const scope = { period, pair, session, setup, dateFrom, dateTo };

  // Account isolation is non-negotiable for the journal scope. A concrete
  // account must be selected — the feature never analyzes mixed-account data.
  if (typeof accountId !== 'string' || accountId === '') {
    return {
      ok: false,
      status: AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
      message: safeJournalErrorMessage(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR),
      analysis: null,
    };
  }

  const focused = applyJournalScope(trades, scope);
  const dataQuality = buildJournalDataQuality(focused.length);

  // Small-sample gate before any provider contact.
  if (focused.length === 0) {
    return {
      ok: false,
      status: AI_NOT_ENOUGH_DATA,
      message: safeJournalErrorMessage(AI_NOT_ENOUGH_DATA),
      analysis: null,
    };
  }

  // Canonical analytics — reuse the verified engines only. No formula is
  // recomputed by the AI layer.
  let context;
  let canonical = { dataQuality };
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

    // Deterministic intelligence blocks (performance / risk / data quality) are
    // computed once here and merged back over the model output, so the UI can
    // never show model-invented numbers.
    const performance = buildJournalPerformance(analytics, risk);
    const riskBlock = buildJournalRiskBlock(risk, patterns, focused);
    const completeness = buildJournalCompleteness(focused);
    const completenessLimits = buildCompletenessLimitations(completeness);
    canonical = {
      dataQuality: buildJournalDataQuality(focused.length, completenessLimits),
      performance,
      riskBlock,
    };

    context = buildAIJournalContext({
      trades: focused,
      accountId,
      accountName,
      analytics,
      setupPerformance,
      disciplineScore,
      heatmap,
      mistakeIntelligence: mistakeAnalysis,
      risk,
      emotion,
      patterns,
      scope,
      dataQuality: canonical.dataQuality,
      performance,
      riskBlock,
      completeness,
    });
  } catch (err) {
    return toJournalResult(err, { dataQuality });
  }

  const activeProvider = provider || createAIProvider();
  const request = {
    kind: AI_REQUEST_KIND_JOURNAL_INTELLIGENCE,
    systemInstruction: JOURNAL_INTELLIGENCE_INSTRUCTION,
    context,
    sanitize: sanitizeJournalResponse,
  };

  try {
    const result = await activeProvider.analyze(request);
    return toJournalResult(result, canonical);
  } catch (err) {
    return toJournalResult(err, canonical);
  }
}

// ---------------------------------------------------------------------------
// Controlled result shaping — raw provider data never leaks to the UI.
// ---------------------------------------------------------------------------
export function toJournalResult(input, canonical = {}) {
  if (input && typeof input === 'object' && typeof input.ok === 'boolean') {
    if (input.ok && input.analysis) {
      return {
        ok: true,
        status: input.status || 'ok',
        message: '',
        analysis: mergeCanonicalAnalysis(input.analysis, canonical),
      };
    }
    const code = input.status || AI_ERROR_CODES.AI_PROVIDER_ERROR;
    return {
      ok: false,
      status: code,
      message: safeJournalErrorMessage(code),
      analysis: null,
    };
  }

  const code = input?.code && (AI_ERROR_CODES[input.code] || input.code === AI_NOT_ENOUGH_DATA) ? input.code : AI_ERROR_CODES.AI_PROVIDER_ERROR;
  return {
    ok: false,
    status: code,
    message: safeJournalErrorMessage(code),
    analysis: null,
  };
}

// Data quality / performance / risk are facts from the canonical scope — never
// let the model present its own trade count, coverage, numbers, or discipline
// flags. The model only adds limitation notes and risk/psychology observations.
function mergeCanonicalAnalysis(analysis, canonical) {
  if (!canonical) return analysis;
  const out = { ...analysis };

  const dq = canonical.dataQuality;
  if (dq) {
    const limitations = Array.isArray(dq.limitations) ? [...dq.limitations] : [];
    const modelLimits = analysis?.dataQuality?.limitations;
    if (Array.isArray(modelLimits)) {
      modelLimits.forEach((l) => {
        if (typeof l !== 'string') return;
        const s = l.trim();
        if (s && !limitations.includes(s)) limitations.push(s);
      });
    }
    out.dataQuality = { ...dq, limitations };
  }

  if (canonical.performance) {
    // Always canonical. Any numbers the model authored were dropped during
    // sanitization (performance is null there) and never reach the UI.
    out.performance = canonical.performance;
  }

  if (canonical.riskBlock) {
    // Canonical metrics + deterministic discipline flags; the model may only
    // contribute qualitative observations on top.
    const observations = Array.isArray(out.risk?.observations) ? out.risk.observations : [];
    out.risk = { ...canonical.riskBlock, observations };
  }

  return out;
}

// Safe, human-readable journal messages — never provider internals.
export function safeJournalErrorMessage(code) {
  switch (code) {
    case AI_NOT_ENOUGH_DATA:
      return 'Not enough trades in this scope to run a meaningful journal analysis. Log more trades or widen the filters.';
    case AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR:
      return 'Journal intelligence is only available after selecting a single account. Your journal data was not changed.';
    case AI_ERROR_CODES.AI_NOT_CONFIGURED:
      return 'EdgeJournal AI is not configured yet. No journal data was sent to any provider.';
    case AI_ERROR_CODES.AI_RATE_LIMITED:
    case AI_ERROR_CODES.AI_TIMEOUT:
    case AI_ERROR_CODES.AI_UNAVAILABLE:
    case AI_ERROR_CODES.AI_PROVIDER_ERROR:
      return 'Journal intelligence is temporarily unavailable. Please try again later. Your journal data was not changed.';
    case AI_ERROR_CODES.AI_INVALID_RESPONSE:
      return 'Journal intelligence returned an unreadable response. Your journal data was not changed.';
    default:
      return 'Journal intelligence could not be completed. Your journal data was not changed.';
  }
}