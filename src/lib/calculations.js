// All calculations derive purely from the trades array.

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
  const protocolPerformance = groupBy((t) => t.protocol);

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

  // Radar Scores (0-100)
  const totalRated = sorted.filter((t) => t.rating).length;
  const avgRatingScore = totalRated ? (sorted.reduce((s, t) => s + (t.rating || 5), 0) / totalRated) * 10 : 70;
  const linkedPlanCount = sorted.filter((t) => t.planId).length;
  const planLinkRate = total ? (linkedPlanCount / total) * 100 : 50;

  const radarScores = [
    { subject: 'Discipline', score: Math.round(Math.min(100, Math.max(20, planLinkRate * 0.4 + avgRatingScore * 0.6))) },
    { subject: 'Execution', score: Math.round(Math.min(100, Math.max(20, tradeWinPct * 0.6 + (profitFactor > 1.5 ? 40 : profitFactor * 20)))) },
    { subject: 'Risk', score: Math.round(Math.min(100, Math.max(20, (avgRR >= 1.5 ? 90 : avgRR * 50)))) },
    { subject: 'Psychology', score: Math.round(Math.min(100, Math.max(20, avgRatingScore))) },
    { subject: 'RR Score', score: Math.round(Math.min(100, Math.max(20, avgRR * 40))) },
    { subject: 'Consistency', score: Math.round(Math.min(100, Math.max(20, dailyWinPct))) },
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
    protocolPerformance,
    topWinningPairs,
    topLosingPairs,
    dayMap,
    radarScores,
    insights,
  };
}
