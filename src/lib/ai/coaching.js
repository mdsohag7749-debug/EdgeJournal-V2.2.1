// AI Coaching & Action Plan — Sprint 9.4 production feature.
//
// Answers "Based on my recorded journal evidence, what should I work on next?"
// It is a structured PERSONAL TRADING COACH, not a signal generator.
//
// Built ENTIRELY on the Sprint 9.1 AI foundation and the Sprint 8 analytics
// engines, exactly like Sprint 9.3. It consumes the SAME canonical outputs the
// verified widgets already produce:
//   - computeAnalytics()            → summary + pair/session/strategy metrics
//   - computeDisciplineScore20()    → Discipline Score 2.0 (never re-calculated)
//   - computeMistakePattern()       → recurrent recorded mistakes
//   - computeSetupPerformance()     → per-setup recorded performance
//   - computePairSessionHeatmap()   → pair/session recorded performance
//   - computeRiskAnalytics()        → risk / drawdown metrics
//   - computePatternDetection()     → observed behavior patterns
//   - buildJournalDataQuality()     → Sprint 9.3 canonical coverage guardrails
//
// Guarantees enforced here (mirroring the rest of the AI module):
//   - ACCOUNT ISOLATION (NON-NEGOTIABLE): the coaching context only ever
//     contains trades belonging to the explicitly requested account. Mixed /
//     cross-account sets throw AI_ACCOUNT_SCOPE_ERROR.
//   - READ-ONLY: nothing here writes trades, balances, PnL, RR, risk, the
//     discipline score, filters or saved views.
//   - CANONICAL AUTHORITATIVE: aggregates arrive pre-computed from the verified
//     engines. Missing values stay missing; statistics are never fabricated.
//   - HORIZON-SCOPED PERIODS: Daily / Weekly / Monthly windows drive BOTH the
//     current analyzer scope and the comparable previous period. The exact
//     window boundaries are deterministic and exposed to the UI.
//   - PERIOD COMPARISON from canonical values: current vs previous metric
//     numbers arrive pre-computed; the model only interprets direction with
//     explicit sample-size caveats.
//   - NO DIRECTIVES / NO EXECUTION: the system instruction forbids buy/sell
//     directives, price predictions, guaranteed outcomes and risk-size orders;
//     the sanitizer independently drops forbidden fields and rejects directive
//     language before a response can reach the UI.
//   - SMALL DATA GUARDRAILS: 0 in-scope trades -> AI_NOT_ENOUGH_DATA (no
//     provider call). 1-4 / 5-9 / 10+ reuse Sprint 9.3's canonical coverage
//     classification and are surfaced verbatim with limitation notes.
//
// The React UI lives in src/components/ai/AICoaching.jsx; this module owns all
// orchestration, prompt design and the coaching response contract.

import { AIError, toSafeAIError } from './errors.js';
import { AI_ERROR_CODES, AI_DISCLAIMER } from './types.js';
import { createAIProvider } from './provider.js';
import { freezeDeep, AI_DIRECTIVE_PATTERN, rejectDirectiveText as rejectDirectiveLanguage } from './safety.js';
import { computeAnalytics } from '../analytics.js';
import {
  applyJournalScope,
  AI_NOT_ENOUGH_DATA,
} from './journalIntelligence.js';
import {
  assertJournalAccountScope,
  buildJournalDataQuality,
  buildJournalPerformance,
  buildJournalRiskBlock,
  buildJournalCompleteness,
  classifyDataCoverage,
  dataCoverageLabel,
  DATA_COVERAGE,
  numOrNull,
  pickSummary,
  pickAnalytics,
  pickDisciplineScore,
  pickSetupPerformance,
  pickMistake,
  pickHeatmap,
  pickPatterns,
  pickRisk,
  pickEmotion,
} from './canonicalContext.js';
import { computeMistakePattern } from '../mistakePattern.js';
import { computeDisciplineScore20 } from '../disciplineScore.js';
import { computeSetupPerformance } from '../setupPerformance.js';
import { computePairSessionHeatmap } from '../heatmap.js';
import { computeRiskAnalytics } from '../riskAnalytics.js';
import { computePatternDetection } from '../patternDetection.js';
import { computeEmotionAnalytics } from '../emotionAnalytics.js';
import { dateKey, monthLabel, weekLabel } from '../utils.js';

