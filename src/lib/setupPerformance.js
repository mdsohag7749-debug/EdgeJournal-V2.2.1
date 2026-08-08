// Setup Performance Dashboard aggregation — an ADDITIVE layer on top of the
// canonical analytics engine. It reuses computeAnalytics() (the same engine
// that powers the rest of the Analytics page) rather than re-implementing any
// PnL / RR / win-loss math. All it adds are the per-setup metrics that the
// existing engine's per-model rows do not already carry:
//
//   - average PnL per trade
//   - best / worst single trade
//   - an explicit sample-status label (No data / Limited data / Normal)
//   - user-selectable ranking
//
// Account scope is inherited from DataContext (trades.items is already scoped
// to the selected account), so no account logic lives here. Pair / session /
// date-range filters operate on the same filtered dataset as the Analytics
// context and are applied BEFORE the engine call, exactly like the other
// additive intelligence modules (see src/lib/performanceInsights.js).
//
// Missing / empty / unknown setup values are grouped under a single
// "No Setup" bucket so trades are NEVER silently discarded.

import { computeAnalytics } from './analytics';
import { applyFocusFilter } from './performanceInsights';
import { memoizeByArgs } from './memoize';
import { dateKey, SESSION_WINDOWS } from './utils';

// Sample-size guardrails. A setup needs this many *decided* trades (Win or
// Loss) before its performance is treated as a real sample; anything smaller
// is clearly labelled so a one-trade winner is never presented as proven.
export const MIN_NORMAL = 5; // 5+ decided trades  -> Normal analysis
export const MAX_LIMITED = 4; // 1-4 decided trades -> Limited data

export const UNASSIGNED_LABEL = 'Unassigned';

