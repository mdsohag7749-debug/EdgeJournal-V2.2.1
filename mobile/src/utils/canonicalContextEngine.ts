// Mobile Canonical Journal AI Context Engine
// TypeScript port of src/lib/ai/canonicalContext.js
//
// This is the SINGLE SOURCE OF TRUTH for the deterministic, model-safe context
// every journal-level AI feature on mobile consumes. Journal Intelligence,
// Coaching, Ask Journal, and Trade Review all build their payloads from the
// same canonical blocks defined here — no feature may recompute a metric.
//
// All numbers arrive pre-computed from the existing mobile engines:
//   analyticsEngine → performance / summary / analytics
//   heatmapEngine   → heatmap
//   psychologyEngine → emotion / mistakeIntelligence / disciplineScore
//   recommendationsEngine → patterns
//
// Dependency direction (no circular imports):
//   canonicalContextEngine → analyticsEngine / heatmapEngine / psychologyEngine
//   edgeAiService / EdgeAIScreen → canonicalContextEngine

import { Trade } from '../types/models';
import { computeDetailedAnalytics, DetailedAnalytics } from './analyticsEngine';
import { computePairSessionHeatmap, HeatmapResult } from './heatmapEngine';
import {
  computeEmotionAnalytics,
  computeMistakePattern,
  computeDisciplineScore,
  EmotionAnalyticsResult,
  MistakePatternResult,
} from './psychologyEngine';
import { computeRecommendations } from './recommendationsEngine';
import { freezeDeep } from './aiSafety';

// Local result type alias for discipline score (engine returns inline object)
type DisciplineScoreResult = ReturnType<typeof computeDisciplineScore>;

// ---------------------------------------------------------------------------
// Data coverage constants — exact parity with web canonicalContext.js
// ---------------------------------------------------------------------------
export const AI_JOURNAL_MAX_RECENT_TRADES = 20;

export const DATA_LIMITED_MAX = 4;
export const DATA_EARLY_MAX = 9;
export const DATA_NORMAL_MIN = 10;

export const DATA_COVERAGE = {
  NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA',
  LIMITED_DATA: 'LIMITED_DATA',
  EARLY_PATTERN: 'EARLY_PATTERN',
  NORMAL_PATTERN_ANALYSIS: 'NORMAL_PATTERN_ANALYSIS',
} as const;

export type DataCoverage = (typeof DATA_COVERAGE)[keyof typeof DATA_COVERAGE];

export function classifyDataCoverage(tradeCount: number): DataCoverage {
  const count = Number.isFinite(tradeCount) ? tradeCount : 0;
  if (count <= 0) return DATA_COVERAGE.NOT_ENOUGH_DATA;
  if (count <= DATA_LIMITED_MAX) return DATA_COVERAGE.LIMITED_DATA;
  if (count <= DATA_EARLY_MAX) return DATA_COVERAGE.EARLY_PATTERN;
  return DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS;
}

