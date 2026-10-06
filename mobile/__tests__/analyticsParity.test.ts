import { describe, it, expect } from 'vitest';
import {
  computeDetailedAnalytics,
  normalizeDirection,
  sessionFor,
  avgDurationMinutes,
  toHhMm,
} from '../src/utils/analyticsEngine';
import {
  computePairSessionHeatmap,
  computeScale,
  cellColor,
} from '../src/utils/heatmapEngine';
import { computeInstitutionalInsights } from '../src/utils/institutionalEngine';
import { computeRecommendations } from '../src/utils/recommendationsEngine';
import { Trade } from '../src/types/models';

const sampleTrades: Trade[] = [
  {
    id: 't1',
    accountId: 'acc1',
    symbol: 'EURUSD',
    direction: 'Long',
    entryDate: '2026-03-01',
    entryTime: '09:00',
    exitDate: '2026-03-01',
    exitTime: '10:30',
    entryPrice: 1.085,
    exitPrice: 1.09,
    size: 1,
    netPnl: 150,
    riskRewardRatio: 2.0,
    status: 'Closed',
    session: 'London',
    timeframe: 'M15',
    setup: 'Breakout',
    mistakes: [],
  },
  {
    id: 't2',
    accountId: 'acc1',
    symbol: 'EURUSD',
    direction: 'Short',
    entryDate: '2026-03-02',
    entryTime: '14:30',
    exitDate: '2026-03-02',
    exitTime: '15:15',
    entryPrice: 1.09,
    exitPrice: 1.095,
    size: 1,
    netPnl: -100,
    riskRewardRatio: 1.5,
    status: 'Closed',
    session: 'New York',
    timeframe: 'M5',
    setup: 'Reversal',
    mistakes: ['Late Entry'],
  },
  {
    id: 't3',
    accountId: 'acc1',
    symbol: 'NQ',
    direction: 'Long',
    entryDate: '2026-03-03',
    entryTime: '15:00',
    exitDate: '2026-03-03',
    exitTime: '16:00',
    entryPrice: 18000,
    exitPrice: 18050,
    size: 2,
    netPnl: 300,
    riskRewardRatio: 3.0,
    status: 'Closed',
    session: 'New York',
    timeframe: 'H1',
    setup: 'Breakout',
    mistakes: [],
  },
  {
    id: 't4',
    accountId: 'acc1',
    symbol: 'NQ',
    direction: 'Long',
    entryDate: '2026-03-04',
    entryTime: '09:30',
    exitDate: '2026-03-04',
    exitTime: '10:00',
    entryPrice: 18100,
    exitPrice: 18120,
    size: 1,
    netPnl: 100,
    riskRewardRatio: 2.0,
    status: 'Closed',
    session: 'London',
    timeframe: 'M15',
    setup: 'Trend Follow',
    mistakes: [],
  },
  {
    id: 't5',
    accountId: 'acc1',
    symbol: 'NQ',
    direction: 'Short',
    entryDate: '2026-03-05',
    entryTime: '15:30',
    exitDate: '2026-03-05',
    exitTime: '15:45',
    entryPrice: 18150,
    exitPrice: 18170,
    size: 1,
    netPnl: -80,
    riskRewardRatio: 1.0,
    status: 'Closed',
    session: 'New York',
    timeframe: 'M5',
    setup: 'Reversal',
    mistakes: ['Late Entry', 'Early Exit'],
  },
];

