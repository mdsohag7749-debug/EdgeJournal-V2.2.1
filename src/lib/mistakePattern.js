// Mistake Pattern Intelligence — an ADDITIVE layer over the canonical mistake
// data stored on each trade (`t.mistakes`, a map of truthy tag keys). It does
// NOT re-implement any PnL / RR / win-loss math: every money / RR number below
// is pulled straight from the same stored t.netPnl / t.rr / t.result fields
// the rest of the Analytics page displays, and aggregated with the engine's
// canonical definitions.
//
// Data model facts relied upon (from the trade form + trades API):
//   - `t.mistakes` is an object like `{ 'FOMO Entry': true, 'Over Trading': true }`.
//   - Multiple mistakes per trade are supported; each truthy key is counted
//     as one OCCURRENCE, while the trade itself is one AFFECTED TRADE.
//   - Mistake names are DYNAMIC — every truthy key is supported, not just the
//     built-in vocabulary, so custom tags works automatically.
//   - accountId is applied upstream in DataContext (trades.items is already
//     scoped), so no account logic lives here.
//
// Guardrails (transparent thresholds, no ML, no significance claims):
//   - 0 occurrences          -> "No Data"
//   - 1-2 occurrences        -> "Occasional"
//   - 3-4 occurrences        -> "Recurring"
//   - 5+ occurrences         -> "Frequent"
//
// Relationships (mistake × setup / pair / session) are DESCRIPTIVE counts of
// how often each context appears on trades carrying a mistake. Language always
// says "associated with", never "caused".

import { applyPeriodFilter } from './setupPerformance.js';
import { memoizeByArgs } from './memoize.js';
import { SESSION_WINDOWS } from './utils.js';

export const NO_DATA = 0;
export const OCCASIONAL_MAX = 2;
export const RECURRING_MIN = 3;
export const FREQUENT_MIN = 5;

export const UNASSIGNED_LABEL = 'Unassigned';