export function dataCoverageLabel(coverage: DataCoverage): string {
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

export interface AIDataQuality {
  tradeCount: number;
  coverage: DataCoverage;
  label: string;
  limitations: string[];
}

export function buildJournalDataQuality(tradeCount: number, extraLimitations: string[] = []): AIDataQuality {
  const count = Number.isFinite(Number(tradeCount)) ? Number(tradeCount) : 0;
  const coverage = classifyDataCoverage(count);
  const limitations: string[] = Array.isArray(extraLimitations) ? [...extraLimitations] : [];

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

  return { tradeCount: count, coverage, label: dataCoverageLabel(coverage), limitations };
}

// ---------------------------------------------------------------------------
// Account isolation guard — mirrors web assertJournalAccountScope()
// ---------------------------------------------------------------------------
export function assertJournalAccountScope(trades: Trade[], accountId?: string | null): void {
  if (!Array.isArray(trades)) return;
  const required = typeof accountId === 'string' && accountId !== '' ? accountId : null;
  const present = new Set<string>();
  trades.forEach((t) => {
    const ta = t && typeof (t as any).accountId === 'string' && (t as any).accountId !== ''
      ? (t as any).accountId
      : null;
    if (ta) present.add(ta);
  });

  if (required) {
    if (present.size && !present.has(required)) {
      throw new Error(
        'AI_ACCOUNT_SCOPE_ERROR: Account isolation — trades outside the requested account reached the journal AI context.'
      );
    }
    if (present.size > 1) {
      throw new Error(
        'AI_ACCOUNT_SCOPE_ERROR: Account isolation — a mix of accounts reached the journal AI context.'
      );
    }
    return;
  }
  if (present.size > 1) {
    throw new Error(
      'AI_ACCOUNT_SCOPE_ERROR: Account isolation — a single requested account is required to build a journal AI context.'
    );
  }
}

// ---------------------------------------------------------------------------
// Numeric helper (mirrors web numOrNull)
// ---------------------------------------------------------------------------
export function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Deterministic performance block — mirrors web buildJournalPerformance()
// ---------------------------------------------------------------------------
export interface AIPerformanceBlock {
  total: number | null;
  wins: number | null;
  losses: number | null;
  breakevens: number | null;
  winRate: number | null;
  netPnl: number | null;
  avgRR: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  currentWinStreak: number | null;
  currentLossStreak: number | null;
  longestWinStreak: number | null;
  longestLossStreak: number | null;
  tradingDays: number | null;
}

export function buildJournalPerformance(analytics: Partial<DetailedAnalytics> | null, risk: AIRiskLite | null = null): Readonly<AIPerformanceBlock> {
  const a = analytics && typeof analytics === 'object' ? analytics : {} as Partial<DetailedAnalytics>;
  const r = risk && typeof risk === 'object' ? risk : {} as AIRiskLite;
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
    profitFactor: pf === Infinity || pf === undefined ? null : numOrNull(pf),
    bestTrade: numOrNull(a.bestTrade),
    worstTrade: numOrNull(a.worstTrade),
    currentWinStreak: numOrNull(a.currentWinStreak),
    currentLossStreak: numOrNull(a.currentLossStreak),
    longestWinStreak: numOrNull(a.longestWinStreak),
    longestLossStreak: numOrNull((r as any).longestLossStreak),
    tradingDays: numOrNull(a.tradingDays),
  });
}

// ---------------------------------------------------------------------------
// Risk lite (from analytics, not a separate risk engine on mobile)
// ---------------------------------------------------------------------------
interface AIRiskLite {
  avgRiskPct?: number | null;
  avgRewardPct?: number | null;
  longestWinStreak?: number | null;
  longestLossStreak?: number | null;
  maxDrawdown?: number | null;
  currentDrawdown?: number | null;
  averageDrawdown?: number | null;
  recoveryDays?: number | null;
  distribution?: unknown[];
  winRateByRisk?: unknown[];
}

// ---------------------------------------------------------------------------
// Risk block — mirrors web buildJournalRiskBlock()
// ---------------------------------------------------------------------------
export interface AIRiskBlock {
  avgRiskPct: number | null;
  avgRewardPct: number | null;
  longestWinStreak: number | null;
  longestLossStreak: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  averageDrawdown: number | null;
  recoveryDays: number | null;
  distribution: unknown[];
  winRateByRisk: unknown[];
  sizing: {
    count: number;
    avg: number | null;
    stdDev: number | null;
    cv: number | null;
  };
  riskEscalation: {
    riskAfterLossStreak: number | null;
    riskAfterWinStreak: number | null;
    lossStreakCount: number | null;
    winStreakCount: number | null;
  };
  overRisking: number;
  flags: string[];
}

