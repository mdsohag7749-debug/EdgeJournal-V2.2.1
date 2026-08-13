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

import { AIError } from './errors';
import { AI_ERROR_CODES, AI_DISCLAIMER } from './types';
import { createAIProvider } from './provider';
import { freezeDeep } from './safety';
import { computeAnalytics } from '../analytics';
import { applyPeriodFilter, computeSetupPerformance, UNASSIGNED_LABEL } from '../setupPerformance';
import { computePairSessionHeatmap, sessionKey } from '../heatmap';
import { computeMistakePattern } from '../mistakePattern';
import { computeDisciplineScore20 } from '../disciplineScore';
import { computeRiskAnalytics } from '../riskAnalytics';
import { computeEmotionAnalytics } from '../emotionAnalytics';
import { computePatternDetection } from '../patternDetection';

export const AI_REQUEST_KIND_JOURNAL_INTELLIGENCE = 'journalIntelligence';

// A journal-level state: too few trades to justify any AI analysis. Kept as a
// controlled code so consumers render one safe message for it without the
// provider ever being touched.
export const AI_NOT_ENOUGH_DATA = 'AI_NOT_ENOUGH_DATA';

// Small-sample guardrails (whole-journal scope). Per-setup/pair statuses still
// use the canonical engines' own "Limited data / Normal" guards (MIN_NORMAL=5),
// which are passed through verbatim — these thresholds are for the journal as
// a whole and never conflict with them.
export const DATA_LIMITED_MAX = 4;
export const DATA_EARLY_MAX = 9;
export const DATA_NORMAL_MIN = 10;

export const DATA_COVERAGE = {
  NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA', // 0 trades
  LIMITED_DATA: 'LIMITED_DATA', // 1-4
  EARLY_PATTERN: 'EARLY_PATTERN', // 5-9
  NORMAL_PATTERN_ANALYSIS: 'NORMAL_PATTERN_ANALYSIS', // 10+
};

// Hard cap on how many individual (already account-scoped) trade records may
// travel to the model for pattern interpretation. Aggregates are preferred;
// this exists only to ground qualitative observations.
export const AI_JOURNAL_MAX_RECENT_TRADES = 20;

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
  'keyInsights',
  'strengths',
  'recurringIssues',
  'setupInsights',
  'pairSessionInsights',
  'disciplineInsights',
  'improvementAreas',
  'watchlist',
  'dataQuality',
  'confidence',
  'disclaimer',
];

// Free-form list sections (arrays of strings).
export const JOURNAL_RESPONSE_LIST_KEYS = [
  'strengths',
  'setupInsights',
  'pairSessionInsights',
  'disciplineInsights',
  'improvementAreas',
  'watchlist',
];

// Object-list sections (keyInsights / recurringIssues) with the fields each
// item may carry.
export const JOURNAL_INSIGHT_SCHEMA = {
  keyInsights: ['title', 'observation', 'evidence', 'confidence'],
  recurringIssues: ['title', 'observation', 'evidence'],
};

// Strong directive / guarantee language that even a sanitized response must
// reject (never reaches the UI). Descriptive words ("entered early", "exit")
// are fine; explicit execution orders, signals and profit promises are not.
const DIRECTIVE_PATTERN =
  /\b(?:buy now|sell now|buy signal|sell signal|entry signal|exit signal|place a buy|place a sell|place buy|place sell|buy at|sell at|guaranteed profit|guarantee.? profit|guaranteed returns|price prediction|market prediction|predicted price|predicted profit|lot recommendation|recommended lot|increase your risk|decrease your risk|trade this signal|trade the signal|recommended entry|recommended exit|100% profit)\b/i;

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
  '  keyInsights: array of { title: string, observation: string, evidence: string, confidence?: number 0-1 }\n' +
  '  strengths: string[]\n' +
  '  recurringIssues: array of { title: string, observation: string, evidence: string }\n' +
  '  setupInsights: string[]\n' +
  '  pairSessionInsights: string[]\n' +
  '  disciplineInsights: string[]\n' +
  '  improvementAreas: string[]\n' +
  '  watchlist: string[]\n' +
  '  dataQuality: { tradeCount: number, coverage: string, limitations: string[] }\n' +
  '  confidence: number between 0 and 1 or null\n' +
  '  disclaimer: string\n'
);

// Sample-coverage classification for the whole analyzed scope.
export function classifyDataCoverage(tradeCount) {
  const n = Number(tradeCount);
  const count = Number.isFinite(n) ? n : 0;
  if (count <= 0) return DATA_COVERAGE.NOT_ENOUGH_DATA;
  if (count <= DATA_LIMITED_MAX) return DATA_COVERAGE.LIMITED_DATA;
  if (count <= DATA_EARLY_MAX) return DATA_COVERAGE.EARLY_PATTERN;
  return DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS;
}

export function dataCoverageLabel(coverage) {
  switch (coverage) {
    case DATA_COVERAGE.NOT_ENOUGH_DATA:
      return 'No data';
    case DATA_COVERAGE.LIMITED_DATA:
      return 'Limited data';
    case DATA_COVERAGE.EARLY_PATTERN:
      return 'Early pattern';
    case DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS:
      return 'Normal';
    default:
      return 'No data';
  }
}

