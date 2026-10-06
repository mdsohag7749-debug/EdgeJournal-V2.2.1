// Deterministic Psychology & Mistake Intelligence Engine
// Ported from EdgeJournal Web (emotionAnalytics.js, mistakePattern.js, mistakeAnalytics.js, ruleCompliance.js, calculations.js)

import { Trade } from '../types/models';

export const PSYCH_KEYS = [
  'Confidence',
  'Patience',
  'Focus',
  'Fear',
  'Greed',
  'FOMO',
  'Revenge',
  'Stress',
] as const;

export type PsychKey = (typeof PSYCH_KEYS)[number];

export const POSITIVE_EMOTIONS: PsychKey[] = ['Confidence', 'Patience', 'Focus'];
export const DISRUPTIVE_EMOTIONS: PsychKey[] = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress'];

export const NO_DATA = 0;
export const OCCASIONAL_MAX = 2;
export const RECURRING_MIN = 3;
export const FREQUENT_MIN = 5;

export const UNASSIGNED_LABEL = 'Unassigned';

export type MistakeRankMode = 'affectedTrades' | 'occurrences' | 'netPnl' | 'losses';

export interface EmotionRow {
  key: PsychKey;
  label: string;
  avg: number | null;
  tone: 'pos' | 'neg';
  frequency: number | null; // % of rated trades with score >= 4
}

export interface MonthlyEmotionTrend {
  key: string;
  label: string;
  Confidence?: number | null;
  Patience?: number | null;
  Focus?: number | null;
  Fear?: number | null;
  Greed?: number | null;
  FOMO?: number | null;
  Revenge?: number | null;
  Stress?: number | null;
  positiveAvg?: number | null;
  disruptiveAvg?: number | null;
}

export interface EmotionAnalyticsResult {
  total: number; // rated trades count
  totalTrades: number; // all scoped trades count
  perEmotion: EmotionRow[];
  distribution: EmotionRow[];
  mostCommonEmotion: EmotionRow | null;
  avgConfidence: number | null;
  avgFocus: number | null;
  avgPatience: number | null;
  fearFreq: number | null;
  greedFreq: number | null;
  fomoFreq: number | null;
  stressFreq: number | null;
  revengeFreq: number | null;
  monthlyTrend: MonthlyEmotionTrend[];
  emotionalHealth: number | null; // 0-100 score
  stateDistribution?: {
    before: Array<{ name: string; count: number }>;
    during: Array<{ name: string; count: number }>;
    after: Array<{ name: string; count: number }>;
  };
}

export interface ContextCount {
  label: string;
  count: number;
}

export interface MistakeRow {
  name: string;
  occurrences: number;
  affectedTrades: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  lossRate: number;
  netPnl: number;
  avgPnl: number;
  avgRR: number;
  status: 'No Data' | 'Occasional' | 'Recurring' | 'Frequent';
  setups: ContextCount[];
  pairs: ContextCount[];
  sessions: ContextCount[];
}

export interface MistakeInsight {
  signal: 'positive' | 'warning' | 'neutral';
  claim: string;
}

export interface MistakePatternResult {
  hasData: boolean;
  hasMistakes: boolean;
  totalTrades: number;
  affectedTradeCount: number;
  totalOccurrences: number;
  mistakeRate: number; // % of all trades that carried at least one mistake
  rows: MistakeRow[];
  mostCommon: MistakeRow | null;
  mostExpensive: MistakeRow | null;
  insights: MistakeInsight[];
  pairOptions: string[];
  sessionOptions: string[];
  setupOptions: string[];
  rank: MistakeRankMode;
  byPair: Array<{ name: string; count: number; totalNetPnl: number }>;
  bySession: Array<{ name: string; count: number; totalNetPnl: number }>;
}

export interface RuleStat {
  name: string;
  followed: number;
  broken: number;
  present: number;
  compliancePct: number;
}

