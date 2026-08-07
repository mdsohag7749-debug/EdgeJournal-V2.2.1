// Smart Trade Insights — an ADDITIVE, non-AI insight layer that
// *interprets* the account's existing real trade history instead of simply
// counting the same statistics as the KPI cards. It reuses the same date
// filter (applyFocusFilter) that Performance Intelligence uses and the
// account-scoping already applied upstream in DataContext, so every insight
// is account-aware and date-aware by construction.
//
// Sample-size protection (the "don't invent conclusions from tiny samples"
// requirement). Only rules are emitted:
//   - MIN_SUPPORT = 5 : the layer stays empty until at least 5 decided trades.
//   - MIN_GROUP   = 4 : minimum decided trades in a single group before it may
//                        be declared a "strongest" session/setup.
//   - MIN_PAIR    = 4 : minimum decided trades on EACH side of a two-group
//                        comparison before two groups are compared.
//   - MIN_RATE_BASE = 5: minimum decided trades before any share/rate claim.
//
// Each rule returns an insight object or null; null means "not enough evidence",
// so no fabricated claims are ever rendered.

import { applyFocusFilter } from './performanceInsights';
import { memoizeByArgs } from './memoize';
import { SESSION_WINDOWS } from './utils';

export const MIN_SUPPORT = 5;
export const MIN_GROUP = 4;
export const MIN_PAIR = 4;
export const MIN_RATE_BASE = 5;

export const INSIGHT_CATEGORIES = ['Performance', 'Risk', 'Execution', 'Psychology', 'Mistakes', 'Consistency'];

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function fmtMoney(x) {
  const v = Number(x) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(x) {
  return `${Math.round(x)}%`;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

function winRate(arr) {
  const decided = arr.filter((t) => t.result === 'Win' || t.result === 'Loss').length;
  if (!decided) return 0;
  const wins = arr.filter((t) => t.result === 'Win').length;
  return (wins / decided) * 100;
}

function sortChronological(trades) {
  return [...trades].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));
}