export function buildJournalRiskBlock(
  risk: AIRiskLite | null,
  patterns: Record<string, unknown> | null,
  trades: Trade[]
): Readonly<AIRiskBlock> {
  const r = risk && typeof risk === 'object' ? risk : {} as AIRiskLite;
  const p = patterns && typeof patterns === 'object' ? patterns : {};
  const list = Array.isArray(trades) ? trades : [];

  const riskPcts = list
    .map((t) => Number((t as any).riskPercent))
    .filter((v) => Number.isFinite(v) && v > 0);

  let sizing: AIRiskBlock['sizing'];
  if (riskPcts.length > 0) {
    const avg = riskPcts.reduce((s, v) => s + v, 0) / riskPcts.length;
    const variance = riskPcts.reduce((s, v) => s + (v - avg) ** 2, 0) / riskPcts.length;
    const stdDev = Math.sqrt(variance);
    sizing = {
      count: riskPcts.length,
      avg: Number(avg.toFixed(2)),
      stdDev: Number(stdDev.toFixed(2)),
      cv: avg > 0 ? Number(((stdDev / avg) * 100).toFixed(1)) : null,
    };
  } else {
    sizing = { count: 0, avg: null, stdDev: null, cv: null };
  }

  const overRisking = list.filter((t) => Number((t as any).riskPercent) >= 3).length;

  const flags: string[] = [];
  if (sizing.avg !== null && sizing.avg >= 2) flags.push('Average risk per trade is at or above 2%.');
  if (sizing.cv !== null && sizing.cv > 50) flags.push('Position sizing is inconsistent across trades — risk % varies widely.');
  const ral = (p as any).riskAfterLossStreak;
  const baseAvgRisk = (p as any).baseline?.avgRisk;
  if (ral !== null && ral !== undefined && baseAvgRisk && Number(baseAvgRisk) > 0 && ral > Number(baseAvgRisk) * 1.15) {
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
      riskAfterLossStreak: numOrNull((p as any).riskAfterLossStreak),
      riskAfterWinStreak: numOrNull((p as any).riskAfterWinStreak),
      lossStreakCount: numOrNull((p as any).lossStreakCount),
      winStreakCount: numOrNull((p as any).winStreakCount),
    },
    overRisking,
    flags,
  });
}

// ---------------------------------------------------------------------------
// Completeness — mirrors web buildJournalCompleteness()
// ---------------------------------------------------------------------------
export interface AICompleteness {
  total: number;
  missing: {
    netPnl: number;
    rr: number;
    riskPercent: number;
    result: number;
    session: number;
    setup: number;
    notes: number;
    psychology: number;
  };
  inconsistencyCount: number;
}

export function buildJournalCompleteness(trades: Trade[]): Readonly<AICompleteness> {
  const list = Array.isArray(trades) ? trades : [];
  const total = list.length;
  const missingField = (pred: (t: Trade) => boolean) => list.filter(pred).length;
  const missing = {
    netPnl: missingField((t) => {
      const p = (t as any).netPnl ?? (t as any).pnl;
      return p === undefined || p === null || p === '';
    }),
    rr: missingField((t) => {
      const r = (t as any).rr ?? (t as any).riskRewardRatio;
      return r === undefined || r === null || r === '';
    }),
    riskPercent: missingField((t) => {
      const rp = (t as any).riskPercent;
      return rp === undefined || rp === null || rp === '';
    }),
    result: missingField((t) => !(t as any).result && !(t as any).status),
    session: missingField((t) => !(t as any).session && !(t as any).entryTime),
    setup: missingField((t) => !(t as any).model && !(t as any).setup),
    notes: missingField((t) => !(t as any).notes && !(t as any).lessonsLearned),
    psychology: missingField((t) => !(t as any).psychology || typeof (t as any).psychology !== 'object'),
  };
  const inconsistencyCount = list.filter((t) => {
    const r = (t as any).result;
    const pnl = Number((t as any).netPnl ?? (t as any).pnl);
    return r === 'Win' ? pnl <= 0 : r === 'Loss' ? pnl >= 0 : false;
  }).length;
  return freezeDeep({ total, missing, inconsistencyCount });
}


