// EdgeJournal AI — canonical journal intelligence context.
//
// Sprint 9.3 audit follow-up (P1): the SINGLE SOURCE OF TRUTH for the
// deterministic, model-safe context every journal-level AI feature consumes.
// Journal Intelligence (9.3), Coaching (9.4) and Ask Journal (9.5) all build
// their prompts from the exact same canonical blocks and projections defined
// here — no feature may recompute a metric or re-implement a projection.
//
// Dependency direction (no circular imports):
//   canonicalContext → safety.js / errors.js / types.js / verified engines
//   journalIntelligence / coaching / askJournal → canonicalContext
//
// What lives here:
//   1. Data-coverage constants + classification (the small-sample guardrails).
//   2. Deterministic intelligence blocks — performance, risk, completeness,
//      data quality. Computed BEFORE any provider contact; the model only
//      interprets them and the UI renders these exact numbers regardless of
//      what the model returns. No value here is ever model-authored.
//   3. Deep-immune projections — only what the AI may see. Never the raw
//      trade rows, never user profile data, never credentials.
//   4. The account-scope guard every journal context relies on.
//   5. buildCanonicalJournalContext() — assembles the canonical data block
//      (dataQuality / performance / risk / completeness / summary / analytics /
//      setupPerformance / heatmap / mistakeIntelligence / disciplineScore /
//      emotion / patterns / recentTrades) used verbatim by the features.
//   6. classifyJournalQuestionIntent() — the small heuristic that decides
//      whether a free-form Ask Journal question needs the canonical blocks.

import { AIError } from './errors.js';
import { AI_ERROR_CODES } from './types.js';
import { freezeDeep } from './safety.js';

// Hard cap on how many individual (already account-scoped) trade records may
// travel to the model for pattern interpretation. Aggregates are preferred;
// this exists only to ground qualitative observations.
export const AI_JOURNAL_MAX_RECENT_TRADES = 20;

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
// Deterministic intelligence blocks — computed BEFORE any provider contact.
// These are canonical facts from the verified engines; the model only
// interprets them, and the UI renders these exact numbers regardless of what
// the model returns. No value here is ever model-authored.
// ---------------------------------------------------------------------------

export function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Deterministic Performance section: the requested performance metrics taken
// straight from the canonical analytics engine (+ risk for the longest losing
// streak, which the analytics engine does not produce).
export function buildJournalPerformance(analytics, risk) {
  const a = analytics && typeof analytics === 'object' ? analytics : {};
  const r = risk && typeof risk === 'object' ? risk : {};
  const pf = a.profitFactor;
  return freezeDeep({
    total: numOrNull(a.total),
    wins: numOrNull(a.wins),
    losses: numOrNull(a.losses),
    breakevens: numOrNull(a.breakevens),
    winRate: numOrNull(a.winRate),
    netPnl: numOrNull(a.netPnl),
    avgRR: numOrNull(a.avgRR),
    avgWin: numOrNull(a.avgWin),
    avgLoss: numOrNull(a.avgLoss),
    profitFactor: pf === Infinity ? null : numOrNull(pf),
    bestTrade: numOrNull(a.bestTrade),
    worstTrade: numOrNull(a.worstTrade),
    currentWinStreak: numOrNull(a.currentWinStreak),
    currentLossStreak: numOrNull(a.currentLossStreak),
    longestWinStreak: numOrNull(a.longestWinStreak),
    longestLossStreak: numOrNull(r.longestLossStreak),
    tradingDays: numOrNull(a.tradingDays),
  });
}