export const AI_REQUEST_KIND_COACHING = 'coaching';

// Coaching horizons. The selected horizon drives the deterministic window pair
// (current vs previous comparable period) supplied to the model.
export const COACHING_HORIZONS = ['daily', 'weekly', 'monthly'];
export const COACHING_DEFAULT_HORIZON = 'weekly';

export function coachingHorizonLabel(horizon) {
  switch (horizon) {
    case 'daily':
      return 'Daily';
    case 'monthly':
      return 'Monthly';
    case 'weekly':
    default:
      return 'Weekly';
  }
}

// The coaching response contract. Distinct from the foundation's base
// RESPONSE_CONTRACT (which this feature extends with the coaching sections).
export const COACHING_RESPONSE_KEYS = [
  'summary',
  'focusAreas',
  'strengths',
  'recurringPatterns',
  'periodComparison',
  'actionPlan',
  'watchItems',
  'limitations',
  'confidence',
  'disclaimer',
];

// Free-form list sections (arrays of strings).
export const COACHING_LIST_KEYS = ['strengths', 'watchItems', 'limitations'];

// Object-list sections with the fields each item may carry.
export const COACHING_FOCUS_SCHEMA = ['title', 'reason', 'evidence', 'priority', 'confidence', 'action', 'source'];
export const COACHING_PATTERN_SCHEMA = ['title', 'observation', 'evidence'];
export const COACHING_COMPARISON_SCHEMA = ['metric', 'current', 'previous', 'direction', 'observation', 'confidence'];
export const COACHING_ACTION_SCHEMA = ['title', 'why', 'evidence', 'timeframe', 'measurable', 'completionHint'];

// Closed vocabularies — invalid model values are normalized to safe fallbacks
// (or dropped) so the UI never renders fabricated data.
export const COACHING_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
export const COACHING_DIRECTIONS = ['IMPROVING', 'DECLINING', 'STABLE', 'INCONCLUSIVE'];
export const COACHING_TIMEFRAMES = ['TODAY', 'THIS_WEEK', 'NEXT_7_DAYS', 'NEXT_REVIEW'];
export const COACHING_SOURCES = [
  'mistakeIntelligence',
  'disciplineScore',
  'setupPerformance',
  'heatmap',
  'journalIntelligence',
  'periodComparison',
  'patterns',
];

// Structural fields (beyond the response allow-list, which already drops them)
// that coaching output MUST NEVER carry — the enforceability mirror of the
// prompt's forbidden vocabulary.
export const COACHING_FORBIDDEN_FIELDS = [
  'buy',
  'sell',
  'signal',
  'tradeSignal',
  'entrySignal',
  'exitSignal',
  'recommendedEntry',
  'recommendedExit',
  'marketPrediction',
  'pricePrediction',
  'futurePrice',
  'guaranteedProfit',
  'profitGuarantee',
  'lotRecommendation',
  'riskIncrease',
  'riskDecrease',
  'automatedTrade',
  'executeTrade',
];