export function buildCompletenessLimitations(completeness: AICompleteness): string[] {
  const c = completeness && typeof completeness === 'object' ? completeness : {} as AICompleteness;
  const m = c.missing || ({} as AICompleteness['missing']);
  const out: string[] = [];
  const add = (count: number, msg: string) => {
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
// Deep-immune projection pickers — mirrors web pick*() functions
// ---------------------------------------------------------------------------
function pickRows(rows: unknown, keys: string[]): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Record<string, unknown>[]).slice(0, 20).map((r) => {
    const out: Record<string, unknown> = {};
    keys.forEach((k) => {
      if (r[k] !== undefined && r[k] !== null) out[k] = r[k];
    });
    return out;
  });
}

export function pickSummary(a: Partial<DetailedAnalytics> | null): Record<string, unknown> {
  if (!a || typeof a !== 'object') return {};
  const out: Record<string, unknown> = {};
  const keys = ['total', 'wins', 'losses', 'breakevens', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor', 'bestTrade', 'worstTrade', 'currentWinStreak', 'currentLossStreak', 'longestWinStreak', 'tradingDays'];
  keys.forEach((k) => {
    const v = (a as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) out[k] = v;
  });
  return out;
}

export function pickAnalytics(a: Partial<DetailedAnalytics> | null): Record<string, unknown> {
  if (!a || typeof a !== 'object') return {};
  const cols = ['label', 'trades', 'wins', 'losses', 'winRate', 'netPnl', 'avgRR', 'avgWin', 'avgLoss', 'profitFactor'];
  return {
    byPair: pickRows((a as any).byPair, cols),
    bySession: pickRows((a as any).bySession, cols),
    byStrategy: pickRows((a as any).byStrategy, cols),
    byDirection: pickRows((a as any).byDirection, cols),
    byTimeframe: pickRows((a as any).byTimeframe, cols),
  };
}

export function pickSetupPerformance(setup: unknown): Record<string, unknown> {
  if (!setup || !Array.isArray((setup as any).setups)) return { setups: [] };
  const s = setup as any;
  return {
    totalTrades: s.totalTrades ?? 0,
    decidedCount: s.decidedCount ?? 0,
    minNormal: s.minNormal ?? 5,
    setups: (s.setups as any[]).slice(0, 12).map((x: any) => ({
      label: x.label,
      trades: x.trades,
      wins: x.wins,
      losses: x.losses,
      decided: x.decided,
      winRate: numOrNull(x.winRate),
      avgRR: numOrNull(x.avgRR),
      netPnl: numOrNull(x.netPnl),
      avgPnl: numOrNull(x.avgPnl),
      avgWin: numOrNull(x.avgWin),
      avgLoss: numOrNull(x.avgLoss),
      profitFactor: x.profitFactor === Infinity ? 'Infinite' : numOrNull(x.profitFactor),
      bestTrade: numOrNull(x.bestTrade),
      worstTrade: numOrNull(x.worstTrade),
      status: x.status,
    })),
  };
}

export function pickHeatmap(h: HeatmapResult | null): Record<string, unknown> {
  if (!h || !Array.isArray((h as any).rows)) return {};
  const cells: Record<string, unknown>[] = [];
  (h as any).rows.forEach((row: any) => {
    if (!Array.isArray(row.cells)) return;
    row.cells.forEach((c: any) => {
      if (!c || c.decided === 0) return;
      cells.push({
        pair: c.pair,
        session: c.session,
        trades: c.trades,
        decided: c.decided,
        winRate: numOrNull(c.winRate),
        netPnl: numOrNull(c.netPnl),
        avgRR: numOrNull(c.avgRR),
        status: c.status,
      });
    });
  });
  cells.sort((x: any, y: any) => y.trades - x.trades || String(x.pair || '').localeCompare(String(y.pair || '')));
  return { cells: cells.slice(0, 20) };
}

function pickContext(rows: unknown): { label: string; count: number }[] {
  if (!Array.isArray(rows)) return [];
  return (rows as any[]).slice(0, 5).map((c) => ({ label: c.label, count: c.count }));
}

export function pickMistake(m: MistakePatternResult | null): Record<string, unknown> {
  if (!m || !Array.isArray((m as any).rows)) return {};
  return {
    affectedTradeCount: (m as any).affectedTradeCount ?? 0,
    totalOccurrences: (m as any).totalOccurrences ?? 0,
    patterns: ((m as any).rows as any[]).slice(0, 10).map((r: any) => ({
      name: r.name,
      occurrences: r.occurrences,
      affectedTrades: r.affectedTrades,
      wins: r.wins,
      losses: r.losses,
      winRate: numOrNull(r.winRate),
      netPnl: numOrNull(r.netPnl),
      avgPnl: numOrNull(r.avgPnl),
      status: r.status,
      setups: pickContext(r.setups),
      pairs: pickContext(r.pairs),
      sessions: pickContext(r.sessions),
    })),
    insights: Array.isArray((m as any).insights) ? (m as any).insights.slice(0, 5) : [],
  };
}

export function pickDisciplineScore(d: DisciplineScoreResult | null): Record<string, unknown> {
  if (!d || typeof d !== 'object') return {};
  return {
    score: d.score !== undefined && d.score !== null ? d.score : null,
    coveragePct: (d as any).coveragePct ?? 0,
    band: (d as any).band ? { label: (d as any).band.label, min: (d as any).band.min, max: (d as any).band.max } : null,
    components: Array.isArray((d as any).components)
      ? (d as any).components.map((c: any) => ({ key: c.key, label: c.label, weight: c.weight, score: c.score, available: c.available, note: c.note }))
      : [],
    improvements: Array.isArray((d as any).improvements) ? (d as any).improvements.slice(0, 6) : [],
    weekly: Array.isArray((d as any).weekly) ? (d as any).weekly.slice(-3) : [],
    monthly: Array.isArray((d as any).monthly) ? (d as any).monthly.slice(-3) : [],
    hasTrend: !!(d as any).hasTrend,
  };
}

export function pickEmotion(e: EmotionAnalyticsResult | null): Record<string, unknown> {
  if (!e || typeof e !== 'object') return {};
  return {
    total: (e as any).total ?? 0,
    mostCommonEmotion: (e as any).mostCommonEmotion
      ? { key: (e as any).mostCommonEmotion.key, avg: numOrNull((e as any).mostCommonEmotion.avg), tone: (e as any).mostCommonEmotion.tone }
      : null,
    avgConfidence: numOrNull((e as any).avgConfidence),
    avgFocus: numOrNull((e as any).avgFocus),
    avgPatience: numOrNull((e as any).avgPatience),
    fearFreq: numOrNull((e as any).fearFreq),
    greedFreq: numOrNull((e as any).greedFreq),
    fomoFreq: numOrNull((e as any).fomoFreq),
    stressFreq: numOrNull((e as any).stressFreq),
    perEmotion: Array.isArray((e as any).perEmotion) ? (e as any).perEmotion.slice(0, 8) : [],
  };
}

export function pickRisk(r: AIRiskLite | null): Record<string, unknown> {
  if (!r || typeof r !== 'object') return {};
  return {
    avgRiskPct: numOrNull(r.avgRiskPct),
    avgRewardPct: numOrNull(r.avgRewardPct),
    longestWinStreak: r.longestWinStreak ?? 0,
    longestLossStreak: r.longestLossStreak ?? 0,
    maxDrawdown: numOrNull(r.maxDrawdown),
    currentDrawdown: numOrNull(r.currentDrawdown),
    averageDrawdown: numOrNull(r.averageDrawdown),
    recoveryDays: numOrNull(r.recoveryDays),
  };
}

export function pickPatterns(p: unknown): Record<string, unknown> {
  if (!p || !Array.isArray((p as any).patterns)) return {};
  return {
    decidedCount: (p as any).decidedCount ?? 0,
    patterns: ((p as any).patterns as any[]).slice(0, 10).map((x: any) => ({
      category: x.category,
      title: x.title,
      detail: x.detail,
      observations: x.observations,
      strength: x.strength,
      confidence: x.confidence,
    })),
  };
}

// ---------------------------------------------------------------------------
// Recent trades projection — deterministically sorted, capped, no raw rows
// Mirrors web collectRecentTrades() + projectTrade()
// ---------------------------------------------------------------------------
function projectTrade(t: Trade): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const ta = t as any;
  if (typeof ta.id === 'string' && ta.id) out.id = ta.id;
  if (ta.date) out.date = ta.date;
  if (ta.instrument || ta.symbol) out.instrument = ta.instrument || ta.symbol;
  if (ta.direction) out.direction = ta.direction;
  if (ta.session) out.session = ta.session;
  if (ta.timeframe) out.timeframe = ta.timeframe;
  if (typeof ta.model === 'string' && ta.model.trim()) out.setup = ta.model.trim();
  else if (typeof ta.setup === 'string' && ta.setup.trim()) out.setup = ta.setup.trim();
  if (ta.result) out.result = ta.result;
  const pnl = numOrNull(ta.netPnl);
  if (pnl !== null) out.pnl = pnl;
  const rr = numOrNull(ta.rr);
  if (rr !== null) out.rr = rr;
  const risk = numOrNull(ta.riskPercent);
  if (risk !== null) out.riskPercent = risk;
  if (ta.tradeGrade) out.tradeGrade = ta.tradeGrade;
  if (typeof ta.emotion === 'string' && ta.emotion) out.emotion = ta.emotion;
  // Mistakes: support both string[] and object map
  if (ta.mistakes && typeof ta.mistakes === 'object') {
    const names = Array.isArray(ta.mistakes)
      ? ta.mistakes.filter(Boolean)
      : Object.keys(ta.mistakes).filter((k) => ta.mistakes[k]);
    if (names.length) out.mistakes = names;
  }
  return out;
}

