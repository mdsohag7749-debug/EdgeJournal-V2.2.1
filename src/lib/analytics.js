// Advanced Analytics module. All numbers here are derived purely from
// the trades array already loaded into DataContext (Supabase-backed),
// the same way src/lib/calculations.js drives the Dashboard — this is
// a separate, self-contained file (rather than extending
// calculations.js) so the existing Dashboard module's code and output
// are left completely untouched.
//
// Because every consumer (Analytics.jsx) reads `trades.items` straight
// from useData() through a useMemo keyed on that array, every number
// on the page recomputes automatically the moment a trade is added,
// edited, or removed anywhere else in the app (Trading Journal) — no
// separate wiring needed here.

import { mondayKey, monthLabel, weekLabel, SESSION_WINDOWS } from './utils.js';

function sortByDate(trades) {
  return [...trades].sort((a, b) => (a.date + (a.entryTime || '')).localeCompare(b.date + (b.entryTime || '')));
}

// Buckets a trade's entry time-of-day into a market session. There's
// no explicit "session" field on a trade — this is a standard-hours
// heuristic derived from entryTime (24h "HH:MM"), same as any trading
// journal that infers session from time-of-day.
const SESSION_ORDER = ['Asia', 'London', 'New York', 'London + New York', 'After Hours', 'Unknown'];

// Calendar weekday (Mon–Sun) derived from a 'YYYY-MM-DD' date string.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_ORDER = [...WEEKDAYS.slice(1), WEEKDAYS[0], 'Unknown']; // Mon .. Sun
const TIMEFRAME_ORDER = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN', 'Unknown'];
const DIRECTION_ORDER = ['Buy', 'Sell', 'Unknown'];

function toWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return 'Unknown';
  return WEEKDAYS[d.getDay()];
}

function pickBest(groups, metric) {
  if (!groups.length) return null;
  return groups.reduce((best, g) => (g[metric] > best[metric] ? g : best));
}

function pickWorst(groups, metric) {
  if (!groups.length) return null;
  return groups.reduce((worst, g) => (g[metric] < worst[metric] ? g : worst));
}

function sessionFor(entryTime) {
  if (!entryTime) return 'Unknown';
  const hour = parseInt(entryTime.split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

// Groups trades by an arbitrary key, returning per-group trade count,
// win rate, net P&L, average R:R, average win/loss, and profit factor.
// Used for Monthly/Weekly Performance, Trades by Pair, by Session, by
// Strategy, by Weekday, by Timeframe, and by Direction alike.
function groupBy(trades, keyFn, labelFn) {
  const map = {};
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
    g.trades += 1;
    g.netPnl += pnl;
    if (t.result === 'Win') {
      g.wins += 1;
      g.winPnlSum += pnl;
      g.grossProfit += pnl;
    }
    if (t.result === 'Loss') {
      g.losses += 1;
      g.lossPnlSum += pnl;
      g.grossLoss += Math.abs(pnl);
    }
    const rr = Number(t.rr);
    if (Number.isFinite(rr) && rr > 0) {
      g.rrSum += rr;
      g.rrCount += 1;
    }
  });
  return Object.values(map).map((g) => {
    const decided = g.wins + g.losses;
    return {
      ...g,
      netPnl: Number(g.netPnl.toFixed(2)),
      winRate: decided ? (g.wins / decided) * 100 : 0,
      avgRR: g.rrCount ? g.rrSum / g.rrCount : 0,
      avgWin: g.wins ? g.winPnlSum / g.wins : 0,
      avgLoss: g.losses ? g.lossPnlSum / g.losses : 0,
      profitFactor: g.grossLoss > 0 ? g.grossProfit / g.grossLoss : g.grossProfit > 0 ? Infinity : 0,
    };
  });
}

// computeAnalytics() is a pure function of the trades array (it never reads
// the wall clock and only parses the date strings already present in the data),
// and every consumer destructures/reads its result without mutating it. That
// makes its result memoizable per-array-reference. The Analytics page renders
// several widgets that all re-derive analytics from the same `trades.items` on
// every render, so we share ONE computation per distinct array here instead of
// redundantly recomputing it 5–6 times. A WeakMap keyed on the array reference
// auto-invalidates whenever DataContext hands out a fresh `trades.items`.
const resultsCache = new WeakMap();

