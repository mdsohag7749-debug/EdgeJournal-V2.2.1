// All calculations derive purely from the trades array.

import { computeRuleCompliance } from './ruleCompliance.js';

function sortByDate(trades) {
  return [...trades].sort((a, b) => (a.date + (a.entryTime || '')).localeCompare(b.date + (b.entryTime || '')));
}

export function computeDashboardStats(trades) {
  const sorted = sortByDate(trades);
  const total = sorted.length;

  const wins = sorted.filter((t) => t.result === 'Win');
  const losses = sorted.filter((t) => t.result === 'Loss');
  const decided = wins.length + losses.length;

  const round2 = (val) => Math.round((val + Number.EPSILON) * 100) / 100;

  const netPnl = round2(sorted.reduce((s, t) => s + (Number(t.netPnl) || 0), 0));
  const tradeWinPct = decided ? (wins.length / decided) * 100 : 0;

  // Daily win %
  const byDay = {};
  sorted.forEach((t) => {
    if (!t.date) return;
    byDay[t.date] = (byDay[t.date] || 0) + (Number(t.netPnl) || 0);
  });
  const days = Object.values(byDay);
  const winDays = days.filter((d) => d > 0).length;
  const lossDays = days.filter((d) => d < 0).length;
  const decidedDays = winDays + lossDays;
  const dailyWinPct = decidedDays ? (winDays / decidedDays) * 100 : 0;

  const avgWin = wins.length ? round2(wins.reduce((s, t) => s + (Number(t.netPnl) || 0), 0) / wins.length) : 0;
  const avgLoss = losses.length ? round2(losses.reduce((s, t) => s + (Number(t.netPnl) || 0), 0) / losses.length) : 0;
  const avgRR = avgLoss !== 0 ? round2(Math.abs(avgWin / avgLoss)) : 0;

  const grossProfit = wins.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.netPnl) || 0), 0));
  const profitFactor = grossLoss > 0 ? round2(grossProfit / grossLoss) : grossProfit > 0 ? 99.99 : 0;

  // Expectancy = (Win % * Avg Win) - (Loss % * Avg Loss)
  const winRateRatio = decided ? wins.length / decided : 0;
  const lossRateRatio = decided ? losses.length / decided : 0;
  const expectancy = round2(winRateRatio * avgWin - lossRateRatio * Math.abs(avgLoss));

  const bestTrade = sorted.length ? Math.max(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;
  const worstTrade = sorted.length ? Math.min(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;

  // Best day and worst day
  const bestDay = days.length ? Math.max(...days) : 0;
  const worstDay = days.length ? Math.min(...days) : 0;

  // Current streak
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

  // Best win streak
  let bestWinStreak = 0;
  let runningWinStreak = 0;
  sorted.forEach((t) => {
    if (t.result === 'Win') {
      runningWinStreak++;
      bestWinStreak = Math.max(bestWinStreak, runningWinStreak);
    } else {
      runningWinStreak = 0;
    }
  });

  // Trend comparisons
  let trend = null;
  if (sorted.length >= 4) {
    const mid = Math.floor(sorted.length / 2);
    const halfStats = (arr) => {
      const w = arr.filter((t) => t.result === 'Win').length;
      const l = arr.filter((t) => t.result === 'Loss').length;
      const d = w + l;
      return {
        netPnl: arr.reduce((s, t) => s + (Number(t.netPnl) || 0), 0),
        winPct: d ? (w / d) * 100 : 0,
      };
    };
    const a = halfStats(sorted.slice(0, mid));
    const b = halfStats(sorted.slice(mid));
    trend = { netPnl: b.netPnl - a.netPnl, winPct: b.winPct - a.winPct };
  }

  // Equity Curve & Max Drawdown
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve = sorted.map((t, i) => {
    running += Number(t.netPnl) || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;
    return { index: i + 1, date: t.date, equity: Number(running.toFixed(2)) };
  });

  // Daily PnL Chart Data
  const dailyPnLData = Object.entries(byDay)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, pnl]) => ({
      date,
      pnl: round2(pnl),
    }));

  // Breakdown pie
  const breakdown = [
    { name: 'Wins', value: wins.length, color: '#2fd66e' },
    { name: 'Losses', value: losses.length, color: '#ff4d5e' },
    { name: 'Breakeven', value: sorted.length - wins.length - losses.length, color: '#9a9aa3' },
  ].filter((d) => d.value > 0);

  // Group helper
  const groupBy = (keyFn) => {
    const map = {};
    sorted.forEach((t) => {
      const key = keyFn(t) || 'Unassigned';
      if (!map[key]) map[key] = { label: key, trades: 0, wins: 0, losses: 0, netPnl: 0 };
      map[key].trades += 1;
      if (t.result === 'Win') map[key].wins += 1;
      if (t.result === 'Loss') map[key].losses += 1;
      map[key].netPnl += Number(t.netPnl) || 0;
    });
    return Object.values(map)
      .map((m) => ({
        ...m,
        netPnl: round2(m.netPnl),
        winPct: m.wins + m.losses ? round2((m.wins / (m.wins + m.losses)) * 100) : 0,
      }))
      .sort((a, b) => b.netPnl - a.netPnl);
  };

  const pairPerformance = groupBy((t) => t.instrument);
  const sessionPerformance = groupBy((t) => t.session);
  const timeframePerformance = groupBy((t) => t.timeframe);
  const directionPerformance = groupBy((t) => t.direction);
  const modelPerformance = groupBy((t) => t.model);

  const topWinningPairs = [...pairPerformance].filter((p) => p.netPnl > 0).slice(0, 3);
  const topLosingPairs = [...pairPerformance].filter((p) => p.netPnl < 0).reverse().slice(0, 3);

  // Calendar day map
  const dayMap = {};
  sorted.forEach((t) => {
    if (!t.date) return;
    if (!dayMap[t.date]) dayMap[t.date] = { pnl: 0, count: 0, trades: [] };
    dayMap[t.date].pnl += Number(t.netPnl) || 0;
    dayMap[t.date].count += 1;
    dayMap[t.date].trades.push(t);
  });

  // Radar Scores (0-100) — Institutional Performance Radar. Every score
  // is derived from real trading data (never placeholders): plan
  // adherence + risk-checklist adherence feed Discipline and Risk
  // Management; win rate + R:R feed Execution; self-assessed ratings +
  // win-rate feed Psychology; daily win % feeds Consistency; profit
  // factor + win rate feed Profitability. Each is clamped to 0–100 so an
  // account with no data reports a true 0, never a fake default floor.
  const clampScore = (v) => Math.round(Math.min(100, Math.max(0, v)));

  // Real data-drove pieces (no defaults):
  const totalRated = sorted.filter((t) => Number(t.rating) > 0).length;
  const avgRatingScore = totalRated ? (sorted.reduce((s, t) => s + Number(t.rating || 0), 0) / totalRated) * 10 : 0;
  const linkedPlanCount = sorted.filter((t) => t.planId).length;
  const planLinkRate = total ? (linkedPlanCount / total) * 100 : 0;

  // Risk-checklist adherence: average % of actually-defined risk rules
  // that were followed. Falls back to "% of trades that at least defined
  // a risk %" when no checklists are present — still real data.
  let riskRules = 0;
  let riskRulesMet = 0;
  let tradesWithRiskRules = 0;
  sorted.forEach((t) => {
    const keys = Object.keys(t.riskChecklist || {});
    if (keys.length) {
      riskRules += keys.length;
      riskRulesMet += keys.filter((k) => t.riskChecklist[k]).length;
      tradesWithRiskRules += 1;
    }
  });
  const riskAdherence = riskRules
    ? (riskRulesMet / riskRules) * 100
    : total
      ? (sorted.filter((t) => t.riskPercent).length / total) * 100
      : 0;

  // Instrument-effort reward: how strong an R:R the trader takes.
  const rrScore = Math.min(100, avgRR >= 1.5 ? 90 : avgRR * 50);
  const profitFactorScore = profitFactor >= 99 ? 100 : Math.min(100, profitFactor * 40);
  const profitable = netPnl >= 0;

  const radarScores = [
    { subject: 'Discipline', score: clampScore(planLinkRate * 0.55 + riskAdherence * 0.45) },
    { subject: 'Execution', score: clampScore(tradeWinPct * 0.5 + rrScore * 0.5) },
    { subject: 'Risk Management', score: clampScore(riskAdherence * 0.6 + rrScore * 0.4) },
    { subject: 'Psychology', score: clampScore((totalRated ? avgRatingScore : 0) * 0.6 + dailyWinPct * 0.4) },
    { subject: 'Consistency', score: clampScore(dailyWinPct) },
    { subject: 'Profitability', score: clampScore(profitFactorScore * 0.6 + (profitable ? tradeWinPct : 100 - tradeWinPct) * 0.4) },
  ];

  // Dynamic Algorithmic Insights Generator
  const insights = [];
  if (topWinningPairs.length > 0) {
    insights.push({
      type: 'positive',
      title: 'Top Performing Pair',
      message: `${topWinningPairs[0].label} is your highest grossing instrument with +$${topWinningPairs[0].netPnl.toLocaleString()} Net P&L (${topWinningPairs[0].winPct}% win rate).`,
    });
  }
  if (topLosingPairs.length > 0) {
    insights.push({
      type: 'negative',
      title: 'Trading Leak Alert',
      message: `${topLosingPairs[0].label} accounts for your largest loss ($${topLosingPairs[0].netPnl.toLocaleString()}). Consider tightening your stop-loss or trade size on this asset.`,
    });
  }
  if (sessionPerformance.length > 0) {
    const bestSession = sessionPerformance[0];
    insights.push({
      type: 'neutral',
      title: 'Session Mastery',
      message: `Your trades in the ${bestSession.label || 'Default'} session yield the highest returns (${bestSession.winPct}% win rate over ${bestSession.trades} trades).`,
    });
  }
  if (expectancy > 0) {
    insights.push({
      type: 'positive',
      title: 'Positive Edge Expectancy',
      message: `Your mathematical expectancy is +$${expectancy} per trade. Your system has a positive mathematical edge.`,
    });
  } else if (expectancy < 0) {
    insights.push({
      type: 'negative',
      title: 'Negative Expectancy Warning',
      message: `Your current expectancy is -$${Math.abs(expectancy)} per trade. Review risk management and exit protocols.`,
    });
  }

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    netPnl,
    tradeWinPct,
    dailyWinPct,
    avgRR,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    bestDay: round2(bestDay),
    worstDay: round2(worstDay),
    maxDrawdown: round2(maxDrawdown),
    streak,
    streakType,
    bestWinStreak,
    trend,
    equityCurve,
    dailyPnLData,
    breakdown,
    pairPerformance,
    sessionPerformance,
    timeframePerformance,
    directionPerformance,
    modelPerformance,
    topWinningPairs,
    topLosingPairs,
    dayMap,
    radarScores,
    insights,
  };
}