export const RANK_MODES = [
  { value: 'netPnl', label: 'Net P&L' },
  { value: 'winRate', label: 'Win Rate' },
  { value: 'avgRR', label: 'Average RR' },
  { value: 'profitFactor', label: 'Profit Factor' },
];

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Session key exactly matching how the canonical analytics engine buckets
// sessions (explicit session field, falling back to entry-time heuristic) so
// the Session filter can never disagree with Analytics' bySession view.
function sessionKey(t) {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

// Keeps only trades inside the requested window. `month` / `week` delegate to
// the shared filter; `30` is a local trailing-30-day window; explicit
// dateFrom / dateTo give a deterministic range (used by tests and by the
// optional UI range picker).
export function applyPeriodFilter(list, period = 'all', dateFrom, dateTo) {
  if (!Array.isArray(list)) return [];
  let out = list;

  if (period && period !== 'all') {
    if (period === '30') {
      const start = dateKey(new Date(Date.now() - 30 * 86400000));
      out = out.filter((t) => t.date && t.date >= start);
    } else {
      out = applyFocusFilter(out, period);
    }
  }

  if (dateFrom && dateTo) {
    out = out.filter((t) => t.date && t.date >= dateFrom && t.date <= dateTo);
  }

  return out;
}

function sampleStatus(row) {
  if (row.decided === 0) return 'No data';
  if (row.decided <= MAX_LIMITED) return 'Limited data';
  return 'Normal';
}

// Stable metric comparison for ranking. "No data" rows (no decided trades)
// always sink to the bottom because there is nothing to rank by; anything
// else sorts by the chosen metric descending, tying by net P&L.
function metricCompare(a, b, metric) {
  const aNo = a.decided === 0;
  const bNo = b.decided === 0;
  if (aNo !== bNo) return aNo ? 1 : -1;
  if (metric === 'profitFactor') {
    // Keep an infinite profit factor on top (all wins, no losses).
    const ap = a.profitFactor;
    const bp = b.profitFactor;
    if (ap === Infinity || bp === Infinity) {
      if (ap === Infinity && bp === Infinity) return N(b.netPnl) - N(a.netPnl);
      return ap === Infinity ? -1 : 1;
    }
    if (bp === ap) return N(b.netPnl) - N(a.netPnl);
    return bp - ap;
  }
  const va = N(a[metric]);
  const vb = N(b[metric]);
  if (vb === va) return N(b.netPnl) - N(a.netPnl);
  return vb - va;
}

function computeSetupPerformanceUncached(trades, { period = 'all', pair = 'All', session = 'All', dateFrom, dateTo, rank = 'netPnl' } = {}) {
  const list = Array.isArray(trades) ? trades : [];

  const periodFocus = applyPeriodFilter(list, period, dateFrom, dateTo);
  const focused = periodFocus.filter(
    (t) => (pair === 'All' || !pair ? true : t.instrument === pair) && (session === 'All' || !session ? true : sessionKey(t) === session)
  );

  // Canonical engine already produces every per-model number we display —
  // trades, wins, losses, win rate, net P&L, avg RR, avg win/loss, profit
  // factor. We never recompute PnL/RR formulas here.
  const a = computeAnalytics(focused);

  // Re-derive per group the two things the engine rows don't carry: best and
  // worst single trade and average P&L/trade. The values themselves are the
  // SAME canonical t.netPnl stored on each trade (no new PnL formula).
  const extra = {};
  focused.forEach((t) => {
    const label = (t.model && String(t.model).trim()) || UNASSIGNED_LABEL;
    const pnl = N(t.netPnl);
    if (!extra[label]) extra[label] = { pnlSum: 0, trades: 0, best: pnl, worst: pnl };
    extra[label].pnlSum += pnl;
    extra[label].trades += 1;
    if (pnl > extra[label].best) extra[label].best = pnl;
    if (pnl < extra[label].worst) extra[label].worst = pnl;
  });

  const raw = (a.byStrategy || []).map((g) => {
    const label = g.label || UNASSIGNED_LABEL;
    const wins = Number(g.wins) || 0;
    const losses = Number(g.losses) || 0;
    const decided = wins + losses;
    const trades = Number(g.trades) || 0;
    const netPnl = Number(g.netPnl) || 0;
    const x = extra[label];
    const row = {
      label,
      trades,
      wins,
      losses,
      breakevens: Math.max(0, trades - wins - losses),
      decided,
      winRate: decided ? (wins / decided) * 100 : 0,
      avgRR: Number(g.avgRR) || 0,
      netPnl,
      avgPnl: trades ? netPnl / trades : 0,
      avgWin: Number(g.avgWin) || 0,
      avgLoss: Number(g.avgLoss) || 0,
      profitFactor: Number.isFinite(Number(g.profitFactor)) ? Number(g.profitFactor) : g.profitFactor === Infinity ? Infinity : 0,
      grossProfit: Number(g.grossProfit) || 0,
      grossLoss: Number(g.grossLoss) || 0,
      bestTrade: x ? x.best : 0,
      worstTrade: x ? x.worst : 0,
    };
    row.status = sampleStatus(row);
    return row;
  });

  // Group everything that exists, including "Unassigned". Never dropped.
  const setups = [...raw];
  const knownLabels = new Set(raw.map((r) => r.label));
  Object.keys(extra).forEach((label) => {
    if (knownLabels.has(label)) return;
    // Present in raw data but missing from the engine's byStrategy (should not
    // happen — byStrategy includes every model) — build a zeroed row.
    const trades = extra[label]?.trades || 0;
    const netPnl = extra[label]?.pnlSum || 0;
    setups.push({
      label,
      trades,
      wins: 0,
      losses: 0,
      breakevens: trades,
      decided: 0,
      winRate: 0,
      avgRR: 0,
      netPnl,
      avgPnl: trades ? netPnl / trades : 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      grossProfit: 0,
      grossLoss: 0,
      bestTrade: extra[label]?.best || 0,
      worstTrade: extra[label]?.worst || 0,
      status: 'No data',
    });
  });

  const metric = RANK_MODES.some((r) => r.value === rank) ? rank : 'netPnl';
  setups.sort((a, b) => metricCompare(a, b, metric));
  setups.forEach((s, i) => (s.rank = i + 1));

  const decidedCount = Number(a.wins) + Number(a.losses);
  const modeledCount = list.filter((t) => t.model && String(t.model).trim()).length;

  return {
    setups,
    totalTrades: focused.length,
    decidedCount,
    modeledCount,
    hasData: focused.length > 0,
    hasAnySetup: raw.some((r) => r.label !== UNASSIGNED_LABEL),
    // Filter-scoped option lists (derived from the full visible array so the
    // user can always select a currently-visible value).
    pairOptions: [...new Set(list.map((t) => t.instrument).filter(Boolean))].sort(),
    sessionOptions: [...new Set(list.map(sessionKey).filter((s) => s && s !== 'Unknown'))].sort(),
    period,
    rank: metric,
    minNormal: MIN_NORMAL,
    maxLimited: MAX_LIMITED,
    unassignedLabel: UNASSIGNED_LABEL,
  };
}

export const computeSetupPerformance = memoizeByArgs(computeSetupPerformanceUncached);