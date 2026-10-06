// Pair & Session Performance Heatmap Engine — Parity with Web (src/lib/heatmap.js)
import { Trade } from '../types/models';
import { getTradeDate, getTradeSymbol, sessionKey, getResult } from './analyticsEngine';

export const MIN_NORMAL = 5;
export const MAX_LIMITED = 4;
export const UNASSIGNED_LABEL = 'Unassigned';

export type HeatmapMetric = 'netPnl' | 'winRate' | 'avgRR';

export interface HeatmapCell {
  key: string;
  pair: string;
  session: string;
  trades: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number;
  netPnl: number;
  avgRR: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  status: 'No data' | 'Limited data' | 'Normal';
}

export interface HeatmapRow {
  pair: string;
  totalTrades: number;
  cells: HeatmapCell[];
}

export interface HeatmapScale {
  ref: number;
  maxAbs: number;
}

export interface HeatmapResult {
  rows: HeatmapRow[];
  sessions: Array<{ key: string; label: string }>;
  scale: HeatmapScale;
  hasData: boolean;
  hasAnyPair: boolean;
  totalTrades: number;
  decidedCount: number;
  pairOptions: string[];
  sessionOptions: string[];
  period: string;
  metric: HeatmapMetric;
  minNormal: number;
  maxLimited: number;
  unassignedLabel: string;
}

const SESSION_ORDER = ['Asia', 'London', 'New York', 'London + New York', 'After Hours', 'Unknown'];

const N = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function orderIndex(key: string): number {
  const i = SESSION_ORDER.indexOf(key);
  return i === -1 ? SESSION_ORDER.length : i;
}

function cellStatus(decided: number): 'No data' | 'Limited data' | 'Normal' {
  if (decided === 0) return 'No data';
  if (decided <= MAX_LIMITED) return 'Limited data';
  return 'Normal';
}

function aggregate(list: Trade[]): Omit<HeatmapCell, 'key' | 'pair' | 'session'> {
  let wins = 0;
  let losses = 0;
  let netPnl = 0;
  let rrSum = 0;
  let rrCount = 0;
  let winPnlSum = 0;
  let lossPnlSum = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  list.forEach((t) => {
    const pnl = N(t.netPnl);
    netPnl += pnl;
    const res = getResult(t);
    if (res === 'Win') {
      wins += 1;
      winPnlSum += pnl;
      grossProfit += pnl;
    }
    if (res === 'Loss') {
      losses += 1;
      lossPnlSum += pnl;
      grossLoss += Math.abs(pnl);
    }
    const rr = N(t.riskRewardRatio || (t as any).rr);
    if (rr > 0) {
      rrSum += rr;
      rrCount += 1;
    }
  });

  const decided = wins + losses;
  return {
    trades: list.length,
    wins,
    losses,
    decided,
    winRate: decided ? (wins / decided) * 100 : 0,
    netPnl: Math.round(netPnl * 100) / 100,
    avgRR: rrCount ? rrSum / rrCount : 0,
    avgWin: wins ? winPnlSum / wins : 0,
    avgLoss: losses ? lossPnlSum / losses : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    status: cellStatus(decided),
  };
}

function emptyCell(pair: string, session: string): HeatmapCell {
  return {
    key: `${pair}\u0001${session}`,
    pair,
    session,
    trades: 0,
    wins: 0,
    losses: 0,
    decided: 0,
    winRate: 0,
    netPnl: 0,
    avgRR: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    status: 'No data',
  };
}

export function computeScale(cells: HeatmapCell[], metric: HeatmapMetric): HeatmapScale {
  if (metric === 'winRate') return { ref: 100, maxAbs: 100 };
  const decided = cells.filter((c) => c && c.decided > 0);
  const maxAbs = decided.length ? Math.max(1, ...decided.map((c) => Math.abs(N(c[metric])))) : 1;
  return { ref: maxAbs, maxAbs };
}