describe('Analytics Engine — Parity & Formulas', () => {
  it('calculates win rate, profit factor, net P&L, avg win, avg loss correctly', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    expect(res.total).toBe(5);
    expect(res.wins).toBe(3);
    expect(res.losses).toBe(2);
    expect(res.decided).toBe(5);
    expect(res.winRate).toBe(60); // 3 / 5 * 100
    expect(res.netPnl).toBe(370); // 150 - 100 + 300 + 100 - 80 = 370
    expect(res.grossProfit).toBe(550); // 150 + 300 + 100 = 550
    expect(res.grossLoss).toBe(180); // 100 + 80 = 180
    expect(res.avgWin).toBe(Math.round((550 / 3) * 100) / 100); // 183.33
    expect(res.avgLoss).toBe(90); // 180 / 2 = 90
    expect(res.profitFactor).toBe(Math.round((550 / 180) * 100) / 100); // 3.06
  });

  it('calculates expectancy matching canonical web formula (winRate * avgWin - lossRate * avgLoss)', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    const expectedExp = 0.6 * (550 / 3) - 0.4 * 90; // 110 - 36 = 74.00
    expect(res.expectancy).toBe(Math.round(expectedExp * 100) / 100);
  });

  it('calculates payoff ratio (avgWin / avgLoss)', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    const expectedPayoff = (550 / 3) / 90; // 2.037 -> 2.04
    expect(res.avgRR).toBe(Math.round(expectedPayoff * 100) / 100);
  });

  it('identifies best and worst trades', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    expect(res.bestTrade).toBe(300);
    expect(res.worstTrade).toBe(-100);
  });

  it('calculates streaks correctly (current and longest)', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    // Sequence: t1(W), t2(L), t3(W), t4(W), t5(L)
    // Latest is t5 (Loss), so currentLossStreak = 1, currentWinStreak = 0
    expect(res.currentLossStreak).toBe(1);
    expect(res.currentWinStreak).toBe(0);
    // Longest win streak is t3 + t4 = 2
    expect(res.longestWinStreak).toBe(2);
  });

  it('normalizes directions seamlessly (Buy/Long, Sell/Short)', () => {
    expect(normalizeDirection('Long')).toBe('Long');
    expect(normalizeDirection('Buy')).toBe('Long');
    expect(normalizeDirection('Short')).toBe('Short');
    expect(normalizeDirection('Sell')).toBe('Short');
    expect(normalizeDirection(undefined)).toBe('Unknown');
  });

  it('aggregates Long vs Short direction performance', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    const longRow = res.byDirection.find((d) => d.key === 'Long');
    const shortRow = res.byDirection.find((d) => d.key === 'Short');

    expect(longRow).toBeDefined();
    expect(longRow?.trades).toBe(3);
    expect(longRow?.wins).toBe(3);
    expect(longRow?.winRate).toBe(100);
    expect(longRow?.netPnl).toBe(550);

    expect(shortRow).toBeDefined();
    expect(shortRow?.trades).toBe(2);
    expect(shortRow?.losses).toBe(2);
    expect(shortRow?.winRate).toBe(0);
    expect(shortRow?.netPnl).toBe(-180);
  });

  it('sorts timeframes according to canonical order', () => {
    const res = computeDetailedAnalytics(sampleTrades);
    const tfKeys = res.byTimeframe.map((t) => t.key);
    // sample has M5, M15, H1
    expect(tfKeys.indexOf('M5')).toBeLessThan(tfKeys.indexOf('M15'));
    expect(tfKeys.indexOf('M15')).toBeLessThan(tfKeys.indexOf('H1'));
  });

  it('computes average trade duration in minutes', () => {
    // durations:
    // t1: 09:00 to 10:30 = 90m
    // t2: 14:30 to 15:15 = 45m
    // t3: 15:00 to 16:00 = 60m
    // t4: 09:30 to 10:00 = 30m
    // t5: 15:30 to 15:45 = 15m
    // avg = (90 + 45 + 60 + 30 + 15) / 5 = 240 / 5 = 48m
    const avg = avgDurationMinutes(sampleTrades);
    expect(avg).toBe(48);
    expect(toHhMm(avg)).toBe('48m');
  });

  it('handles empty trades dataset safely without NaN or division by zero', () => {
    const res = computeDetailedAnalytics([]);
    expect(res.total).toBe(0);
    expect(res.winRate).toBe(0);
    expect(res.profitFactor).toBe(0);
    expect(res.expectancy).toBe(0);
    expect(res.avgRR).toBe(0);
    expect(res.netPnl).toBe(0);
    expect(res.currentWinStreak).toBe(0);
    expect(res.longestWinStreak).toBe(0);
  });
});

