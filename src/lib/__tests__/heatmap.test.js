import { describe, it, expect } from 'vitest';
import {
  computePairSessionHeatmap,
  computeScale,
  cellColor,
  MIN_NORMAL,
  MAX_LIMITED,
  UNASSIGNED_LABEL,
} from '../heatmap';
import { computeAnalytics } from '../analytics';

const T = (o = {}) => ({
  date: '2024-01-02',
  entryTime: '09:00',
  instrument: 'EURUSD',
  session: 'London',
  result: 'Win',
  netPnl: 100,
  rr: 2,
  riskPercent: 1,
  ...o,
});

// One pair × one session, 5+ decided trades -> a single Normal cell.
function normalDataset() {
  return Array.from({ length: 6 }, (_, i) =>
    T({ instrument: 'EURUSD', session: 'London', result: i % 2 === 0 ? 'Win' : 'Loss', netPnl: i % 2 === 0 ? 100 : -40, rr: i % 2 === 0 ? 2 : 1 })
  );
}

describe('computePairSessionHeatmap — basics & grid shape', () => {
  it('empty dataset -> hasData false, no rows, no fabricated numbers', () => {
    const r = computePairSessionHeatmap([]);
    expect(r.hasData).toBe(false);
    expect(r.rows).toEqual([]);
    expect(r.sessions).toEqual([]);
    expect(r.totalTrades).toBe(0);
    expect(r.decidedCount).toBe(0);
  });

  it('one pair one session -> single Normal cell with canonical metrics', () => {
    const r = computePairSessionHeatmap(normalDataset());
    expect(r.hasData).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(r.sessions).toHaveLength(1);
    const c = r.rows[0].cells[0];
    expect(c.trades).toBe(6);
    expect(c.wins).toBe(3);
    expect(c.losses).toBe(3);
    expect(c.decided).toBe(6);
    expect(c.status).toBe('Normal');
    expect(c.winRate).toBeCloseTo(50, 1);
    expect(c.netPnl).toBeCloseTo(180, 1);
  });

  it('builds a full pair × session grid, zeroing empty intersections', () => {
    const trades = [
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 100 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'Loss', netPnl: -40 }),
      T({ instrument: 'GBPUSD', session: 'New York', result: 'Win', netPnl: 200 }),
      T({ instrument: 'GBPUSD', session: 'New York', result: 'Loss', netPnl: -30 }),
    ];
    const r = computePairSessionHeatmap(trades);
    expect(r.rows).toHaveLength(2);
    expect(r.sessions.map((s) => s.label).sort()).toEqual(['London', 'New York']);
    const eurusd = r.rows.find((row) => row.pair === 'EURUSD');
    const londonCell = eurusd.cells.find((c) => c.session === 'London');
    expect(londonCell.trades).toBe(2); // EURUSD has data in London
    expect(londonCell.status).toBe('Limited data');
  });
});

describe('computePairSessionHeatmap — canonical math reuse', () => {
  it('win rate from decided wins/losses only (BE never counted)', () => {
    const trades = [
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 100 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'Loss', netPnl: -40 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'BE', netPnl: 0 }),
    ];
    const r = computePairSessionHeatmap(trades);
    const c = r.rows[0].cells[0];
    expect(c.trades).toBe(3);
    expect(c.decided).toBe(2);
    expect(c.winRate).toBe(50);
  });

  it('average RR averages only rr > 0 values (matches engine)', () => {
    const trades = [
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 100, rr: 2 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'Loss', netPnl: -40, rr: 1 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 60, rr: 0 }),
    ];
    const r = computePairSessionHeatmap(trades);
    const c = r.rows[0].cells[0];
    expect(c.avgRR).toBeCloseTo(1.5, 5); // (2+1)/2 ; rr=0 ignored
  });

  it('profit factor from gross profit / gross loss, ∞ for all-win cells', () => {
    const mixed = [
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 100 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'Loss', netPnl: -50 }),
    ];
    const r1 = computePairSessionHeatmap(mixed);
    expect(r1.rows[0].cells[0].profitFactor).toBeCloseTo(2, 5);

    const allWin = [
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 100 }),
      T({ instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 50 }),
    ];
    const r2 = computePairSessionHeatmap(allWin);
    expect(r2.rows[0].cells[0].profitFactor).toBe(Infinity);
  });
});

