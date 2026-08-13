// Pair & Session Performance Heatmap — an ADDITIVE layer over the canonical
// analytics engine (src/lib/analytics.js). It renders a pair × session matrix
// where every cell is a real, stored-account subset of trades. No PnL / RR /
// win-loss formulas are re-implemented here: each cell's numbers use EXACTLY
// the same definitions as `groupBy` in analytics.js (the engine that powers
// "Trades by Pair" / "Trades by Session" on the Analytics page), so a cell for
// EURUSD·London can never disagree with the byPair / bySession breakdowns.
//
// Pair key   -> `t.instrument || 'Unassigned'` (same as byPair).
// Session key-> `t.session || sessionFor(t.entryTime)` (same as bySession),
//               where sessionFor uses the shared SESSION_WINDOWS table.
//
// Sample-size guardrails per cell (matching the Setup Performance dashboard):
//   - 0 decided trades  -> "No data"    (never a fabricated percentage)
//   - 1-4 decided       -> "Limited data"
//   - 5+ decided        -> "Normal"
//
// The color scale is DATA-DRIVEN: its reference intensity is derived from the
// cells actually present (max |net P&L|, 100 for win rate), so nothing here is
// hardcoded to a currency, a win-rate band, or an RR band.
//
// Account scope is inherited from DataContext (trades.items is already scoped
// to the selected account). Period / pair / session filters operate on the
// same filtered dataset used elsewhere on Analytics.

import { applyPeriodFilter } from './setupPerformance.js';
import { memoizeByArgs } from './memoize.js';
import { SESSION_WINDOWS } from './utils.js';

export const MIN_NORMAL = 5; // 5+ decided trades  -> Normal analysis
export const MAX_LIMITED = 4; // 1-4 decided trades -> Limited data

export const UNASSIGNED_LABEL = 'Unassigned';

// Metrics the user can switch the cell fill between. Each maps to a canonical
// per-cell value produced with the engine's own formulas.
export const HEAT_METRICS = [
  { value: 'netPnl', label: 'Net P&L' },
  { value: 'winRate', label: 'Win Rate' },
  { value: 'avgRR', label: 'Average RR' },
];