// Deterministic Risk section: canonical risk metrics + risk-band distribution +
// position-sizing consistency (coefficient of variation) + escalation-after-loss
// (from the pattern engine) + over-risking counts + discipline flags. All
// numbers are canonical; only the flags are judgement phrases on canonical data.
export function buildJournalRiskBlock(risk, patterns, trades) {
  const r = risk && typeof risk === 'object' ? risk : {};
  const p = patterns && typeof patterns === 'object' ? patterns : {};
  const list = Array.isArray(trades) ? trades : [];

  const riskPcts = list.map((t) => Number(t.riskPercent)).filter((v) => Number.isFinite(v) && v > 0);
  const sizing =
    riskPcts.length > 0
      ? (() => {
          const avg = riskPcts.reduce((s, v) => s + v, 0) / riskPcts.length;
          const variance = riskPcts.reduce((s, v) => s + (v - avg) ** 2, 0) / riskPcts.length;
          const stdDev = Math.sqrt(variance);
          return {
            count: riskPcts.length,
            avg: Number(avg.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            cv: avg > 0 ? Number(((stdDev / avg) * 100).toFixed(1)) : null,
          };
        })()
      : { count: 0, avg: null, stdDev: null, cv: null };

  const overRisking = list.filter((t) => Number(t.riskPercent) >= 3).length;

  const flags = [];
  if (sizing.avg !== null && sizing.avg >= 2) flags.push('Average risk per trade is at or above 2%.');
  if (sizing.cv !== null && sizing.cv > 50) flags.push('Position sizing is inconsistent across trades — risk % varies widely.');
  if (p.riskAfterLossStreak !== null && p.riskAfterLossStreak !== undefined && p.baseline && Number(p.baseline.avgRisk) > 0 && p.riskAfterLossStreak > Number(p.baseline.avgRisk) * 1.15) {
    flags.push('Risk tends to increase on the trade right after a losing streak.');
  }
  if (overRisking > 0) flags.push(`${overRisking} trade${overRisking === 1 ? '' : 's'} logged at 3%+ risk.`);
  const longestLoss = numOrNull(r.longestLossStreak);
  if (longestLoss !== null && longestLoss >= 4) flags.push(`Longest losing streak reached ${longestLoss} trades.`);

  return freezeDeep({
    avgRiskPct: numOrNull(r.avgRiskPct),
    avgRewardPct: numOrNull(r.avgRewardPct),
    longestWinStreak: numOrNull(r.longestWinStreak),
    longestLossStreak: numOrNull(r.longestLossStreak),
    maxDrawdown: numOrNull(r.maxDrawdown),
    currentDrawdown: numOrNull(r.currentDrawdown),
    averageDrawdown: numOrNull(r.averageDrawdown),
    recoveryDays: numOrNull(r.recoveryDays),
    distribution: Array.isArray(r.distribution) ? r.distribution.slice(0, 6) : [],
    winRateByRisk: Array.isArray(r.winRateByRisk) ? r.winRateByRisk.slice(0, 6) : [],
    sizing,
    riskEscalation: {
      riskAfterLossStreak: numOrNull(p.riskAfterLossStreak),
      riskAfterWinStreak: numOrNull(p.riskAfterWinStreak),
      lossStreakCount: numOrNull(p.lossStreakCount),
      winStreakCount: numOrNull(p.winStreakCount),
    },
    overRisking,
    flags,
  });
}

// Deterministic data-completeness report for the analyzed scope: how many
// trades are missing the fields that ground specific conclusions, plus a count
// of result/P&L values that look internally inconsistent.
export function buildJournalCompleteness(trades) {
  const list = Array.isArray(trades) ? trades : [];
  const total = list.length;
  const missingField = (pred) => list.filter((t) => pred(t)).length;
  const missing = {
    netPnl: missingField((t) => t.netPnl === undefined || t.netPnl === null || t.netPnl === ''),
    rr: missingField((t) => t.rr === undefined || t.rr === null || t.rr === ''),
    riskPercent: missingField((t) => t.riskPercent === undefined || t.riskPercent === null || t.riskPercent === ''),
    result: missingField((t) => !t.result),
    session: missingField((t) => !t.session && !t.entryTime),
    setup: missingField((t) => !t.model),
    notes: missingField((t) => !t.notes && !t.lessonsLearned),
    psychology: missingField((t) => !t.psychology || typeof t.psychology !== 'object'),
  };
  const inconsistencyCount = list.filter((t) => (t.result === 'Win' ? Number(t.netPnl) <= 0 : t.result === 'Loss' ? Number(t.netPnl) >= 0 : false)).length;
  return freezeDeep({ total, missing, inconsistencyCount });
}

// Human-readable data-quality limitation notes derived from the completeness
// report — merged into the canonical dataQuality.limitations before the model
// sees them, so the AI cannot hide missing-data caveats.
export function buildCompletenessLimitations(completeness) {
  const c = completeness && typeof completeness === 'object' ? completeness : {};
  const m = c.missing || {};
  const out = [];
  const add = (count, msg) => {
    if (Number.isFinite(count) && count > 0) out.push(msg);
  };
  add(m.netPnl, `${m.netPnl} trade${m.netPnl === 1 ? '' : 's'} in this scope have no net P&L recorded.`);
  add(m.rr, `${m.rr} trade${m.rr === 1 ? '' : 's'} in this scope have no R:R recorded.`);
  add(m.riskPercent, `${m.riskPercent} trade${m.riskPercent === 1 ? '' : 's'} in this scope have no risk % recorded.`);
  add(m.notes, `${m.notes} trade${m.notes === 1 ? '' : 's'} in this scope have no notes or reflections recorded.`);
  add(m.psychology, `${m.psychology} trade${m.psychology === 1 ? '' : 's'} in this scope have no psychology ratings recorded.`);
  if (Number.isFinite(c.inconsistencyCount) && c.inconsistencyCount > 0) {
    out.push(`${c.inconsistencyCount} trade${c.inconsistencyCount === 1 ? '' : 's'} have a result that conflicts with the recorded net P&L.`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deep-immune projections — only what the AI may see. Never the raw trade
// rows, never user profile data, never credentials.
// ---------------------------------------------------------------------------

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pickSummary(a) {
  if (!a || typeof a !== 'object') return {};
  const out = {};
  const keys = ['total', 'wins', 'losses', 'breakevens', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor', 'bestTrade', 'worstTrade', 'currentWinStreak', 'currentLossStreak', 'longestWinStreak', 'tradingDays'];
  keys.forEach((k) => {
    const v = a[k];
    if (v !== undefined && v !== null) out[k] = v;
  });
  return out;
}

export function pickAnalytics(a) {
  if (!a || typeof a !== 'object') return {};
  return {
    byPair: pickRows(a.byPair, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
    bySession: pickRows(a.bySession, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
    byStrategy: pickRows(a.byStrategy, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
    byDirection: pickRows(a.byDirection, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
    byTimeframe: pickRows(a.byTimeframe, ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor']),
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

export function pickSetupPerformance(setup) {
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

export function pickHeatmap(h) {
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

export function pickMistake(m) {
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

// Canonical discipline projection. Includes the weekly / monthly trend trail
// the discipline engine produces so Coaching, Ask and Journal all describe
// discipline the same way (never re-calculated).
export function pickDisciplineScore(d) {
  if (!d || typeof d !== 'object') return {};
  return {
    score: d.score !== undefined && d.score !== null ? d.score : null,
    coveragePct: d.coveragePct ?? 0,
    band: d.band ? { label: d.band.label, min: d.band.min, max: d.band.max } : null,
    components: Array.isArray(d.components)
      ? d.components.map((c) => ({ key: c.key, label: c.label, weight: c.weight, score: c.score, available: c.available, note: c.note }))
      : [],
    improvements: Array.isArray(d.improvements) ? d.improvements.slice(0, 6) : [],
    weekly: Array.isArray(d.weekly) ? d.weekly.slice(-3) : [],
    monthly: Array.isArray(d.monthly) ? d.monthly.slice(-3) : [],
    hasTrend: !!d.hasTrend,
  };
}

// Richer journal-level emotion projection (fear/greed/FOMO/stress frequencies
// + per-emotion rows). Ask/Coaching share this same canonical shape.
export function pickEmotion(e) {
  if (!e || typeof e !== 'object') return {};
  return {
    total: e.total ?? 0,
    mostCommonEmotion: e.mostCommonEmotion ? { key: e.mostCommonEmotion.key, avg: num(e.mostCommonEmotion.avg), tone: e.mostCommonEmotion.tone } : null,
    avgConfidence: num(e.avgConfidence),
    avgFocus: num(e.avgFocus),
    avgPatience: num(e.avgPatience),
    fearFreq: num(e.fearFreq),
    greedFreq: num(e.greedFreq),
    fomoFreq: num(e.fomoFreq),
    stressFreq: num(e.stressFreq),
    perEmotion: Array.isArray(e.perEmotion) ? e.perEmotion.slice(0, 8) : [],
  };
}

// Lightweight risk projection used inside feature contexts for the raw risk
// metrics (streaks default to 0 like the legacy widgets). The authoritative
// risk block for decision groundings is buildJournalRiskBlock().
export function pickRisk(r) {
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

export function pickPatterns(p) {
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
export function collectRecentTrades(list, cap) {
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
// Canonical context builder — pure, deterministic, deeply frozen.
// The account-scoped feature builders spread this block into their own
// wrapper (account / scope / mode) and re-freeze it. All numbers arrive
// pre-computed from the canonical engines.
// ---------------------------------------------------------------------------
export function buildCanonicalJournalContext({
  trades = [],
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
} = {}) {
  if (!Array.isArray(trades)) {
    throw new AIError(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, 'A trades array is required to build a canonical journal context.');
  }
  assertJournalAccountScope(trades, accountId);

  // Deep-immune projection: only what the AI may see. Never the raw trade
  // rows, never user profile data, never credentials.
  const recent = collectRecentTrades(trades, AI_JOURNAL_MAX_RECENT_TRADES);

  const perf = performance || buildJournalPerformance(analytics, risk);
  const riskOut = riskBlock || buildJournalRiskBlock(risk, patterns, trades);
  const complete = completeness || buildJournalCompleteness(trades);

  return freezeDeep({
    dataQuality: dataQuality || buildJournalDataQuality(trades.length),
    performance: perf,
    risk: riskOut,
    completeness: complete,
    summary: pickSummary(analytics),
    analytics: pickAnalytics(analytics),
    setupPerformance: pickSetupPerformance(setupPerformance),
    heatmap: pickHeatmap(heatmap),
    mistakeIntelligence: pickMistake(mistakeIntelligence),
    disciplineScore: pickDisciplineScore(disciplineScore),
    emotion: pickEmotion(emotion),
    patterns: pickPatterns(patterns),
    recentTrades: recent,
  });
}

// ---------------------------------------------------------------------------
// Ask Journal question intent classifier — the small, focused heuristic that
// decides whether a free-form question needs the canonical intelligence blocks.
//
// A question about MEASURABLE performance ("How is my win rate this month?",
// "Which pair is best?", "Am I over-risking?") gets the full canonical blocks
// so the answer is grounded in the exact same deterministic numbers the
// journal and coaching features use. A purely qualitative question ("How do I
// feel after losses?", "Help me with trading psychology") avoids that
// unnecessary context. This is intentionally NOT a machine-learning model —
// just a stable keyword heuristic.
// ---------------------------------------------------------------------------

const MEASURABLE_QUESTION_TERMS = [
  'win rate', 'winrate', 'profit factor', 'pnl', 'profit', 'loss', 'losses', 'risk', 'drawdown',
  'streak', 'session', 'pair', 'setup', 'strategy', 'timeframe', 'direction', 'average', 'avg',
  'performance', 'perform', 'how many', 'how much', 'percent', '%', 'most', 'best', 'compare',
  'comparison', 'improve', 'improvement', 'discipline', 'sizing', 'overtrade', 'frequency',
  'which', 'what', 'when', 'consistent', 'consistency', 'lot size',
];

const QUALITATIVE_QUESTION_TERMS = [
  'emotion', 'feeling', 'feel', 'psychology', 'mindset', 'fear', 'greed', 'stress', 'bias',
  'fomo', 'anxiety', 'anxious', 'nervous', 'overthink', 'regret', 'reflect', 'reflection',
  'mentality', 'mental', 'patience', 'reaction', 'confidence',
];

export function classifyJournalQuestionIntent(question) {
  const q = (typeof question === 'string' ? question : '').toLowerCase().trim();
  if (!q) return 'qualitative';
  const hit = (terms) => terms.some((term) => q.includes(term));
  if (hit(QUALITATIVE_QUESTION_TERMS)) return 'qualitative';
  if (hit(MEASURABLE_QUESTION_TERMS)) return 'performance';
  // Default to supplying the canonical blocks: the analyzer grounds better
  // with data than without, and the blocks are read-only context.
  return 'performance';
}