// User-selectable ranking for the "Top Mistakes" section. Every mode keeps the
// underlying numbers visible in the table — this only controls the sort order.
export const RANK_MODES = [
  { value: 'affectedTrades', label: 'Frequency' },
  { value: 'occurrences', label: 'Occurrences' },
  { value: 'netPnl', label: 'Net P&L' },
  { value: 'losses', label: 'Losses' },
];

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Exactly mirrors analytics.js's sessionFor: explicit session wins, otherwise
// the shared SESSION_WINDOWS entry-time heuristic.
function sessionOf(t) {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

// All custom+canonical mistake keys on a trade (truthy values only).
export function mistakesOf(t) {
  const m = t && t.mistakes;
  if (!m || typeof m !== 'object') return [];
  return Object.keys(m).filter((k) => m[k]);
}

// Transparent frequency classification by occurrence count.
export function classifyMistake(occurrences) {
  if (occurrences <= NO_DATA) return 'No Data';
  if (occurrences <= OCCASIONAL_MAX) return 'Occasional';
  if (occurrences < FREQUENT_MIN) return 'Recurring';
  return 'Frequent';
}

function aggContexts(list, keyFn, cap = 5) {
  const map = {};
  list.forEach((t) => {
    const k = keyFn(t);
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([label, count]) => ({ label, count }));
}

function computeMistakePatternUncached(
  trades,
  { period = 'all', pair = 'All', session = 'All', setup = 'All', dateFrom, dateTo, rank = 'affectedTrades' } = {}
) {
  const list = Array.isArray(trades) ? trades : [];

  const periodFocus = applyPeriodFilter(list, period, dateFrom, dateTo);
  const focused = periodFocus.filter(
    (t) =>
      (pair === 'All' || !pair ? true : (t.instrument || UNASSIGNED_LABEL) === pair) &&
      (session === 'All' || !session ? true : sessionOf(t) === session) &&
      (setup === 'All' || !setup ? true : (t.model || UNASSIGNED_LABEL) === setup)
  );

  // Single pass: bucket trades by mistake key, tracking occurrences vs.
  // affected trades separately (a numeric mistake value counts as multiple
  // occurrences; each trade still counts as one affected trade).
  const byMistake = new Map();
  const order = [];
  focused.forEach((t) => {
    const pnl = N(t.netPnl);
    const rr = N(t.rr);
    const tags = mistakesOf(t);
    tags.forEach((name) => {
      if (!byMistake.has(name)) {
        byMistake.set(name, { name, trades: new Set(), occurrences: 0 });
        order.push(name);
      }
      const entry = byMistake.get(name);
      const value = typeof t.mistakes[name] === 'number' ? Math.max(0, t.mistakes[name]) : 1;
      entry.occurrences += N(value);
      entry.trades.add(t);
    });
  });

  const rows = order.map((name) => {
    const entry = byMistake.get(name);
    const group = [...entry.trades].map((t) => ({ t, pnl: N(t.netPnl), rr: N(t.rr) }));

    const wins = group.filter((g) => g.t.result === 'Win').length;
    const losses = group.filter((g) => g.t.result === 'Loss').length;
    const decided = wins + losses;
    const winRate = decided ? (wins / decided) * 100 : 0;
    const lossRate = decided ? (losses / decided) * 100 : 0;
    const netPnl = group.reduce((s, g) => s + N(g.pnl), 0);

    const rrs = group.map((g) => N(g.rr)).filter((r) => r > 0);
    const avgRR = rrs.length ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0;

    return {
      name,
      occurrences: entry.occurrences,
      affectedTrades: entry.trades.size,
      trades: group.length,
      wins,
      losses,
      winRate,
      lossRate,
      netPnl: Number(netPnl.toFixed(2)),
      avgPnl: group.length ? Number((netPnl / group.length).toFixed(2)) : 0,
      avgRR,
      status: classifyMistake(entry.occurrences),
      // Per-mistake context breakdowns (counts of matching trades per dimension).
      setups: aggContexts(group.map((g) => g.t), (t) => t.model || UNASSIGNED_LABEL),
      pairs: aggContexts(group.map((g) => g.t), (t) => t.instrument || UNASSIGNED_LABEL),
      sessions: aggContexts(group.map((g) => g.t), (t) => sessionOf(t)),
    };
  });

  const validRank = RANK_MODES.some((r) => r.value === rank) ? rank : 'affectedTrades';
  const sorted = [...rows].sort((a, b) => {
    if (validRank === 'occurrences') return b.occurrences - a.occurrences || b.netPnl - a.netPnl;
    if (validRank === 'netPnl') return a.netPnl - b.netPnl || b.affectedTrades - a.affectedTrades;
    if (validRank === 'losses') return b.losses - a.losses || b.affectedTrades - a.affectedTrades;
    return b.affectedTrades - a.affectedTrades || b.occurrences - a.occurrences;
  });

  const affectedTradeCount = new Set(focused.filter((t) => mistakesOf(t).length).map((t) => t.id)).size;
  const totalOccurrences = sorted.reduce((s, r) => s + r.occurrences, 0);

  // ---- Rule-based insights (descriptive only, no causation) ----
  const insights = [];

  const frequent = sorted.find((r) => r.status === 'Frequent');
  if (frequent) {
    insights.push({
      signal: 'positive',
      claim: `${frequent.name} appears in ${frequent.occurrences} trades, so it is classified as Frequent.`,
    });
  }

  const recurringNegative = sorted.filter((r) => r.status !== 'No Data' && r.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0];
  if (recurringNegative) {
    insights.push({
      signal: 'warning',
      claim: `${recurringNegative.name} appears in ${recurringNegative.affectedTrades} trades and is associated with a net P&L of ${fmtMoney(recurringNegative.netPnl)}.`,
    });
  }

  // Total occurrence counts per session across all mistake trades -> which
  // session records the most mistakes.
  const sessionOcc = {};
  focused.forEach((t) => {
    if (mistakesOf(t).length) {
      const s = sessionOf(t);
      sessionOcc[s] = (sessionOcc[s] || 0) + mistakesOf(t).length;
    }
  });
  const topSession = Object.entries(sessionOcc).sort((a, b) => b[1] - a[1])[0];
  if (topSession) {
    insights.push({
      signal: 'neutral',
      claim: `Most recorded mistakes occurred during ${topSession[0]} (${topSession[1]} total occurrences).`,
    });
  }

  if (!insights.length) insights.push({ signal: 'neutral', claim: 'No insight yet — log more reviewed trades to surface mistake patterns.' });

  return {
    hasData: focused.length > 0,
    hasMistakes: rows.length > 0,
    totalTrades: focused.length,
    affectedTradeCount,
    totalOccurrences,
    rows: sorted,
    // Option list from the FULL visible array (so a currently-visible value is
    // always selectable), never invented.
    pairOptions: [...new Set(list.map((t) => t.instrument || UNASSIGNED_LABEL))].sort((a, b) => a.localeCompare(b)),
    sessionOptions: [...new Set(list.map(sessionOf))].sort((a, b) => a.localeCompare(b)),
    setupOptions: [...new Set(list.map((t) => t.model || UNASSIGNED_LABEL))].sort((a, b) => a.localeCompare(b)),
    insights,
    period,
    rank: validRank,
    minRecurring: RECURRING_MIN,
    minFrequent: FREQUENT_MIN,
  };
}

function fmtMoney(v) {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export const computeMistakePattern = memoizeByArgs(computeMistakePatternUncached);