// Canonical data-quality block for the analyzed scope. tradeCount and coverage
// are facts about the supplied dataset, never something the model decides.
export function buildJournalDataQuality(tradeCount, extraLimitations = []) {
  const count = Number.isFinite(Number(tradeCount)) ? Number(tradeCount) : 0;
  const coverage = classifyDataCoverage(count);
  const limitations = Array.isArray(extraLimitations) ? [...extraLimitations] : [];

  if (coverage === DATA_COVERAGE.NOT_ENOUGH_DATA) {
    limitations.push('No trades fall within the analyzed scope.');
  } else if (coverage === DATA_COVERAGE.LIMITED_DATA) {
    limitations.push(`Only ${count} trade${count === 1 ? '' : 's'} in this scope — conclusions carry limited confidence.`);
  } else if (coverage === DATA_COVERAGE.EARLY_PATTERN) {
    limitations.push(`Only ${count} trades in this scope — treat findings as early patterns, not proven edges.`);
  }
  if (coverage !== DATA_COVERAGE.NOT_ENOUGH_DATA) {
    limitations.push('Analysis is based only on recorded journal data and reflects what has already happened, not the future.');
  }

  return {
    tradeCount: count,
    coverage,
    label: dataCoverageLabel(coverage),
    limitations,
  };
}

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
// Account isolation — the cross-account guard for a whole scope.
// ---------------------------------------------------------------------------
export function assertJournalAccountScope(trades, accountId) {
  if (!Array.isArray(trades)) return;
  const required = typeof accountId === 'string' && accountId !== '' ? accountId : null;
  const present = new Set();
  trades.forEach((t) => {
    const ta = t && typeof t.accountId === 'string' && t.accountId !== '' ? t.accountId : null;
    if (ta) present.add(ta);
  });

  if (required) {
    if (present.size && !present.has(required)) {
      throw new AIError(
        AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
        'Account isolation: trades outside the requested account reached the journal AI context.',
        { detail: `expected=${required}` }
      );
    }
    if (present.size > 1) {
      throw new AIError(
        AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
        'Account isolation: a mix of accounts reached the journal AI context.',
        { detail: `expected=${required}, accounts=${[...present].join(',')}` }
      );
    }
    return;
  }
  if (present.size > 1) {
    throw new AIError(
      AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
      'Account isolation: a single requested account is required to build a journal AI context.',
      { detail: `accounts=${[...present].join(',')}` }
    );
  }
}

// ---------------------------------------------------------------------------
// Journal context builder — pure, deterministic, deeply frozen.
// All numbers arrive pre-computed from the canonical engines.
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
} = {}) {
  if (!Array.isArray(trades)) {
    throw new AIError(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, 'A trades array is required to build a journal AI context.');
  }
  assertJournalAccountScope(trades, accountId);

  // Deep-immune projection: only what the AI may see. Never the raw trade
  // rows, never user profile data, never credentials.
  const recent = collectRecentTrades(trades, AI_JOURNAL_MAX_RECENT_TRADES);

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
    if (v !== undefined && v !== null) out[k] = v;
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
      if (r[k] !== undefined && r[k] !== null) out[k] = r[k];
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
      bestTrade: num(s.bestTrade),
      worstTrade: num(s.worstTrade),
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
// Response sanitization (journal contract) + forbidden-field enforcement.
// ---------------------------------------------------------------------------
export function sanitizeJournalResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a non-object journal response.');
  }

  const source = raw;
  const out = {
    summary: typeof source.summary === 'string' ? source.summary.trim() : '',
    keyInsights: toInsightList(source.keyInsights, JOURNAL_INSIGHT_SCHEMA.keyInsights),
    strengths: toTextList(source.strengths),
    recurringIssues: toInsightList(source.recurringIssues, JOURNAL_INSIGHT_SCHEMA.recurringIssues),
    setupInsights: toTextList(source.setupInsights),
    pairSessionInsights: toTextList(source.pairSessionInsights),
    disciplineInsights: toTextList(source.disciplineInsights),
    improvementAreas: toTextList(source.improvementAreas),
    watchlist: toTextList(source.watchlist),
    // Structural hole for model limitation notes only. tradeCount / coverage
    // are recomputed from the canonical scope and override this in
    // mergeCanonicalDataQuality().
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

function rejectDirectiveText(out) {
  const text = [
    out.summary,
    ...out.strengths,
    ...out.setupInsights,
    ...out.pairSessionInsights,
    ...out.disciplineInsights,
    ...out.improvementAreas,
    ...out.watchlist,
    ...out.keyInsights.flatMap((i) => [i.title, i.observation, i.evidence]),
    ...out.recurringIssues.flatMap((i) => [i.title, i.observation, i.evidence]),
  ]
    .filter(Boolean)
    .join(' \n ');

  if (DIRECTIVE_PATTERN.test(text)) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned directive or guarantee language.');
  }
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
      dataQuality,
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
    return toJournalResult(result, { dataQuality });
  } catch (err) {
    return toJournalResult(err, { dataQuality });
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

// Data quality is a fact from the canonical scope — never let the model present
// its own trade count / coverage. Merge only the model's limitation notes.
function mergeCanonicalAnalysis(analysis, canonical) {
  const dq = canonical && canonical.dataQuality;
  if (!dq) return analysis;
  const limitations = Array.isArray(dq.limitations) ? [...dq.limitations] : [];
  const modelLimits = analysis?.dataQuality?.limitations;
  if (Array.isArray(modelLimits)) {
    modelLimits.forEach((l) => {
      if (typeof l !== 'string') return;
      const s = l.trim();
      if (s && !limitations.includes(s)) limitations.push(s);
    });
  }
  return {
    ...analysis,
    dataQuality: { ...dq, limitations },
  };
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