// Pure deterministic calculations ported from EdgeJournal core analytics engine

import { Trade } from '../types/models';

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number; // percentage (0 - 100)
  totalNetPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  avgTradePnl: number;
  maxWin: number;
  maxLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  expectancy: number;
  sharpeRatio?: number;
}

export function computeTradeMetrics(trades: Trade[], startingBalance: number = 10000): PerformanceMetrics {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      totalNetPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      avgTradePnl: 0,
      maxWin: 0,
      maxLoss: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      expectancy: 0,
    };
  }

  let totalNetPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;
  let maxWin = 0;
  let maxLoss = 0;

  for (const t of trades) {
    const pnl = Number(t.netPnl) || 0;
    totalNetPnl += pnl;

    if (pnl > 0) {
      winningTrades++;
      grossProfit += pnl;
      if (pnl > maxWin) maxWin = pnl;
    } else if (pnl < 0) {
      losingTrades++;
      grossLoss += Math.abs(pnl);
      if (Math.abs(pnl) > maxLoss) maxLoss = Math.abs(pnl);
    } else {
      breakEvenTrades++;
    }
  }

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const averageWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const avgTradePnl = totalTrades > 0 ? totalNetPnl / totalTrades : 0;

  let profitFactor = 0;
  if (grossLoss === 0) {
    profitFactor = grossProfit > 0 ? 999 : 0;
  } else {
    profitFactor = grossProfit / grossLoss;
  }

  const winRateDecimal = winRate / 100;
  const lossRateDecimal = totalTrades > 0 ? losingTrades / totalTrades : 0;
  const expectancy = winRateDecimal * averageWin - lossRateDecimal * averageLoss;

  // Calculate Drawdown from chronological equity curve
  const sorted = [...trades].sort((a, b) => {
    const da = `${a.entryDate} ${a.entryTime || '00:00'}`;
    const db = `${b.entryDate} ${b.entryTime || '00:00'}`;
    return da.localeCompare(db);
  });

  let runningBalance = startingBalance;
  let peakBalance = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const t of sorted) {
    runningBalance += Number(t.netPnl) || 0;
    if (runningBalance > peakBalance) {
      peakBalance = runningBalance;
    }
    const currentDrawdown = peakBalance - runningBalance;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
      maxDrawdownPercent = peakBalance > 0 ? (currentDrawdown / peakBalance) * 100 : 0;
    }
  }

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate: Math.round(winRate * 10) / 10,
    totalNetPnl: Math.round(totalNetPnl * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    averageWin: Math.round(averageWin * 100) / 100,
    averageLoss: Math.round(averageLoss * 100) / 100,
    avgTradePnl: Math.round(avgTradePnl * 100) / 100,
    maxWin: Math.round(maxWin * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 10) / 10,
    expectancy: Math.round(expectancy * 100) / 100,
  };
}

export function computeEquityCurve(trades: Trade[], startingBalance: number = 10000): Array<{ date: string; balance: number; pnl: number }> {
  const sorted = [...trades].sort((a, b) => `${a.entryDate} ${a.entryTime || ''}`.localeCompare(`${b.entryDate} ${b.entryTime || ''}`));

  let running = startingBalance;
  return sorted.map((t) => {
    running += Number(t.netPnl) || 0;
    return {
      date: t.entryDate,
      balance: running,
      pnl: Number(t.netPnl) || 0,
    };
  });
}