// System instruction sent to the model alongside the coaching context. Kept
// OUT of the React component on purpose; future features reuse or extend it.
export const COACHING_INSTRUCTION = (
  'You are EdgeJournal AI Coach.\n' +
  'Your role is to help the user improve their trading process based only on their recorded journal data.\n' +
  'Analyze the supplied evidence conservatively.\n' +
  'Never invent statistics or missing values.\n' +
  'Never make causal claims unless explicitly supported by the supplied evidence.\n' +
  'Never provide buy/sell signals.\n' +
  'Never predict market prices.\n' +
  'Never predict future profits.\n' +
  'Never guarantee outcomes.\n' +
  'Never recommend increasing or decreasing financial risk.\n' +
  'Do not tell the user which asset to trade.\n' +
  'Do not tell the user which direction the market will move.\n\n' +
  'Instead focus on:\n' +
  '- journaling behavior\n' +
  '- execution quality\n' +
  '- discipline\n' +
  '- recurring recorded mistakes\n' +
  '- setup review\n' +
  '- pair/session observations\n' +
  '- consistency\n' +
  '- review habits\n' +
  '- process improvement\n\n' +
  'Every coaching recommendation must be connected to supplied evidence.\n' +
  'When evidence is weak, explicitly say so.\n' +
  'Do not modify or reinterpret canonical calculations — use the numbers exactly as supplied.\n' +
  'Use canonical period-comparison values for the periodComparison array and never replace them with invented numbers.\n' +
  'If a comparison metric has too small a sample, mark direction INCONCLUSIVE.\n\n' +
  'Prefer: review, monitor, consider, practice, document, compare, validate, focus on.\n' +
  'Avoid: must, guaranteed, always, never, will, should trade, buy, sell.\n\n' +
  'REPLY ONLY with a JSON object using SOME or ALL of these keys:\n' +
  '  summary: string\n' +
  '  focusAreas: array of { title: string, reason: string, evidence: string, priority: "HIGH"|"MEDIUM"|"LOW", confidence?: number 0-1, action: string, source?: "mistakeIntelligence"|"disciplineScore"|"setupPerformance"|"heatmap"|"journalIntelligence"|"periodComparison"|"patterns" }\n' +
  '  strengths: string[]\n' +
  '  recurringPatterns: array of { title: string, observation: string, evidence: string }\n' +
  '  periodComparison: array of { metric: string, current: number|null, previous: number|null, direction: "IMPROVING"|"DECLINING"|"STABLE"|"INCONCLUSIVE", observation: string, confidence?: number 0-1 }\n' +
  '  actionPlan: array of { title: string, why: string, evidence: string, timeframe: "TODAY"|"THIS_WEEK"|"NEXT_7_DAYS"|"NEXT_REVIEW", measurable: boolean, completionHint: string }\n' +
  '  watchItems: string[]\n' +
  '  limitations: string[]\n' +
  '  confidence: number between 0 and 1 or null\n' +
  '  disclaimer: string\n'
);

// ---------------------------------------------------------------------------
// Deterministic coaching window pair — horizon → current vs previous period.
// ---------------------------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mondayOf(d) {
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  return m;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Returns { horizon, current: {start,end,label,key}, previous: {start,end,label,key} }
// where start/end are 'YYYY-MM-DD' boundaries (inclusive calendar filters).
// `now` is injectable for deterministic tests; it defaults to the wall clock.
export function buildCoachingPeriods(horizon = COACHING_DEFAULT_HORIZON, now) {
  const norm = COACHING_HORIZONS.includes(horizon) ? horizon : COACHING_DEFAULT_HORIZON;
  const today = toDate(now);
  const todayKey = dateKey(today);

  if (norm === 'daily') {
    const prevKey = dateKey(addDays(today, -1));
    return {
      horizon: norm,
      current: { start: todayKey, end: todayKey, label: 'Today', key: `d:${todayKey}` },
      previous: { start: prevKey, end: prevKey, label: 'Yesterday', key: `d:${prevKey}` },
    };
  }

  if (norm === 'monthly') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const key = `${y}-${pad(m + 1)}`;
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    const prevKey = `${prevY}-${pad(prevM + 1)}`;
    return {
      horizon: norm,
      current: { start: `${key}-01`, end: dateKey(new Date(y, m + 1, 0)), label: monthLabel(key), key },
      previous: { start: `${prevKey}-01`, end: dateKey(new Date(prevY, prevM + 1, 0)), label: monthLabel(prevKey), key: prevKey },
    };
  }

  // weekly (default)
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const prevMonday = addDays(monday, -7);
  const prevSunday = addDays(monday, -1);
  return {
    horizon: norm,
    current: { start: dateKey(monday), end: dateKey(sunday), label: `This week (${weekLabel(dateKey(monday))})`, key: `w:${dateKey(monday)}` },
    previous: { start: dateKey(prevMonday), end: dateKey(prevSunday), label: `Previous week (${weekLabel(dateKey(prevMonday))})`, key: `w:${dateKey(prevMonday)}` },
  };
}

// Applies the same canonical pair / session / setup filters used everywhere on
// the Analytics page to a date-window slice (Sprint 9.3's canonical filter).
export function scopeCoachingTrades(trades, { start, end, pair = 'All', session = 'All', setup = 'All' } = {}) {
  return applyJournalScope(trades, { period: 'all', pair, session, setup, dateFrom: start, dateTo: end });
}