export function collectRecentTrades(list: Trade[], cap = AI_JOURNAL_MAX_RECENT_TRADES): Record<string, unknown>[] {
  if (!Array.isArray(list)) return [];
  const sorted = [...list]
    .filter((t) => t && typeof t === 'object')
    .sort((a, b) => {
      const aKey = String((a as any).date || '') + String((a as any).entryTime || '');
      const bKey = String((b as any).date || '') + String((b as any).entryTime || '');
      return bKey.localeCompare(aKey) || String((b as any).id || '').localeCompare(String((a as any).id || ''));
    });
  return sorted.slice(0, cap).map(projectTrade);
}

// ---------------------------------------------------------------------------
// Trade Review canonical calculations pass-through
// Mirrors web tradeReview.js buildTradeReviewCalculations()
// ---------------------------------------------------------------------------
export function buildTradeReviewCalculations(trade: unknown): Record<string, unknown> {
  if (!trade || typeof trade !== 'object') return {};
  const t = trade as Record<string, unknown>;
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';
  const out: Record<string, unknown> = {};
  if (has(t.netPnl)) out.pnl = Number(t.netPnl);
  if (has(t.rr)) out.realizedRR = Number(t.rr);
  if (has(t.riskPercent)) out.riskPercent = Number(t.riskPercent);
  if (has(t.positionSize)) out.lotSize = Number(t.positionSize);
  else if (has(t.contracts)) out.lotSize = Number(t.contracts);
  if (has(t.result)) out.winLoss = t.result;
  return out;
}

