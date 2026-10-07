// EdgeJournal AI — Deterministic Analytics Engine for Edge AI Command Center.
//
// Calculates verified, deterministic metrics across trading history BEFORE
// any LLM interpretation takes place. Grounded strictly in user-owned trades;
// never hallucinates values, never manufactures fake trades, and never alters
// raw database records.
//
// Reuses canonical analytics rules from Phase 5 and Phase 8.

import { classifyDataCoverage, dataCoverageLabel, DATA_COVERAGE } from './canonicalContext.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Computes deterministic quick metrics and insights from a list of trades.
 * Pure function, zero side-effects, fully testable.
 *
 * @param {Array} trades - Array of account-scoped trade objects
 * @returns {Object} Deterministic metrics snapshot
 */
export function computeQuickAnalytics(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      totalTrades: 0,
      resolvedTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      totalPnl: 0,
      avgPnl: 0,
      avgR: 0,
      bestTrade: null,
      worstTrade: null,
      profitFactor: 0,
      instrumentPerformance: { list: [], best: null, worst: null },
      sessionPerformance: { list: [], best: null, worst: null },
      riskConsistency: {
        avgRiskPercent: 0,
        maxRiskPercent: 0,
        minRiskPercent: 0,
        stdDev: 0,
        adherenceRate: 100,
        isConsistent: true,
      },
      drawdownBehavior: {
        maxDrawdown: 0,
        currentDrawdown: 0,
        maxConsecutiveLosses: 0,
      },
      recentTrend: {
        last10WinRate: 0,
        prev10WinRate: 0,
        last10Pnl: 0,
        momentum: 'neutral',
      },
      journalBehavior: {
        notesRate: 0,
        mistakeRate: 0,
        topMistakes: [],
      },
      dataCoverage: {
        level: DATA_COVERAGE.NOT_ENOUGH_DATA,
        label: dataCoverageLabel(DATA_COVERAGE.NOT_ENOUGH_DATA),
        isSufficient: false,
      },
    };
  }

  // Sort trades chronologically
  const sorted = [...trades].sort((a, b) => {
    const da = (a.date || '') + (a.entryTime || '');
    const db = (b.date || '') + (b.entryTime || '');
    return da.localeCompare(db);
  });

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalPnl = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let rSum = 0;
  let rCount = 0;

  let bestPnl = -Infinity;
  let worstPnl = Infinity;
  let bestTrade = null;
  let worstTrade = null;

  const instrumentsMap = {};
  const sessionsMap = {};
  const riskList = [];
  const mistakesMap = {};
  let tradesWithNotes = 0;

  // Running equity & drawdown calculation
  let runningPnl = 0;
  let peakPnl = 0;
  let maxDrawdown = 0;
  let currentConsecLosses = 0;
  let maxConsecLosses = 0;

  for (const t of sorted) {
    const pnl = num(t.netPnl) ?? 0;
    const res = (t.result || '').toLowerCase();
    totalPnl += pnl;

    runningPnl += pnl;
    if (runningPnl > peakPnl) {
      peakPnl = runningPnl;
    }
    const dd = peakPnl - runningPnl;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }

    if (res === 'win') {
      wins += 1;
      grossWin += Math.max(0, pnl);
      currentConsecLosses = 0;
    } else if (res === 'loss') {
      losses += 1;
      grossLoss += Math.abs(Math.min(0, pnl));
      currentConsecLosses += 1;
      if (currentConsecLosses > maxConsecLosses) {
        maxConsecLosses = currentConsecLosses;
      }
    } else if (res === 'breakeven' || res === 'be') {
      breakevens += 1;
      currentConsecLosses = 0;
    }

    if (pnl > bestPnl) {
      bestPnl = pnl;
      bestTrade = { id: t.id, instrument: t.instrument, netPnl: pnl, date: t.date };
    }
    if (pnl < worstPnl) {
      worstPnl = pnl;
      worstTrade = { id: t.id, instrument: t.instrument, netPnl: pnl, date: t.date };
    }

    const r = num(t.rr);
    if (r !== null && r > 0) {
      rSum += r;
      rCount += 1;
    }

    const risk = num(t.riskPercent);
    if (risk !== null && risk >= 0) {
      riskList.push(risk);
    }

    // Instrument grouping
    const inst = (t.instrument || 'Unknown').toUpperCase().trim();
    if (!instrumentsMap[inst]) {
      instrumentsMap[inst] = { instrument: inst, trades: 0, wins: 0, losses: 0, netPnl: 0 };
    }
    instrumentsMap[inst].trades += 1;
    instrumentsMap[inst].netPnl += pnl;
    if (res === 'win') instrumentsMap[inst].wins += 1;
    if (res === 'loss') instrumentsMap[inst].losses += 1;

    // Session grouping
    const sess = (t.session || 'Unknown').trim();
    if (!sessionsMap[sess]) {
      sessionsMap[sess] = { session: sess, trades: 0, wins: 0, losses: 0, netPnl: 0 };
    }
    sessionsMap[sess].trades += 1;
    sessionsMap[sess].netPnl += pnl;
    if (res === 'win') sessionsMap[sess].wins += 1;
    if (res === 'loss') sessionsMap[sess].losses += 1;

    // Journal behavior notes
    if (t.notes && typeof t.notes === 'string' && t.notes.trim().length > 0) {
      tradesWithNotes += 1;
    }

    // Mistakes tracking
    if (t.mistakes && typeof t.mistakes === 'object') {
      const keys = Array.isArray(t.mistakes) ? t.mistakes : Object.keys(t.mistakes).filter((k) => t.mistakes[k]);
      for (const m of keys) {
        mistakesMap[m] = (mistakesMap[m] || 0) + 1;
      }
    }
  }

  const resolved = wins + losses + breakevens;
  const winRate = resolved > 0 ? (wins / resolved) * 100 : 0;
  const avgPnl = resolved > 0 ? totalPnl / resolved : 0;
  const avgR = rCount > 0 ? rSum / rCount : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const currentDrawdown = Math.max(0, peakPnl - runningPnl);

  // Instrument performance summary
  const instList = Object.values(instrumentsMap)
    .map((item) => ({
      ...item,
      winRate: item.trades > 0 ? (item.wins / item.trades) * 100 : 0,
    }))
    .sort((a, b) => b.netPnl - a.netPnl);

  const bestInstrument = instList.length > 0 ? instList[0] : null;
  const worstInstrument = instList.length > 1 ? instList[instList.length - 1] : null;

  // Session performance summary
  const sessionList = Object.values(sessionsMap)
    .map((item) => ({
      ...item,
      winRate: item.trades > 0 ? (item.wins / item.trades) * 100 : 0,
    }))
    .sort((a, b) => b.netPnl - a.netPnl);

  const bestSession = sessionList.length > 0 ? sessionList[0] : null;
  const worstSession = sessionList.length > 1 ? sessionList[sessionList.length - 1] : null;

  // Risk consistency
  let avgRiskPercent = 0;
  let maxRiskPercent = 0;
  let minRiskPercent = 0;
  let stdDev = 0;
  let disciplinedCount = 0;

  if (riskList.length > 0) {
    const sumRisk = riskList.reduce((acc, r) => acc + r, 0);
    avgRiskPercent = sumRisk / riskList.length;
    maxRiskPercent = Math.max(...riskList);
    minRiskPercent = Math.min(...riskList);

    const variance = riskList.reduce((acc, r) => acc + Math.pow(r - avgRiskPercent, 2), 0) / riskList.length;
    stdDev = Math.sqrt(variance);

    disciplinedCount = riskList.filter((r) => r <= 2.0).length;
  }

  const riskAdherenceRate = riskList.length > 0 ? (disciplinedCount / riskList.length) * 100 : 100;
  const isConsistent = stdDev <= 0.6 && maxRiskPercent <= 2.5;

  // Recent trend (last 10 vs previous 10)
  const last10 = sorted.slice(-10);
  const prev10 = sorted.slice(-20, -10);

  const l10Wins = last10.filter((t) => (t.result || '').toLowerCase() === 'win').length;
  const l10Resolved = last10.filter((t) => ['win', 'loss', 'breakeven', 'be'].includes((t.result || '').toLowerCase())).length;
  const last10WinRate = l10Resolved > 0 ? (l10Wins / l10Resolved) * 100 : 0;
  const last10Pnl = last10.reduce((acc, t) => acc + (num(t.netPnl) ?? 0), 0);

  let prev10WinRate = 0;
  if (prev10.length > 0) {
    const p10Wins = prev10.filter((t) => (t.result || '').toLowerCase() === 'win').length;
    const p10Resolved = prev10.filter((t) => ['win', 'loss', 'breakeven', 'be'].includes((t.result || '').toLowerCase())).length;
    prev10WinRate = p10Resolved > 0 ? (p10Wins / p10Resolved) * 100 : 0;
  }

  let momentum = 'neutral';
  if (last10.length >= 5) {
    if (last10WinRate > prev10WinRate + 10 && last10Pnl > 0) momentum = 'improving';
    else if (last10WinRate < prev10WinRate - 10 || last10Pnl < 0) momentum = 'cooling';
  }

  // Journal behavior
  const topMistakes = Object.entries(mistakesMap)
    .map(([mistake, count]) => ({ mistake, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const coverageLevel = classifyDataCoverage(sorted.length);

  return {
    totalTrades: sorted.length,
    resolvedTrades: resolved,
    wins,
    losses,
    breakevens,
    winRate: Math.round(winRate * 10) / 10,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgPnl: Math.round(avgPnl * 100) / 100,
    avgR: Math.round(avgR * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    bestTrade,
    worstTrade,
    instrumentPerformance: {
      list: instList,
      best: bestInstrument,
      worst: worstInstrument,
    },
    sessionPerformance: {
      list: sessionList,
      best: bestSession,
      worst: worstSession,
    },
    riskConsistency: {
      avgRiskPercent: Math.round(avgRiskPercent * 100) / 100,
      maxRiskPercent: Math.round(maxRiskPercent * 100) / 100,
      minRiskPercent: Math.round(minRiskPercent * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      adherenceRate: Math.round(riskAdherenceRate * 10) / 10,
      isConsistent,
    },
    drawdownBehavior: {
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      currentDrawdown: Math.round(currentDrawdown * 100) / 100,
      maxConsecutiveLosses: maxConsecLosses,
    },
    recentTrend: {
      last10WinRate: Math.round(last10WinRate * 10) / 10,
      prev10WinRate: Math.round(prev10WinRate * 10) / 10,
      last10Pnl: Math.round(last10Pnl * 100) / 100,
      momentum,
    },
    journalBehavior: {
      notesRate: sorted.length > 0 ? Math.round((tradesWithNotes / sorted.length) * 100) : 0,
      mistakeRate: sorted.length > 0 ? Math.round((Object.keys(mistakesMap).length / sorted.length) * 100) : 0,
      topMistakes,
    },
    dataCoverage: {
      level: coverageLevel,
      label: dataCoverageLabel(coverageLevel),
      isSufficient: coverageLevel !== DATA_COVERAGE.NOT_ENOUGH_DATA && coverageLevel !== DATA_COVERAGE.LIMITED_DATA,
    },
  };
}