// ---------------------------------------------------------------------------
// Coaching context builder — pure, deterministic, deeply frozen.
// All numbers arrive pre-computed from the canonical engines; the deterministic
// blocks (performance / risk / completeness / data quality) and projections are
// the canonicalContext single source of truth.
// ---------------------------------------------------------------------------
function pfValue(v) {
  if (v === Infinity) return null;
  return numOrNull(v);
}

function buildCanonicalComparison(currentA, previousA, currentD, previousD) {
  if (!currentA) return [];
  const rows = [];
  const push = (metric, current, previous) => {
    rows.push({
      metric,
      current: current === undefined || current === null ? null : numOrNull(current),
      previous: previous === undefined || previous === null ? null : numOrNull(previous),
      currentTrades: numOrNull(currentA.total),
      previousTrades: previousA ? numOrNull(previousA.total) : null,
    });
  };

  push('Win rate', currentA.winRate, previousA && previousA.winRate);
  push('Net P&L', currentA.netPnl, previousA && previousA.netPnl);
  push('Average RR', currentA.avgRR, previousA && previousA.avgRR);
  push('Profit factor', pfValue(currentA.profitFactor), previousA ? pfValue(previousA.profitFactor) : null);
  push('Trades', currentA.total, previousA && previousA.total);
  if (currentD && currentD.score !== null && currentD.score !== undefined) {
    push('Discipline score', currentD.score, previousD && previousD.score !== null ? previousD.score : null);
  }
  return rows;
}

export function buildAICoachingContext({
  trades = [],
  accountId,
  accountName,
  currentScope = {},
  previousScope = {},
  currentAnalytics,
  previousAnalytics,
  journalIntelligence,
  disciplineScore,
  setupPerformance,
  mistakeIntelligence,
  heatmap,
  risk,
  patterns,
  emotion,
  canonicalComparison = [],
  dataQuality,
  performance,
  riskBlock,
  completeness,
} = {}) {
  if (!Array.isArray(trades)) {
    throw new AIError(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, 'A trades array is required to build a coaching context.');
  }
  assertJournalAccountScope(trades, accountId);

  const context = {
    account: {
      id: accountId || null,
      name: accountName === null || accountName === undefined ? null : accountName,
    },
    mode: 'coaching',
    currentPeriod: {
      start: currentScope.start || null,
      end: currentScope.end || null,
      label: currentScope.label || '',
      key: currentScope.key || null,
    },
    previousPeriod: {
      start: previousScope.start || null,
      end: previousScope.end || null,
      label: previousScope.label || '',
      key: previousScope.key || null,
    },
    dataQuality: dataQuality || buildJournalDataQuality(trades.length),
    // Canonical deterministic blocks — the exact same numbers the journal
    // feature renders. Never model-authored, never recomputed here.
    performance: performance || buildJournalPerformance(currentAnalytics, risk),
    riskBlock: riskBlock || buildJournalRiskBlock(risk, patterns, trades),
    completeness: completeness || buildJournalCompleteness(trades),
    emotion: pickEmotion(emotion),
    current: {
      summary: pickSummary(currentAnalytics),
      analytics: pickAnalytics(currentAnalytics),
      discipline: pickDisciplineScore(disciplineScore),
      setupPerformance: pickSetupPerformance(setupPerformance),
      mistakeIntelligence: pickMistake(mistakeIntelligence),
      heatmap: pickHeatmap(heatmap),
      risk: pickRisk(risk),
      patterns: pickPatterns(patterns),
    },
    previous: {
      summary: pickSummary(previousAnalytics),
    },
    periodComparison: Array.isArray(canonicalComparison) ? canonicalComparison.slice(0, 12) : [],
    journalIntelligence: pickJournalObservations(journalIntelligence),
  };

  return freezeDeep(context);
}

