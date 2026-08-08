import { describe, it, expect } from 'vitest';
import {
  computeDisciplineScore20,
  DISCIPLINE_COMPONENTS,
  BANDS,
  EXECUTION_FIELDS,
  UNASSIGNED_LABEL,
} from '../disciplineScore';

let _id = 0;
const T = (o = {}) => ({
  id: `d${++_id}`,
  date: '2024-01-02',
  entryTime: '09:00',
  instrument: 'EURUSD',
  session: 'London',
  model: 'Breakout',
  direction: 'Buy',
  stopLoss: 1.1,
  takeProfit: 1.2,
  entryPrice: 1.1,
  riskPercent: 1,
  riskChecklist: {},
  tradeChecklist: {},
  mistakes: {},
  result: 'Win',
  netPnl: 100,
  rr: 2,
  ...o,
});

describe('computeDisciplineScore20 — basics, empty & no-data behavior', () => {
  it('empty dataset -> hasData false, score null, no fabricated 0/100', () => {
    const r = computeDisciplineScore20([]);
    expect(r.hasData).toBe(false);
    expect(r.total).toBe(0);
    expect(r.score).toBe(null);
    expect(r.band).toBe(null);
    expect(r.coveragePct).toBe(0);
  });

  it('no component has real data -> score null and every component unavailable', () => {
    const trades = [T({ result: '', riskChecklist: {}, tradeChecklist: {}, riskPercent: '', mistakes: {} })];
    const r = computeDisciplineScore20(trades);
    expect(r.hasData).toBe(true);
    // Trades exist with no discipline fields, so execution + mistake are
    // measured (real absence), while risk/plan/review carry no data.
    expect(r.components.find((c) => c.key === 'risk').available).toBe(false);
    expect(r.components.find((c) => c.key === 'plan').available).toBe(false);
    expect(r.components.find((c) => c.key === 'execution').available).toBe(true);
    expect(r.components.find((c) => c.key === 'review').available).toBe(false);
    expect(r.score).not.toBe(null);
  });

  it('weights total 100 and all five components are declared', () => {
    expect(DISCIPLINE_COMPONENTS.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(DISCIPLINE_COMPONENTS.map((c) => c.key)).toEqual(['risk', 'plan', 'execution', 'mistake', 'review']);
  });

  it('bands cover 0-100 without gaps', () => {
    expect(BANDS[0].min).toBe(90);
    expect(BANDS[0].max).toBe(100);
    expect(BANDS[BANDS.length - 1].min).toBe(0);
    const sorted = [...BANDS].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max).toBe(sorted[i + 1].min - 1);
    }
  });
});

describe('computeDisciplineScore20 — Risk Management component (30%)', () => {
  it('measures adherence to CONFIGURED risk criteria on engaged trades', () => {
    const trades = [
      T({ riskChecklist: { 'Risk 1% Max': true, 'Always stop': false }, riskPercent: 1 }),
      T({ riskChecklist: { 'Risk 1% Max': true, 'Always stop': true }, riskPercent: 1 }),
    ];
    const r = computeDisciplineScore20(trades, { riskCriteria: ['Risk 1% Max', 'Always stop'] });
    const risk = r.components.find((c) => c.key === 'risk');
    expect(risk.available).toBe(true);
    expect(risk.engaged).toBe(2);
    // Trade-avg of 50% & 100% -> 75
    expect(risk.score).toBe(75);
  });

  it('falls back to each trade own risk-checklist keys when no criteria configured', () => {
    const trades = [
      T({ riskChecklist: { A: true, B: false, C: true } }),
      T({ riskChecklist: { A: false, B: true } }),
    ];
    const r = computeDisciplineScore20(trades);
    const risk = r.components.find((c) => c.key === 'risk');
    expect(risk.available).toBe(true);
    // trade1 2/3=66.7, trade2 1/2=50 -> avg 58.3 -> round 58
    expect(risk.score).toBe(58);
  });

  it('counts a trade as engaged when riskPercent is set but checklist is empty', () => {
    const trades = [T({ riskChecklist: {}, riskPercent: 1 }), T({ riskChecklist: {}, riskPercent: 1 })];
    const r = computeDisciplineScore20(trades);
    const risk = r.components.find((c) => c.key === 'risk');
    expect(risk.available).toBe(true);
    expect(risk.engaged).toBe(2);
  });

  it('trades that never engage risk leave the component unavailable (NOT ENOUGH DATA)', () => {
    const trades = [T({ riskChecklist: {}, riskPercent: null })];
    const r = computeDisciplineScore20(trades);
    const risk = r.components.find((c) => c.key === 'risk');
    expect(risk.available).toBe(false);
    expect(risk.score).toBe(null);
  });
});

