// Session & Pair Intelligence — an ADDITIVE, non-AI layer that finds meaningful
// performance patterns across Trading Pair, Trading Session and the Pair+Session
// combination, using ONLY the existing saved trade data. Account scope is applied
// upstream in DataContext; the same date filter used elsewhere on Analytics is
// reused here. It does NOT re-render the global KPIs already present (best/worst
// pair & session, global win rate / P&L / R:R) — instead it produces deeper,
// contextual edges and trade-offs.
//
// Minimum-sample protection -> each group's `status`:
//   - MIN_LIMITED  = 3 : below this = "Limited Data" (never an edge).
//   - MIN_EMERGING = 5 : "Emerging Pattern" (informational, not proven).
//   - MIN_RELIABLE = 8 : "Consistent Pattern" (only this supports strong claims).
//
// Confidence = Low / Medium / High band from sample size, green-day consistency and
// return variance. Risk context: `highVar` flags a group whose return swings exceed
// expectation, so it is never praised for raw P&L alone.

import { applyFocusFilter } from './performanceInsights';

export const MIN_LIMITED = 3;
export const MIN_EMERGING = 5;
export const MIN_RELIABLE = 8;
export const MIN_STRONG_COMBO = 8;

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

const SESSION_WINDOWS = [
  { session: 'Asia', start: 0, end: 8 },
  { session: 'London', start: 8, end: 13 },
  { session: 'New York', start: 13, end: 21 },
  { session: 'After Hours', start: 21, end: 24 },
];
function sessionOf(t) {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

export function fmtMoney(x) {
  const v = N(x);
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function avgRR(trades) {
  const rrs = trades.map((t) => N(t.rr)).filter((r) => r > 0);
  if (rrs.length) return rrs.reduce((s, r) => s + r, 0) / rrs.length;
  const wins = trades.filter((t) => t.result === 'Win').map((t) => N(t.netPnl));
  const losses = trades.filter((t) => t.result === 'Loss').map((t) => Math.abs(N(t.netPnl)));
  const aw = wins.length ? wins.reduce((s, x) => s + x, 0) / wins.length : 0;
  const al = losses.length ? losses.reduce((s, x) => s + x, 0) / losses.length : 0;
  return al > 0 ? aw / al : 0;
}

function analyze(trades) {
  const decided = (trades || []).filter((t) => t.result === 'Win' || t.result === 'Loss');
  const wins = decided.filter((t) => t.result === 'Win').length;
  const losses = decided.filter((t) => t.result === 'Loss').length;
  const d = wins + losses;
  const netPnl = decided.reduce((s, t) => s + N(t.netPnl), 0);

  const returns = decided.map((t) => N(t.netPnl));
  const mean = d ? returns.reduce((s, x) => s + x, 0) / d : 0;
  const stdev = returns.length
    ? Math.sqrt(returns.reduce((s, x) => s + (x - mean) * (x - mean), 0) / returns.length)
    : 0;
  const cv = mean !== 0 ? stdev / Math.abs(mean) : stdev > 0 ? 99 : 0;

  const winRate = d ? (wins / d) * 100 : 0;
  const avgWin = wins ? decided.filter((t) => t.result === 'Win').reduce((s, t) => s + N(t.netPnl), 0) / wins : 0;
  const avgLossAbs = losses ? Math.abs(decided.filter((t) => t.result === 'Loss').reduce((s, t) => s + N(t.netPnl), 0) / losses) : 0;
  const expectancy = d ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLossAbs : 0;

  const dayMap = {};
  decided.forEach((t) => {
    if (!t.date) return;
    dayMap[t.date] = (dayMap[t.date] || 0) + N(t.netPnl);
  });
  const days = Object.values(dayMap);
  const winDays = days.filter((x) => x > 0).length;
  const lossDays = days.filter((x) => x < 0).length;
  const consistency = winDays + lossDays ? (winDays / (winDays + lossDays)) * 100 : 0;

  const mistakeCount = trades.filter((t) => (t.mistakes || {}) && Object.keys(t.mistakes || {}).some((k) => t.mistakes[k])).length;
  const mistakeRate = trades.length ? (mistakeCount / trades.length) * 100 : 0;

  const worstLoss = decided.length ? Math.min(...decided.map((t) => N(t.netPnl))) : 0;
  const highVar = cv > 1.5 || (d >= 3 && avgWin > 0 && Math.abs(worstLoss) > 2 * Math.max(avgWin, 1));

  const status = d < MIN_LIMITED ? 'Limited Data' : d < MIN_RELIABLE ? 'Emerging Pattern' : 'Consistent Pattern';

  let confScore = 30 + d * 5 + (consistency >= 50 ? 20 : 0);
  confScore += cv <= 1.5 ? 10 : cv > 3 ? -10 : 0;
  const confidence = clamp(confScore) >= 75 ? 'High' : clamp(confScore) >= 50 ? 'Medium' : 'Low';

  return {
    sample: d,
    winRate,
    netPnl,
    avgWin,
    avgLoss: avgLossAbs,
    meanRR: avgRR(trades),
    expectancy,
    consistency,
    mistakeRate,
    highVar,
    worstLoss,
    confidence,
    status,
  };
}

function makeRow(key, label, tradeArr) {
  return { key, label, ...analyze(tradeArr) };
}

// Builds rows for pairs, sessions and combos; each carries the trade array for
// the insight generator via a lookup on the same key space.
export function computeSessionPairIntelligence(trades, period = 'all') {
  const focused = period === 'all' ? trades : applyFocusFilter(trades, period);
  const decidedCount = focused.filter((t) => t.result === 'Win' || t.result === 'Loss').length;

  const groupTo = (grouping) => {
    const map = {};
    focused.forEach((t) => {
      const k = grouping(t);
      if (!k || k === 'Unknown' || k === 'Unassigned') return;
      if (!map[k]) map[k] = { key: k, arr: [] };
      map[k].arr.push(t);
    });
    return map;
  };

  const pairMap = groupTo((t) => (t.instrument || 'Unassigned').trim());
  const sessionMap = groupTo((t) => sessionOf(t));
  const comboMap = {};
  focused.forEach((t) => {
    const pair = (t.instrument || 'Unassigned').trim();
    const sess = sessionOf(t);
    if (!pair || pair === 'Unassigned') return;
    if (!sess || sess === 'Unknown') return;
    const k = `${pair}\u0001${sess}`;
    if (!comboMap[k]) comboMap[k] = [];
    comboMap[k].push(t);
  });

  const pairs = Object.entries(pairMap)
    .map(([k, v]) => makeRow(k, k, v.arr))
    .sort((a, b) => b.sample - a.sample);
  const sessions = Object.entries(sessionMap)
    .map(([k, v]) => makeRow(k, k, v.arr))
    .sort((a, b) => b.sample - a.sample);
  const combos = Object.entries(comboMap)
    .map(([k, arr]) => {
      const [pair, sess] = k.split('\u0001');
      return { key: k, pair, session: sess, ...analyze(arr) };
    })
    .sort((a, b) => b.sample - a.sample);

  const eligible = (rows, min = MIN_EMERGING) => rows.filter((r) => r.sample >= min);
  const real = (rows) => rows.filter((r) => r.status !== 'Limited Data');

  // ---- Insight generation -------------------------------------------------
  const insights = [];

  // --- Pair insights ---
  const pairEdge = real(pairs).filter((p) => p.expectancy > 0);
  if (pairEdge.length) {
    const consistentOne = pairEdge.filter((p) => p.sample >= MIN_RELIABLE && p.consistency >= 55);
    if (consistentOne.length) {
      const p = consistentOne.sort((a, b) => b.consistency - a.consistency)[0];
      insights.push({
        domain: 'Pair',
        signal: p.highVar ? 'warning' : 'positive',
        confidence: p.confidence,
        claim: `${p.label} has shown consistent positive expectancy with a sufficient sample (consistency ${Math.round(p.consistency)}%, expectancy ${fmtMoney(p.expectancy)}/trade).`,
      });
    } else {
      const p = pairEdge.sort((a, b) => b.expectancy - a.expectancy)[0];
      insights.push({
        domain: 'Pair',
        signal: p.highVar ? 'warning' : 'neutral',
        confidence: p.confidence,
        claim: `${p.label} shows positive expectancy (${fmtMoney(p.expectancy)}/trade)${p.highVar ? ' but with higher execution variance — size it carefully' : ''} (${p.sample} trades).`,
      });
    }
  }

  const profitableHighVar = real(pairs).filter((p) => p.netPnl > 0 && p.highVar);
  if (profitableHighVar.length) {
    const p = profitableHighVar.sort((a, b) => b.netPnl - a.netPnl)[0];
    insights.push({
      domain: 'Pair',
      signal: 'warning',
      confidence: p.confidence,
      claim: `${p.label} is profitable (${fmtMoney(p.netPnl)}) but carries higher execution variance / larger swings — don't treat raw P&L as steady edge.`,
    });
  }

  const inconsistent = real(pairs).filter((p) => p.netPnl > 0 && p.consistency < 45);
  if (inconsistent.length) {
    const p = inconsistent.sort((a, b) => a.consistency - b.consistency)[0];
    insights.push({
      domain: 'Pair',
      signal: 'neutral',
      confidence: p.confidence,
      claim: `${p.label} performance is currently inconsistent (green only ${Math.round(p.consistency)}% of trading days) despite positive net results.`,
    });
  }

  // --- Session insights ---
  const sessEdge = real(sessions).filter((s) => s.expectancy > 0);
  if (sessEdge.length) {
    const p = sessEdge.sort((a, b) => b.expectancy - a.expectancy)[0];
    insights.push({
      domain: 'Session',
      signal: p.highVar ? 'warning' : 'positive',
      confidence: p.confidence,
      claim: `Your ${p.label} session carries the most dependable edge right now (expectancy ${fmtMoney(p.expectancy)}/trade, ${Math.round(p.consistency)}% consistent days, ${p.sample} trades).`,
    });
  }
  const sessRisky = real(sessions).filter((s) => s.highVar && s.expectancy > 0);
  if (sessEdge.length) {
    const p = sessRisky.sort((a, b) => b.expectancy - a.expectancy)[0];
    if (p) {
      insights.push({
        domain: 'Session',
        signal: 'warning',
        confidence: p.confidence,
        claim: `${p.label} has positive expectancy but with elevated variance — results are broader across the period, watch sizing.`,
      });
    }
  }

  // --- Pair+Session combination insights (main feature; only where sample allows) ---
  const comboStrong = real(combos).filter((c) => c.sample >= MIN_STRONG_COMBO && c.expectancy > 0);
  const comboReachable = comboStrong.filter((c) => c.consistency >= 50);
  if (comboReachable.length) {
    const c = comboReachable.sort((a, b) => b.consistency - a.consistency)[0];
    insights.push({
      domain: 'Combo',
      signal: c.highVar ? 'warning' : 'positive',
      confidence: c.confidence,
      claim: `${c.pair} during ${c.session} currently shows your strongest consistency (${Math.round(c.consistency)}% green days, expectancy ${fmtMoney(c.expectancy)}/trade, ${c.sample} trades).`,
    });
  } else if (comboStrong.length) {
    const c = comboStrong.sort((a, b) => b.expectancy - a.expectancy)[0];
    insights.push({
      domain: 'Combo',
      signal: c.highVar ? 'warning' : 'neutral',
      confidence: c.confidence,
      claim: `${c.pair} during ${c.session} has positive expectancy (${fmtMoney(c.expectancy)}/trade)${c.highVar ? ' but higher risk variability' : ''} across ${c.sample} trades.`,
    });
  }

  const comboUnder = real(combos).filter((c) => c.expectancy < 0 && c.sample >= MIN_EMERGING);
  if (comboUnder.length) {
    const c = comboUnder.sort((a, b) => a.expectancy - b.expectancy)[0];
    insights.push({
      domain: 'Combo',
      signal: 'warning',
      confidence: c.confidence,
      claim: `${c.pair} during ${c.session} is currently underperforming (negative expectancy ${fmtMoney(c.expectancy)}/trade, ${c.sample} trades).`,
    });
  }

  return {
    decidedCount,
    pairs,
    sessions,
    combos,
    insights,
    minEmerging: MIN_EMERGING,
    minReliable: MIN_RELIABLE,
  };
}