// Institutional Insights Engine — Parity with Web (src/lib/insightAnalytics.js)
import { Trade } from '../types/models';
import { computeDetailedAnalytics, GroupMetricRow } from './analyticsEngine';

export interface TopMistake {
  name: string;
  count: number;
}

export interface MonthlyWinRatePoint {
  label: string;
  winRate: number;
  decided: number;
}

export interface ImprovementTrend {
  direction: 'up' | 'down' | 'flat' | null;
  slope: number | null;
  monthly: MonthlyWinRatePoint[];
}

export interface InstitutionalInsightsResult {
  hasData: boolean;
  decided: number;
  insights: {
    bestPair: GroupMetricRow | null;
    worstPair: GroupMetricRow | null;
    bestSession: GroupMetricRow | null;
    bestDay: GroupMetricRow | null;
    rrEnvironment: GroupMetricRow | null;
    bestModel: GroupMetricRow | null;
    consistent: GroupMetricRow | null;
    topMistake: TopMistake | null;
  };
  trend: ImprovementTrend;
}

const N = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function bestBy(
  list: GroupMetricRow[],
  metric: keyof GroupMetricRow,
  filterFn: (g: GroupMetricRow) => boolean = () => true
): GroupMetricRow | null {
  const rows = list.filter((g) => filterFn(g) && N(g[metric]) > 0);
  if (!rows.length) return null;
  return rows.reduce((best, g) => (N(g[metric]) > N(best[metric]) ? g : best));
}

function topMistake(trades: Trade[]): TopMistake | null {
  const tally: Record<string, number> = {};
  trades.forEach((t) => {
    const m = t.mistakes;
    if (Array.isArray(m)) {
      m.forEach((k) => {
        if (k) tally[k] = (tally[k] || 0) + 1;
      });
    } else if (m && typeof m === 'object') {
      Object.keys(m).forEach((k) => {
        const c = (m as any)[k];
        if (c && Number.isFinite(Number(c)) && Number(c) > 0) tally[k] = (tally[k] || 0) + Number(c);
        else if (c === true) tally[k] = (tally[k] || 0) + 1;
      });
    }
  });

  const keys = Object.keys(tally);
  if (!keys.length) return null;
  const topKey = keys.reduce((a, b) => (tally[b] > tally[a] ? b : a));
  return { name: topKey, count: tally[topKey] };
}

function slopeOf(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = values.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  return den === 0 ? null : num / den;
}

export function computeInstitutionalInsights(trades: Trade[]): InstitutionalInsightsResult {
  const a = computeDetailedAnalytics(trades);
  const decided = a.decided;

  const bestPair = a.bestPair || null;
  const worstPair = a.worstPair || null;
  const bestSession = a.bestSession || null;
  const bestDay = a.bestDay || null;

  // Highest-RR environment = session with best realized average R:R
  const rrEnv = bestBy(a.bySession || [], 'avgRR', (g) => N(g.avgRR) > 0);

  // Most profitable model
  const bestModel = bestBy(a.byStrategy || [], 'netPnl');

  // Most consistent session (>= 2 decided trades, highest winRate)
  const consistent =
    ((a.bySession || [])
      .filter((s) => s.wins + s.losses >= 2 && s.winRate > 0)
      .sort((x, y) => y.winRate - x.winRate) || [])[0] || null;

  const mistake = topMistake(trades);

  // Monthly improvement trend (win rate slope)
  const monthly: MonthlyWinRatePoint[] = (a.monthlyPerformance || [])
    .filter((m) => m.wins + m.losses > 0)
    .map((m) => ({ label: m.label, winRate: m.winRate, decided: m.wins + m.losses }));

  const slope = monthly.length >= 2 ? slopeOf(monthly.map((m) => m.winRate)) : null;
  const direction: 'up' | 'down' | 'flat' | null =
    slope === null ? null : slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';

  const trend: ImprovementTrend = {
    direction,
    slope: slope === null ? null : Math.round(slope * 100) / 100,
    monthly,
  };

  return {
    hasData: decided > 0,
    decided,
    insights: {
      bestPair,
      worstPair,
      bestSession,
      bestDay,
      rrEnvironment: rrEnv,
      bestModel,
      consistent,
      topMistake: mistake,
    },
    trend,
  };
}