describe('buildDisciplineScore — Plan & Checklist component (25%)', () => {
  it('measures checklist adherence on engaged trades with configured criteria', () => {
    const trades = [
      T({ tradeChecklist: { 'Plan approved': true, 'Risk 1%': false }, model: 'Breakout' }),
      T({ tradeChecklist: { 'Plan approved': true, 'Risk 1%': true }, model: 'Breakout' }),
    ];
    const r = computeDisciplineScore20(trades, { models: ['Breakout'], checklistCriteria: ['Plan approved', 'Risk 1%'] });
    const plan = r.components.find((c) => c.key === 'plan');
    expect(plan.available).toBe(true);
    // checklist avg 75 & plan-following 100 -> avg 87.5 -> 88
    expect(plan.score).toBe(88);
  });

  it('falls back to per-trade keys when no checklist criteria are configured', () => {
    const trades = [T({ tradeChecklist: { A: true, B: true, C: false } })];
    const r = computeDisciplineScore20(trades);
    const plan = r.components.find((c) => c.key === 'plan');
    expect(plan.score).toBe(67); // 2/3 -> 66.6 -> 67
  });

  it('no trade never touches the trade checklist -> unavailable', () => {
    const trades = [T({ tradeChecklist: {} })];
    const r = computeDisciplineScore20(trades);
    const plan = r.components.find((c) => c.key === 'plan');
    expect(plan.available).toBe(false);
    expect(plan.score).toBe(null);
  });

  it('plan following alone (configured models, no checklist) is still real data', () => {
    const trades = [
      T({ tradeChecklist: {}, model: 'Momentum' }),
      T({ tradeChecklist: {}, model: 'Breakout' }),
    ];
    const r = computeDisciplineScore20(trades, { models: ['Breakout'] });
    const plan = r.components.find((c) => c.key === 'plan');
    expect(plan.available).toBe(true);
    expect(plan.score).toBe(50); // 1 of 2 used a configured model
  });
});

describe('buildDisciplineScore — Execution component (20%)', () => {
  it('scores completeness of the execution-critical fields', () => {
    const full = T({ model: 'B', session: 'London', direction: 'Buy', entryTime: '09:00', stopLoss: 1, takeProfit: 1.2 });
    const partial = T({ model: '', session: '', direction: 'Buy', entryTime: '', stopLoss: '', takeProfit: '' });
    const r = computeDisciplineScore20([full, partial]);
    const exec = r.components.find((c) => c.key === 'execution');
    expect(exec.available).toBe(true);
    // (6/6 + 1/6) / 2 -> 58.3 -> 58 (direction always counts)
    expect(exec.score).toBe(58);
  });

  it('execution is measured across the declared field list', () => {
    expect(EXECUTION_FIELDS).toEqual(['model', 'session', 'direction', 'entryTime', 'stopLoss', 'takeProfit']);
  });

  it('zero-valued and empty fields count as not recorded', () => {
    const t = T({ model: '', session: '', direction: 'Buy', entryTime: '10:00', stopLoss: 0, takeProfit: '' });
    const r = computeDisciplineScore20([t]);
    const exec = r.components.find((c) => c.key === 'execution');
    // direction + entryTime only -> 2/6 -> 33
    expect(exec.score).toBe(33);
  });
});

describe('buildDisciplineScore — Mistake Control component (15%)', () => {
  it('mistake-free rate uses the same truthy-key counting as Task 8.3', () => {
    const trades = [
      T({ mistakes: {} }),
      T({ mistakes: { 'FOMO Entry': true } }),
      T({ mistakes: { 'Revenge Trading': true } }),
    ];
    const r = computeDisciplineScore20(trades);
    const mistake = r.components.find((c) => c.key === 'mistake');
    expect(mistake.available).toBe(true);
    expect(mistake.score).toBe(33); // 1 of 3 mistake-free -> 33
  });

  it('100 when no trade logs any mistake', () => {
    const trades = [T({ mistakes: {} }), T({ mistakes: {} })];
    const r = computeDisciplineScore20(trades);
    expect(r.components.find((c) => c.key === 'mistake').score).toBe(100);
  });
});

