import { describe, it, expect } from 'vitest';
import {
  computeDerived,
  getLotConfig,
  validateTrade,
  num,
  BLANK,
} from '../tradeCalc';

/**
 * Tests for the shared Log Trade calculation engine (src/lib/tradeCalc.js).
 * These pin the CURRENT behavior of the engine so the historical
 * "price/risk fields stop calculating" regression can never return.
 */

describe('computeDerived — PnL, PnL%, RR, Risk $, Risk %', () => {
  it('computes a winning EURUSD Buy trade (manual 1 lot)', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      exitPrice: '1.10200',
      stopLoss: '1.09900',
      takeProfit: '1.10400',
      riskPercent: '1',
      accountBalance: '10000',
      contracts: '',
    });

    // 20 pips × $10/pip × 1 lot = $200
    expect(d.pnl).toBeCloseTo(200, 5);
    // Risk amount = 1% of 10,000
    expect(d.riskAmount).toBeCloseTo(100, 5);
    // pnl %) 200 / 10000 = 2%
    expect(d.pnlPct).toBeCloseTo(2, 5);
    expect(d.result).toBe('Win');
  });

  it('computes a losing EURUSD buy', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      exitPrice: '1.09800', // -20 pips
      stopLoss: '1.09900',
      takeProfit: '1.10400',
      riskPercent: '1', // 1% risk on 10k = $100 → 1.0 lot
      accountBalance: '10000',
      contracts: '',
    });
    expect(d.pnl).toBeCloseTo(-200, 5);
    expect(d.result).toBe('Loss');
    expect(d.pnlPct).toBeCloseTo(-2, 5);
  });

  it('derives stop distance, risk value and planned reward', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      stopLoss: '1.09900', // 10 pips risk
      takeProfit: '1.10200', // 20 pips reward
    });
    expect(d.stopPips).toBeCloseTo(10, 5);
    expect(d.rewardPips).toBeCloseTo(20, 5);
    // riskValue = 10 pips * $10/pip per lot = $100 per 1.0 lot
    expect(d.plannedRR).toBeCloseTo(2, 5);
  });

  it('derives an exact 1.0 lot from balance + risk %', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      stopLoss: '1.09900', // 10 pips = $100 price-value
      riskPercent: '10', // risk $100 on a $1,000 balance
      accountBalance: '1000',
    });
    // riskAmount = 100, riskValue = 100 → 1.0 lot
    expect(d.autoLot).toBeCloseTo(1, 5);
    expect(d.qty).toBeCloseTo(1, 5);
  });

  it('scales lot size down for small accounts', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      stopLoss: '1.09900', // risk $100 / 1.0 lot
      riskPercent: '1', // risk $10 on a $1,000 balance
      accountBalance: '1000',
    });
    expect(d.autoLot).toBeCloseTo(0.1, 5);
    // falls back to a "manual" qty min of 1 lot when nothing to size from
  });

  it('computes realized R multiple', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      exitPrice: '1.10200', // +$200
      stopLoss: '1.09900',
      riskPercent: '2',
      accountBalance: '5000', // risk $100
      contracts: '1',
    });
    expect(d.realizedRR).toBeCloseTo(2, 5);
  });

  it('computes trade duration', () => {
    const d = computeDerived({ entryTime: '09:00', exitTime: '10:15' });
    expect(d.duration).toBe('1h 15m');
    const short = computeDerived({ entryTime: '09:00', exitTime: '09:30' });
    expect(short.duration).toBe('30m');
    // overnight
    const overnight = computeDerived({ entryTime: '23:00', exitTime: '01:30' });
    expect(overnight.duration).toBe('2h 30m');
  });

  it('treats missing exit as an open trade (no fabricated result/PnL)', () => {
    const d = computeDerived({ instrument: 'EURUSD', entryPrice: '1.10000' });
    expect(d.result).toBe('');
    expect(d.pnl).toBe(0);
    expect(d.qty).toBe(1);
  });
});