export function computeAnalytics(trades) {
  if (resultsCache.has(trades)) return resultsCache.get(trades);
  const result = computeAnalyticsUncached(trades);
  resultsCache.set(trades, result);
  return result;
}

function computeAnalyticsUncached(trades) {
  const sorted = sortByDate(trades);
  const total = sorted.length;

  const wins = sorted.filter((t) => t.result === 'Win');
  const losses = sorted.filter((t) => t.result === 'Loss');
  const breakevens = total - wins.length - losses.length;
  const decided = wins.length + losses.length;

  const winRate = decided ? (wins.length / decided) * 100 : 0;
  const lossRate = decided ? (losses.length / decided) * 100 : 0;

  const netPnl = sorted.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + (Number(t.netPnl) || 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + (Number(t.netPnl) || 0), 0) / losses.length : 0;
  const avgRR = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  const grossProfit = wins.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.netPnl) || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const bestTrade = total ? Math.max(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;
  const worstTrade = total ? Math.min(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;

  // Current streak (consecutive Win or Loss results counting back from
  // the most recent trade; a Breakeven ends the streak).
  let streak = 0;
  let streakType = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i].result;
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

  // Longest historical winning streak (Loss/BE breaks the chain).
  let longestWinStreak = 0;
  let runningWinStreak = 0;
  sorted.forEach((t) => {
    if (t.result === 'Win') {
      runningWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, runningWinStreak);
    } else {
      runningWinStreak = 0;
    }
  });

  // Trading Days: number of distinct calendar days with at least one trade.
  const uniqueDays = new Set(sorted.filter((t) => t.date).map((t) => t.date));
  const tradingDays = uniqueDays.size;

  // Monthly Performance — chronological, one entry per calendar month.
  const monthlyPerformance = groupBy(
    sorted.filter((t) => t.date),
    (t) => t.date.slice(0, 7),
    (t, key) => monthLabel(key)
  ).sort((a, b) => a.key.localeCompare(b.key));

  // Weekly Performance — chronological, one entry per Mon–Sun week.
  const weeklyPerformance = groupBy(
    sorted.filter((t) => t.date),
    (t) => mondayKey(t.date),
    (t, key) => weekLabel(key)
  ).sort((a, b) => a.key.localeCompare(b.key));

  // Trades by Pair (the `instrument` field — e.g. NQ, ES, MNQ).
  const byPair = groupBy(sorted, (t) => t.instrument || 'Unassigned').sort((a, b) => b.trades - a.trades);

  // Trades by Session — uses the explicit session field when logged,
  // otherwise falls back to the entry-time heuristic (see sessionFor above).
  const bySession = groupBy(sorted, (t) => t.session || sessionFor(t.entryTime)).sort(
    (a, b) => SESSION_ORDER.indexOf(a.key) - SESSION_ORDER.indexOf(b.key)
  );

  // Trades by Strategy (the `model` field).
  const byStrategy = groupBy(sorted, (t) => t.model || 'Unassigned').sort((a, b) => b.netPnl - a.netPnl);

  // Trades by Weekday (Mon–Sun), derived from the trade's date.
  const byWeekday = groupBy(sorted.filter((t) => t.date), (t) => toWeekday(t.date)).sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.key) - WEEKDAY_ORDER.indexOf(b.key)
  );

  // Trades by Timeframe (M1 .. MN), ascending chart-timeframe order.
  const byTimeframe = groupBy(sorted, (t) => t.timeframe || 'Unknown').sort(
    (a, b) => TIMEFRAME_ORDER.indexOf(a.key) - TIMEFRAME_ORDER.indexOf(b.key)
  );

  // Trades by Direction (Buy / Sell).
  const byDirection = groupBy(sorted, (t) => t.direction || 'Unknown').sort(
    (a, b) => DIRECTION_ORDER.indexOf(a.key) - DIRECTION_ORDER.indexOf(b.key)
  );

  // Highlights for each dimension (net P&L driven, trade count for the
  // "most traded" spotlight).
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
    winRate,
    lossRate,
    profitFactor,
    avgRR,
    avgWin,
    avgLoss,
    netPnl,
    bestTrade,
    worstTrade,
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    tradingDays,
    monthlyPerformance,
    weeklyPerformance,
    byPair,
    bySession,
    byStrategy,
    byWeekday,
    byTimeframe,
    byDirection,
    bestPair,
    worstPair,
    mostTradedPair,
    bestSession,
    worstSession,
    bestDay,
  };
}
