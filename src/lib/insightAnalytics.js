// Institutional Insights — an ADDITIVE statistics-only analytics module
// (no AI). Reuses the existing computeAnalytics() and computeRiskAnalytics()
// engines where possible and adds only the small stat computations those
// engines don't cover (top mistake, most-consistent session, best risk band,
// and a monthly improvement slope). Every figure is derived from the real,
// account-scoped trade rows in DataContext — live, filter-aware and
// multi-account by construction. No existing module is touched.

import { computeAnalytics } from './analytics';
import { computeRiskAnalytics } from './riskAnalytics';

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function bestBy(list, metric, filterFn = () => true) {
  const rows = list.filter((g) => filterFn(g) && N(g[metric]) > 0);
  if (!rows.length) return null;
  return rows.reduce((best, g) => (N(g[metric]) > N(best[metric]) ? g : best));
}

// Most frequent mistake from the per-trade `mistakes` map.
function topMistake(trades) {
  const tally = {};
  trades.forEach((t) => {
    const m = t.mistakes;
    if (!m || typeof m !== 'object') return;
    Object.keys(m).forEach((k) => {
      const c = m[k];
      if (c && Number.isFinite(Number(c)) && Number(c) > 0) tally[k] = (tally[k] || 0) + Number(c);
      else if (c === true) tally[k] = (tally[k] || 0) + 1;
    });
  });
  const keys = Object.keys(tally);
  if (!keys.length) return null;
  const topKey = keys.reduce((a, b) => (tally[b] > tally[a] ? b : a));
  return { name: topKey, count: tally[topKey] };
}

// Linear-regression slope of a stat across an ordered array of values.
function slopeOf(values) {
  const n = values.length;
  if (n < 2) return null;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = values.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  return den === 0 ? null : num / den;
}

export function computeInstitutionalInsights(trades) {
  const a = computeAnalytics(trades);
  const risk = computeRiskAnalytics(trades);
  const decided = a.wins + a.losses;
  const hasData = decided > 0;

  // ---- simple statistics ----------------------------------------------------
  const bestPair = a.bestPair || null;
  const worstPair = a.worstPair || null;
  const bestSession = a.bestSession || null;
  const bestDay = a.bestDay || null;

  // Best risk band (highest win rate with at least one decided trade).
  const riskBand = (risk.winRateByRisk || [])
    .filter((b) => b.trades > 0 && b.winRate > 0)
    .sort((x, y) => y.winRate - x.winRate)[0] || null;

  // Highest-RR environment = session with the best average realized R:R.
  const rrEnv = bestBy(a.bySession || [], 'avgRR', (g) => N(g.avgRR) > 0);

  // Most profitable trading model (the `model` strategy field).
  const bestModel = bestBy(a.byStrategy || [], 'netPnl');

  // Most consistent session = highest win rate among sessions with >=2 decisions.
  const consistent = ((a.bySession || [])
    .filter((s) => (s.wins + s.losses) >= 2 && s.winRate > 0)
    .sort((x, y) => y.winRate - x.winRate) || [])[0] || null;

  const mistake = topMistake(trades);

  // ---- monthly improvement trend (win rate slope) ---------------------------
  const monthly = (a.monthlyPerformance || [])
    .filter((m) => m.wins + m.losses > 0)
    .map((m) => ({ label: m.label, winRate: m.winRate, decided: m.wins + m.losses }));
  const slope = monthly.length >= 2 ? slopeOf(monthly.map((m) => m.winRate)) : null;
  const direction = slope === null ? null : slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';
  const trend = {
    direction,
    slope: slope === null ? null : Math.round(slope * 100) / 100,
    monthly,
  };

  return {
    hasData: decided > 0,
    decided,
    insights: {
      bestPair,
      worstPair,
      bestSession,
      bestDay,
      bestRiskBand: riskBand,
      rrEnvironment: rrEnv,
      bestModel,
      consistent,
      topMistake: mistake,
    },
    trend,
  };
}