export function cellColor(cell: HeatmapCell | undefined, metric: HeatmapMetric, scale: HeatmapScale): string {
  if (!cell || cell.decided === 0) return 'rgba(148,163,184,0.12)';
  const value = N(cell[metric]);
  const maxAbs = (scale && scale.maxAbs) || 1;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const alpha = (0.12 + 0.68 * intensity).toFixed(3);

  if (metric === 'netPnl') {
    return value >= 0 ? `rgba(22,163,74,${alpha})` : `rgba(220,38,38,${alpha})`;
  }
  if (metric === 'avgRR') {
    return value >= 0 ? `rgba(37,99,235,${alpha})` : `rgba(220,38,38,${alpha})`;
  }
  // winRate
  return `rgba(22,163,74,${alpha})`;
}

function applyPeriod(trades: Trade[], period: string): Trade[] {
  if (!period || period === 'all') return trades;
  const now = new Date();
  let days = 30;
  if (period === 'week' || period === '7') days = 7;
  else if (period === 'month' || period === '30') days = 30;
  else if (period === '90') days = 90;

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return trades.filter((t) => getTradeDate(t) >= cutoffStr);
}

export function computePairSessionHeatmap(
  trades: Trade[],
  options: {
    period?: string;
    pair?: string;
    session?: string;
    metric?: HeatmapMetric;
  } = {}
): HeatmapResult {
  const list = Array.isArray(trades) ? trades : [];
  const period = options.period || 'all';
  const pairFilter = options.pair || 'All';
  const sessionFilter = options.session || 'All';
  const metric: HeatmapMetric = options.metric === 'winRate' || options.metric === 'avgRR' ? options.metric : 'netPnl';

  const periodFocus = applyPeriod(list, period);
  const focused = periodFocus.filter(
    (t) =>
      (pairFilter === 'All' || !pairFilter ? true : getTradeSymbol(t) === pairFilter) &&
      (sessionFilter === 'All' || !sessionFilter ? true : sessionKey(t) === sessionFilter)
  );

  const buckets = new Map<string, { pair: string; session: string; list: Trade[] }>();
  focused.forEach((t) => {
    const pk = getTradeSymbol(t);
    const sk = sessionKey(t);
    const key = `${pk}\u0001${sk}`;
    if (!buckets.has(key)) buckets.set(key, { pair: pk, session: sk, list: [] });
    buckets.get(key)!.list.push(t);
  });

  const cells: HeatmapCell[] = [...buckets.values()].map((b) => ({
    key: `${b.pair}\u0001${b.session}`,
    pair: b.pair,
    session: b.session,
    ...aggregate(b.list),
  }));

  const pairs = [...new Set(focused.map((t) => getTradeSymbol(t)))].sort((a, b) => a.localeCompare(b));
  const sessions = [...new Set(focused.map((t) => sessionKey(t)))].sort(
    (a, b) => orderIndex(a) - orderIndex(b) || a.localeCompare(b)
  );

  const cellMap = new Map(cells.map((c) => [c.key, c]));
  const rows: HeatmapRow[] = pairs
    .map((pk) => ({
      pair: pk,
      totalTrades: cells.filter((c) => c.pair === pk).reduce((s, c) => s + c.trades, 0),
      cells: sessions.map((sk) => cellMap.get(`${pk}\u0001${sk}`) || emptyCell(pk, sk)),
    }))
    .sort((a, b) => b.totalTrades - a.totalTrades || a.pair.localeCompare(b.pair));

  const allCells = rows.flatMap((r) => r.cells);
  const decidedCount = allCells.reduce((s, c) => s + c.decided, 0);
  const totalTrades = allCells.reduce((s, c) => s + c.trades, 0);

  return {
    rows,
    sessions: sessions.map((sk) => ({ key: sk, label: sk })),
    scale: computeScale(allCells, metric),
    hasData: focused.length > 0,
    hasAnyPair: pairs.some((p) => p !== UNASSIGNED_LABEL),
    totalTrades,
    decidedCount,
    pairOptions: [...new Set(list.map((t) => getTradeSymbol(t)))].sort((a, b) => a.localeCompare(b)),
    sessionOptions: [...new Set(list.map((t) => sessionKey(t)))].sort(
      (a, b) => orderIndex(a) - orderIndex(b) || a.localeCompare(b)
    ),
    period,
    metric,
    minNormal: MIN_NORMAL,
    maxLimited: MAX_LIMITED,
    unassignedLabel: UNASSIGNED_LABEL,
  };
}