// Canonical display order for session columns; anything not listed (custom
// session values entered in the journal) is appended in alphabetical order.
const SESSION_ORDER = ['Asia', 'London', 'New York', 'London + New York', 'After Hours', 'Unknown'];

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Exact mirror of analytics.sessionFor(): entry-hour -> SESSION_WINDOWS bucket.
function sessionFor(entryTime) {
  if (!entryTime) return 'Unknown';
  const hour = parseInt(entryTime.split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

// Exact mirror of analytics bySession's key: explicit session wins, otherwise
// the entry-time heuristic. Never silently drops a trade.
export function sessionKey(t) {
  return t.session || sessionFor(t.entryTime);
}

// Exact mirror of analytics byPair's key.
export function pairKey(t) {
  return t.instrument || UNASSIGNED_LABEL;
}

function orderIndex(key) {
  const i = SESSION_ORDER.indexOf(key);
  return i === -1 ? SESSION_ORDER.length : i;
}

function cellStatus(decided) {
  if (decided === 0) return 'No data';
  if (decided <= MAX_LIMITED) return 'Limited data';
  return 'Normal';
}

// Aggregates one pair × session bucket with the engine's canonical formulas.
// Each number is derived from the same stored t.netPnl / t.rr / t.result
// values the rest of the page shows — nothing new is invented.
function aggregate(list) {
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
    if (t.result === 'Win') {
      wins += 1;
      winPnlSum += pnl;
      grossProfit += pnl;
    }
    if (t.result === 'Loss') {
      losses += 1;
      lossPnlSum += pnl;
      grossLoss += Math.abs(pnl);
    }
    const rr = N(t.rr);
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
    netPnl: Number(netPnl.toFixed(2)),
    avgRR: rrCount ? rrSum / rrCount : 0,
    avgWin: wins ? winPnlSum / wins : 0,
    avgLoss: losses ? lossPnlSum / losses : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    status: cellStatus(decided),
  };
}

// A fully-zeroed cell for a pair × session intersection that has no trades in
// the current view. Rendered as "No data" — never fabricated as 0%.
function emptyCell(pair, session) {
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

// Data-driven color reference for the active metric.
//   - winRate: intensity is value/100 (the metric's natural ceiling).
//   - netPnl / avgRR: intensity is |value| / max |value| across decided cells.
export function computeScale(cells, metric) {
  if (metric === 'winRate') return { ref: 100, maxAbs: 100 };
  const decided = cells.filter((c) => c && c.decided > 0);
  const maxAbs = decided.length ? Math.max(1, ...decided.map((c) => Math.abs(N(c[metric])))) : 1;
  return { ref: maxAbs, maxAbs };
}

// Cell background for the active metric. Never uses a hardcoded band — the
// alpha is normalized by the data-driven scale, and neutral grey is reserved
// strictly for cells with no decided trades.
export function cellColor(cell, metric, scale) {
  if (!cell || cell.decided === 0) return 'rgba(148,163,184,0.12)';
  const value = N(cell[metric]);
  const maxAbs = (scale && scale.maxAbs) || 1;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const alpha = (0.08 + 0.62 * intensity).toFixed(3);

  if (metric === 'netPnl') return value >= 0 ? `rgba(22,163,74,${alpha})` : `rgba(220,38,38,${alpha})`;
  if (metric === 'avgRR') return value >= 0 ? `rgba(37,99,235,${alpha})` : `rgba(220,38,38,${alpha})`;
  // winRate — always non-negative; strong = deep green.
  return `rgba(22,163,74,${alpha})`;
}

export function computePairSessionHeatmapUncached(
  trades,
  { period = 'all', pair = 'All', session = 'All', dateFrom, dateTo, metric = 'netPnl' } = {}
) {
  const list = Array.isArray(trades) ? trades : [];
  const validMetric = HEAT_METRICS.some((m) => m.value === metric) ? metric : 'netPnl';

  const periodFocus = applyPeriodFilter(list, period, dateFrom, dateTo);
  const focused = periodFocus.filter(
    (t) => (pair === 'All' || !pair ? true : pairKey(t) === pair) && (session === 'All' || !session ? true : sessionKey(t) === session)
  );

  // Single pass over the filtered dataset, bucketing by pair × session.
  const buckets = new Map();
  focused.forEach((t) => {
    const pk = pairKey(t);
    const sk = sessionKey(t);
    const key = `${pk}\u0001${sk}`;
    if (!buckets.has(key)) buckets.set(key, { pair: pk, session: sk, list: [] });
    buckets.get(key).list.push(t);
  });

  const cells = [...buckets.values()].map((b) => ({ key: `${b.pair}\u0001${b.session}`, pair: b.pair, session: b.session, ...aggregate(b.list) }));

  // Row / column universes come from the FILTERED view so the matrix always
  // reflects what is actually on screen.
  const pairs = [...new Set(focused.map(pairKey))].sort((a, b) => a.localeCompare(b));
  const sessions = [...new Set(focused.map(sessionKey))].sort((a, b) => orderIndex(a) - orderIndex(b) || a.localeCompare(b));

  // Build the full grid — every pair × session intersection, zeroed when empty.
  const cellMap = new Map(cells.map((c) => [c.key, c]));
  const rows = pairs
    .map((pk) => ({
      pair: pk,
      // Sort rows by total trades descending so the busiest pairs sit on top.
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
    scale: computeScale(allCells, validMetric),
    hasData: focused.length > 0,
    hasAnyPair: pairs.some((p) => p !== UNASSIGNED_LABEL),
    totalTrades,
    decidedCount,
    // Filter-scoped option lists derived from the FULL visible array so the
    // user can always select a currently-visible value.
    pairOptions: [...new Set(list.map(pairKey))].sort((a, b) => a.localeCompare(b)),
    sessionOptions: [...new Set(list.map(sessionKey))].sort((a, b) => orderIndex(a) - orderIndex(b) || a.localeCompare(b)),
    period,
    metric: validMetric,
    minNormal: MIN_NORMAL,
    maxLimited: MAX_LIMITED,
    unassignedLabel: UNASSIGNED_LABEL,
  };
}

export const computePairSessionHeatmap = memoizeByArgs(computePairSessionHeatmapUncached);