// Optional pre-computed Sprint 9.3 journal observations (when supplied) are
// projected verbatim; coaching never re-runs the journal AI call itself.
function pickJournalObservations(journal) {
  if (!journal || typeof journal !== 'object') return {};
  const out = {};
  if (typeof journal.summary === 'string' && journal.summary.trim()) out.summary = journal.summary.trim();
  if (Array.isArray(journal.keyInsights) && journal.keyInsights.length) {
    out.keyInsights = journal.keyInsights.slice(0, 5).map((i) => ({
      title: i.title,
      observation: i.observation,
      evidence: i.evidence,
    }));
  }
  if (Array.isArray(journal.recurringIssues) && journal.recurringIssues.length) {
    out.recurringIssues = journal.recurringIssues.slice(0, 5).map((i) => ({
      title: i.title,
      observation: i.observation,
      evidence: i.evidence,
    }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Response sanitization (coaching contract) + forbidden-field enforcement.
// ---------------------------------------------------------------------------
export function sanitizeCoachingResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a non-object coaching response.');
  }

  const source = raw;
  const out = {
    summary: typeof source.summary === 'string' ? source.summary.trim() : '',
    focusAreas: toFocusList(source.focusAreas),
    strengths: toTextList(source.strengths),
    recurringPatterns: toObjectList(source.recurringPatterns, COACHING_PATTERN_SCHEMA),
    periodComparison: toComparisonList(source.periodComparison),
    actionPlan: toActionList(source.actionPlan),
    watchItems: toTextList(source.watchItems),
    limitations: toTextList(source.limitations),
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

function toStr(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

// Copies ONLY the allow-listed fields out of an item; anything else — buy/sell
// directives, signals, predictions, guarantees — is dropped by construction.
function toFocusList(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = {
      title: toStr(item.title),
      reason: toStr(item.reason),
      evidence: toStr(item.evidence),
      action: toStr(item.action),
    };
    const priority = normEnum(item.priority, COACHING_PRIORITIES);
    if (priority) row.priority = priority;
    const source = normEnum(item.source, COACHING_SOURCES);
    if (source) row.source = source;
    const conf = toConfidence(item.confidence);
    if (conf !== null) row.confidence = conf;
    if (row.title || row.reason || row.evidence || row.action) rows.push(row);
  });
  return rows.slice(0, 3); // Top 3 focus areas only.
}

function toObjectList(value, keys) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = {};
    keys.forEach((k) => {
      if (typeof item[k] === 'string' && item[k].trim()) row[k] = item[k].trim();
    });
    if (Object.keys(row).length) rows.push(row);
  });
  return rows;
}

function toComparisonList(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = {
      metric: toStr(item.metric),
      observation: toStr(item.observation),
    };
    const direction = normEnum(item.direction, COACHING_DIRECTIONS);
    row.direction = direction || 'INCONCLUSIVE';
    const current = Number(item.current);
    if (item.current !== null && item.current !== undefined && Number.isFinite(current)) row.current = current;
    const previous = Number(item.previous);
    if (item.previous !== null && item.previous !== undefined && Number.isFinite(previous)) row.previous = previous;
    const conf = toConfidence(item.confidence);
    if (conf !== null) row.confidence = conf;
    if (row.metric || row.observation) rows.push(row);
  });
  return rows.slice(0, 8);
}

function toActionList(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = {
      title: toStr(item.title),
      why: toStr(item.why),
      evidence: toStr(item.evidence),
      completionHint: toStr(item.completionHint),
    };
    const timeframe = normEnum(item.timeframe, COACHING_TIMEFRAMES);
    row.timeframe = timeframe || COACHING_TIMEFRAMES[1];
    row.measurable = item.measurable === true;
    if (row.title || row.why || row.evidence) rows.push(row);
  });
  return rows.slice(0, 5); // Max 5 actions.
}

function normEnum(value, allowed) {
  if (typeof value !== 'string') return null;
  const label = value.toUpperCase();
  if (allowed.includes(label)) return label;
  const clean = value.trim().toUpperCase().replace(/[^A-Z_]/g, '');
  return allowed.includes(clean) ? clean : null;
}