function sessionOf(t) {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

function mistakeOf(t) {
  const m = t?.mistakes || {};
  return Object.keys(m).filter((k) => m[k]);
}

// A trade is treated as "FOMO-typed" if tagged that way on the emotion line,
// the psychology score, or the mistakes checklist.
function isFomoTrade(t) {
  if ((t.emotion || '').toUpperCase() === 'FOMO') return true;
  if (N(t?.psychology?.FOMO) >= 4) return true;
  const m = t?.mistakes || {};
  return !!(m['FOMO Entry'] || m.FOMO || m['News Chase']);
}

// Group decided trades by a key; returns [{ key, arr }].
function groupDecided(decided, keyFn) {
  const map = {};
  decided.forEach((t) => {
    const k = keyFn(t) || 'Unassigned';
    if (!map[k]) map[k] = { key: k, arr: [] };
    map[k].arr.push(t);
  });
  return Object.values(map);
}

// The subgroup of `rows` with the highest avg net P&L per trade, respecting the
// MIN_GROUP sample guard. Returns null when no subgroup qualifies.
function leaderOf(rows) {
  const qualified = rows
    .map((r) => ({ ...r, mean: r.arr.reduce((s, t) => s + N(t.netPnl), 0) / r.arr.length }))
    .filter((r) => r.arr.length >= MIN_GROUP);
  if (!qualified.length) return null;
  qualified.sort((a, b) => b.mean - a.mean);
  return qualified[0];
}

// ============================== PERFORMANCE ================================

// The session with the strongest avg net P&L per trade.
function ruleStrongestSession(decided) {
  const best = leaderOf(groupDecided(decided, sessionOf));
  if (!best) return null;
  return {
    category: 'Performance',
    id: 'strongestSession',
    signal: best.mean > 0 ? 'positive' : 'neutral',
    title: 'Strongest Session',
    claim: `The ${best.key} session has produced your strongest results over the selected period.`,
    detail: `Averaging ${fmtMoney(best.mean)} per trade across ${best.arr.length} trades (${winRate(best.arr).toFixed(0)}% win rate).`,
    metrics: [
      { label: 'Session', value: best.key },
      { label: 'Avg / trade', value: fmtMoney(best.mean) },
      { label: 'Sample', value: `${best.arr.length}` },
    ],
    sample: best.arr.length,
  };
}

// The trading model/setup with the strongest avg net P&L per trade.
function ruleBestSetup(decided) {
  const best = leaderOf(groupDecided(decided, (t) => t.model || 'Unassigned'));
  if (!best) return null;
  return {
    category: 'Performance',
    id: 'bestSetup',
    signal: best.mean > 0 ? 'positive' : 'neutral',
    title: 'Setup Leader',
    claim: `Your highest-performing setup is currently ${best.key}.`,
    detail: `${best.key} averages ${fmtMoney(best.mean)} per trade across ${best.arr.length} trades.`,
    metrics: [
      { label: 'Setup', value: best.key },
      { label: 'Avg / trade', value: fmtMoney(best.mean) },
      { label: 'Sample', value: `${best.arr.length}` },
    ],
    sample: best.arr.length,
  };
}

// Performance of trades taken right after a loss versus right after a win.
function ruleAfterLoss(decided) {
  const sorted = sortChronological(decided);
  const afterLoss = [];
  const afterWin = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].result;
    if (prev === 'Loss') afterLoss.push(sorted[i]);
    else if (prev === 'Win') afterWin.push(sorted[i]);
  }
  if (afterLoss.length < MIN_PAIR || afterWin.length < MIN_PAIR) return null;
  const lossMean = mean(afterLoss.map((t) => N(t.netPnl)));
  const winMean = mean(afterWin.map((t) => N(t.netPnl)));
  return {
    category: 'Performance',
    id: 'afterLoss',
    signal: lossMean < winMean ? 'warning' : 'positive',
    title: 'After a Loss',
    claim:
      lossMean < winMean
        ? 'Your average performance is weaker when trading right after a loss.'
        : 'You hold your edge when trading right after a loss.',
    detail: `Trading after a loss averages ${fmtMoney(lossMean)} per trade, versus ${fmtMoney(winMean)} after a win.`,
    metrics: [
      { label: 'After a loss', value: fmtMoney(lossMean) },
      { label: 'After a win', value: fmtMoney(winMean) },
    ],
    sample: afterLoss.length + afterWin.length,
  };
}

// ============================== RISK =======================================

function ruleRiskOnLosing(decided) {
  const losses = decided.filter((t) => t.result === 'Loss' && N(t.riskPercent) > 0);
  const wins = decided.filter((t) => t.result === 'Win' && N(t.riskPercent) > 0);
  if (losses.length < MIN_PAIR || wins.length < MIN_PAIR) return null;
  const lossRisk = mean(losses.map((t) => N(t.riskPercent)));
  const winRisk = mean(wins.map((t) => N(t.riskPercent)));
  if (Math.abs(lossRisk - winRisk) < 0.3) return null; // no meaningful difference
  return {
    category: 'Risk',
    id: 'riskOnLosing',
    signal: lossRisk > winRisk ? 'warning' : 'positive',
    title: 'Risk by Outcome',
    claim:
      lossRisk > winRisk
        ? 'Risk appears higher on your losing trades than on your winning trades.'
        : 'You take meaningfully less risk on the trades that tend to lose.',
    detail: `Average risk ${lossRisk.toFixed(2)}% on losing trades versus ${winRisk.toFixed(2)}% on winning trades.`,
    metrics: [
      { label: 'Risk on loses', value: `${lossRisk.toFixed(2)}%` },
      { label: 'Risk on wins', value: `${winRisk.toFixed(2)}%` },
    ],
    sample: losses.length + wins.length,
  };
}

