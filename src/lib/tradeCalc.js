// Trade calculation engine — the single place all live Log Trade math
// lives (the "calculator"). It is kept deliberately pure (no React, no
// imports beyond these local helpers) so it can be unit-tested directly.
// The trade form (TradeFormPanel) imports these same functions and never
// re-implements them, so the on-form preview and the saved record always
// share one calculation path.

import { todayISO } from './utils';

const DEFAULT_USDJPY = 150;

const INDICES = ['US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225'];
const CRYPTO = ['BTCUSD', 'ETHUSD', 'SOLUSD'];

export function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

export function num(value) {
  if (isBlank(value)) return null;
  const n = Number(value);
  // Reject anything that isn't a finite real number (NaN, Infinity, etc.) so
  // downstream math can never be poisoned by a non-numeric input.
  return Number.isFinite(n) ? n : null;
}

// Per-asset pip/point value (USD per 1 pip × 1.0 lot) — the heart of the
// position size engine. Everything else derives from these two numbers.
export function getLotConfig(instrument, entryPrice) {
  const instr = typeof instrument === 'string' ? instrument : '';
  if (instr === 'XAUUSD') return { pip: 0.1, pipValue: 10, unit: 'Pips' };
  if (instr === 'XAGUSD') return { pip: 0.01, pipValue: 50, unit: 'Pips' };
  if (INDICES.includes(instr)) return { pip: 1, pipValue: 1, unit: 'Points' };
  if (CRYPTO.includes(instr)) return { pip: 1, pipValue: 1, unit: 'Points' };

  // Forex — standard 100,000-unit lot.
  if (instr.endsWith('JPY')) {
    const usdJpy = instr === 'USDJPY' && entryPrice > 0 ? entryPrice : DEFAULT_USDJPY;
    return { pip: 0.01, pipValue: 1000 / usdJpy, unit: 'Pips' };
  }
  if (instr.startsWith('USD') && entryPrice > 0) {
    // USDCAD / USDCHF: $10/pip in the quote currency, converted to USD.
    return { pip: 0.0001, pipValue: 10 / entryPrice, unit: 'Pips' };
  }
  return { pip: 0.0001, pipValue: 10, unit: 'Pips' };
}

// All live trade math lives here — the trader never calculates anything.
// Everything updates instantly on every keystroke.
export function computeDerived(form) {
  const entry = num(form.entryPrice);
  const exit = num(form.exitPrice);
  const sl = num(form.stopLoss);
  const tp = num(form.takeProfit);
  const riskPct = num(form.riskPercent);
  const balance = num(form.accountBalance);
  const lot = num(form.contracts);

  const cfg = getLotConfig(form.instrument, entry || 0);

  const hasEntry = entry !== null;
  const hasExit = exit !== null;
  const hasSL = sl !== null;
  const hasTP = tp !== null;
  const hasRisk = riskPct !== null && riskPct > 0;
  const hasBalance = balance !== null && balance > 0;

  // Friendly warnings that never block logging, but keep the user honest.
  const warnings = [];
  if (hasEntry && hasSL && Math.abs(entry - sl) < 0.000000001) {
    warnings.push('Stop Loss cannot be equal to Entry Price.');
  }
  if (hasRisk && riskPct <= 0) warnings.push('Risk % must be greater than 0.');
  if (hasBalance && balance <= 0) warnings.push('Account Balance must be greater than 0.');
  if (hasEntry && entry <= 0) warnings.push('Entry Price must be greater than 0.');
  if (hasSL && sl <= 0) warnings.push('Stop Loss must be greater than 0.');
  if (hasTP && tp <= 0) warnings.push('Take Profit must be greater than 0.');

  // Risk Amount ($) = Balance × Risk %
  let riskAmount = 0;
  if (hasRisk && hasBalance) riskAmount = (balance * riskPct) / 100;

  // Stop distance in price, pips/points, and pip value
  const riskPerUnit = hasEntry && hasSL ? Math.abs(entry - sl) : 0;
  const stopPips = riskPerUnit > 0 && cfg.pip > 0 ? riskPerUnit / cfg.pip : 0;
  const riskValue = stopPips * cfg.pipValue;
  // Planned R:R from SL / TP (and reward distance)
  const rewardPerUnit = hasEntry && hasTP ? Math.abs(tp - entry) : 0;
  const rewardPips = rewardPerUnit > 0 && cfg.pip > 0 ? rewardPerUnit / cfg.pip : 0;
  let plannedRR = 0;
  if (riskValue > 0) {
    plannedRR = (rewardPerUnit > 0 ? rewardPips * cfg.pipValue : 0) / riskValue;
  } else if (hasEntry && hasSL && hasTP) {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (risk > 0) plannedRR = reward / risk;
  }

  // Lot / position size — fully automatic. position size can never drop
  // to zero: when no balance/risk sizing is available it falls back to the
  // manual lot size, else a single lot, so the recorded lot, RR and PnL
  // never collapse.
  const manualLot = lot !== null && lot > 0;
  const autoLot = riskValue > 0 && riskAmount > 0 ? riskAmount / riskValue : 0;
  const qty = manualLot ? lot : autoLot > 0 ? autoLot : 1;

  // Potential profit at the take profit level.
  const potentialProfit = plannedRR > 0 && riskAmount > 0 ? plannedRR * riskAmount : 0;

  // PnL ($) — (exit - entry) scaled to the instrument's per-price-point,
  // per-lot dollar value, then multiplied by the position's lot size.
  // Built from the same cfg.pipValue/pip used to size the position, so the
  // displayed PnL always matches the calculator and the saved record.
  let pnl = 0;
  if (hasEntry && hasExit) {
    const directionMultiplier = form.direction === 'Buy' ? 1 : -1;
    const valuePerPricePoint = cfg.pipValue / cfg.pip; // $ per 1.0 price move, per 1.0 lot
    const effQty = qty > 0 ? qty : 1; // fall back to 1 lot if never sized
    pnl = (exit - entry) * directionMultiplier * valuePerPricePoint * effQty;
  }

  // PnL (%) vs account balance
  let pnlPct = 0;
  if (hasBalance) pnlPct = (pnl / balance) * 100;

  // Realized R multiple (how many R the trade actually returned)
  let realizedRR = 0;
  if (riskAmount > 0) realizedRR = pnl / riskAmount;

  // Result (auto)
  let result = '';
  if (hasEntry && hasExit) result = pnl > 0 ? 'Win' : pnl < 0 ? 'Loss' : 'BE';

  // Trade duration (HH:MM)
  let duration = '';
  if (form.entryTime && form.exitTime) {
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    let diff = toMin(form.exitTime) - toMin(form.entryTime);
    if (diff < 0) diff += 24 * 60;
    if (diff > 0) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  }

  return {
    cfg,
    riskAmount,
    stopPips,
    rewardPips,
    plannedRR,
    realizedRR,
    potentialProfit,
    qty,
    autoLot,
    pnl,
    pnlPct,
    result,
    duration,
    warnings,
  };
}

