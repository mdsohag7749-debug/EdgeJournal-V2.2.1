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

function sortByDate(trades) {
  return [...trades].sort((a, b) => (a.date + (a.entryTime || '')).localeCompare(b.date + (b.entryTime || '')));
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Monday of the week containing `dateStr` ('YYYY-MM-DD'), as a
// 'YYYY-MM-DD' key — used to bucket trades into calendar weeks without
// pulling in a date library.
function mondayKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

// Buckets a trade's entry time-of-day into a market session. There's
// no explicit "session" field on a trade — this is a standard-hours
// heuristic derived from entryTime (24h "HH:MM"), same as any trading
// journal that infers session from time-of-day.
const SESSION_WINDOWS = [
  { session: 'Asia', start: 0, end: 8 },
  { session: 'London', start: 8, end: 13 },
  { session: 'New York', start: 13, end: 21 },
  { session: 'After Hours', start: 21, end: 24 },
];
const SESSION_ORDER = ['Asia', 'London', 'New York', 'After Hours', 'Unknown'];

function sessionFor(entryTime) {
  if (!entryTime) return 'Unknown';
  const hour = parseInt(entryTime.split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

// Groups trades by an arbitrary key, returning per-group trade count,
// win rate, and net P&L. Used for Monthly/Weekly Performance, Trades by
// Pair, by Session, and by Strategy alike.
function groupBy(trades, keyFn, labelFn) {
  const map = {};
  trades.forEach((t) => {
    const key = keyFn(t);
    if (key === null || key === undefined || key === '') return;
    if (!map[key]) {
      map[key] = { key, label: labelFn ? labelFn(t, key) : key, trades: 0, wins: 0, losses: 0, netPnl: 0 };
    }
    map[key].trades += 1;
    if (t.result === 'Win') map[key].wins += 1;
    if (t.result === 'Loss') map[key].losses += 1;
    map[key].netPnl += Number(t.netPnl) || 0;
  });
  return Object.values(map).map((g) => ({
    ...g,
    netPnl: Number(g.netPnl.toFixed(2)),
    winRate: g.wins + g.losses ? (g.wins / (g.wins + g.losses)) * 100 : 0,
  }));
}

export function computeAnalytics(trades) {
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
    (t, key) => {
      const d = new Date(key + '-01T00:00:00');
      return isNaN(d) ? key : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }
  ).sort((a, b) => a.key.localeCompare(b.key));

  // Weekly Performance — chronological, one entry per Mon–Sun week.
  const weeklyPerformance = groupBy(
    sorted.filter((t) => t.date),
    (t) => mondayKey(t.date),
    (t, key) => {
      const d = new Date(key + 'T00:00:00');
      return isNaN(d) ? key : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  ).sort((a, b) => a.key.localeCompare(b.key));

  // Trades by Pair (the `instrument` field — e.g. NQ, ES, MNQ).
  const byPair = groupBy(sorted, (t) => t.instrument || 'Unassigned').sort((a, b) => b.trades - a.trades);

  // Trades by Session — derived from entry time-of-day (see sessionFor above).
  const bySession = groupBy(sorted, (t) => sessionFor(t.entryTime)).sort(
    (a, b) => SESSION_ORDER.indexOf(a.key) - SESSION_ORDER.indexOf(b.key)
  );

  // Trades by Strategy (the `model` field).
  const byStrategy = groupBy(sorted, (t) => t.model || 'Unassigned').sort((a, b) => b.netPnl - a.netPnl);

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
  };
}