// Share of risk-defined trades sized above 2% account risk.
function ruleOverRisk(decided) {
  const withRisk = decided.filter((t) => N(t.riskPercent) > 0);
  if (withRisk.length < MIN_RATE_BASE) return null;
  const over = withRisk.filter((t) => N(t.riskPercent) > 2).length;
  const share = (over / withRisk.length) * 100;
  if (over === 0 || share < 0.25) return null;
  return {
    category: 'Risk',
    id: 'overRisk',
    signal: share > 0.7 ? 'warning' : 'neutral',
    title: share > 0.7 ? 'Over-Risk Clusters' : 'Risk Discipline',
    claim:
      share > 0.7
        ? `${pct(share)} of your decided trades risk more than 2% of the account — sizable over the sample.`
        : `${pct(share)} of your risk-defined trades sit above a 2% account risk — worth watching.`,
    detail: `${over} of ${withRisk.length} risk-defined trades are sized above 2%.`,
    metrics: [{ label: 'Trades >2%', value: `${over}` }],
    sample: withRisk.length,
  };
}

// ============================== EXECUTION ===================================

// How much of total profit comes from the largest winners (concentration risk).
function ruleConcentration(decided) {
  const wins = decided.filter((t) => t.result === 'Win');
  const totalNet = decided.reduce((s, t) => s + N(t.netPnl), 0);
  if (wins.length < MIN_SUPPORT || totalNet <= 0) return null;
  const sortedWins = [...wins].sort((a, b) => N(b.netPnl) - N(a.netPnl));
  const topN = Math.max(2, Math.ceil(wins.length * 0.25));
  const sliceSum = sortedWins.slice(0, topN).reduce((s, t) => s + N(t.netPnl), 0);
  const share = (sliceSum / totalNet) * 100;
  if (share < 60) return null;
  return {
    category: 'Execution',
    id: 'concentration',
    signal: share >= 80 ? 'warning' : 'neutral',
    title: share >= 80 ? 'High Profit Concentration' : 'Profit Concentration',
    claim:
      share >= 80
        ? 'A handful of big winners is carrying most of your P&L.'
        : `Your top ${topN} winners make up a large share of total P&L.`,
    detail: `The ${topN} most profitable winners account for ${pct(share)} of your total profit.`,
    metrics: [{ label: 'Top winners share', value: pct(share) }],
    sample: wins.length,
  };
}

// The average win vs average loss relationship — interpreted, not repeated.
function ruleWinLossShape(decided) {
  const wins = decided.filter((t) => t.result === 'Win');
  const losses = decided.filter((t) => t.result === 'Loss');
  if (wins.length < MIN_PAIR || losses.length < MIN_PAIR) return null;
  const avgWin = mean(wins.map((t) => N(t.netPnl)));
  const avgLoss = Math.abs(mean(losses.map((t) => N(t.netPnl))));
  if (avgWin <= 0 || avgLoss <= 0) return null;
  const ratio = avgWin / avgLoss;
  return {
    category: 'Execution',
    id: 'winLossShape',
    signal: ratio < 1 ? 'warning' : 'positive',
    title: ratio < 1 ? 'Loss-Win Shape' : 'Winner Shape',
    claim:
      ratio < 1
        ? `Your average loss pounds weigh more than your average win.`
        : `Each win out-earns your average loss.`,
    detail: `Average win ${fmtMoney(avgWin)} versus average loss ${fmtMoney(avgLoss)} (${ratio.toFixed(2)}x).`,
    metrics: [
      { label: 'Avg win', value: fmtMoney(avgWin) },
      { label: 'Avg loss', value: `-${fmtMoney(avgLoss)}` },
    ],
    sample: wins.length + losses.length,
  };
}

// ============================== PSYCHOLOGY ==================================

// Win rate of FOMO-typed trades versus the trader's normal trades.
function ruleFomoWinRate(decided) {
  const fomo = decided.filter(isFomoTrade);
  const normal = decided.filter((t) => !isFomoTrade(t));
  if (fomo.length < MIN_PAIR || normal.length < MIN_PAIR) return null;
  const fw = winRate(fomo);
  const nw = winRate(normal);
  if (Math.abs(fw - nw) < 6) return null;
  return {
    category: 'Psychology',
    id: 'fomoWinRate',
    signal: fw < nw ? 'warning' : 'positive',
    title: 'FOMO & Win Rate',
    claim:
      fw < nw
        ? 'FOMO-typed trades have a lower win rate than your normal trades.'
        : 'FOMO-typed trades match your normal win rate.',
    detail: `FOMO trades win ${fw.toFixed(0)}% versus ${nw.toFixed(0)}% on your routine trades.`,
    metrics: [
      { label: 'FOMO win rate', value: pct(fw) },
      { label: 'Normal win rate', value: pct(nw) },
    ],
    sample: fomo.length + normal.length,
  };
}