// ---------------------------------------------------------------------------
// Ask Journal question intent classifier
// Mirrors web classifyJournalQuestionIntent()
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

export type QuestionIntent = 'performance' | 'qualitative';

export function classifyJournalQuestionIntent(question: string): QuestionIntent {
  const q = (typeof question === 'string' ? question : '').toLowerCase().trim();
  if (!q) return 'qualitative';
  const hit = (terms: string[]) => terms.some((term) => q.includes(term));
  if (hit(QUALITATIVE_QUESTION_TERMS)) return 'qualitative';
  if (hit(MEASURABLE_QUESTION_TERMS)) return 'performance';
  return 'performance';
}

// ---------------------------------------------------------------------------
// Full canonical context builder — mirrors web buildCanonicalJournalContext()
// This is the ONLY function EdgeAIScreen / edgeAiService should call.
// ---------------------------------------------------------------------------
export interface CanonicalJournalContextInput {
  trades: Trade[];
  accountId?: string | null;
}

export interface CanonicalJournalContext {
  dataQuality: AIDataQuality;
  performance: Readonly<AIPerformanceBlock>;
  risk: Readonly<AIRiskBlock>;
  completeness: Readonly<AICompleteness>;
  summary: Record<string, unknown>;
  analytics: Record<string, unknown>;
  setupPerformance: Record<string, unknown>;
  heatmap: Record<string, unknown>;
  mistakeIntelligence: Record<string, unknown>;
  disciplineScore: Record<string, unknown>;
  emotion: Record<string, unknown>;
  patterns: Record<string, unknown>;
  recentTrades: Record<string, unknown>[];
}

