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

  const bestTrade = sorted.length ? Math.max(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;
  const worstTrade = sorted.length ? Math.min(...sorted.map((t) => Number(t.netPnl) || 0)) : 0;

  // current streak: consecutive wins or losses from most recent trade backwards
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

  // best historical winning streak (consecutive Win results; BE/Loss breaks the chain)
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

  // simple trend: compare second half of trades vs first half chronologically
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

  // equity curve
  let running = 0;
  const equityCurve = sorted.map((t, i) => {
    running += Number(t.netPnl) || 0;
    return { index: i + 1, date: t.date, equity: Number(running.toFixed(2)) };
  });

  // breakdown pie
  const breakdown = [
    { name: 'Wins', value: wins.length, color: '#2fd66e' },
    { name: 'Losses', value: losses.length, color: '#ff4d5e' },
    { name: 'Breakeven', value: sorted.length - wins.length - losses.length, color: '#9a9aa3' },
  ].filter((d) => d.value > 0);

  // model performance
  const modelMap = {};
  sorted.forEach((t) => {
    const key = t.model || 'Unassigned';
    if (!modelMap[key]) modelMap[key] = { model: key, trades: 0, wins: 0, losses: 0, netPnl: 0 };
    modelMap[key].trades += 1;
    if (t.result === 'Win') modelMap[key].wins += 1;
    if (t.result === 'Loss') modelMap[key].losses += 1;
    modelMap[key].netPnl += Number(t.netPnl) || 0;
  });
  const modelPerformance = Object.values(modelMap)
    .map((m) => ({
      ...m,
      winPct: m.wins + m.losses ? (m.wins / (m.wins + m.losses)) * 100 : 0,
    }))
    .sort((a, b) => b.netPnl - a.netPnl);

  // calendar day map: date -> { pnl, count }
  const dayMap = {};
  sorted.forEach((t) => {
    if (!t.date) return;
    if (!dayMap[t.date]) dayMap[t.date] = { pnl: 0, count: 0 };
    dayMap[t.date].pnl += Number(t.netPnl) || 0;
    dayMap[t.date].count += 1;
  });

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    netPnl,
    tradeWinPct,
    dailyWinPct,
    avgRR,
    profitFactor,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    streak,
    streakType,
    bestWinStreak,
    trend,
    equityCurve,
    breakdown,
    modelPerformance,
    dayMap,
  };
}
