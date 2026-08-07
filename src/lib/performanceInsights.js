// Performance Intelligence — an ADDITIVE companion to the Analytics
// module. It intentionally does NOT re-derive its own math from scratch:
// it feeds the (already-lived, account-scoped) trade array through the
// existing computeAnalytics() engine and cherry-picks the "leaderboard"
// highlights into a single, filterable snapshot. No existing module is
// touched.
//
// Period filtering (All Time / This Month / This Week) is applied locally
// *before* handing trades to the analytics engine, so every headline that
// engine produces — best/worst pair & session, average RR, streaks, biggest
// win/loss — is recomputed on the focused slice. The Account filter is
// handled upstream: DataContext already scopes `trades.items` to the
// currently selected account (or all accounts), so nothing extra is needed
// here for account-aware behavior.

import { computeAnalytics } from './analytics';
import { dateKey } from './utils';

export const FOCUS_PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

function pad(n) {
  return String(n).padStart(2, '0');
}

// Returns the Monday ('YYYY-MM-DD') of the week containing the given Date.
function mondayOf(d) {
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  const copy = new Date(d);
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Keeps only trades whose `date` ('YYYY-MM-DD') falls inside the focus
// period. `all` keeps everything; `week` = Mon–Sun of the current week;
// `month` = the current calendar month.
export function applyFocusFilter(trades, period) {
  if (!period || period === 'all') return trades;
  const now = new Date();

  if (period === 'week') {
    const monday = mondayOf(now);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const start = dateKey(monday);
    const end = dateKey(sunday);
    return trades.filter((t) => t.date && t.date >= start && t.date <= end);
  }

  if (period === 'month') {
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const end = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-31`;
    return trades.filter((t) => t.date && t.date >= start && t.date <= end);
  }

  return trades;
}

// Computes the whole Performance Intelligence snapshot for a period over
// the given (already account-scoped) trades. Returns a plain object of
// cards plus the trade count used for empty-state handling.
export function computePerformanceInsights(trades, period = 'all') {
  const focused = applyFocusFilter(trades, period);
  const a = computeAnalytics(focused);
  const total = focused.length;
  const decided = a.wins + a.losses;

  return {
    total,
    hasDecided: decided > 0,
    bestPair: a.bestPair || null,
    worstPair: a.worstPair || null,
    bestSession: a.bestSession || null,
    bestDay: a.bestDay || null,
    avgRR: a.avgRR || 0,
    winStreak: a.currentWinStreak,
    lossStreak: a.currentLossStreak,
    biggestWin: a.bestTrade || 0,
    biggestLoss: a.worstTrade || 0,
  };
}