function rejectDirectiveText(out) {
  const text = [
    out.summary,
    ...out.strengths,
    ...out.watchItems,
    ...out.limitations,
    ...out.focusAreas.flatMap((f) => [f.title, f.reason, f.evidence, f.action]),
    ...out.recurringPatterns.flatMap((r) => [r.title, r.observation, r.evidence]),
    ...out.periodComparison.flatMap((c) => [c.metric, c.observation]),
    ...out.actionPlan.flatMap((a) => [a.title, a.why, a.evidence, a.completionHint]),
  ]
    .filter(Boolean)
    .join(' \n ');

  rejectDirectiveLanguage(text);
}

// Structural validation of an already-sanitized coaching response.
export function validateCoachingResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { ok: false, errors: ['Coaching AI response must be a single object.'], response: null };
  }
  const target = response;
  const errors = [];
  if (typeof target.summary !== 'string') errors.push('summary must be a string');
  COACHING_LIST_KEYS.forEach((k) => {
    if (target[k] !== undefined && !Array.isArray(target[k])) errors.push(`${k} must be an array`);
  });
  ['focusAreas', 'recurringPatterns', 'periodComparison', 'actionPlan'].forEach((k) => {
    if (target[k] !== undefined && !Array.isArray(target[k])) errors.push(`${k} must be an array`);
  });
  if (target.confidence !== undefined && target.confidence !== null && (typeof target.confidence !== 'number' || target.confidence < 0 || target.confidence > 1)) {
    errors.push('confidence must be a number between 0 and 1, or null');
  }
  if (target.disclaimer !== undefined && typeof target.disclaimer !== 'string') errors.push('disclaimer must be a string');
  return { ok: errors.length === 0, errors, response: target };
}

export function assertCoachingResponseContract(response) {
  const check = validateCoachingResponse(response);
  if (!check.ok) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a coaching response outside the allowed contract.');
  }
  return check.response;
}

// ---------------------------------------------------------------------------
// Orchestration — one read-only flow the UI wires to its Generate button.
// ---------------------------------------------------------------------------
export async function generateAICoaching({
  trades,
  accountId,
  accountName,
  horizon = COACHING_DEFAULT_HORIZON,
  pair = 'All',
  session = 'All',
  setup = 'All',
  provider,
  system = {},
  now,
} = {}) {
  // Account isolation is non-negotiable. A concrete account must be selected —
  // coaching never analyzes mixed-account data.
  if (typeof accountId !== 'string' || accountId === '') {
    return {
      ok: false,
      status: AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
      message: safeCoachingErrorMessage(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR),
      analysis: null,
    };
  }

  const periods = buildCoachingPeriods(horizon, now);
  const current = scopeCoachingTrades(trades, { ...periods.current, pair, session, setup });
  const previous = scopeCoachingTrades(trades, { ...periods.previous, pair, session, setup });
  const dataQuality = buildJournalDataQuality(current.length);

  // Small-sample gate before any provider contact.
  if (current.length === 0) {
    return {
      ok: false,
      status: AI_NOT_ENOUGH_DATA,
      message: safeCoachingErrorMessage(AI_NOT_ENOUGH_DATA),
      analysis: null,
    };
  }

  // Canonical analytics — reuse the verified engines only. No formula is
  // recomputed by the AI layer, and none is computed twice.
  let context;
  try {
    assertJournalAccountScope(current, accountId);
    assertJournalAccountScope(previous, accountId);

    const currentAnalytics = computeAnalytics(current);
    const previousAnalytics = previous.length ? computeAnalytics(previous) : null;
    const disciplineScore = computeDisciplineScore20(current, {
      models: system.models || [],
      riskCriteria: system.riskCriteria || [],
      checklistCriteria: system.checklistCriteria || [],
      reflections: system.reflections || [],
    });
    const prevDiscipline = previous.length
      ? computeDisciplineScore20(previous, {
          models: system.models || [],
          riskCriteria: system.riskCriteria || [],
          checklistCriteria: system.checklistCriteria || [],
          reflections: system.reflections || [],
        })
      : null;
    const heatmap = computePairSessionHeatmap(current, {});
    const mistakeIntelligence = computeMistakePattern(current, {});
    const setupPerformance = computeSetupPerformance(current, {});
    const risk = computeRiskAnalytics(current);
    const patterns = computePatternDetection(current, 'all');
    const emotion = computeEmotionAnalytics(current);
    const canonicalComparison = buildCanonicalComparison(currentAnalytics, previousAnalytics, disciplineScore, prevDiscipline);

    context = buildAICoachingContext({
      trades: current,
      accountId,
      accountName,
      currentScope: periods.current,
      previousScope: periods.previous,
      currentAnalytics,
      previousAnalytics,
      disciplineScore,
      setupPerformance,
      mistakeIntelligence,
      heatmap,
      risk,
      patterns,
      emotion,
      canonicalComparison,
      dataQuality,
    });
  } catch (err) {
    return toCoachingResult(err, { dataQuality });
  }

  const activeProvider = provider || createAIProvider();
  const request = {
    kind: AI_REQUEST_KIND_COACHING,
    systemInstruction: COACHING_INSTRUCTION,
    context,
    sanitize: sanitizeCoachingResponse,
  };

  try {
    const result = await activeProvider.analyze(request);
    return toCoachingResult(result, { dataQuality });
  } catch (err) {
    return toCoachingResult(toSafeAIError(err), { dataQuality });
  }
}