export function buildCanonicalJournalContext({ trades, accountId }: CanonicalJournalContextInput): Readonly<CanonicalJournalContext> {
  if (!Array.isArray(trades)) {
    throw new Error('AI_ACCOUNT_SCOPE_ERROR: A trades array is required to build a canonical journal context.');
  }
  assertJournalAccountScope(trades, accountId);

  // Run all mobile engines — these are the same deterministic calculations
  // the Analytics / Psychology / Heatmap screens already use.
  const analytics = trades.length > 0 ? computeDetailedAnalytics(trades) : null;
  const heatmap = trades.length > 0 ? computePairSessionHeatmap(trades) : null;
  const emotion = trades.length > 0 ? computeEmotionAnalytics(trades) : null;
  const mistakeData = trades.length > 0 ? computeMistakePattern(trades) : null;
  const disciplineData = trades.length > 0 ? computeDisciplineScore(trades) : null;
  const recommendations = trades.length > 0 ? computeRecommendations(trades) : null;

  // Build risk lite from analytics streaks (mobile does not have a separate
  // riskAnalytics engine; we derive from analyticsEngine output)
  const riskLite: AIRiskLite = analytics
    ? {
        avgRiskPct: null,
        avgRewardPct: null,
        longestWinStreak: analytics.longestWinStreak ?? null,
        longestLossStreak: null,
        maxDrawdown: null,
        currentDrawdown: null,
        averageDrawdown: null,
        recoveryDays: null,
        distribution: [],
        winRateByRisk: [],
      }
    : null;

  const dataQuality = buildJournalDataQuality(
    trades.length,
    buildCompletenessLimitations(buildJournalCompleteness(trades))
  );

  const recent = collectRecentTrades(trades, AI_JOURNAL_MAX_RECENT_TRADES);

  const perf = buildJournalPerformance(analytics, riskLite);
  const riskOut = buildJournalRiskBlock(riskLite, null, trades);
  const complete = buildJournalCompleteness(trades);

  // Patterns: adapt recommendationsEngine output to the patterns pick shape
  const patternsLike = recommendations
    ? {
        decidedCount: (analytics?.total ?? 0),
        patterns: Array.isArray((recommendations as any).patterns)
          ? (recommendations as any).patterns
          : Array.isArray((recommendations as any).insights)
          ? (recommendations as any).insights.map((i: any) => ({
              category: i.category || 'Observation',
              title: i.title || i.type || '',
              detail: i.detail || i.description || '',
              observations: i.count ?? null,
              strength: i.strength || null,
              confidence: i.confidence || null,
            }))
          : [],
      }
    : null;

  return freezeDeep({
    dataQuality,
    performance: perf,
    risk: riskOut,
    completeness: complete,
    summary: pickSummary(analytics),
    analytics: pickAnalytics(analytics),
    setupPerformance: pickSetupPerformance(null), // mobile does not have setupPerformance engine in P1.4
    heatmap: pickHeatmap(heatmap),
    mistakeIntelligence: pickMistake(mistakeData),
    disciplineScore: pickDisciplineScore(disciplineData),
    emotion: pickEmotion(emotion),
    patterns: pickPatterns(patternsLike),
    recentTrades: recent,
  });
}