const NEGATIVE_EMOTIONS = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Hesitation'];
const CALM_EMOTIONS = ['Confident', 'Calm'];

// The five review components a closed trade can complete. Each completed
// item is worth 20% of the trade's Review score (5 × 20% = 100%).
export const REVIEW_ITEMS = [
  { key: 'beforeScreenshot', label: 'Before Trade Screenshot' },
  { key: 'afterScreenshot', label: 'After Trade Screenshot' },
  { key: 'reviewSummary', label: 'Trade Review Summary' },
  { key: 'lessonLearned', label: 'Lesson Learned / Mistake' },
  { key: 'emotionReflection', label: 'Emotion & Psychology Reflection' },
];

// A trade counts as "closed" (reviewable) once it has an exit outcome.
export function isClosedTrade(t) {
  if (!t) return false;
  if (Number(t.exitPrice) > 0) return true;
  const r = (t.result || '').toLowerCase();
  return r === 'win' || r === 'loss' || r === 'be';
}

// Review score (0–100) for a single trade: completed items ÷ 5 × 100.
export function reviewScoreForTrade(t) {
  const review = t?.review || {};
  const done = REVIEW_ITEMS.filter((i) => review[i.key]).length;
  return Math.round((done / REVIEW_ITEMS.length) * 100);
}

