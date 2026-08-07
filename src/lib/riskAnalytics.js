// Risk Analytics — an ADDITIVE companion to the Analytics module. Fully
// derived from real trade rows already loaded into DataContext (account-
// scoped upstream), so it is live, filter-aware and multi-account by
// construction. No existing module is touched.
//
// Metrics computed from stored trade fields:
//   - riskPercent            -> Average Risk % + risk histogram / win-rate
//   - riskPercent + TP/SL    -> Average Reward % (reward = risk budget x RR)
//   - result                 -> Largest winning / losing streak
//   - date + netPnl          -> equity curve -> Max / Current / Average
//                              drawdown and average recovery time

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sortChronological(trades) {
  return [...trades].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));
}

// ---- Risk / reward percentages -----------------------------------------

function averageRiskPct(trades) {
  const values = trades.map((t) => N(t.riskPercent)).filter((r) => r > 0);
  if (!values.length) return null;
  return values.reduce((s, r) => s + r, 0) / values.length;
}

// reward% = risk% x RR, with RR = TP distance / SL distance (how much of the
// risked budget is earned when the target is hit). Only trades with a usable
// stop, entry and target are counted.
function averageRewardPct(trades) {
  const values = [];
  trades.forEach((t) => {
    const riskPct = N(t.riskPercent);
    const entry = N(t.entryPrice);
    const sl = N(t.stopLoss);
    const tp = N(t.takeProfit);
    if (riskPct <= 0 || entry <= 0 || sl <= 0) return;
    const slDist = Math.abs(entry - sl);
    const tpDist = Math.abs(tp - entry);
    if (slDist <= 0 || tpDist <= 0) return;
    values.push(riskPct * (tpDist / slDist));
  });
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ---- Risk % buckets (distribution + win rate) ----------------------------

const BUCKETS = [
  { label: '≤0.5%', min: 0, max: 0.5 },
  { label: '0.5–1%', min: 0.5, max: 1 },
  { label: '1–2%', min: 1, max: 2 },
  { label: '2–3%', min: 2, max: 3 },
  { label: '3–5%', min: 3, max: 5 },
  { label: '5%+', min: 5, max: Infinity },
];

function bucketIndex(riskPct) {
  return BUCKETS.findIndex((b) => riskPct >= b.min && riskPct < b.max);
}

// Two aligned series: trade counts per risk % band, and win rate within each
// band (only decided trades count toward the win rate).
function riskBuckets(trades) {
  const map = {};
  BUCKETS.forEach((b, i) => (map[i] = { label: b.label, trades: 0, wins: 0, decided: 0 }));
  trades.forEach((t) => {
    const idx = bucketIndex(N(t.riskPercent));
    if (idx < 0) return;
    const b = map[idx];
    b.trades += 1;
    if (t.result === 'Win' || t.result === 'Loss') b.decided += 1;
    if (t.result === 'Win') b.wins += 1;
  });
  const list = Object.values(map);
  return {
    distribution: list.map((b) => ({ label: b.label, trades: b.trades })),
    winRate: list.map((b) => ({ label: b.label, trades: b.decided, winRate: b.decided ? (b.wins / b.decided) * 100 : 0 })),
  };
}

// ---- Streaks (largest consecutive run of the same result) ------------------

function longestStreaks(sorted) {
  const counts = {};
  let runKind = null;
  let run = 0;
  sorted.forEach((t) => {
    if (t.result === 'Win' || t.result === 'Loss') {
      if (t.result === runKind) run += 1;
      else {
        runKind = t.result;
        run = 1;
      }
      counts[t.result] = Math.max(counts[t.result] || 0, run);
    } else {
      runKind = null;
      run = 0;
    }
  });
  return { longestWin: counts.Win || 0, longestLoss: counts.Loss || 0 };
}

// ---- Drawdown + recovery (cumulative equity curve) --------------------------

function daysBetween(a, b) {
  const A = a ? new Date(a + 'T00:00:00') : null;
  const B = b ? new Date(b + 'T00:00:00') : null;
  if (!A || !B || isNaN(A) || isNaN(B)) return null;
  return Math.round((B - A) / 86400000);
}

// Walks a chronological cumulative net-P&L curve and returns:
//   maxDrawdown       largest peak-to-trough drop in $
//   maxDrawdownPct    that drop as a % of its running peak equity
//   currentDrawdown   distance from the all-time equity high, in $
//   currentPct        same, as a % of that high
//   averageDrawdown   mean depth ($) of each drawdown episode
//   recoveryDays      avg calendar days to climb back to a new peak
function drawdownMetrics(sortedTrades) {
  const events = (sortedTrades || []).map((t) => ({ date: t.date, pnl: N(t.netPnl) }));
  const hasCurve = events.length > 0;

  let cumulative = 0;
  let peak = 0;
  let peakDate = null;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let currentPct = 0;
  let episode = null;
  const episodes = [];
  const recoveries = [];

  events.forEach((ev) => {
    cumulative += ev.pnl;

    if (cumulative > peak) {
      // New all-time high — close any open drawdown episode and record the
      // time it took to recover back above its reference peak.
      if (episode) {
        episodes.push(episode.high - episode.trough);
        const rec = daysBetween(episode.highDate, ev.date);
        if (rec !== null) recoveries.push(rec);
        episode = null;
      }
      peak = cumulative;
      peakDate = ev.date;
      currentDrawdown = 0;
      currentPct = 0;
    } else {
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (!episode) {
        episode = { high: peak, highDate: peakDate, trough: cumulative };
      } else if (cumulative < episode.trough) {
        episode.trough = cumulative;
      }
      currentDrawdown = dd;
      currentPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  });

  if (episode) episodes.push(episode.high - episode.trough);

  const averageDrawdown = episodes.length ? episodes.reduce((s, e) => s + e, 0) / episodes.length : 0;
  const recoveryDays = recoveries.length ? recoveries.reduce((s, r) => s + r, 0) / recoveries.length : 0;

  return {
    maxDrawdown,
    maxDrawdownPct: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
    currentDrawdown,
    currentPct,
    averageDrawdown,
    recoveryDays,
    hasCurve,
  };
}

// ---- Entry point ----------------------------------------------------------

export function computeRiskAnalytics(trades) {
  const sorted = sortChronological(trades);
  const decided = sorted.filter((t) => t.result === 'Win' || t.result === 'Loss');

  const buckets = riskBuckets(sorted);
  const dd = drawdownMetrics(sorted);
  const streaks = longestStreaks(sorted);

  return {
    total: sorted.length,
    decided: decided.length,
    avgRiskPct: averageRiskPct(decided),
    avgRewardPct: averageRewardPct(decided),
    distribution: buckets.distribution,
    winRateByRisk: buckets.winRate,
    longestWinStreak: streaks.longestWin,
    longestLossStreak: streaks.longestLoss,
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownPct: dd.maxDrawdownPct,
    currentDrawdown: dd.currentDrawdown,
    currentPct: dd.currentPct,
    averageDrawdown: dd.averageDrawdown,
    recoveryDays: dd.recoveryDays,
    hasCurve: dd.hasCurve,
  };
}