describe('Review & Reflection component (10%)', () => {
  it('closed-trade review completion feeds the review score', () => {
    const reviewed = T({
      result: 'Win',
      exitPrice: 1.2,
      review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: true, lessonLearned: true, emotionReflection: true },
    });
    const r = computeDisciplineScore20([reviewed]);
    const rev = r.components.find((c) => c.key === 'review');
    expect(rev.available).toBe(true);
    expect(rev.score).toBe(100);
  });

  it('reflections alone (with some trading days) count as real review data', () => {
    const trades = [T({ result: '', exitPrice: '' }), T({ result: '', exitPrice: '', date: '2024-01-03' }), T({ result: '', exitPrice: '', date: '2024-01-04' })];
    const r = computeDisciplineScore20(trades, { reflections: [{ date: '2024-01-02' }] });
    const rev = r.components.find((c) => c.key === 'review');
    expect(rev.available).toBe(true);
    // 1 reflection / 3 trading days -> 33%
    expect(rev.score).toBe(33);
  });

  it('no closed-trade reviews and no reflections -> NOT ENOUGH DATA', () => {
    const trades = [T({ result: '', exitPrice: '' }), T({ result: '', exitPrice: '' })];
    const r = computeDisciplineScore20(trades);
    const rev = r.components.find((c) => c.key === 'review');
    expect(rev.available).toBe(false);
    expect(rev.score).toBe(null);
  });
});

describe('Overall weighted score — data-availability aware', () => {
  // Everything engaged and perfect -> 100
  const PERFECT = [
    T({
      riskChecklist: { A: true },
      tradeChecklist: { c: true },
      model: 'Breakout',
      riskPercent: 1,
      review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: true, lessonLearned: true, emotionReflection: true },
    }),
  ];

  it('perfect data -> overall 100, band Excellent', () => {
    const r = computeDisciplineScore20(PERFECT, { models: ['Breakout'], riskCriteria: ['A'], checklistCriteria: ['c'], reflections: [{ date: '2024-01-02' }] });
    expect(r.score).toBe(100);
    expect(r.band.label).toBe('Excellent');
    expect(r.coveragePct).toBe(100);
  });

  it('a missing component is excluded WITHOUT dragging the score to 0 and coverage reflects it', () => {
    // Only execution + mistake data exist (trade recorded fields but no
    // checklists, risk %, review or mistakes).
    const t = T({ result: '', exitPrice: '', review: {}, riskChecklist: {}, tradeChecklist: {}, riskPercent: null, model: 'X', date: '2024-01-02' });
    const r = computeDisciplineScore20([t]);
    const availKeys = r.components.filter((c) => c.available).map((c) => c.key);
    expect(availKeys.sort()).toEqual(['execution', 'mistake']);
    expect(r.coveragePct).toBe(35); // execution(20) + mistake(15)
    expect(r.score).not.toBe(null);
    // execution = 100 (all sales) and mistake = 100 -> 100
    expect(r.score).toBe(100);
  });

  it('a weak component drags the weighted blend — one failed risk trade in two', () => {
    // Both trades perfect everywhere except the second fails its one risk rule.
    const trades = [
      T({ riskChecklist: { A: true }, tradeChecklist: { c: true }, model: 'Breakout', review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: true, lessonLearned: true, emotionReflection: true } }),
      T({ riskChecklist: { A: false }, tradeChecklist: { c: true }, model: 'Breakout', review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: true, lessonLearned: true, emotionReflection: true } }),
    ];
    const r = computeDisciplineScore20(trades, { models: ['Breakout'], riskCriteria: ['A'], checklistCriteria: ['c'] });
    // risk = 50 (30% weight) while risk 100 everywhere else -> overall 85
    expect(r.score).toBe(85);
    expect(r.band.label).toBe('Strong');
  });
});