// ---------------------------------------------------------------------------
// Controlled result shaping — raw provider data never leaks to the UI.
// ---------------------------------------------------------------------------
export function toCoachingResult(input, canonical = {}) {
  if (input && typeof input === 'object' && typeof input.ok === 'boolean') {
    if (input.ok && input.analysis) {
      return {
        ok: true,
        status: input.status || 'ok',
        message: '',
        analysis: mergeCanonicalDataQuality(input.analysis, canonical),
      };
    }
    const code = input.status || AI_ERROR_CODES.AI_PROVIDER_ERROR;
    return {
      ok: false,
      status: code,
      message: safeCoachingErrorMessage(code),
      analysis: null,
    };
  }

  const code = input?.code && (AI_ERROR_CODES[input.code] || input.code === AI_NOT_ENOUGH_DATA) ? input.code : AI_ERROR_CODES.AI_PROVIDER_ERROR;
  return {
    ok: false,
    status: code,
    message: safeCoachingErrorMessage(code),
    analysis: null,
  };
}

// Data quality is a fact from the canonical scope — never let the model present
// its own trade count / coverage. Merge only the model's limitation notes.
function mergeCanonicalDataQuality(analysis, canonical) {
  const dq = canonical && canonical.dataQuality;
  if (!dq) return analysis;
  const limitations = Array.isArray(dq.limitations) ? [...dq.limitations] : [];
  const modelLimits = analysis?.limitations;
  if (Array.isArray(modelLimits)) {
    modelLimits.forEach((l) => {
      if (typeof l !== 'string') return;
      const s = l.trim();
      if (s && !limitations.includes(s)) limitations.push(s);
    });
  }
  return {
    ...analysis,
    limitations,
    dataQuality: { ...dq, limitations },
  };
}

// Safe, human-readable coaching messages — never provider internals.
export function safeCoachingErrorMessage(code) {
  switch (code) {
    case AI_NOT_ENOUGH_DATA:
      return 'Not enough trades in this period to run a meaningful coaching plan. Log more trades or switch to a wider horizon.';
    case AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR:
      return 'AI coaching is only available after selecting a single account. Your journal data was not changed.';
    case AI_ERROR_CODES.AI_NOT_CONFIGURED:
      return 'EdgeJournal AI is not configured yet. No journal data was sent to any provider.';
    case AI_ERROR_CODES.AI_RATE_LIMITED:
    case AI_ERROR_CODES.AI_TIMEOUT:
    case AI_ERROR_CODES.AI_UNAVAILABLE:
    case AI_ERROR_CODES.AI_PROVIDER_ERROR:
      return 'AI coaching is temporarily unavailable. Please try again later. Your journal data was not changed.';
    case AI_ERROR_CODES.AI_INVALID_RESPONSE:
      return 'AI coaching returned an unreadable response. Your journal data was not changed.';
    default:
      return 'AI coaching could not be completed. Your journal data was not changed.';
  }
}

// Convenience re-export of the canonical coverage classifier so the UI keeps a
// single source of truth for the coverage label (mirrors Sprint 9.3).
export { classifyDataCoverage, dataCoverageLabel, DATA_COVERAGE };