describe('computeDerived — instrument handling', () => {
  it('XAUUSD uses $10 per pip at 0.1 pip size', () => {
    const d = computeDerived({
      instrument: 'XAUUSD',
      direction: 'Buy',
      entryPrice: '2000',
      exitPrice: '2015', // 150 pips × $10 = $1500
    });
    expect(d.cfg.pip).toBe(0.1);
    expect(d.cfg.pipValue).toBe(10);
    expect(d.pnl).toBeCloseTo(1500, 5);
  });

  it('indices (US30) use $1 per point', () => {
    const cfg = getLotConfig('US30');
    expect(cfg.unit).toBe('Points');
    const d = computeDerived({
      instrument: 'US30',
      direction: 'Buy',
      entryPrice: '45000',
      exitPrice: '45100', // +100 points × $1 = $100
    });
    expect(d.pnl).toBeCloseTo(100, 5);
  });

  it('crypto (BTCUSD) uses $1 per point', () => {
    const d = computeDerived({
      instrument: 'BTCUSD',
      direction: 'Buy',
      entryPrice: '60000',
      exitPrice: '60100', // +100 points × $1 = $100
    });
    expect(d.pnl).toBeCloseTo(100, 5);
    expect(d.cfg.unit).toBe('Points');
  });

  it('JPY pairs use the pip config (default feed pricing)', () => {
    const cfg = getLotConfig('USDJPY', 150);
    expect(cfg.pip).toBe(0.01);
    // Entry passed → USDJPY uses the real price as the feed:
    expect(cfg.pipValue).toBeCloseTo(1000 / 150, 5);
  });

  it('USD-quoted pairs (USDCAD / USDCHF) size from the real price, never crash', () => {
    // $10/pip in CAD/CHF, converted to USD at the feed price.
    expect(getLotConfig('USDCAD', 1.35).pipValue).toBeCloseTo(10 / 1.35, 5);
    expect(getLotConfig('USDCHF', 0.91).pipValue).toBeCloseTo(10 / 0.91, 5);

    const d = computeDerived({
      instrument: 'USDCAD',
      direction: 'Buy',
      entryPrice: '1.3500',
      exitPrice: '1.3600', // +100 pips, same distance as the 100-pip stop → 1:1 R:R
      stopLoss: '1.3400',
      takeProfit: '1.3700',
      riskPercent: '1',
      accountBalance: '10000',
    });
    expect(Number.isFinite(d.pnl)).toBe(true);
    expect(d.riskAmount).toBeCloseTo(100, 5);
    // 100 pips of risk ≈ $740.74 per lot → auto lot ≈ 0.135, so the 1:1
    // win returns exactly the risked $100 — never a crash/NaN.
    expect(d.autoLot).toBeCloseTo(100 / (100 * (10 / 1.35)), 5);
    expect(d.pnl).toBeCloseTo(100, 5);
  });
});

describe('price/risk regression — derived values always recalc', () => {
  // The historical bug: after certain inputs the derived price/risk fields
  // "stopped calculating". These cases pin that the engine derives every
  // time, for every instrument class and both directions.
  it('short (sell) trade derives negative PnL', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Sell',
      entryPrice: '1.10000',
      exitPrice: '1.10500', // price rose → a sell loses -0.0050
      stopLoss: '1.10600',
      takeProfit: '1.09500',
    });
    expect(d.pnl).toBeCloseTo(-500, 5);
    expect(
      validateTrade({ ...BLANK, accountId: 'acc-1', entryPrice: '1.10000', stopLoss: '1.10600', takeProfit: '1.09500', direction: 'Sell' })
    ).toEqual({});
  });

  it('short (sell) WIN derives positive PnL', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Sell',
      entryPrice: '1.10000',
      exitPrice: '1.09800', // price fell → a sell wins +0.0020 = +$200
      stopLoss: '1.10600',
      takeProfit: '1.09500',
    });
    expect(d.result).toBe('Win');
    expect(d.pnl).toBeCloseTo(200, 5);
    expect(d.pnlPct).toBeCloseTo(0, 5); // no balance given, so no % yet
  });

  it('buy/loss, all four P&W result combos stay consistent', () => {
    const buyWin = computeDerived({
      instrument: 'EURUSD', direction: 'Buy', entryPrice: '1.10000', exitPrice: '1.10200',
      stopLoss: '1.09900', takeProfit: '1.10400', riskPercent: '1', accountBalance: '10000',
    });
    expect(buyWin.result).toBe('Win');
    expect(buyWin.pnl).toBeCloseTo(200, 5);

    const sellLoss = computeDerived({
      instrument: 'EURUSD', direction: 'Sell', entryPrice: '1.10000', exitPrice: '1.10200', // price rose → sell loses
    });
    expect(sellLoss.result).toBe('Loss');
    expect(sellLoss.pnl).toBeCloseTo(-200, 5);

    const sellWin = computeDerived({
      instrument: 'EURUSD', direction: 'Sell', entryPrice: '1.10000', exitPrice: '1.09800',
      stopLoss: '1.10600', takeProfit: '1.09500',
    });
    expect(sellWin.result).toBe('Win');
    expect(sellWin.pnl).toBeCloseTo(200, 5);

    const buyLoss = computeDerived({
      instrument: 'EURUSD', direction: 'Buy', entryPrice: '1.10000', exitPrice: '1.09800',
      stopLoss: '1.09900', takeProfit: '1.10400',
    });
    expect(buyLoss.result).toBe('Loss');
    expect(buyLoss.pnl).toBeCloseTo(-200, 5);
  });

  it('missing optional fields do not poison other derived values', () => {
    const base = {
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      stopLoss: '1.09900',
      takeProfit: '1.10200',
    };
    // leaving accountBalance blank → no risk amount, but RR + stop distance fine
    const d = computeDerived(base);
    expect(d.riskAmount).toBe(0);
    expect(d.stopPips).toBeCloseTo(10, 5);
    expect(d.plannedRR).toBeCloseTo(2, 5);
    expect(d.qty).toBe(1); // falls back to a single lot
  });

  it('invalid values are treated as absent, not NaN', () => {
    const d = computeDerived({ ...BLANK, entryPrice: 'abc', stopLoss: 'zzz', takeProfit: 'xyz' });
    expect(Number.isNaN(d.pnl)).toBe(false);
    expect(d.pnl).toBe(0);
    expect(d.warnings.length).toBe(0);
  });

  it('warns when stop equals entry', () => {
    const d = computeDerived({ ...BLANK, entryPrice: '1.10000', stopLoss: '1.10000' });
    expect(d.warnings).toContain('Stop Loss cannot be equal to Entry Price.');
  });
});