export function reviewStatusForTrade(t) {
  return reviewScoreForTrade(t) === 100 ? 'Reviewed' : 'Pending Review';
}

// Institutional Discipline Score engine — every metric is derived from the
// account's real trades + the user's configured System data (trading models,
// risk checklist, trade checklist). No placeholders, no fake floors:
// zero trades -> every metric 0.
export function computeDisciplineScore(trades, { models = [], riskCriteria = [], checklistCriteria = [] } = {}) {
  const list = Array.isArray(trades) ? trades : [];
  const total = list.length;

  const configuredModels = (models || []).filter(Boolean);
  const configuredRisk = (riskCriteria || []).filter(Boolean);
  const configuredChecklist = (checklistCriteria || []).filter(Boolean);

  const ratio = (n, d) => (d > 0 ? (n / d) * 100 : 0);
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  // A) Plan Following — trades linked to a configured Trading Model count as
  // planned; trades without a selected model reduce plan adherence.
  const planned = list.filter((t) => t.model && configuredModels.includes(t.model)).length;
  const planFollowing = clamp(ratio(planned, total));

  // B) Rule Compliance — how faithfully the trader followed their configured
  // rules (Risk Checklist + Trade Checklist) with every logged mistake counted
  // as a break. Delegated to the shared ruleCompliance engine so the checklist
  // adherence is computed exactly once and re-used here (no duplicate
  // calculations). This replaces the previous separate Execution / Risk
  // Management pillars, which both derived from the same two checklists.
  const ruleCompliance = computeRuleCompliance(list, { riskCriteria: configuredRisk, checklistCriteria: configuredChecklist });
  const ruleFollowing = ruleCompliance.ruleScore;

  // C) Consistency — percentage of trading days that ended in profit.
  const dayMap = {};
  list.forEach((t) => {
    if (!t.date) return;
    if (!dayMap[t.date]) dayMap[t.date] = { win: 0 };
    if ((Number(t.netPnl) || 0) > 0) dayMap[t.date].win += 1;
  });
  const days = Object.values(dayMap);
  const winDays = days.filter((d) => d.win > 0).length;
  const consistency = clamp(ratio(winDays, days.length));

  // E) Emotional Control — share of emotion-tagged trades logged as calm/confident.
  const emotionTrades = list.filter((t) => t.emotion && (CALM_EMOTIONS.includes(t.emotion) || NEGATIVE_EMOTIONS.includes(t.emotion)));
  const calmTrades = emotionTrades.filter((t) => CALM_EMOTIONS.includes(t.emotion)).length;
  const emotionalControl = clamp(ratio(calmTrades, emotionTrades.length));

  // F) Review & Reflection — average Review score across all closed trades.
  // A completed trade starts at 0% and only rises as review items are done.
  const closedTrades = list.filter(isClosedTrade);
  const reviewReflection = clamp(
    closedTrades.length ? closedTrades.reduce((s, t) => s + reviewScoreForTrade(t), 0) / closedTrades.length : 0
  );

  const metrics = [
    { label: 'Plan Following', value: planFollowing },
    { label: 'Rule Compliance', value: ruleFollowing },
    { label: 'Consistency', value: consistency },
    { label: 'Emotional Control', value: emotionalControl },
    { label: 'Review & Reflection', value: reviewReflection },
  ];

  // Weighted average (equal weight per pillar).
  const score = clamp(metrics.reduce((s, m) => s + m.value, 0) / metrics.length);

  return { score, metrics, total };
}
