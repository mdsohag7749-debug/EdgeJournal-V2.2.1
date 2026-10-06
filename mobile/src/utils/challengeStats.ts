// Mobile Challenge Progress & Balance Engine — Exact Parity with Web (src/lib/challengeStats.js)
import { Challenge, Trade, Account } from '../types/models';

export interface ChallengeMetrics {
  startingBalance: number;
  currentBalance: number;
  equity: number;
  netPnl: number;
  profitTarget: number;
  profitProgress: number; // 0 to 1+
  profitRemaining: number;
  dailyDrawdown: number;
  dailyDDUsed: number;
  dailyDDProgress: number; // 0 to 1
  dailyDDRemaining: number;
  maximumDrawdown: number;
  maxDDUsed: number;
  maxDDProgress: number; // 0 to 1
  maxDDRemaining: number;
  minTradingDays: number;
  tradingDaysCompleted: number;
  tradingDaysRemaining: number;
  tradingDaysProgress: number; // 0 to 1
  startDate: string;
  endDate: string;
  daysRemaining: number | null;
  totalTrades: number;
  status: 'active' | 'pass' | 'warning' | 'failed' | 'completed' | 'archived' | string;
}

const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export function toISODate(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toISODate(d);
}

// Distinct calendar days that have at least one trade, bounded by challenge window.
export function countTradingDays(trades: Trade[] = [], startDate?: string, endDate?: string): number {
  const start = toISODate(startDate);
  const end = toISODate(endDate);
  const days = new Set<string>();

  for (const t of trades) {
    const d = toISODate(t.entryDate || (t as any).date);
    if (!d) continue;
    if (start && d < start) continue;
    if (end && d > end) continue;
    days.add(d);
  }
  return days.size;
}

// Whole calendar days from today until challenge end date.
// Returns null when no end date is set, 0 or negative once passed.
export function daysRemaining(endDate?: string): number | null {
  const end = toISODate(endDate);
  if (!end) return null;
  const targetDate = new Date(end + 'T00:00:00');
  const todayDate = new Date(todayISO() + 'T00:00:00');
  const ms = targetDate.getTime() - todayDate.getTime();
  return Math.round(ms / 86400000);
}

// Computes live metrics for one challenge from real account-scoped trades.
export function computeChallengeMetrics(
  challenge: Challenge,
  trades: Trade[] = [],
  account: Account | null = null
): ChallengeMetrics {
  const startingBalance = Number(challenge.startingBalance) || 0;
  const profitTarget = Number(challenge.profitTarget) || 0;
  const dailyDrawdown = Number(challenge.dailyDrawdown) || 0;
  const maximumDrawdown = Number(challenge.maximumDrawdown) || 0;
  const minTradingDays = Number(challenge.minTradingDays) || 0;

  const start = toISODate(challenge.startDate);
  const end = toISODate(challenge.endDate);

  // Filter real trades scoped to the challenge date window
  const challengeTrades = (trades || []).filter((t) => {
    const d = toISODate(t.entryDate || (t as any).date);
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const netPnl = round2(challengeTrades.reduce((sum, t) => sum + (Number(t.netPnl) || 0), 0));
  const currentBalance = round2(startingBalance + netPnl);
  const equity = currentBalance;

  // Daily drawdown = worst single-day loss inside window
  const byDay: Record<string, number> = {};
  for (const t of challengeTrades) {
    const d = toISODate(t.entryDate || (t as any).date);
    if (!d) continue;
    byDay[d] = round2((byDay[d] || 0) + (Number(t.netPnl) || 0));
  }
  const dailyLosses = Object.values(byDay).filter((v) => v < 0);
  const dailyDDUsed = dailyLosses.length ? round2(Math.min(...dailyLosses) * -1) : 0;

  // Maximum drawdown = deepest peak-to-trough from starting balance across chronological trades
  let running = startingBalance;
  let peak = startingBalance;
  let maxDDUsed = 0;
  [...challengeTrades]
    .sort((a, b) =>
      (toISODate(a.entryDate || (a as any).date) || '').localeCompare(
        toISODate(b.entryDate || (b as any).date) || ''
      )
    )
    .forEach((t) => {
      running += Number(t.netPnl) || 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDDUsed) maxDDUsed = dd;
    });
  maxDDUsed = round2(maxDDUsed);

  const profitProgress = profitTarget > 0 ? Math.max(0, netPnl / profitTarget) : netPnl > 0 ? 1 : 0;
  const profitRemaining = round2(profitTarget - netPnl);
  const dailyDDProgress = dailyDrawdown > 0 ? Math.min(1, dailyDDUsed / dailyDrawdown) : 0;
  const dailyDDRemaining = round2(dailyDrawdown - dailyDDUsed);
  const maxDDProgress = maximumDrawdown > 0 ? Math.min(1, maxDDUsed / maximumDrawdown) : 0;
  const maxDDRemaining = round2(maximumDrawdown - maxDDUsed);

  const tradingDaysCompleted = countTradingDays(challengeTrades, start, end);
  const tradingDaysProgress =
    minTradingDays > 0
      ? Math.min(1, tradingDaysCompleted / minTradingDays)
      : tradingDaysCompleted > 0
      ? 1
      : 0;
  const tradingDaysRemaining = Math.max(0, minTradingDays - tradingDaysCompleted);
  const daysLeft = daysRemaining(end);

  // Auto status from real deterministic rules
  let status: ChallengeMetrics['status'] = 'active';
  if (challenge.status === 'completed' || challenge.status === 'archived') {
    status = challenge.status;
  } else if (profitProgress >= 1 && tradingDaysCompleted >= minTradingDays) {
    status = 'completed';
  } else if (maxDDProgress >= 1 || dailyDDProgress >= 1) {
    status = 'failed';
  } else if (daysLeft !== null && daysLeft < 0) {
    status = 'failed';
  } else if (profitProgress >= 0.7 && maxDDProgress < 0.5) {
    status = 'pass';
  } else if (profitProgress >= 0.4 || maxDDProgress >= 0.7) {
    status = 'warning';
  }

  return {
    startingBalance,
    currentBalance,
    equity,
    netPnl,
    profitTarget,
    profitProgress,
    profitRemaining,
    dailyDrawdown,
    dailyDDUsed,
    dailyDDProgress,
    dailyDDRemaining,
    maximumDrawdown,
    maxDDUsed,
    maxDDProgress,
    maxDDRemaining,
    minTradingDays,
    tradingDaysCompleted,
    tradingDaysRemaining,
    tradingDaysProgress,
    startDate: start,
    endDate: end,
    daysRemaining: daysLeft,
    totalTrades: challengeTrades.length,
    status,
  };
}