describe('computeLotSize — zero/invalid behaviors', () => {
  it('defaults to 1 lot when no sizing inputs exist', () => {
    const d = computeDerived({ instrument: 'EURUSD', entryPrice: '1.1' });
    expect(d.qty).toBe(1);
  });

  it('manual lot wins over auto-sizing when both present', () => {
    const d = computeDerived({
      instrument: 'EURUSD',
      direction: 'Buy',
      entryPrice: '1.10000',
      exitPrice: '1.10200',
      stopLoss: '1.09900',
      riskPercent: '1',
      accountBalance: '1000', // auto would be 0.1
      contracts: '0.5',
    });
    expect(d.qty).toBeCloseTo(0.5, 5);
    expect(d.pnl).toBeCloseTo(100, 5); // 0.5 lot × 20 pips × $10
  });
});

describe('validateTrade — required and boundary rules', () => {
  it('requires an account', () => {
    const errs = validateTrade(BLANK);
    expect(errs.accountId).toBe('Select an account for this trade');
  });

  it('rejects invalid risk % input', () => {
    const e1 = validateTrade({ ...BLANK, accountId: 'a', riskPercent: 'not-a-number' });
    expect(e1.riskPercent).toBe('Enter a valid number');
    const e2 = validateTrade({ ...BLANK, accountId: 'a', riskPercent: '-1' });
    expect(e2.riskPercent).toBe('Must be greater than 0');
    const e3 = validateTrade({ ...BLANK, accountId: 'a', riskPercent: '110' });
    expect(e3.riskPercent).toBe('Cannot exceed 100%');
  });

  it('rejects invalid lot size', () => {
    const e = validateTrade({ ...BLANK, accountId: 'a', contracts: '0' });
    expect(e.contracts).toBe('Enter a valid lot size');
  });

  it('enforces buy/sell stop and target placement around entry', () => {
    const sfx = { ...BLANK, accountId: 'a', direction: 'Buy', entryPrice: '1.10000' };
    expect(validateTrade({ ...sfx, stopLoss: '1.10100' })).toHaveProperty('stopLoss');
    expect(validateTrade({ ...sfx, takeProfit: '1.00500' })).toHaveProperty('takeProfit');
    expect(validateTrade({ ...sfx, stopLoss: '1.09900', takeProfit: '1.10200' })).toEqual({});
  });
});

describe('num helper', () => {
  it('coerces numeric strings and rejects non-finite values', () => {
    expect(num('')).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('0')).toBe(0);
    expect(num('-3.5')).toBe(-3.5);
    expect(num('abc')).toBeNull();
    expect(num(Infinity)).toBeNull();
    expect(num(NaN)).toBeNull();
  });
});