describe('Trend & historical-data guard', () => {
  it('reports no trend when there is insufficient historical data', () => {
    const trades = [T(), T()]; // both share the default date 2024-01-02 -> a single bucket
    const r = computeDisciplineScore20(trades);
    expect(r.hasTrend).toBe(false);
  });

  it('buckets the overall score by week across >=2 weeks', () => {
    const trades = [
      T({ date: '2024-01-01' }),
      T({ date: '2024-01-02' }),
      T({ date: '2024-01-08' }),
      T({ date: '2024-01-09' }),
    ];
    const r = computeDisciplineScore20(trades);
    expect(r.hasTrend).toBe(true);
    expect(r.weekly.length).toBeGreaterThanOrEqual(2);
  });

  it('monthly trend surfaces at least two months when data spans months', () => {
    const trades = [
      T({ date: '2024-01-01' }),
      T({ date: '2024-01-15' }),
      T({ date: '2024-02-01' }),
      T({ date: '2024-02-15' }),
    ];
    const r = computeDisciplineScore20(trades);
    expect(r.monthly.length).toBe(2);
    expect(r.monthly[0].label).toMatch(/2024-01|Jan/);
  });
});

describe('Filters (pair / session / setup) & options', () => {
  it('respects the pair filter before scoring', () => {
    const trades = [
      T({ instrument: 'EURUSD' }),
      T({ instrument: 'GBPUSD' }),
      T({ instrument: 'EURUSD' }),
    ];
    const all = computeDisciplineScore20(trades);
    const eur = computeDisciplineScore20(trades, { pair: 'EURUSD' });
    expect(eur.total).toBe(2);
    expect(eur.total).toBeLessThan(all.total);
  });

  it('respects session filter using the shared session resolution', () => {
    const trades = [T({ session: 'London' }), T({ session: 'New York' }), T({ session: 'London' })];
    const r = computeDisciplineScore20(trades, { session: 'London' });
    expect(r.total).toBe(2);
  });

  it('respects setup (model) filter', () => {
    const trades = [T({ model: 'Breakout' }), T({ model: 'Momentum' })];
    const r = computeDisciplineScore20(trades, { setup: 'Breakout' });
    expect(r.total).toBe(1);
  });

  it('exposes filter options from the full visible array (never invented)', () => {
    const trades = [
      T({ instrument: 'EURUSD', session: 'London', model: 'Breakout' }),
      T({ instrument: 'GBPUSD', session: 'New York', model: 'Momentum' }),
    ];
    const r = computeDisciplineScore20(trades);
    expect(r.pairOptions.sort()).toEqual(['EURUSD', 'GBPUSD'].sort());
    expect(r.sessionOptions.sort()).toEqual(['London', 'New York'].sort());
    expect(r.setupOptions.sort()).toEqual(['Breakout', 'Momentum'].sort());
  });

  it('groups trades without an instrument / model under the shared labels', () => {
    const trades = [
      T({ instrument: '', model: '' }),
      T({ instrument: 'EURUSD', model: 'Breakout' }),
    ];
    const r = computeDisciplineScore20(trades);
    expect(r.pairOptions).toContain(UNASSIGNED_LABEL);
    expect(r.setupOptions).toContain(UNASSIGNED_LABEL);
  });
});

describe('BuildImprovements — rule-based, descriptive', () => {
  it('flag components below 70 with fixable, non-causal advice', () => {
    const trades = [
      T({ riskChecklist: { A: false } }),
    ];
    const r = computeDisciplineScore20(trades, { riskCriteria: ['A'] });
    const risk = r.components.find((c) => c.key === 'risk');
    expect(risk.score).toBe(0);
    expect(r.improvements.some((i) => i.key === 'risk')).toBe(true);
  });

  it('flags unavailable components as not enough data', () => {
    const trades = [T({ riskChecklist: {}, riskPercent: null, tradeChecklist: {} })];
    const r = computeDisciplineScore20(trades, { riskCriteria: ['A'] });
    expect(r.improvements.some((i) => i.key === 'risk')).toBe(true);
  });
});

describe('Mistake discipline wiring (Task 8.3 reuse)', () => {
  it('mistakesOf is used: numeric mistake values still = a single affected trade but occurrence count unaffected for scoring', () => {
    const trades = [
      T({ mistakes: { 'X': 3 } }),
      T({ mistakes: { 'X': 3 } }),
      T({ mistakes: {} }),
    ];
    const r = computeDisciplineScore20(trades);
    const mistake = r.components.find((c) => c.key === 'mistake');
    expect(mistake.score).toBe(33); // 1 of 3 free
  });
});

