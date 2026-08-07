// Risk & Execution Intelligence — an ADDITIVE, non-AI layer that interprets
// how EXISTING saved risk / execution behaviour relates to outcomes. It reads
// stored fields (risk %, result, netPnl, rr, session, model, mistakes) and does
// NOT recompute PnL, R:R, lot size or drawdown — it does not touch the Log Trade
// calculator or the analytics engine. Account scope is applied upstream in
// DataContext; the same date filter used elsewhere on Analytics is reused.
//
// It deliberately does NOT re-display the existing Risk Analytics KPIs
// (average risk %, reward %, drawdown, streaks, risk histogram...). Instead it
// INTERPRETS relationships:
//   1) Risk consistency  — is sizing roughly consistent, or rises after wins / losses?
//   2) Risk vs outcome   — do different risk levels behave differently (descriptive, not causal)?
//   3) Execution quality — mistake-tagged vs clean trades and their outcomes
//   4) Risk + mistake    — are mistakes associated with larger risk?
//   5) Risk + model      — setups that are sized very differently
//   6) Risk + session    — sizing that changes by session
//
// Minimum-sample protection (same bands as the other intelligence layers):
//   - MIN_LIMITED = 3   : below this a group is "Limited Data" — never an edge.
//   - MIN_EMERGING = 5   : "Emerging Pattern" (informational, not proven).
//   - MIN_RELIABLE = 8   : "Consistent Pattern" (only this supports strong claims).
//
// Confidence = Low / Medium / High from sample size, split size and the
// strength (magnitude) of the observed relationship.

import { applyFocusFilter } from './performanceInsights';

export const MIN_LIMITED = 3;
export const MIN_EMERGING = 5;
export const MIN_RELIABLE = 8;

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

const MISTAKE_KEYS = [
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

const hasMistakes = (t) => {
  const m = t.mistakes;
  if (!m || typeof m !== 'object') return false;
  return MISTAKE_KEYS.some((k) => m[k]);
};
const mistakesOf = (t) => {
  const m = t.mistakes;
  if (!m || typeof m !== 'object') return [];
  return MISTAKE_KEYS.filter((k) => m[k]);
};

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length);
};

