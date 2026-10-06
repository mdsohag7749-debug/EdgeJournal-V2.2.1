// Mobile Analytics Calculation Engine — Parity with Web (src/lib/analytics.js & calculations.js)
import { Trade } from '../types/models';

export interface GroupMetricRow {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  winRate: number;
  avgRR: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

export interface DetailedAnalytics {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  decided: number;
  winRate: number;
  lossRate: number;
  profitFactor: number;
  avgRR: number;
  avgWin: number;
  avgLoss: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  tradingDays: number;
  avgDurationMin: number;
  avgDurationLabel: string;
  byDirection: GroupMetricRow[];
  byTimeframe: GroupMetricRow[];
  byPair: GroupMetricRow[];
  bySession: GroupMetricRow[];
  byStrategy: GroupMetricRow[];
  byWeekday: GroupMetricRow[];
  monthlyPerformance: GroupMetricRow[];
  weeklyPerformance: GroupMetricRow[];
  bestPair: GroupMetricRow | null;
  worstPair: GroupMetricRow | null;
  mostTradedPair: GroupMetricRow | null;
  bestSession: GroupMetricRow | null;
  worstSession: GroupMetricRow | null;
  bestDay: GroupMetricRow | null;
}

export const SESSION_WINDOWS = [
  { session: 'Asia', start: 0, end: 8 },
  { session: 'London', start: 8, end: 13 },
  { session: 'New York', start: 13, end: 21 },
  { session: 'After Hours', start: 21, end: 24 },
];

export const SESSION_ORDER = ['Asia', 'London', 'New York', 'London + New York', 'After Hours', 'Unknown'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Unknown'];
export const TIMEFRAME_ORDER = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN', 'Unknown'];
export const DIRECTION_ORDER = ['Long', 'Short', 'Unknown'];

export function getTradeDate(t: any): string {
  return t.entryDate || t.date || '';
}

export function getTradeSymbol(t: any): string {
  return t.symbol || t.instrument || 'Unassigned';
}

export function normalizeDirection(dir: any): 'Long' | 'Short' | 'Unknown' {
  if (!dir) return 'Unknown';
  const d = String(dir).toLowerCase().trim();
  if (d === 'long' || d === 'buy') return 'Long';
  if (d === 'short' || d === 'sell') return 'Short';
  return 'Unknown';
}

export function getResult(t: any): 'Win' | 'Loss' | 'BE' {
  if (t.result) {
    if (t.result === 'Win' || t.result === 'Loss' || t.result === 'BE') return t.result;
  }
  const pnl = Number(t.netPnl) || 0;
  if (pnl > 0) return 'Win';
  if (pnl < 0) return 'Loss';
  return 'BE';
}

export function sessionFor(entryTime?: string): string {
  if (!entryTime) return 'Unknown';
  const hour = parseInt(entryTime.split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

export function sessionKey(t: any): string {
  return t.session || sessionFor(t.entryTime);
}

export function toWeekday(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Unknown';
  return WEEKDAYS[d.getDay()];
}

function mondayKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthLabel(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return isNaN(date.getTime()) ? ym : date.toLocaleString('default', { month: 'short', year: 'numeric' });
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `W ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function toMinutes(t?: string): number | null {
  if (!t || !String(t).includes(':')) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function avgDurationMinutes(trades: Trade[]): number {
  const durations: number[] = [];
  trades.forEach((t) => {
    const inMin = toMinutes(t.entryTime);
    const outMin = toMinutes(t.exitTime);
    if (inMin === null || outMin === null) return;
    let diff = outMin - inMin;
    if (diff < 0) diff += 24 * 60;
    durations.push(diff);
  });
  if (!durations.length) return 0;
  return durations.reduce((s, n) => s + n, 0) / durations.length;
}

export function toHhMm(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function pickBest(groups: GroupMetricRow[], metric: keyof GroupMetricRow): GroupMetricRow | null {
  if (!groups.length) return null;
  return groups.reduce((best, g) => ((g[metric] as number) > (best[metric] as number) ? g : best));
}

function pickWorst(groups: GroupMetricRow[], metric: keyof GroupMetricRow): GroupMetricRow | null {
  if (!groups.length) return null;
  return groups.reduce((worst, g) => ((g[metric] as number) < (worst[metric] as number) ? g : worst));
}

export function groupTradesBy(
  trades: Trade[],
  keyFn: (t: Trade) => string | null | undefined,
  labelFn?: (t: Trade, key: string) => string
): GroupMetricRow[] {
  const map: Record<string, any> = {};

  trades.forEach((t) => {
    const key = keyFn(t);
    if (key === null || key === undefined || key === '') return;
    if (!map[key]) {
      map[key] = {
        key,
        label: labelFn ? labelFn(t, key) : key,
        trades: 0,
        wins: 0,
        losses: 0,
        netPnl: 0,
        rrSum: 0,
        rrCount: 0,
        winPnlSum: 0,
        lossPnlSum: 0,
        grossProfit: 0,
        grossLoss: 0,
      };
    }
    const g = map[key];
    const pnl = Number(t.netPnl) || 0;
    const res = getResult(t);
    g.trades += 1;
    g.netPnl += pnl;

    if (res === 'Win') {
      g.wins += 1;
      g.winPnlSum += pnl;
      g.grossProfit += pnl;
    }
    if (res === 'Loss') {
      g.losses += 1;
      g.lossPnlSum += pnl;
      g.grossLoss += Math.abs(pnl);
    }
    const rr = Number(t.riskRewardRatio || (t as any).rr);
    if (Number.isFinite(rr) && rr > 0) {
      g.rrSum += rr;
      g.rrCount += 1;
    }
  });

  return Object.values(map).map((g) => {
    const decided = g.wins + g.losses;
    return {
      key: g.key,
      label: g.label,
      trades: g.trades,
      wins: g.wins,
      losses: g.losses,
      netPnl: Math.round(g.netPnl * 100) / 100,
      winRate: decided ? (g.wins / decided) * 100 : 0,
      avgRR: g.rrCount ? g.rrSum / g.rrCount : 0,
      avgWin: g.wins ? g.winPnlSum / g.wins : 0,
      avgLoss: g.losses ? g.lossPnlSum / g.losses : 0,
      profitFactor: g.grossLoss > 0 ? g.grossProfit / g.grossLoss : g.grossProfit > 0 ? Infinity : 0,
    };
  });
}

export function computeDetailedAnalytics(trades: Trade[]): DetailedAnalytics {
  const sorted = [...(trades || [])].sort((a, b) =>
    (getTradeDate(a) + (a.entryTime || '')).localeCompare(getTradeDate(b) + (b.entryTime || ''))
  );
  const total = sorted.length;

  const wins = sorted.filter((t) => getResult(t) === 'Win');
  const losses = sorted.filter((t) => getResult(t) === 'Loss');
  const breakevens = total - wins.length - losses.length;
  const decided = wins.length + losses.length;

  const winRate = decided ? (wins.length / decided) * 100 : 0;
  const lossRate = decided ? (losses.length / decided) * 100 : 0;

  const netPnl = sorted.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
  const grossProfit = wins.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.netPnl) || 0), 0));

  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const avgRR = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Expectancy = (Win % * Avg Win) - (Loss % * Avg Loss)
  const winRateRatio = decided ? wins.length / decided : 0;
  const lossRateRatio = decided ? losses.length / decided : 0;
  const expectancy = winRateRatio * avgWin - lossRateRatio * avgLoss;

  const bestTrade = total ? Math.max(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;
  const worstTrade = total ? Math.min(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;

  // Current streak (consecutive Win or Loss counting back from latest; BE breaks streak)
  let streak = 0;
  let streakType: string | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = getResult(sorted[i]);
    if (r === 'BE') break;
    if (streakType === null) {
      streakType = r;
      streak = 1;
    } else if (r === streakType) {
      streak++;
    } else {
      break;
    }
  }
  const currentWinStreak = streakType === 'Win' ? streak : 0;
  const currentLossStreak = streakType === 'Loss' ? streak : 0;

  // Longest historical winning streak
  let longestWinStreak = 0;
  let runningWinStreak = 0;
  sorted.forEach((t) => {
    if (getResult(t) === 'Win') {
      runningWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, runningWinStreak);
    } else {
      runningWinStreak = 0;
    }
  });

  // Trading Days
  const uniqueDays = new Set(sorted.map(getTradeDate).filter(Boolean));
  const tradingDays = uniqueDays.size;

  // Average Trade Duration
  const avgDurationMin = avgDurationMinutes(sorted);
  const avgDurationLabel = toHhMm(avgDurationMin);

  // Groupings
  const monthlyPerformance = groupTradesBy(
    sorted.filter((t) => getTradeDate(t)),
    (t) => getTradeDate(t).slice(0, 7),
    (t, key) => monthLabel(key)
  ).sort((a, b) => a.key.localeCompare(b.key));

  const weeklyPerformance = groupTradesBy(
    sorted.filter((t) => getTradeDate(t)),
    (t) => mondayKey(getTradeDate(t)),
    (t, key) => weekLabel(key)
  ).sort((a, b) => a.key.localeCompare(b.key));

  const byPair = groupTradesBy(sorted, (t) => getTradeSymbol(t)).sort((a, b) => b.trades - a.trades);

  const bySession = groupTradesBy(sorted, (t) => sessionKey(t)).sort(
    (a, b) => SESSION_ORDER.indexOf(a.key) - SESSION_ORDER.indexOf(b.key)
  );

  const byStrategy = groupTradesBy(sorted, (t) => t.setup || (t as any).model || 'Unassigned').sort(
    (a, b) => b.netPnl - a.netPnl
  );

  const byWeekday = groupTradesBy(
    sorted.filter((t) => getTradeDate(t)),
    (t) => toWeekday(getTradeDate(t))
  ).sort((a, b) => WEEKDAY_ORDER.indexOf(a.key) - WEEKDAY_ORDER.indexOf(b.key));

  const byTimeframe = groupTradesBy(sorted, (t) => t.timeframe || 'Unknown').sort(
    (a, b) => TIMEFRAME_ORDER.indexOf(a.key) - TIMEFRAME_ORDER.indexOf(b.key)
  );

  const byDirection = groupTradesBy(sorted, (t) => normalizeDirection(t.direction)).sort(
    (a, b) => DIRECTION_ORDER.indexOf(a.key) - DIRECTION_ORDER.indexOf(b.key)
  );

  const bestPair = pickBest(byPair, 'netPnl');
  const worstPair = pickWorst(byPair, 'netPnl');
  const mostTradedPair = pickBest(byPair, 'trades');
  const bestSession = pickBest(bySession, 'netPnl');
  const worstSession = pickWorst(bySession, 'netPnl');
  const bestDay = pickBest(byWeekday, 'netPnl');

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    breakevens,
    decided,
    winRate: Math.round(winRate * 10) / 10,
    lossRate: Math.round(lossRate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgRR: Math.round(avgRR * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    bestTrade: Math.round(bestTrade * 100) / 100,
    worstTrade: Math.round(worstTrade * 100) / 100,
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    tradingDays,
    avgDurationMin,
    avgDurationLabel,
    byDirection,
    byTimeframe,
    byPair,
    bySession,
    byStrategy,
    byWeekday,
    monthlyPerformance,
    weeklyPerformance,
    bestPair,
    worstPair,
    mostTradedPair,
    bestSession,
    worstSession,
    bestDay,
  };
}