export function validateTrade(form) {
  const errors = {};
  if (!form.accountId) errors.accountId = 'Select an account for this trade';

  const riskPct = num(form.riskPercent);
  if (!isBlank(form.riskPercent)) {
    if (riskPct === null) errors.riskPercent = 'Enter a valid number';
    else if (riskPct <= 0) errors.riskPercent = 'Must be greater than 0';
    else if (riskPct > 100) errors.riskPercent = 'Cannot exceed 100%';
  }

  const lot = num(form.contracts);
  if (!isBlank(form.contracts) && (lot === null || lot <= 0)) {
    errors.contracts = 'Enter a valid lot size';
  }

  const entry = num(form.entryPrice);
  const entryIsValid = entry !== null;

  const sl = num(form.stopLoss);
  if (!isBlank(form.stopLoss)) {
    if (sl === null) errors.stopLoss = 'Enter a valid number';
    else if (sl <= 0) errors.stopLoss = 'Must be greater than 0';
    else if (entryIsValid && form.direction === 'Buy' && sl >= entry) errors.stopLoss = 'Must be below Entry for a Buy';
    else if (entryIsValid && form.direction === 'Sell' && sl <= entry) errors.stopLoss = 'Must be above Entry for a Sell';
  }

  const tp = num(form.takeProfit);
  if (!isBlank(form.takeProfit)) {
    if (tp === null) errors.takeProfit = 'Enter a valid number';
    else if (tp <= 0) errors.takeProfit = 'Must be greater than 0';
    else if (entryIsValid && form.direction === 'Buy' && tp <= entry) errors.takeProfit = 'Must be above Entry for a Buy';
    else if (entryIsValid && form.direction === 'Sell' && tp >= entry) errors.takeProfit = 'Must be below Entry for a Sell';
  }

  return errors;
}

export const BLANK = {
  accountId: '',
  date: todayISO(),
  entryTime: '',
  exitTime: '',
  instrument: 'EURUSD',
  direction: 'Buy',
  session: '',
  timeframe: '',
  model: '',
  entryPrice: '',
  exitPrice: '',
  contracts: '',
  stopLoss: '',
  takeProfit: '',
  riskPercent: '',
  rr: '',
  positionSize: '',
  netPnl: '',
  commission: '',
  result: '',
  planId: '',
  rating: 6,
  riskChecklist: {},
  tradeChecklist: {},
  tradeGrade: '',
  emotion: '',
  mistakes: {},
  confluences: '',
  tradeManagement: '',
  notes: '',
  lessonsLearned: '',
  screenshot: '',
  tags: [],
  psychology: {},
};