const fmtRp = (x) => `${N(x).toFixed(2)}%`;
const fmtPct = (x) => `${N(x).toFixed(1)}%`;
const fmtRr = (x) => `${N(x).toFixed(2)}`;
const fmtMoney = (x) => {
  const v = N(x);
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

function groupOutcomes(trades) {
  const d = trades.filter((t) => t.result === 'Win' || t.result === 'Loss');
  const wins = d.filter((t) => t.result === 'Win').length;
  const losses = d.length - wins;
  const winRate = d.length ? (wins / d.length) * 100 : 0;
  const rr = d.map((t) => N(t.rr)).filter((r) => r > 0);
  const dayMap = {};
  d.forEach((t) => {
    if (t.date) dayMap[t.date] = (dayMap[t.date] || 0) + N(t.netPnl);
  });
  const days = Object.values(dayMap);
  const positive = days.filter((x) => x > 0).length;
  const consistency = days.length ? (positive / days.length) * 100 : 0;
  return {
    count: d.length,
    wins,
    losses,
    winRate,
    avgRR: mean(rr),
    expectancy: d.length ? d.reduce((s, t) => s + N(t.netPnl), 0) / d.length : 0,
    netPnl: d.reduce((s, t) => s + N(t.netPnl), 0),
    consistency,
  };
}

export function computeRiskExecutionIntelligence(trades, period = 'all') {
  const focused = period === 'all' ? trades : applyFocusFilter(trades, period);
  const decided = focused.filter((t) => t.result === 'Win' || t.result === 'Loss');
  const decidedCount = decided.length;

  const riskTrades = decided.filter((t) => N(t.riskPercent) > 0);
  const riskVals = riskTrades.map((t) => N(t.riskPercent));

  // -- 1. RISK CONSISTENCY -------------------------------------------------
  const avgRisk = mean(riskVals);
  const medianRisk = (() => {
    if (!riskVals.length) return 0;
    const s = [...riskVals].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  })();
  const cvRisk = avgRisk !== 0 ? stdev(riskVals) / Math.abs(avgRisk) : 0;
  const riskScore = clamp(100 - cvRisk * 180); // 0-100 stability

  // risk on the trade *following* a win / a loss (chronological)
  const sorted = [...decided].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));
  const afterWin = [];
  const afterLoss = [];
  sorted.forEach((t, i) => {
    if (i === 0) return;
    const prev = sorted[i - 1];
    const r = N(t.riskPercent);
    if (r <= 0) return;
    if (prev.result === 'Win') afterWin.push(r);
    else if (prev.result === 'Loss') afterLoss.push(r);
  });
  const riskAfterWin = mean(afterWin);
  const riskAfterLoss = mean(afterLoss);
  const afterWinCount = afterWin.length;
  const afterLossCount = afterLoss.length;

  const pivot = medianRisk || avgRisk;
  const largeCount = riskVals.filter((r) => pivot > 0 && r > pivot * 1.75).length;
  const smallCount = riskVals.filter((r) => pivot > 0 && r < pivot * 0.45).length;

  // -- 2. RISK vs OUTCOME (split around median) -----------------------------
  let lowRisk = null;
  let highRisk = null;
  if (riskVals.length >= MIN_EMERGING && pivot > 0) {
    const low = riskTrades.filter((t) => N(t.riskPercent) <= pivot);
    const high = riskTrades.filter((t) => N(t.riskPercent) > pivot);
    lowRisk = { ...groupOutcomes(low) };
    highRisk = { ...groupOutcomes(high) };
  }

  // -- 3. EXECUTION QUALITY -------------------------------------------------
  const cleanTrades = decided.filter((t) => !hasMistakes(t));
  const mistakeTrades = decided.filter((t) => hasMistakes(t));
  const clean = groupOutcomes(cleanTrades);
  const mistaken = groupOutcomes(mistakeTrades);
  const perMistake = MISTAKE_KEYS.map((name) => {
    const set = decided.filter((t) => mistakesOf(t).includes(name));
    return { name, ...groupOutcomes(set) };
  }).filter((m) => m.count > 0).sort((a, b) => b.count - a.count);

  const cleanRisk = cleanTrades.filter((t) => N(t.riskPercent) > 0).map((t) => N(t.riskPercent));
  const mistakeRisk = mistakeTrades.filter((t) => N(t.riskPercent) > 0).map((t) => N(t.riskPercent));

  // -- 5. RISK + MODEL ----------------------------------------------------
  const modelMap = {};
  focused.forEach((t) => {
    const mod = t.model && String(t.model).trim();
    if (!mod) return;
    (modelMap[mod] = modelMap[mod] || []).push(t);
  });
  const riskByModel = Object.entries(modelMap)
    .map(([name, arr]) => {
      const rs = arr.filter((t) => N(t.riskPercent) > 0).map((t) => N(t.riskPercent));
      const n = arr.filter((t) => t.result === 'Win' || t.result === 'Loss').length;
      return { name, count: n, avgRisk: rs.length ? mean(rs) : 0 };
    })
    .filter((m) => m.count >= MIN_EMERGING)
    .sort((a, b) => b.avgRisk - a.avgRisk);

  // -- 6. RISK + SESSION -----------------------------------------------------
  const SESSION_WINDOWS = [
    { session: 'Asia', start: 0, end: 8 },
    { session: 'London', start: 8, end: 13 },
    { session: 'New York', start: 13, end: 21 },
    { session: 'After Hours', start: 21, end: 24 },
  ];
  const sessionFor = (t) => {
    if (t.session) return t.session;
    const hour = parseInt((t.entryTime || '').split(':')[0], 10);
    if (Number.isNaN(hour)) return null;
    const w = SESSION_WINDOWS.find((x) => hour >= x.start && hour < x.end);
    return w ? w.session : null;
  };
  const sessionMap = {};
  focused.forEach((t) => {
    const s = sessionFor(t);
    if (!s) return;
    (sessionMap[s] = sessionMap[s] || []).push(t);
  });
  const riskBySession = Object.entries(sessionMap)
    .map(([name, arr]) => {
      const rs = arr.filter((t) => N(t.riskPercent) > 0).map((t) => N(t.riskPercent));
      const n = arr.filter((t) => t.result === 'Win' || t.result === 'Loss').length;
      return { name, count: n, avgRisk: rs.length ? mean(rs) : 0 };
    })
    .filter((m) => m.count >= MIN_EMERGING)
    .sort((a, b) => b.avgRisk - a.avgRisk);

  // ========================================================================
  // Insights (only from adequate samples)
  // ========================================================================
  const insights = [];

  const stable = riskVals.length >= MIN_EMERGING && cvRisk < 0.45;
  const winDrift = afterWinCount >= MIN_EMERGING && riskAfterWin > avgRisk * 1.25;
  const lossDrift = afterLossCount >= MIN_EMERGING && riskAfterLoss > avgRisk * 1.25;

  if (lossDrift) {
    insights.push({
      domain: 'Risk Consistency',
      signal: 'warning',
      confidence: afterLossCount >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `Risk increased on trades following losses (${fmtRp(riskAfterLoss)} vs ${fmtRp(avgRisk)} overall, ${afterLossCount} trades). Sizing spiked after drawdowns — descriptive trend, not a rule.`,
    });
  } else if (winDrift) {
    insights.push({
      domain: 'Risk Consistency',
      signal: 'neutral',
      confidence: afterWinCount >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `Risk drifted up after winning trades (${fmtRp(riskAfterWin)} avg vs ${fmtRp(avgRisk)} overall, ${afterWinCount} trades) — sizing grows with momentum rather than staying flat.`,
    });
  } else if (stable) {
    insights.push({
      domain: 'Risk Consistency',
      signal: 'positive',
      confidence: riskVals.length >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `Your risk has remained relatively consistent across trades (average ${fmtRp(avgRisk)}, low variation) — a stable sizing profile.`,
    });
  }

  if (largeCount >= MIN_EMERGING) {
    insights.push({
      domain: 'Risk Consistency',
      signal: 'warning',
      confidence: largeCount >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `${largeCount} trade(s) were sized well above your typical level (${fmtRp(avgRisk)} avg) — large outliers concentrate risk into single decisions.`,
    });
  }
  if (smallCount >= MIN_EMERGING) {
    insights.push({
      domain: 'Risk Consistency',
      signal: 'neutral',
      confidence: smallCount >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `${smallCount} trade(s) were sized well below your typical level (${fmtRp(avgRisk)} avg) — a noticeably lighter footprint on those trades.`,
    });
  }

  if (lowRisk && highRisk && highRisk.count >= MIN_EMERGING && lowRisk.count >= MIN_EMERGING) {
    const consGap = lowRisk.consistency - highRisk.consistency;
    if (consGap > 6) {
      insights.push({
        domain: 'Risk vs Outcome',
        signal: 'warning',
        confidence: Math.min(lowRisk.count, highRisk.count) >= MIN_RELIABLE ? 'High' : 'Medium',
        claim: `Lower-risk trades have shown higher consistency (${fmtPct(lowRisk.consistency)} vs ${fmtPct(highRisk.consistency)} green days, ${lowRisk.count}/${highRisk.count} trades). A correlation — higher risk behaved less consistently here, not necessarily caused it.`,
      });
    } else if (highRisk.avgRR > lowRisk.avgRR && lowRisk.winRate >= 50 && highRisk.winRate >= 50) {
      insights.push({
        domain: 'Risk vs Outcome',
        signal: 'neutral',
        confidence: 'Medium',
        claim: `Higher-risk trades returned a similar win rate but a higher average R:R (${fmtRr(highRisk.avgRR)} vs ${fmtRr(lowRisk.avgRR)}) on this sample — the extra risk appeared alongside better payoffs.`,
      });
    }
  }

  if (clean.count >= MIN_EMERGING && mistaken.count >= MIN_EMERGING) {
    const gap = clean.avgRR - mistaken.avgRR;
    if (gap > 0.25) {
      insights.push({
        domain: 'Execution Quality',
        signal: 'positive',
        confidence: Math.min(clean.count, mistaken.count) >= MIN_RELIABLE ? 'High' : 'Medium',
        claim: `Trades without recorded mistakes show a higher average R:R (${fmtRr(clean.avgRR)} vs ${fmtRr(mistaken.avgRR)}, ${clean.count}/${mistaken.count} trades) — cleaner execution tracks better risk-reward.`,
      });
    }
  }

  const worstMistake = perMistake.find((m) => m.count >= MIN_EMERGING && m.winRate < 42);
  if (worstMistake) {
    insights.push({
      domain: 'Execution Quality',
      signal: 'warning',
      confidence: worstMistake.count >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `"${worstMistake.name}" trades have historically underperformed (${fmtPct(worstMistake.winRate)} win rate across ${worstMistake.count} trades).`,
    });
  }

  const ma = mean(mistakeRisk);
  const ca = mean(cleanRisk);
  if (mistakeRisk.length >= MIN_EMERGING && cleanRisk.length >= MIN_EMERGING && ma > ca * 1.2) {
    insights.push({
      domain: 'Risk + Mistake',
      signal: 'warning',
      confidence: Math.min(mistakeRisk.length, cleanRisk.length) >= MIN_RELIABLE ? 'High' : 'Medium',
      claim: `Mistake-flagged trades trend toward higher risk (${fmtRp(ma)} avg vs ${fmtRp(ca)} clean, ${mistakeRisk.length} trades) — risk and execution errors appear together.`,
    });
  }

  if (riskByModel.length >= 2) {
    const gap = riskByModel[0].avgRisk - riskByModel[riskByModel.length - 1].avgRisk;
    if (gap > 0.5) {
      insights.push({
        domain: 'Risk + Model',
        signal: 'neutral',
        confidence: riskByModel[0].count >= MIN_RELIABLE ? 'High' : 'Medium',
        claim: `Your ${riskByModel[0].name} setup is traded with higher average risk (${fmtRp(riskByModel[0].avgRisk)}) than ${riskByModel[riskByModel.length - 1].name} (${fmtRp(riskByModel[riskByModel.length - 1].avgRisk)}) across ${riskByModel.length} setups — a descriptive sizing difference.`,
      });
    }
  }

  if (riskBySession.length >= 2) {
    const gap = riskBySession[0].avgRisk - riskBySession[riskBySession.length - 1].avgRisk;
    if (gap > 0.4) {
      insights.push({
        domain: 'Risk + Session',
        signal: 'neutral',
        confidence: riskBySession[0].count >= MIN_RELIABLE ? 'High' : 'Medium',
        claim: `Average risk is higher during ${riskBySession[0].name} (${fmtRp(riskBySession[0].avgRisk)}) than ${riskBySession[riskBySession.length - 1].name} (${fmtRp(riskBySession[riskBySession.length - 1].avgRisk)}) — not labelled good or bad, just how sizing shifts by session.`,
      });
    }
  }

  return {
    decidedCount,
    riskCount: riskVals.length,
    avgRisk,
    medianRisk,
    cvRisk,
    riskScore,
    riskAfterWin,
    riskAfterLoss,
    afterWinCount,
    afterLossCount,
    largeCount,
    smallCount,
    lowRisk,
    highRisk,
    clean,
    mistaken,
    perMistake,
    cleanAvgRisk: ca,
    mistakeAvgRisk: ma,
    riskByModel,
    riskBySession,
    insights,
    minEmerging: MIN_EMERGING,
    minReliable: MIN_RELIABLE,
  };
}