describe('computePairSessionHeatmap — status guardrails', () => {
  it('0 decided -> No data (BE-only cell is never labelled a win rate)', () => {
    const r = computePairSessionHeatmap([T({ result: 'BE', netPnl: 0 })]);
    const c = r.rows[0].cells[0];
    expect(c.decided).toBe(0);
    expect(c.status).toBe('No data');
    expect(c.winRate).toBe(0);
  });

  it('1-4 decided -> Limited data', () => {
    const trades = [T({ result: 'Win', netPnl: 100 }), T({ result: 'Win', netPnl: 50 })];
    const r = computePairSessionHeatmap(trades);
    const c = r.rows[0].cells[0];
    expect(c.decided).toBe(2);
    expect(c.status).toBe('Limited data');
  });

  it('5+ decided -> Normal', () => {
    const r = computePairSessionHeatmap(normalDataset());
    expect(r.rows[0].cells[0].status).toBe('Normal');
  });

  it('exports the guardrail constants', () => {
    expect(MIN_NORMAL).toBe(5);
    expect(MAX_LIMITED).toBe(4);
    expect(UNASSIGNED_LABEL).toBe('Unassigned');
  });
});

describe('computePairSessionHeatmap — never drops trades', () => {
  it('missing pair groups under Unassigned', () => {
    const trades = [
      T({ instrument: '', result: 'Win', netPnl: 60 }),
      T({ instrument: '', result: 'Loss', netPnl: -20 }),
    ];
    const r = computePairSessionHeatmap(trades);
    const unassignedRow = r.rows.find((row) => row.pair === UNASSIGNED_LABEL);
    expect(unassignedRow).toBeDefined();
    const c = unassignedRow.cells[0];
    expect(c.trades).toBe(2);
    expect(c.netPnl).toBe(40);
  });

  it('missing session falls back to entry-time heuristic (matches analytics)', () => {
    const trades = [
      T({ session: '', entryTime: '09:00', result: 'Win', netPnl: 100 }), // London (9h)
      T({ session: '', entryTime: '15:00', result: 'Loss', netPnl: -30 }), // New York (15h)
    ];
    const r = computePairSessionHeatmap(trades);
    const sessions = r.sessions.map((s) => s.label);
    expect(sessions).toContain('London');
    expect(sessions).toContain('New York');
    const row = r.rows[0];
    const london = row.cells.find((c) => c.session === 'London');
    const ny = row.cells.find((c) => c.session === 'New York');
    expect(london.netPnl).toBe(100);
    expect(ny.netPnl).toBe(-30);
  });

  it('unparseable entry-time -> Unknown session, still shown', () => {
    const r = computePairSessionHeatmap([T({ session: '', entryTime: '', result: 'Win', netPnl: 50 })]);
    const labels = r.sessions.map((s) => s.label);
    expect(labels).toContain('Unknown');
  });
});

describe('computePairSessionHeatmap — filters & account isolation', () => {
  const dataset = () => [
    T({ date: '2024-01-02', instrument: 'EURUSD', session: 'London', result: 'Win', netPnl: 100 }),
    T({ date: '2024-01-03', instrument: 'EURUSD', session: 'London', result: 'Loss', netPnl: -50 }),
    T({ date: '2024-01-04', instrument: 'GBPUSD', session: 'New York', result: 'Win', netPnl: 200 }),
    T({ date: '2024-02-05', instrument: 'GBPUSD', session: 'New York', result: 'Loss', netPnl: -30 }),
  ];

  it('honours the pair filter', () => {
    const r = computePairSessionHeatmap(dataset(), { pair: 'EURUSD' });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].pair).toBe('EURUSD');
    expect(r.totalTrades).toBe(2);
  });

  it('honours the session filter', () => {
    const r = computePairSessionHeatmap(dataset(), { session: 'New York' });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].pair).toBe('GBPUSD');
    expect(r.sessions.map((s) => s.label)).toEqual(['New York']);
  });

  it('honours an explicit date range', () => {
    const r = computePairSessionHeatmap(dataset(), { dateFrom: '2024-01-01', dateTo: '2024-01-31' });
    expect(r.totalTrades).toBe(3);
  });

  it('never bleeds across accounts computed from different arrays', () => {
    const accountATrades = dataset();
    const accountBTrades = [T({ instrument: 'XAUUSD', session: 'Asia', result: 'Win', netPnl: 999 })];
    const a = computePairSessionHeatmap(accountATrades);
    const b = computePairSessionHeatmap(accountBTrades);
    const pairsA = a.rows.map((row) => row.pair);
    const pairsB = b.rows.map((row) => row.pair);
    expect(pairsA).toContain('EURUSD');
    expect(pairsA).toContain('GBPUSD');
    expect(pairsB).toEqual(['XAUUSD']);
    expect(pairsB).not.toContain('EURUSD');
    expect(a.totalTrades).toBe(4);
    expect(b.totalTrades).toBe(1);
  });
});

