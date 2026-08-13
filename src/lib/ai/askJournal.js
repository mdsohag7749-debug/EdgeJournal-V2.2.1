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

import { AIError } from './errors';
import { AI_ERROR_CODES, AI_DISCLAIMER } from './types';
import { createAIProvider } from './provider';
import { freezeDeep } from './safety';
import {
  AI_JOURNAL_MAX_RECENT_TRADES,
  AI_NOT_ENOUGH_DATA,
  applyJournalScope,
  analyzedScopeLabel,
  assertJournalAccountScope,
  buildJournalDataQuality,
  classifyDataCoverage,
  createScopeFingerprint,
  DATA_COVERAGE,
  dataCoverageLabel,
  scopeLabel,
} from './journalIntelligence';
import { computeAnalytics } from '../analytics';
import { computeSetupPerformance } from '../setupPerformance';
import { computePairSessionHeatmap, sessionKey } from '../heatmap';
import { computeMistakePattern } from '../mistakePattern';
import { computeDisciplineScore20 } from '../disciplineScore';
import { computeRiskAnalytics } from '../riskAnalytics';
import { computeEmotionAnalytics } from '../emotionAnalytics';
import { computePatternDetection } from '../patternDetection';

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

// Directive / guarantee language that even a sanitized answer must reject.
// Descriptive words ("you bought EURUSD six times") are fine; explicit
// execution orders, directional commands, risk-sizing orders, profit promises
// and hard predictions are not.
export const ASK_JOURNAL_DIRECTIVE_PATTERN =
  /\b(?:buy now|sell now|buy signal|sell signal|entry signal|exit signal|place a buy|place a sell|place buy|place sell|buy at|sell at|go long|go short|long now|short now|take this trade|take the trade|take the position|trade this signal|trade the signal|recommended entry|recommended exit|guaranteed profit|guarantee.? profit|guaranteed returns|guaranteed outcome|guarantee.? outcome|100% profit|price prediction|market prediction|predicted price|predicted profit|next (week|session|month).? price|lot recommendation|recommended lot|increase your risk|decrease your risk|risk more|risk less|execute (this|the|a)? ?trade|automated trade|no.?risk|sure thing|guaranteed win)\b/i;

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

export { AI_NOT_ENOUGH_DATA, DATA_COVERAGE, dataCoverageLabel, scopeLabel, analyzedScopeLabel, applyJournalScope, createScopeFingerprint, assertJournalAccountScope, buildJournalDataQuality };