// Average profit of trades logged under elevated disruptive emotion vs calm.
function ruleElevatedEmotion(decided) {
  const DISRUPTIVE = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress'];
  const withScore = new Set();
  const elevated = [];
  decided.forEach((t) => {
    const em = t?.psychology || {};
    if (DISRUPTIVE.some((k) => N(em[k]) >= 1)) withScore.add(t);
    const isElevated = DISRUPTIVE.some((k) => N(em[k]) >= 4) || (t.emotion && DISRUPTIVE.includes(t.emotion));
    if (isElevated) elevated.push(t);
  });
  const collarCalm = decided.filter((t) => !withScore.has(t) && !elevated.includes(t));
  if (elevated.length < MIN_GROUP || collarCalm.length < MIN_GROUP) return null;
  const emMean = mean(elevated.map((t) => N(t.netPnl)));
  const compatMean = mean(collarCalm.map((t) => N(t.netPnl)));
  if (Math.abs(emMean - compatMean) < 1) return null;
  return {
    category: 'Psychology',
    id: 'emotionDrain',
    signal: emMean < compatMean ? 'warning' : 'positive',
    title: 'Emotional Weight',
    claim:
      emMean < compatMean
        ? 'Trades taken under disruptive emotion are underperforming your calm trades.'
        : 'Your collected (calm) trades perform in line with emotional ones.',
    detail: `Elevated-emotion trades average ${fmtMoney(emMean)}, versus ${fmtMoney(compatMean)} when calm.`,
    metrics: [
      { label: 'Elevated', value: fmtMoney(emMean) },
      { label: 'Calm', value: fmtMoney(compatMean) },
    ],
    sample: elevated.length + collarCalm.length,
  };
}

// ============================== MISTAKES ===================================

function ruleFrequentMistake(decided) {
  const tally = {};
  decided.forEach((t) => {
    mistakeOf(t).forEach((k) => {
      if (!tally[k]) tally[k] = { count: 0, net: 0 };
      tally[k].count += 1;
      tally[k].net += N(t.netPnl);
    });
  });
  const rows = Object.entries(tally)
    .map(([name, v]) => ({ name, ...v }))
    .filter((r) => r.count >= 2);
  if (!rows.length) return null;
  rows.sort((a, b) => b.count - a.count);
  const top = rows[0];
  return {
    category: 'Mistakes',
    id: 'frequentMistake',
    signal: top.net < 0 ? 'warning' : 'neutral',
    title: 'Recurring Mistake',
    claim: `Your most common mistake is "${top.name}".`,
    detail: `It appears on ${top.count} trades and has contributed ${fmtMoney(top.net)} net.`,
    metrics: [
      { label: 'Mistake', value: top.name },
      { label: 'Trades', value: `${top.count}` },
    ],
    sample: top.count,
  };
}

// Share of decided trades that carried at least one recorded mistake.
function ruleMistakeRate(decided) {
  if (decided.length < MIN_RATE_BASE) return null;
  const withM = decided.filter((t) => mistakeOf(t).length > 0).length;
  const rate = (withM / decided.length) * 100;
  if (rate > 60) {
    return {
      category: 'Mistakes',
      id: 'mistakeRate',
      signal: 'warning',
      title: 'Mistake Frequency',
      claim: `Most of your trades carry at least one logged mistake.`,
      detail: `${pct(rate)} of ${decided.length} decided trades had a recorded mistake.`,
      metrics: [{ label: 'Mistake rate', value: pct(rate) }],
      sample: decided.length,
    };
  }
  if (rate < 30) {
    return {
      category: 'Mistakes',
      id: 'mistakeRate',
      signal: 'positive',
      title: 'Clean Execution',
      claim: `Your trades are largely mistake-free.`,
      detail: `Only ${pct(rate)} of ${decided.length} decided trades carried a logged mistake.`,
      metrics: [{ label: 'Mistake rate', value: pct(rate) }],
      sample: decided.length,
    };
  }
  return null;
}