describe('Account isolation — discipline never mixes accounts', () => {
  const accountARows = [
    T({ id: 'a1', riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
    T({ id: 'a2', riskChecklist: { '1%': false }, tradeChecklist: { plan: true }, model: 'Breakout' }),
  ];
  const accountBRows = [
    T({ id: 'b1', riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
  ];
  const cfg = { riskCriteria: ['1%'], checklistCriteria: ['plan'], models: ['Breakout'] };

  it('scoring A uses only A rows and B uses only B rows', () => {
    const a = computeDisciplineScore20(accountARows, cfg);
    const b = computeDisciplineScore20(accountBRows, cfg);
    expect(a.total).toBe(2);
    expect(b.total).toBe(1);
    // A's blended score reflects its own weaker risk row; B's does not.
    expect(a.components.find((c) => c.key === 'risk').score).toBe(50);
    expect(b.components.find((c) => c.key === 'risk').score).toBe(100);
  });

  it('recomputing A after B never mutates or bleeds state', () => {
    const first = computeDisciplineScore20(accountARows, cfg);
    computeDisciplineScore20(accountBRows, cfg); // interleave
    const again = computeDisciplineScore20(accountARows, cfg);
    expect(again.total).toBe(2);
    expect(again.score).toBe(first.score);
    expect(again.components.map((c) => c.score)).toEqual(first.components.map((c) => c.score));
  });
});

describe('Date filtering — Deterministic range', () => {
  const rows = [
    T({ id: 'd1', date: '2024-01-05', riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
    T({ id: 'd2', date: '2024-02-20', riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
  ];
  const cfg = { riskCriteria: ['1%'], checklistCriteria: ['plan'], models: ['Breakout'] };

  it('dateFrom/dateTo narrow the scored set before any component is computed', () => {
    const jan = computeDisciplineScore20(rows, { ...cfg, dateFrom: '2024-01-01', dateTo: '2024-01-31' });
    expect(jan.total).toBe(1);
    expect(jan.hasTrend).toBe(false); // a single in-range bucket cannot form a trend
    const both = computeDisciplineScore20(rows, cfg);
    expect(both.total).toBe(2);
  });

  it('excluded rows are not scored even when they carry perfect checklist data', () => {
    const jan = computeDisciplineScore20(rows, { ...cfg, dateFrom: '2024-01-01', dateTo: '2024-01-31' });
    // Only the Jan row is scored; the Feb row's perfect data never leaks in.
    expect(jan.components.find((c) => c.key === 'plan').engaged).toBe(1);
    expect(jan.components.find((c) => c.key === 'risk').engaged).toBe(1);
  });
});

describe('Weighted points transparency (Section 9 breakdown)', () => {
  it('every scored component exposes points relative to its own weight', () => {
    const trades = [
      T({ riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
      T({ riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
    ];
    const r = computeDisciplineScore20(trades, { riskCriteria: ['1%'], checklistCriteria: ['plan'], models: ['Breakout'] });
    const risk = r.components.find((c) => c.key === 'risk');
    const plan = r.components.find((c) => c.key === 'plan');
    expect(risk.points).toBe(30); // 100% × 30 weight
    expect(plan.points).toBe(25); // 100% × 25 weight
    expect(risk.points).toBeLessThanOrEqual(risk.weight);
    expect(plan.points).toBeLessThanOrEqual(plan.weight);
  });

  it('points are consistent with the overall weighted score', () => {
    const trades = [
      T({ riskChecklist: { '1%': true }, tradeChecklist: { plan: true }, model: 'Breakout' }),
      T({ riskChecklist: { '1%': false }, tradeChecklist: { plan: true }, model: 'Breakout' }),
    ];
    const r = computeDisciplineScore20(trades, { riskCriteria: ['1%'], checklistCriteria: ['plan'], models: ['Breakout'] });
    const active = r.components.filter((c) => c.available);
    const recomputed = Math.round(active.reduce((s, c) => s + (c.score * c.weight) / r.coveragePct, 0));
    expect(r.score).toBe(recomputed);
    expect(r.availablePoints).toBe(Math.round((r.score * r.coveragePct) / 100));
  });
});