describe('computePairSessionHeatmap — data-driven option lists & scale', () => {
  it('pair/session options are discovered from data, never hardcoded', () => {
    const trades = [
      T({ instrument: 'ADAUSDT', session: 'Asia' }),
      T({ instrument: 'XAUUSD', session: 'New York' }),
    ];
    const r = computePairSessionHeatmap(trades);
    expect(r.pairOptions).toContain('ADAUSDT');
    expect(r.pairOptions).toContain('XAUUSD');
    expect(r.sessionOptions).toContain('Asia');
    expect(r.sessionOptions).toContain('New York');
  });

  it('winRate scale reference is always 100 (natural ceiling)', () => {
    const cells = [{ decided: 5, winRate: 60 }, { decided: 0, winRate: 0 }];
    expect(computeScale(cells, 'winRate')).toEqual({ ref: 100, maxAbs: 100 });
  });

  it('netPnl scale reference is the max |net PnL| across decided cells', () => {
    const cells = [
      { decided: 5, netPnl: 300 },
      { decided: 3, netPnl: -1200 },
      { decided: 0, netPnl: 0 },
    ];
    expect(computeScale(cells, 'netPnl').maxAbs).toBe(1200);
  });

  it('cellColor: no-data cell is always neutral grey', () => {
    for (const metric of ['netPnl', 'winRate', 'avgRR']) {
      expect(cellColor({ decided: 0 }, metric, { maxAbs: 100 })).toContain('148,163,184');
    }
  });

  it('cellColor: positive netPnl -> green, negative -> red, intensity scaled', () => {
    const scale = { maxAbs: 100 };
    const green = cellColor({ decided: 5, netPnl: 50 }, 'netPnl', scale);
    const red = cellColor({ decided: 5, netPnl: -50 }, 'netPnl', scale);
    expect(green).toContain('22,163,74');
    expect(red).toContain('220,38,38');
  });
});

describe('computePairSessionHeatmap — parity with canonical engine', () => {
  it('cell totals per pair equal the engine byPair numbers', () => {
    const trades = normalDataset().concat([
      T({ instrument: 'GBPUSD', session: 'London', result: 'Win', netPnl: 200, rr: 3 }),
      T({ instrument: 'GBPUSD', session: 'London', result: 'Loss', netPnl: -30, rr: 1 }),
    ]);
    const heat = computePairSessionHeatmap(trades);
    const eng = computeAnalytics(trades);

    for (const row of heat.rows) {
      const pairAgg = row.cells.reduce(
        (acc, c) => ({
          trades: acc.trades + c.trades,
          wins: acc.wins + c.wins,
          losses: acc.losses + c.losses,
          netPnl: acc.netPnl + c.netPnl,
        }),
        { trades: 0, wins: 0, losses: 0, netPnl: 0 }
      );
      const g = eng.byPair.find((p) => p.label === row.pair);
      expect(g).toBeDefined();
      expect(pairAgg.trades).toBe(g.trades);
      expect(pairAgg.wins).toBe(g.wins);
      expect(pairAgg.losses).toBe(g.losses);
      expect(pairAgg.netPnl).toBeCloseTo(g.netPnl, 5);
    }
  });

  it('cell totals per session equal the analytic/bySession numbers', () => {
    const trades = Array.from({ length: 8 }, (_, i) =>
      T({
        instrument: i % 2 === 0 ? 'EURUSD' : 'GBPUSD',
        session: i % 3 === 0 ? 'London' : 'New York',
        result: i % 2 === 0 ? 'Win' : 'Loss',
        netPnl: i % 2 === 0 ? 100 : -40,
      })
    );
    const heat = computePairSessionHeatmap(trades);
    const eng = computeAnalytics(trades);

    for (const s of heat.sessions) {
      const sessAgg = heat.rows.reduce(
        (acc, row) => {
          const c = row.cells.find((cell) => cell.session === s.label);
          return {
            trades: acc.trades + (c ? c.trades : 0),
            netPnl: acc.netPnl + (c ? c.netPnl : 0),
          };
        },
        { trades: 0, netPnl: 0 }
      );
      const g = eng.bySession.find((sess) => sess.label === s.label);
      expect(g).toBeDefined();
      expect(sessAgg.trades).toBe(g.trades);
      expect(sessAgg.netPnl).toBeCloseTo(g.netPnl, 5);
    }
  });
});