// =========================== CONSISTENCY ===================================

// % of trading days that ended green.
function ruleWinDays(decided) {
  const byDay = {};
  decided.forEach((t) => {
    if (!t.date) return;
    byDay[t.date] = (byDay[t.date] || 0) + N(t.netPnl);
  });
  const days = Object.values(byDay);
  if (days.length < MIN_GROUP) return null;
  const winDays = days.filter((d) => d > 0).length;
  const rate = (winDays / days.length) * 100;
  return {
    category: 'Consistency',
    id: 'winDays',
    signal: rate >= 60 ? 'positive' : rate < 40 ? 'warning' : 'neutral',
    title: 'Profitable Days',
    claim: `You finished green on ${pct(rate)} of your trading days.`,
    detail: `${winDays} of ${days.length} trading days closed in profit.`,
    metrics: [{ label: 'Green days', value: pct(rate) }],
    sample: days.length,
  };
}

// Current winning / losing drive.
function ruleStreak(decided) {
  let bestWin = 0;
  let run = 0;
  let curType = null;
  let curLen = 0;
  sortChronological(decided).forEach((t) => {
    if (t.result === 'Win') {
      run += 1;
      bestWin = Math.max(bestWin, run);
      curType = 'Win';
      curLen += 1;
    } else if (t.result === 'Loss') {
      run = 0;
      curType = 'Loss';
      curLen += 1;
    } else {
      run = 0;
      curType = null;
      curLen = 0;
    }
  });
  if (curType === 'Win' && bestWin >= 2) {
    return {
      category: 'Consistency',
      id: 'streak',
      signal: 'positive',
      title: 'Current Momentum',
      claim: `You are on a ${curLen}-trade winning streak (best ${bestWin}).`,
      detail: `Longest winning stretch is ${bestWin} trades in a row.`,
      metrics: [{ label: 'Current streak', value: `${curLen}` }, { label: 'Best streak', value: `${bestWin}` }],
      sample: decided.length,
    };
  }
  if (curType === 'Loss' && curLen >= 3 && curLen <= 8) {
    return {
      category: 'Consistency',
      id: 'streak',
      signal: 'warning',
      title: 'Current Slump',
      claim: `You are on a ${curLen}-trade losing streak.`,
      detail: `Guard against tilt or revenge trading before your next entry.`,
      metrics: [{ label: 'Loss streak', value: `${curLen}` }],
      sample: decided.length,
    };
  }
  return null;
}

// ---- Entry point -----------------------------------------------------------

export function computeSmartInsightsUncached(trades, period = 'all') {
  const focused = applyFocusFilter(trades, period);
  const decided = focused.filter((t) => t.result === 'Win' || t.result === 'Loss');
  const sourceCount = focused.length;

  if (decided.length < MIN_SUPPORT) {
    return { insights: [], decidedCount: decided.length, sourceCount, minSupport: MIN_SUPPORT };
  }

  const candidates = [
    ruleStrongestSession(decided),
    ruleBestSetup(decided),
    ruleAfterLoss(decided),
    ruleRiskOnLosing(decided),
    ruleOverRisk(decided),
    ruleConcentration(decided),
    ruleWinLossShape(decided),
    ruleFomoWinRate(decided),
    ruleElevatedEmotion(decided),
    ruleFrequentMistake(decided),
    ruleMistakeRate(decided),
    ruleWinDays(decided),
    ruleStreak(decided),
  ].filter(Boolean);

  const ordered = [];
  INSIGHT_CATEGORIES.forEach((cat) => {
    candidates.forEach((c) => {
      if (c.category === cat) ordered.push(c);
    });
  });

  return { insights: ordered, decidedCount: decided.length, sourceCount, minSupport: MIN_SUPPORT };
}

export const computeSmartInsights = memoizeByArgs(computeSmartInsightsUncached);