export interface RuleComplianceResult {
  total: number;
  engagedTrades: number;
  hasChecklistData: boolean;
  compliancePct: number;
  ruleScore: number;
  breakPct: number;
  perfectCount: number;
  perfectPct: number;
  byRule: RuleStat[];
  mostBrokenRule: RuleStat | null;
  weekly: Array<{ label: string; compliancePct: number }>;
  monthly: Array<{ label: string; compliancePct: number }>;
  trend: Array<{ label: string; compliancePct: number }>;
}

export interface PsychologyOverviewResult {
  score: number | null; // 0-100 Composite Score
  emotionalHealth: number | null;
  compliancePct: number;
  perfectPct: number;
  disciplineScore: number;
  mistakeFreeRate: number;
  ratedTradeCount: number;
  totalTrades: number;
  statusLabel: 'Excellent' | 'Strong' | 'Moderate' | 'Needs Improvement' | 'High Improvement Priority' | 'No Data';
  dominantPositive: { title: string; desc: string; freq: string } | null;
  recurringNegative: { title: string; desc: string; freq: string; impact: string } | null;
  topSessionLeak: { session: string; mistakeCount: number } | null;
}

// Helpers
const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

export function monthLabel(key: string): string {
  if (!key || key.length < 7) return key || '—';
  const parts = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${months[monthIdx] || parts[1]} '${(parts[0] || '').slice(2)}`;
}

export function classifyMistake(occurrences: number): 'No Data' | 'Occasional' | 'Recurring' | 'Frequent' {
  if (occurrences <= NO_DATA) return 'No Data';
  if (occurrences <= OCCASIONAL_MAX) return 'Occasional';
  if (occurrences < FREQUENT_MIN) return 'Recurring';
  return 'Frequent';
}

export function mistakesOfTrade(t: Trade | any): string[] {
  if (!t) return [];
  const m = t.mistakes;
  if (Array.isArray(m)) {
    return m.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
  }
  if (m && typeof m === 'object') {
    return Object.keys(m).filter((k) => !!m[k]);
  }
  return [];
}

