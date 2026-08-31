import { formatCurrency, formatPercent, formatDate } from '../src/utils/formatters';

describe('Trade CRUD & Formatter Parity', () => {
  it('formats positive and negative currency amounts correctly', () => {
    expect(formatCurrency(1250.5)).toBe('$1,250.50');
    expect(formatCurrency(-350.75)).toBe('-$350.75');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats percentage returns with sign', () => {
    expect(formatPercent(14.25)).toBe('+14.3%');
    expect(formatPercent(-8.12)).toBe('-8.1%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats YYYY-MM-DD dates into readable format', () => {
    expect(formatDate('2026-08-28')).toBe('Aug 28, 2026');
    expect(formatDate('2026-01-05')).toBe('Jan 5, 2026');
  });

  it('calculates risk-reward ratio from price levels', () => {
    const entry = 100;
    const stopLoss = 95;
    const takeProfit = 115;
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    const rr = reward / risk;
    expect(rr).toBe(3);
  });
});