describe('Heatmap Engine — Pair × Session Matrix', () => {
  it('builds pair × session matrix with correct trade counts and P&L', () => {
    const heatmap = computePairSessionHeatmap(sampleTrades, { metric: 'netPnl' });
    expect(heatmap.hasData).toBe(true);
    expect(heatmap.totalTrades).toBe(5);

    // Rows: NQ (3 trades), EURUSD (2 trades)
    expect(heatmap.rows[0].pair).toBe('NQ');
    expect(heatmap.rows[0].totalTrades).toBe(3);

    // Check NQ in New York session (t3: +300, t5: -80 -> net: 220, 2 trades, 1W 1L)
    const nqNyCell = heatmap.rows[0].cells.find((c) => c.session === 'New York');
    expect(nqNyCell).toBeDefined();
    expect(nqNyCell?.trades).toBe(2);
    expect(nqNyCell?.netPnl).toBe(220);
    expect(nqNyCell?.wins).toBe(1);
    expect(nqNyCell?.losses).toBe(1);
    expect(nqNyCell?.winRate).toBe(50);
    expect(nqNyCell?.status).toBe('Limited data'); // 2 decided trades <= 4
  });

  it('assigns correct sample size statuses (No data, Limited data, Normal)', () => {
    const heatmap = computePairSessionHeatmap(sampleTrades);
    // Find an empty cell (e.g. NQ in Asia)
    const empty = heatmap.rows[0].cells.find((c) => c.session === 'Asia');
    if (empty) {
      expect(empty.status).toBe('No data');
      expect(empty.decided).toBe(0);
    }
  });

  it('computes scale and cellColor properly', () => {
    const heatmap = computePairSessionHeatmap(sampleTrades, { metric: 'netPnl' });
    const scale = computeScale(heatmap.rows[0].cells, 'netPnl');
    expect(scale.maxAbs).toBeGreaterThan(0);

    const cell = heatmap.rows[0].cells.find((c) => c.session === 'New York');
    const color = cellColor(cell, 'netPnl', scale);
    expect(color).toContain('rgba(22,163,74,'); // positive pnl -> green
  });
});

describe('Institutional Insights Engine', () => {
  it('extracts highest RR session, best model, consistent session and top mistake', () => {
    const inst = computeInstitutionalInsights(sampleTrades);
    expect(inst.hasData).toBe(true);
    expect(inst.decided).toBe(5);

    // Highest RR session: London (t1: 2.0, t4: 2.0 -> avg 2.0) vs New York (t2: 1.5, t3: 3.0, t5: 1.0 -> avg 1.83)
    expect(inst.insights.rrEnvironment?.label).toBe('London');

    // Most profitable model: Breakout (t1: 150 + t3: 300 = 450)
    expect(inst.insights.bestModel?.label).toBe('Breakout');

    // Top mistake: 'Late Entry' (tagged 2 times)
    expect(inst.insights.topMistake?.name).toBe('Late Entry');
    expect(inst.insights.topMistake?.count).toBe(2);
  });
});

describe('Recommendations Engine', () => {
  it('generates actionable data-backed recommendations when >= 3 trades', () => {
    const recs = computeRecommendations(sampleTrades);
    expect(recs.limited).toBe(false);
    expect(recs.recommendations.length).toBeGreaterThan(0);
    expect(recs.recommendations.length).toBeLessThanOrEqual(5);

    // Should include recommendation for top recurring mistake 'Late Entry'
    const mistakeRec = recs.recommendations.find((r) => r.category === 'Execution');
    expect(mistakeRec).toBeDefined();
    expect(mistakeRec?.title).toContain('Late Entry');
  });

  it('returns limited status when fewer than 3 decided trades', () => {
    const recs = computeRecommendations(sampleTrades.slice(0, 2));
    expect(recs.limited).toBe(true);
    expect(recs.recommendations).toHaveLength(0);
  });
});