export function sessionOfTrade(t: Trade | any): string {
  if (t.session && t.session.trim()) return t.session;
  const time = t.entryTime || '';
  const hour = parseInt(time.split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  if (hour >= 0 && hour < 8) return 'Asian';
  if (hour >= 8 && hour < 13) return 'London';
  if (hour >= 13 && hour < 21) return 'New York';
  return 'Asian';
}

function mean(arr: number[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

const toPct = (v: number | null): number | null => {
  if (v === null) return null;
  return Math.max(0, Math.min(100, ((v - 1) / 4) * 100));
};

// ==========================================
// 1. EMOTION ANALYTICS
// ==========================================
export function computeEmotionAnalytics(trades: Trade[]): EmotionAnalyticsResult {
  const list = Array.isArray(trades) ? trades : [];
  const totalTrades = list.length;

  const rated = list.filter((t) => {
    const p = t.psychology;
    if (!p || typeof p !== 'object') return false;
    return PSYCH_KEYS.some((k) => toNum(p[k]) !== null);
  });

  const total = rated.length;

  const avgByKey = (key: PsychKey): number | null => {
    const vals = rated.map((t) => toNum(t.psychology?.[key])).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const frequency = (key: PsychKey): number | null => {
    const presentTrades = rated.filter((t) => toNum(t.psychology?.[key]) !== null);
    if (!presentTrades.length) return null;
    const severe = presentTrades.filter((t) => (toNum(t.psychology?.[key]) || 0) >= 4).length;
    return (severe / presentTrades.length) * 100;
  };

  const perEmotion: EmotionRow[] = PSYCH_KEYS.map((key) => ({
    key,
    label: key,
    avg: avgByKey(key),
    tone: POSITIVE_EMOTIONS.includes(key) ? 'pos' : 'neg',
    frequency: frequency(key),
  }));

  const distribution = perEmotion.filter((e) => e.avg !== null);
  const mostCommonEmotion = distribution.length
    ? distribution.reduce((best, e) => ((e.avg || 0) > (best.avg || 0) ? e : best))
    : null;

  // Monthly trend aggregation
  const monthMap: Record<string, { key: string; label: string; samples: Record<string, number[]> }> = {};
  rated.forEach((t) => {
    const dateStr = t.entryDate || (t as any).date || '';
    if (!dateStr) return;
    const key = dateStr.slice(0, 7);
    if (!monthMap[key]) {
      monthMap[key] = { key, label: monthLabel(key), samples: {} };
    }
    PSYCH_KEYS.forEach((k) => {
      const v = toNum(t.psychology?.[k]);
      if (v === null) return;
      if (!monthMap[key].samples[k]) monthMap[key].samples[k] = [];
      monthMap[key].samples[k].push(v);
    });
  });

  const monthlyTrend: MonthlyEmotionTrend[] = Object.values(monthMap)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => {
      const row: MonthlyEmotionTrend = { key: m.key, label: m.label };
      const posVals: number[] = [];
      const negVals: number[] = [];

      PSYCH_KEYS.forEach((k) => {
        const vals = m.samples[k] || [];
        const emotionAvg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
        row[k] = emotionAvg;
        if (emotionAvg !== null) {
          if (POSITIVE_EMOTIONS.includes(k)) posVals.push(emotionAvg);
          else negVals.push(emotionAvg);
        }
      });

      row.positiveAvg = posVals.length ? posVals.reduce((s, v) => s + v, 0) / posVals.length : null;
      row.disruptiveAvg = negVals.length ? negVals.reduce((s, v) => s + v, 0) / negVals.length : null;
      return row;
    });

  // Emotional Health Composite (0-100)
  const posHealth = perEmotion
    .filter((e) => POSITIVE_EMOTIONS.includes(e.key) && e.avg !== null)
    .map((e) => toPct(e.avg) as number);

  const negHealth = perEmotion
    .filter((e) => DISRUPTIVE_EMOTIONS.includes(e.key) && e.avg !== null)
    .map((e) => toPct(6 - (e.avg || 0)) as number);

  const emotionalHealth = mean([...posHealth, ...negHealth]) != null ? Math.round(mean([...posHealth, ...negHealth])!) : null;

  // Optional qualitative states aggregation
  const beforeCounts: Record<string, number> = {};
  const duringCounts: Record<string, number> = {};
  const afterCounts: Record<string, number> = {};
  list.forEach((t) => {
    if (t.emotionBefore?.trim()) beforeCounts[t.emotionBefore] = (beforeCounts[t.emotionBefore] || 0) + 1;
    if (t.emotionDuring?.trim()) duringCounts[t.emotionDuring] = (duringCounts[t.emotionDuring] || 0) + 1;
    if (t.emotionAfter?.trim()) afterCounts[t.emotionAfter] = (afterCounts[t.emotionAfter] || 0) + 1;
  });

  return {
    total,
    totalTrades,
    perEmotion,
    distribution,
    mostCommonEmotion,
    avgConfidence: avgByKey('Confidence'),
    avgFocus: avgByKey('Focus'),
    avgPatience: avgByKey('Patience'),
    fearFreq: frequency('Fear'),
    greedFreq: frequency('Greed'),
    fomoFreq: frequency('FOMO'),
    stressFreq: frequency('Stress'),
    revengeFreq: frequency('Revenge'),
    monthlyTrend,
    emotionalHealth,
    stateDistribution: {
      before: Object.entries(beforeCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      during: Object.entries(duringCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      after: Object.entries(afterCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    },
  };
}

// ==========================================
// 2. MISTAKE PATTERN & INTELLIGENCE
// ==========================================
function aggContexts(list: Trade[], keyFn: (t: Trade) => string, cap = 5): ContextCount[] {
  const map: Record<string, number> = {};
  list.forEach((t) => {
    const k = keyFn(t) || UNASSIGNED_LABEL;
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([label, count]) => ({ label, count }));
}

function fmtMoney(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function computeMistakePattern(
  trades: Trade[],
  options: { rank?: MistakeRankMode; pair?: string; session?: string; setup?: string } = {}
): MistakePatternResult {
  const list = Array.isArray(trades) ? trades : [];
  const rank = options.rank || 'affectedTrades';
  const pairFilter = options.pair && options.pair !== 'All' ? options.pair : null;
  const sessionFilter = options.session && options.session !== 'All' ? options.session : null;
  const setupFilter = options.setup && options.setup !== 'All' ? options.setup : null;

  const focused = list.filter((t) => {
    const sym = t.symbol || (t as any).instrument || UNASSIGNED_LABEL;
    const sess = sessionOfTrade(t);
    const mod = t.setup || (t as any).model || UNASSIGNED_LABEL;
    if (pairFilter && sym !== pairFilter) return false;
    if (sessionFilter && sess !== sessionFilter) return false;
    if (setupFilter && mod !== setupFilter) return false;
    return true;
  });

  const byMistake = new Map<string, { name: string; trades: Set<Trade>; occurrences: number }>();
  const order: string[] = [];

  const pairMap: Record<string, { name: string; count: number; totalNetPnl: number }> = {};
  const sessionMap: Record<string, { name: string; count: number; totalNetPnl: number }> = {};

  let totalOccurrences = 0;
  let affectedTradeCount = 0;

  focused.forEach((t) => {
    const tags = mistakesOfTrade(t);
    if (tags.length > 0) {
      affectedTradeCount++;
    }

    const pnl = Number(t.netPnl) || 0;
    const pairName = t.symbol || (t as any).instrument || UNASSIGNED_LABEL;
    const sessionName = sessionOfTrade(t);

    tags.forEach((name) => {
      if (!byMistake.has(name)) {
        byMistake.set(name, { name, trades: new Set(), occurrences: 0 });
        order.push(name);
      }
      const entry = byMistake.get(name)!;
      let val = 1;
      if (t.mistakes && typeof t.mistakes === 'object' && !Array.isArray(t.mistakes)) {
        const rawVal = (t.mistakes as any)[name];
        if (typeof rawVal === 'number' && rawVal > 0) val = rawVal;
      }

      entry.occurrences += val;
      entry.trades.add(t);
      totalOccurrences += val;

      if (!pairMap[pairName]) pairMap[pairName] = { name: pairName, count: 0, totalNetPnl: 0 };
      pairMap[pairName].count += val;
      pairMap[pairName].totalNetPnl += pnl;

      if (!sessionMap[sessionName]) sessionMap[sessionName] = { name: sessionName, count: 0, totalNetPnl: 0 };
      sessionMap[sessionName].count += val;
      sessionMap[sessionName].totalNetPnl += pnl;
    });
  });

  const rows: MistakeRow[] = order.map((name) => {
    const entry = byMistake.get(name)!;
    const group = Array.from(entry.trades);

    const wins = group.filter((t) => (t as any).result === 'Win' || Number(t.netPnl) > 0).length;
    const losses = group.filter((t) => (t as any).result === 'Loss' || Number(t.netPnl) < 0).length;
    const decided = wins + losses;
    const winRate = decided ? (wins / decided) * 100 : 0;
    const lossRate = decided ? (losses / decided) * 100 : 0;

    const netPnl = group.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
    const avgPnl = group.length ? netPnl / group.length : 0;

    const rrs = group.map((t) => Number(t.riskRewardRatio || (t as any).rr) || 0).filter((r) => r > 0);
    const avgRR = rrs.length ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

    return {
      name,
      occurrences: entry.occurrences,
      affectedTrades: entry.trades.size,
      trades: group.length,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      lossRate: Math.round(lossRate * 10) / 10,
      netPnl: Math.round(netPnl * 100) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100,
      avgRR: Math.round(avgRR * 100) / 100,
      status: classifyMistake(entry.occurrences),
      setups: aggContexts(group, (t) => t.setup || (t as any).model || UNASSIGNED_LABEL),
      pairs: aggContexts(group, (t) => t.symbol || (t as any).instrument || UNASSIGNED_LABEL),
      sessions: aggContexts(group, (t) => sessionOfTrade(t)),
    };
  });

  // Sort rows by selected ranking mode
  const sorted = [...rows].sort((a, b) => {
    if (rank === 'occurrences') return b.occurrences - a.occurrences || b.netPnl - a.netPnl;
    if (rank === 'netPnl') return a.netPnl - b.netPnl || b.affectedTrades - a.affectedTrades;
    if (rank === 'losses') return b.losses - a.losses || b.affectedTrades - a.affectedTrades;
    return b.affectedTrades - a.affectedTrades || b.occurrences - a.occurrences;
  });

  const mistakeRate = focused.length > 0 ? (affectedTradeCount / focused.length) * 100 : 0;
  const mostCommon = sorted.length ? sorted[0] : null;
  const mostExpensive = sorted.length
    ? sorted.reduce((best, m) => (m.netPnl < best.netPnl ? m : best))
    : null;

  // Descriptive Rule-Based Insights
  const insights: MistakeInsight[] = [];
  const frequent = sorted.find((r) => r.status === 'Frequent');
  if (frequent) {
    insights.push({
      signal: 'warning',
      claim: `${frequent.name} appears in ${frequent.occurrences} instances across ${frequent.affectedTrades} trades (Frequent).`,
    });
  }

  const recurringNegative = sorted.filter((r) => r.status !== 'No Data' && r.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0];
  if (recurringNegative) {
    insights.push({
      signal: 'warning',
      claim: `${recurringNegative.name} is associated with a net loss of ${fmtMoney(recurringNegative.netPnl)} over ${recurringNegative.affectedTrades} trades.`,
    });
  }

  const sessionOcc: Record<string, number> = {};
  focused.forEach((t) => {
    const tags = mistakesOfTrade(t);
    if (tags.length) {
      const s = sessionOfTrade(t);
      sessionOcc[s] = (sessionOcc[s] || 0) + tags.length;
    }
  });

  const topSessionEntry = Object.entries(sessionOcc).sort((a, b) => b[1] - a[1])[0];
  if (topSessionEntry) {
    insights.push({
      signal: 'neutral',
      claim: `Most recorded mistakes occurred during ${topSessionEntry[0]} session (${topSessionEntry[1]} occurrences).`,
    });
  }

  if (!insights.length) {
    insights.push({
      signal: 'positive',
      claim: focused.length > 0 && sorted.length === 0
        ? 'Clean discipline — zero trading mistakes logged across your trades.'
        : 'Log trade reviews and mistakes to surface execution leak patterns.',
    });
  }

  return {
    hasData: focused.length > 0,
    hasMistakes: sorted.length > 0,
    totalTrades: focused.length,
    affectedTradeCount,
    totalOccurrences,
    mistakeRate: Math.round(mistakeRate * 10) / 10,
    rows: sorted,
    mostCommon,
    mostExpensive,
    insights,
    pairOptions: Array.from(new Set(list.map((t) => t.symbol || (t as any).instrument || UNASSIGNED_LABEL))).sort(),
    sessionOptions: Array.from(new Set(list.map(sessionOfTrade))).sort(),
    setupOptions: Array.from(new Set(list.map((t) => t.setup || (t as any).model || UNASSIGNED_LABEL))).sort(),
    rank,
    byPair: Object.values(pairMap).sort((a, b) => b.count - a.count),
    bySession: Object.values(sessionMap).sort((a, b) => b.count - a.count),
  };
}

// ==========================================
// 3. RULE COMPLIANCE
// ==========================================
export function computeRuleCompliance(
  trades: Trade[],
  options: { riskCriteria?: string[]; checklistCriteria?: string[] } = {}
): RuleComplianceResult {
  const list = Array.isArray(trades) ? trades : [];
  const configRisk = (options.riskCriteria || [
    'Risk does not exceed max daily loss limit',
    'Position size matches plan',
    'Stop loss placed before entry',
  ]).filter(Boolean);

  const configExec = (options.checklistCriteria || [
    'Aligned with pre-market bias',
    'Entered at planned level',
    'Confirmation candle present',
  ]).filter(Boolean);

  const sorted = [...list].sort((a, b) => {
    const da = `${a.entryDate || ''} ${a.entryTime || ''}`;
    const db = `${b.entryDate || ''} ${b.entryTime || ''}`;
    return da.localeCompare(db);
  });

  const perTradeCompliance: Array<{ base: number; compliance: number; perfect: boolean; date: string }> = [];
  const ruleStats: Record<string, { name: string; followed: number; broken: number }> = {};

  sorted.forEach((t) => {
    const rc = t.riskChecklist || {};
    const tc = t.tradeChecklist || {};
    const engagedRisk = configRisk.length > 0 && Object.keys(rc).length > 0;
    const engagedExec = configExec.length > 0 && Object.keys(tc).length > 0;

    if (engagedRisk || engagedExec) {
      const rDen = engagedRisk ? configRisk.length : 0;
      const rNum = engagedRisk ? configRisk.filter((r) => rc[r] === true).length : 0;
      const eDen = engagedExec ? configExec.length : 0;
      const eNum = engagedExec ? configExec.filter((c) => tc[c] === true).length : 0;
      const den = rDen + eDen;
      const base = den ? Math.round(((rNum + eNum) / den) * 100) : 100;

      const breaks = mistakesOfTrade(t).length;
      const compliance = Math.max(0, base - breaks * 20);
      const perfect = base === 100 && breaks === 0;

      perTradeCompliance.push({
        base,
        compliance,
        perfect,
        date: t.entryDate || (t as any).date || '',
      });

      if (engagedRisk) {
        configRisk.forEach((r) => {
          if (!(r in rc)) return;
          if (!ruleStats[r]) ruleStats[r] = { name: r, followed: 0, broken: 0 };
          if (rc[r] === true) ruleStats[r].followed += 1;
          else ruleStats[r].broken += 1;
        });
      }

      if (engagedExec) {
        configExec.forEach((c) => {
          if (!(c in tc)) return;
          if (!ruleStats[c]) ruleStats[c] = { name: c, followed: 0, broken: 0 };
          if (tc[c] === true) ruleStats[c].followed += 1;
          else ruleStats[c].broken += 1;
        });
      }
    }
  });

  const total = list.length;
  const compliancePct = perTradeCompliance.length
    ? perTradeCompliance.reduce((s, p) => s + p.compliance, 0) / perTradeCompliance.length
    : 0;
  const perfectCount = perTradeCompliance.filter((p) => p.perfect).length;
  const tradesWithBreaks = list.filter((t) => mistakesOfTrade(t).length > 0).length;
  const breakPct = total ? (tradesWithBreaks / total) * 100 : 0;
  const perfectPct = perTradeCompliance.length ? (perfectCount / perTradeCompliance.length) * 100 : 0;

  const byRule: RuleStat[] = Object.values(ruleStats)
    .map((r) => ({
      ...r,
      present: r.followed + r.broken,
      compliancePct: r.followed + r.broken ? Math.round((r.followed / (r.followed + r.broken)) * 100) : 0,
    }))
    .sort((a, b) => b.broken - a.broken || b.present - a.present);

  const mostBrokenRule = byRule.length ? byRule[0] : null;

  // Monthly & Weekly Trends
  const monthAgg: Record<string, { sum: number; n: number; key: string; label: string }> = {};
  perTradeCompliance.forEach((p) => {
    if (!p.date) return;
    const mo = p.date.slice(0, 7);
    if (mo) {
      if (!monthAgg[mo]) monthAgg[mo] = { sum: 0, n: 0, key: mo, label: monthLabel(mo) };
      monthAgg[mo].sum += p.compliance;
      monthAgg[mo].n += 1;
    }
  });

  const monthly = Object.values(monthAgg)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((w) => ({ label: w.label, compliancePct: Math.round(w.sum / w.n) }));

  const ruleScore = Math.max(0, Math.min(100, Math.round(compliancePct)));

  return {
    total,
    engagedTrades: perTradeCompliance.length,
    hasChecklistData: perTradeCompliance.length > 0 || tradesWithBreaks > 0,
    compliancePct: Math.round(compliancePct),
    ruleScore,
    breakPct: Math.round(breakPct),
    perfectCount,
    perfectPct: Math.round(perfectPct),
    byRule,
    mostBrokenRule,
    weekly: monthly,
    monthly,
    trend: monthly,
  };
}

// ==========================================
// 4. DISCIPLINE SCORE & PSYCHOLOGY SUMMARY
// ==========================================
export function computeDisciplineScore(
  trades: Trade[],
  options: { models?: string[]; riskCriteria?: string[]; checklistCriteria?: string[] } = {}
): { score: number; metrics: Array<{ label: string; value: number }>; total: number } {
  const list = Array.isArray(trades) ? trades : [];
  const total = list.length;
  const ratio = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  // Plan Following
  const configuredModels = (options.models || []).filter(Boolean);
  const planned = list.filter((t) => {
    const mod = t.setup || (t as any).model;
    return mod && (configuredModels.length === 0 || configuredModels.includes(mod));
  }).length;
  const planFollowing = total > 0 ? clamp(ratio(planned, total)) : 0;

  // Rule Compliance
  const rules = computeRuleCompliance(list, options);
  const ruleFollowing = rules.ruleScore;

  // Consistency: profitable trading days
  const dayMap: Record<string, number> = {};
  list.forEach((t) => {
    const d = t.entryDate || (t as any).date;
    if (!d) return;
    if ((Number(t.netPnl) || 0) > 0) {
      dayMap[d] = (dayMap[d] || 0) + 1;
    } else if (!(d in dayMap)) {
      dayMap[d] = 0;
    }
  });
  const days = Object.values(dayMap);
  const winDays = days.filter((d) => d > 0).length;
  const consistency = days.length > 0 ? clamp(ratio(winDays, days.length)) : 0;

  // Emotional Control
  const CALM_EMOTIONS = ['Calm', 'Disciplined', 'Focused', 'Confident', 'Neutral'];
  const NEGATIVE_EMOTIONS = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Anxious', 'Frustrated', 'Chased'];
  const emotionTrades = list.filter((t) => {
    const emo = t.emotionBefore || (t as any).emotion;
    return emo && (CALM_EMOTIONS.includes(emo) || NEGATIVE_EMOTIONS.includes(emo));
  });
  const calmTrades = emotionTrades.filter((t) => CALM_EMOTIONS.includes(t.emotionBefore || (t as any).emotion)).length;
  const emotionalControl = emotionTrades.length > 0 ? clamp(ratio(calmTrades, emotionTrades.length)) : 100;

  // Review & Reflection
  const closedTrades = list.filter((t) => t.status === 'Closed' || Number(t.exitPrice) > 0);
  const reviewedTrades = closedTrades.filter((t) => t.review && Object.keys(t.review).length >= 3).length;
  const reviewReflection = closedTrades.length > 0 ? clamp(ratio(reviewedTrades, closedTrades.length)) : 0;

  const metrics = [
    { label: 'Plan Following', value: planFollowing },
    { label: 'Rule Compliance', value: ruleFollowing },
    { label: 'Consistency', value: consistency },
    { label: 'Emotional Control', value: emotionalControl },
    { label: 'Review & Reflection', value: reviewReflection },
  ];

  const score = total > 0 ? clamp(metrics.reduce((s, m) => s + m.value, 0) / metrics.length) : 0;
  return { score, metrics, total };
}

export function computePsychologyOverview(
  trades: Trade[],
  options: { models?: string[]; riskCriteria?: string[]; checklistCriteria?: string[] } = {}
): PsychologyOverviewResult {
  const list = Array.isArray(trades) ? trades : [];
  const emotion = computeEmotionAnalytics(list);
  const mistakes = computeMistakePattern(list);
  const rules = computeRuleCompliance(list, options);
  const discipline = computeDisciplineScore(list, options);

  // Parts for composite psychology score
  const parts: number[] = [];
  if (emotion.emotionalHealth !== null) parts.push(emotion.emotionalHealth);
  if (rules.hasChecklistData) {
    if (rules.compliancePct != null) parts.push(rules.compliancePct);
    if (rules.perfectPct != null) parts.push(rules.perfectPct);
  }
  if (discipline.score > 0 || list.length > 0) parts.push(discipline.score);

  const score = parts.length ? Math.round(Math.max(0, Math.min(100, mean(parts)!))) : null;

  // Status Band
  let statusLabel: PsychologyOverviewResult['statusLabel'] = 'No Data';
  if (score !== null) {
    if (score >= 90) statusLabel = 'Excellent';
    else if (score >= 80) statusLabel = 'Strong';
    else if (score >= 70) statusLabel = 'Moderate';
    else if (score >= 60) statusLabel = 'Needs Improvement';
    else statusLabel = 'High Improvement Priority';
  }

  // Dominant Positive Pattern
  let dominantPositive: PsychologyOverviewResult['dominantPositive'] = null;
  const bestPos = emotion.perEmotion
    .filter((e) => POSITIVE_EMOTIONS.includes(e.key) && e.avg !== null)
    .sort((a, b) => (b.avg || 0) - (a.avg || 0))[0];

  if (bestPos && (bestPos.avg || 0) >= 3.5) {
    dominantPositive = {
      title: `${bestPos.label} Dominance`,
      desc: `High adherence to disciplined execution (${bestPos.avg?.toFixed(1)}/5 avg rating).`,
      freq: `${Math.round(((bestPos.avg! - 1) / 4) * 100)}% score`,
    };
  } else if (rules.perfectCount > 0) {
    dominantPositive = {
      title: 'Flawless Execution',
      desc: `${rules.perfectCount} trades completed with 100% rule adherence and zero mistakes.`,
      freq: `${rules.perfectPct}% perfect`,
    };
  }

  // Recurring Negative Pattern
  let recurringNegative: PsychologyOverviewResult['recurringNegative'] = null;
  const worstMistake = mistakes.mostExpensive || mistakes.mostCommon;
  const severeDisruptive = emotion.perEmotion
    .filter((e) => DISRUPTIVE_EMOTIONS.includes(e.key) && e.frequency !== null && (e.frequency || 0) > 0)
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))[0];

  if (worstMistake && worstMistake.occurrences > 0) {
    recurringNegative = {
      title: worstMistake.name,
      desc: `${worstMistake.affectedTrades} affected trades. Associated with ${worstMistake.lossRate}% loss rate.`,
      freq: `${worstMistake.occurrences} instances`,
      impact: worstMistake.netPnl < 0 ? fmtMoney(worstMistake.netPnl) : `${worstMistake.winRate}% win`,
    };
  } else if (severeDisruptive && (severeDisruptive.frequency || 0) >= 20) {
    recurringNegative = {
      title: `High ${severeDisruptive.label} State`,
      desc: `Recorded as elevated in ${severeDisruptive.frequency?.toFixed(0)}% of your rated trades.`,
      freq: `${severeDisruptive.frequency?.toFixed(0)}% freq`,
      impact: 'Mental Tension',
    };
  }

  // Top Session Leak
  let topSessionLeak: PsychologyOverviewResult['topSessionLeak'] = null;
  if (mistakes.bySession.length > 0 && mistakes.bySession[0].count > 0) {
    topSessionLeak = {
      session: mistakes.bySession[0].name,
      mistakeCount: mistakes.bySession[0].count,
    };
  }

  const mistakeFreeRate = list.length > 0 ? Math.round(((list.length - mistakes.affectedTradeCount) / list.length) * 100) : 100;

  return {
    score,
    emotionalHealth: emotion.emotionalHealth,
    compliancePct: rules.compliancePct,
    perfectPct: rules.perfectPct,
    disciplineScore: discipline.score,
    mistakeFreeRate,
    ratedTradeCount: emotion.total,
    totalTrades: list.length,
    statusLabel,
    dominantPositive,
    recurringNegative,
    topSessionLeak,
  };
}

export * from './disciplineScoreEngine';