// ---------------------------------------------------------------------------
// Ask Journal context builder — pure, deterministic, deeply frozen.
// All numbers arrive pre-computed from the canonical engines.
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

  const recent = collectRecentTrades(trades, AI_JOURNAL_MAX_RECENT_TRADES);

  const context = {
    mode: 'askJournal',
    question: normalizeAskJournalQuestion(question),
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
    dataQuality: dataQuality || buildJournalDataQuality(trades.length),
    summary: pickSummary(analytics),
    analytics: pickAnalytics(analytics),
    setupPerformance: pickSetupPerformance(setupPerformance),
    heatmap: pickHeatmap(heatmap),
    mistakeIntelligence: pickMistake(mistakeIntelligence),
    disciplineScore: pickDisciplineScore(disciplineScore),
    risk: pickRisk(risk),
    emotion: pickEmotion(emotion),
    patterns: pickPatterns(patterns),
    recentTrades: recent,
  };

  return freezeDeep(context);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickSummary(a) {
  if (!a || typeof a !== 'object') return {};
  const out = {};
  const keys = ['total', 'wins', 'losses', 'breakevens', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor', 'bestTrade', 'worstTrade', 'currentWinStreak', 'currentLossStreak', 'longestWinStreak', 'tradingDays'];
  keys.forEach((k) => {
    const v = a[k];
    if (v !== undefined && v !== null && v !== Infinity) out[k] = v;
  });
  return out;
}

function pickAnalytics(a) {
  if (!a || typeof a !== 'object') return {};
  return {
    byPair: pickRows(a.byPair, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
    bySession: pickRows(a.bySession, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
    byStrategy: pickRows(a.byStrategy, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
  };
}

function pickRows(rows, keys) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 20).map((r) => {
    const out = {};
    keys.forEach((k) => {
      if (r[k] !== undefined && r[k] !== null && r[k] !== Infinity) out[k] = r[k];
    });
    return out;
  });
}

function pickSetupPerformance(setup) {
  if (!setup || !Array.isArray(setup.setups)) return { setups: [] };
  return {
    totalTrades: setup.totalTrades ?? 0,
    decidedCount: setup.decidedCount ?? 0,
    minNormal: setup.minNormal ?? 5,
    setups: setup.setups.slice(0, 12).map((s) => ({
      label: s.label,
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      decided: s.decided,
      winRate: num(s.winRate),
      avgRR: num(s.avgRR),
      netPnl: num(s.netPnl),
      avgPnl: num(s.avgPnl),
      avgWin: num(s.avgWin),
      avgLoss: num(s.avgLoss),
      profitFactor: s.profitFactor === Infinity ? 'Infinite' : num(s.profitFactor),
      status: s.status,
    })),
  };
}

function pickHeatmap(h) {
  if (!h || !Array.isArray(h.rows)) return {};
  const cells = [];
  h.rows.forEach((row) => {
    if (!Array.isArray(row.cells)) return;
    row.cells.forEach((c) => {
      if (!c || c.decided === 0) return;
      cells.push({
        pair: c.pair,
        session: c.session,
        trades: c.trades,
        decided: c.decided,
        winRate: num(c.winRate),
        netPnl: num(c.netPnl),
        avgRR: num(c.avgRR),
        status: c.status,
      });
    });
  });
  cells.sort((x, y) => y.trades - x.trades || (x.pair || '').localeCompare(y.pair || ''));
  return { cells: cells.slice(0, 20) };
}

function pickMistake(m) {
  if (!m || !Array.isArray(m.rows)) return {};
  return {
    affectedTradeCount: m.affectedTradeCount ?? 0,
    totalOccurrences: m.totalOccurrences ?? 0,
    patterns: m.rows.slice(0, 10).map((r) => ({
      name: r.name,
      occurrences: r.occurrences,
      affectedTrades: r.affectedTrades,
      wins: r.wins,
      losses: r.losses,
      winRate: num(r.winRate),
      netPnl: num(r.netPnl),
      avgPnl: num(r.avgPnl),
      status: r.status,
      setups: pickContext(r.setups),
      pairs: pickContext(r.pairs),
      sessions: pickContext(r.sessions),
    })),
    insights: Array.isArray(m.insights) ? m.insights.slice(0, 5) : [],
  };
}

function pickContext(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 5).map((c) => ({ label: c.label, count: c.count }));
}

function pickDisciplineScore(d) {
  if (!d || typeof d !== 'object') return {};
  return {
    score: d.score !== undefined && d.score !== null ? d.score : null,
    coveragePct: d.coveragePct ?? 0,
    band: d.band ? { label: d.band.label, min: d.band.min, max: d.band.max } : null,
    components: Array.isArray(d.components)
      ? d.components.map((c) => ({ key: c.key, label: c.label, weight: c.weight, score: c.score, available: c.available, note: c.note }))
      : [],
    improvements: Array.isArray(d.improvements) ? d.improvements.slice(0, 6) : [],
  };
}

function pickRisk(r) {
  if (!r || typeof r !== 'object') return {};
  return {
    avgRiskPct: num(r.avgRiskPct),
    avgRewardPct: num(r.avgRewardPct),
    longestWinStreak: r.longestWinStreak ?? 0,
    longestLossStreak: r.longestLossStreak ?? 0,
    maxDrawdown: num(r.maxDrawdown),
    currentDrawdown: num(r.currentDrawdown),
    averageDrawdown: num(r.averageDrawdown),
    recoveryDays: num(r.recoveryDays),
  };
}

function pickEmotion(e) {
  if (!e || typeof e !== 'object') return {};
  return {
    total: e.total ?? 0,
    mostCommonEmotion: e.mostCommonEmotion ? { key: e.mostCommonEmotion.key, avg: num(e.mostCommonEmotion.avg), tone: e.mostCommonEmotion.tone } : null,
    avgConfidence: num(e.avgConfidence),
    avgFocus: num(e.avgFocus),
    avgPatience: num(e.avgPatience),
    fomoFreq: num(e.fomoFreq),
    stressFreq: num(e.stressFreq),
  };
}

function pickPatterns(p) {
  if (!p || !Array.isArray(p.patterns)) return {};
  return {
    decidedCount: p.decidedCount ?? 0,
    patterns: p.patterns.slice(0, 10).map((x) => ({
      category: x.category,
      title: x.title,
      detail: x.detail,
      observations: x.observations,
      strength: x.strength,
      confidence: x.confidence,
    })),
  };
}

// Deterministically ordered, capped, projected subset of the most recent trade
// records (in the analyzed scope) for pattern grounding. Only analysis fields
// travel; secrets / profile data / user ids never cross this border.
function collectRecentTrades(list, cap) {
  if (!Array.isArray(list)) return [];
  const sorted = [...list]
    .filter((t) => t && typeof t === 'object')
    .sort((a, b) => (b.date + (b.entryTime || '')).localeCompare(a.date + (a.entryTime || '')) || String(b.id || '').localeCompare(String(a.id || '')));
  return sorted.slice(0, cap).map(projectTrade);
}

function projectTrade(t) {
  const out = {};
  if (typeof t.id === 'string' && t.id) out.id = t.id;
  if (t.date) out.date = t.date;
  if (t.instrument) out.instrument = t.instrument;
  if (t.direction) out.direction = t.direction;
  if (t.session) out.session = t.session;
  if (t.timeframe) out.timeframe = t.timeframe;
  if (typeof t.model === 'string' && t.model.trim()) out.setup = t.model.trim();
  if (t.result) out.result = t.result;
  const pnl = num(t.netPnl);
  if (pnl !== null) out.pnl = pnl;
  const rr = num(t.rr);
  if (rr !== null) out.rr = rr;
  const risk = num(t.riskPercent);
  if (risk !== null) out.riskPercent = risk;
  if (t.tradeGrade) out.tradeGrade = t.tradeGrade;
  if (typeof t.emotion === 'string' && t.emotion) out.emotion = t.emotion;
  if (t.mistakes && typeof t.mistakes === 'object') {
    const names = Object.keys(t.mistakes).filter((k) => t.mistakes[k]);
    if (names.length) out.mistakes = names;
  }
  return out;
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

  if (ASK_JOURNAL_DIRECTIVE_PATTERN.test(text)) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned directive or guarantee language.');
  }
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