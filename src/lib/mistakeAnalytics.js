// Mistake Analytics — an ADDITIVE companion to the Analytics module. Fully
// derived from the `mistakes` map stored on each trade (the checkbox section
// in the trade form). Real trade data only, account-scoped upstream in
// DataContext — so it is multi-account and filter-aware by construction,
// just like every other analytics module.
//
// Metrics computed from stored trade fields:
//   - mistakes (jsonb map, true values) -> mistake counts, frequency, the
//     most common mistake, monthly trend, breakdowns by pair and session,
//     and the single most expensive mistake (worst aggregated net P&L).

const CANONICAL = [
  'Late Entry',
  'Early Exit',
  'Moved Stop Loss',
  'No Stop Loss',
  'Over Risk',
  'Counter Trend',
  'News Chase',
  'Over Trading',
  'Missed Plan',
  'Revenge Trade',
  'FOMO Entry',
  'Impatience',
];

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sortChronological(trades) {
  return [...trades].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));
}

const SESSION_WINDOWS = [
  { session: 'Asia', start: 0, end: 8 },
  { session: 'London', start: 8, end: 13 },
  { session: 'New York', start: 13, end: 21 },
  { session: 'After Hours', start: 21, end: 24 },
];
function sessionFor(t) {
  const s = t.session;
  if (s) return s;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

// Extracts the list of mistake names present on a trade (truthy entries).
function mistakesOf(t) {
  const m = t.mistakes;
  if (!m || typeof m !== 'object') return [];
  return CANONICAL.filter((k) => m[k]);
}

function monthLabel(key) {
  const d = new Date(key + '-01T00:00:00');
  return isNaN(d) ? key : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function computeMistakeAnalytics(trades) {
  const sorted = sortChronological(trades || []);
  const total = sorted.length;

  const map = {};
  CANONICAL.forEach((name) => {
    map[name] = { name, count: 0, totalNetPnl: 0 };
  });
  let tradesWithMistakes = 0;
  let totalMistakes = 0;
  const monthMap = {};
  const pairMap = {};
  const sessionMap = {};

  sorted.forEach((t) => {
    const pnl = toNum(t.netPnl);
    const tags = mistakesOf(t);
    if (tags.length) tradesWithMistakes += 1;
    totalMistakes += tags.length;

    tags.forEach((name) => {
      map[name].count += 1;
      map[name].totalNetPnl += pnl;
    });

    if (t.date) {
      const key = t.date.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { key, label: monthLabel(key), count: 0 };
      monthMap[key].count += tags.length;
    }
    if (tags.length) {
      const pair = t.instrument || 'Unassigned';
      if (!pairMap[pair]) pairMap[pair] = { name: pair, count: 0, totalNetPnl: 0 };
      pairMap[pair].count += tags.length;
      pairMap[pair].totalNetPnl += pnl;

      const session = sessionFor(t);
      if (!sessionMap[session]) sessionMap[session] = { name: session, count: 0, totalNetPnl: 0 };
      sessionMap[session].count += tags.length;
      sessionMap[session].totalNetPnl += pnl;
    }
  });

  const perMistake = CANONICAL.filter((name) => map[name].count > 0)
    .map((name) => ({ name, count: map[name].count, totalNetPnl: map[name].totalNetPnl }))
    .sort((a, b) => b.count - a.count);

  const mostCommon = perMistake.length ? perMistake[0] : null;

  // The most expensive mistake is the one whose trades aggregated to the
  // largest net loss (most negative total net P&L).
  const mostExpensive = perMistake.length
    ? perMistake.reduce((best, m) => (m.totalNetPnl < best.totalNetPnl ? m : best))
    : null;

  const monthly = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));
  const byPair = Object.values(pairMap).sort((a, b) => b.count - a.count);
  const bySession = Object.values(sessionMap).sort((a, b) => b.count - a.count);

  // % of all trades that carried at least one mistake.
  const mistakeRate = total ? (tradesWithMistakes / total) * 100 : 0;

  return {
    total,
    tradesWithMistakes,
    totalMistakes,
    mistakeRate,
    perMistake,
    mostCommon,
    mostExpensive,
    monthly,
    byPair,
    bySession,
  };
}