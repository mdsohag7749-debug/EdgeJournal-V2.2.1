import { describe, it, expect } from 'vitest';
import {
  computeDisciplineScore20,
  DISCIPLINE_COMPONENTS,
  BANDS,
  EXECUTION_FIELDS,
  UNASSIGNED_LABEL,
  mondayKey,
  weekLabel,
  monthLabel,
  mistakesOfTrade,
} from '../src/utils/disciplineScoreEngine';
import { Trade } from '../src/types/models';

let _id = 0;
const T = (o: Partial<Trade> | any = {}): Trade => {
  const inst = o.instrument || o.symbol || 'EURUSD';
  const mod = o.setup || o.model || 'Breakout';
  return {
    id: `d${++_id}`,
    userId: 'u-1',
    accountId: 'acc-1',
    entryDate: '2024-01-02',
    date: '2024-01-02',
    entryTime: '09:00',
    instrument: inst,
    symbol: inst,
    session: 'London',
    model: mod,
    setup: mod,
    direction: 'Long',
    stopLoss: 1.1,
    takeProfit: 1.2,
    entryPrice: 1.1,
    size: 1,
    riskPercent: 1,
    riskChecklist: {},
    tradeChecklist: {},
    mistakes: {},
    status: 'Closed',
    result: 'Win',
    netPnl: 100,
    rr: 2,
    ...o,
  };
};

describe('P2.3 Discipline Score 2.0 Mobile Parity Test Suite', () => {
  describe('Basics, Empty & No-Data Handling', () => {
    it('returns hasData: false and null score on empty dataset', () => {
      const r = computeDisciplineScore20([]);
      expect(r.hasData).toBe(false);
      expect(r.total).toBe(0);
      expect(r.score).toBe(null);
      expect(r.band).toBe(null);
      expect(r.coveragePct).toBe(0);
    });

    it('marks components without real data as unavailable and computes score over remaining weight', () => {
      const trades = [T({ result: '', riskChecklist: {}, tradeChecklist: {}, riskPercent: '', mistakes: {} })];
      const r = computeDisciplineScore20(trades);
      expect(r.hasData).toBe(true);

      const risk = r.components.find((c) => c.key === 'risk');
      const plan = r.components.find((c) => c.key === 'plan');
      const exec = r.components.find((c) => c.key === 'execution');
      const review = r.components.find((c) => c.key === 'review');

      expect(risk?.available).toBe(false);
      expect(plan?.available).toBe(false);
      expect(exec?.available).toBe(true);
      expect(review?.available).toBe(false);
      expect(r.score).not.toBe(null);
    });

    it('declares all 5 components with weights summing exactly to 100', () => {
      expect(DISCIPLINE_COMPONENTS.reduce((s, c) => s + c.weight, 0)).toBe(100);
      expect(DISCIPLINE_COMPONENTS.map((c) => c.key)).toEqual([
        'risk',
        'plan',
        'execution',
        'mistake',
        'review',
      ]);
    });

    it('verifies score bands cover 0–100 without gaps', () => {
      expect(BANDS[0].min).toBe(90);
      expect(BANDS[0].max).toBe(100);
      expect(BANDS[BANDS.length - 1].min).toBe(0);
      const sorted = [...BANDS].sort((a, b) => a.min - b.min);
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].max).toBe(sorted[i + 1].min - 1);
      }
    });
  });

  describe('Component 1: Risk Management (30% Weight)', () => {
    it('measures adherence to configured risk criteria on engaged trades', () => {
      const trades = [
        T({ riskChecklist: { 'Risk 1% Max': true, 'Always stop': false }, riskPercent: 1 }),
        T({ riskChecklist: { 'Risk 1% Max': true, 'Always stop': true }, riskPercent: 1 }),
      ];
      const r = computeDisciplineScore20(trades, { riskCriteria: ['Risk 1% Max', 'Always stop'] });
      const risk = r.components.find((c) => c.key === 'risk');
      expect(risk?.available).toBe(true);
      expect(risk?.engaged).toBe(2);
      expect(risk?.score).toBe(75); // (50 + 100) / 2
      expect(risk?.points).toBe(Math.round((75 * 30) / 100)); // 23 points
    });

    it('falls back to each trade own risk-checklist keys when no criteria are configured', () => {
      const trades = [
        T({ riskChecklist: { A: true, B: false, C: true } }),
        T({ riskChecklist: { A: false, B: true } }),
      ];
      const r = computeDisciplineScore20(trades);
      const risk = r.components.find((c) => c.key === 'risk');
      expect(risk?.available).toBe(true);
      // trade1 2/3 = 66.67%, trade2 1/2 = 50% -> avg 58.33% -> round 58
      expect(risk?.score).toBe(58);
    });

    it('marks trade as engaged when riskPercent is present but checklist is empty', () => {
      const trades = [T({ riskChecklist: {}, riskPercent: 1 }), T({ riskChecklist: {}, riskPercent: 1 })];
      const r = computeDisciplineScore20(trades);
      const risk = r.components.find((c) => c.key === 'risk');
      expect(risk?.available).toBe(true);
      expect(risk?.engaged).toBe(2);
    });

    it('leaves risk unavailable when trades never touch risk checklist or percent', () => {
      const trades = [T({ riskChecklist: {}, riskPercent: null })];
      const r = computeDisciplineScore20(trades);
      const risk = r.components.find((c) => c.key === 'risk');
      expect(risk?.available).toBe(false);
      expect(risk?.score).toBe(null);
    });
  });

  describe('Component 2: Plan & Checklist (25% Weight)', () => {
    it('measures checklist adherence on engaged trades with configured models and criteria', () => {
      const trades = [
        T({ tradeChecklist: { 'Plan approved': true, 'Risk 1%': false }, setup: 'Breakout' }),
        T({ tradeChecklist: { 'Plan approved': true, 'Risk 1%': true }, setup: 'Breakout' }),
      ];
      const r = computeDisciplineScore20(trades, {
        models: ['Breakout'],
        checklistCriteria: ['Plan approved', 'Risk 1%'],
      });
      const plan = r.components.find((c) => c.key === 'plan');
      expect(plan?.available).toBe(true);
      // checklist avg 75% & plan-following 100% -> avg 87.5% -> 88
      expect(plan?.score).toBe(88);
    });

    it('falls back to per-trade keys when no checklist criteria configured', () => {
      const trades = [T({ tradeChecklist: { A: true, B: true, C: false } })];
      const r = computeDisciplineScore20(trades);
      const plan = r.components.find((c) => c.key === 'plan');
      expect(plan?.score).toBe(67);
    });

    it('computes plan score with model plan-following alone when checklist is empty', () => {
      const trades = [
        T({ tradeChecklist: {}, setup: 'Momentum' }),
        T({ tradeChecklist: {}, setup: 'Breakout' }),
      ];
      const r = computeDisciplineScore20(trades, { models: ['Breakout'] });
      const plan = r.components.find((c) => c.key === 'plan');
      expect(plan?.available).toBe(true);
      expect(plan?.score).toBe(50); // 1 of 2 matches configured models
    });
  });

  describe('Component 3: Execution (20% Weight)', () => {
    it('measures completeness across the 6 critical execution fields', () => {
      const full = T({
        setup: 'Breakout',
        session: 'London',
        direction: 'Long',
        entryTime: '09:00',
        stopLoss: 1.1,
        takeProfit: 1.2,
      });
      const partial = T({
        setup: '',
        session: 'London',
        direction: 'Long',
        entryTime: '',
        stopLoss: 0,
        takeProfit: 1.2,
      });

      const r = computeDisciplineScore20([full, partial]);
      const exec = r.components.find((c) => c.key === 'execution');
      expect(exec?.available).toBe(true);
      // full = 6/6 (100%), partial = 3/6 (50%) -> avg 75%
      expect(exec?.score).toBe(75);
    });
  });

  describe('Component 4: Mistake Control (15% Weight)', () => {
    it('calculates 100% when zero trades have mistakes', () => {
      const trades = [T({ mistakes: {} }), T({ mistakes: [] })];
      const r = computeDisciplineScore20(trades);
      const mistake = r.components.find((c) => c.key === 'mistake');
      expect(mistake?.available).toBe(true);
      expect(mistake?.score).toBe(100);
    });

    it('calculates mistake-free rate with logged mistakes', () => {
      const trades = [
        T({ mistakes: ['FOMO Entry'] }),
        T({ mistakes: { 'Early Exit': true } }),
        T({ mistakes: {} }),
        T({ mistakes: [] }),
      ];
      const r = computeDisciplineScore20(trades);
      const mistake = r.components.find((c) => c.key === 'mistake');
      expect(mistake?.available).toBe(true);
      // 2 of 4 mistake-free -> 50%
      expect(mistake?.score).toBe(50);
    });
  });

  describe('Component 5: Review & Reflection (10% Weight)', () => {
    it('measures 5-item review completion on closed trades', () => {
      const reviewed = T({
        status: 'Closed',
        review: {
          beforeScreenshot: true,
          afterScreenshot: true,
          reviewSummary: true,
          lessonLearned: true,
          emotionReflection: true,
        },
      });
      const partial = T({
        status: 'Closed',
        review: {
          beforeScreenshot: true,
          lessonLearned: true,
        },
      });

      const r = computeDisciplineScore20([reviewed, partial]);
      const review = r.components.find((c) => c.key === 'review');
      expect(review?.available).toBe(true);
      // reviewed = 100%, partial = 40% -> avg 70%
      expect(review?.score).toBe(70);
    });

    it('blends reflections activity with closed-trade reviews', () => {
      const trades = [
        T({
          date: '2024-01-02',
          status: 'Closed',
          review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: true, lessonLearned: true, emotionReflection: true },
        }),
      ];
      const r = computeDisciplineScore20(trades, { reflections: [{ date: '2024-01-02' }] });
      const review = r.components.find((c) => c.key === 'review');
      expect(review?.score).toBe(100);
    });
  });

  describe('Overall Score Normalization & Perfect Trader Test', () => {
    it('computes 100/100 for institutional-level perfection', () => {
      const PERFECT = [
        T({
          setup: 'Breakout',
          session: 'London',
          direction: 'Long',
          entryTime: '09:00',
          stopLoss: 1.1,
          takeProfit: 1.2,
          riskPercent: 1,
          riskChecklist: { A: true },
          tradeChecklist: { c: true },
          mistakes: {},
          status: 'Closed',
          review: {
            beforeScreenshot: true,
            afterScreenshot: true,
            reviewSummary: true,
            lessonLearned: true,
            emotionReflection: true,
          },
          date: '2024-01-02',
        }),
      ];

      const r = computeDisciplineScore20(PERFECT, {
        models: ['Breakout'],
        riskCriteria: ['A'],
        checklistCriteria: ['c'],
        reflections: [{ date: '2024-01-02' }],
      });

      expect(r.score).toBe(100);
      expect(r.band?.label).toBe('Excellent');
      expect(r.coveragePct).toBe(100);
      expect(r.availablePoints).toBe(100);
    });
  });

  describe('Weekly & Monthly Trends', () => {
    it('builds weekly trend buckets and flags hasTrend when >= 2 points exist', () => {
      const trades = [
        T({ date: '2024-01-02', netPnl: 100 }), // Week 1
        T({ date: '2024-01-09', netPnl: 50 }),  // Week 2
        T({ date: '2024-01-16', netPnl: -20 }), // Week 3
      ];
      const r = computeDisciplineScore20(trades);
      expect(r.weekly.length).toBe(3);
      expect(r.hasTrend).toBe(true);
    });

    it('flags hasTrend as false when fewer than 2 buckets exist', () => {
      const trades = [T({ date: '2024-01-02' })];
      const r = computeDisciplineScore20(trades);
      expect(r.hasTrend).toBe(false);
    });
  });

  describe('Filtering & Account Isolation', () => {
    it('applies pair, session, and setup filters correctly', () => {
      const trades = [
        T({ instrument: 'EURUSD', session: 'London', setup: 'Breakout' }),
        T({ instrument: 'GBPUSD', session: 'New York', setup: 'Pullback' }),
      ];

      const all = computeDisciplineScore20(trades);
      expect(all.total).toBe(2);

      const eurusd = computeDisciplineScore20(trades, { pair: 'EURUSD' });
      expect(eurusd.total).toBe(1);

      const ny = computeDisciplineScore20(trades, { session: 'New York' });
      expect(ny.total).toBe(1);

      const breakout = computeDisciplineScore20(trades, { setup: 'Breakout' });
      expect(breakout.total).toBe(1);
    });

    it('isolates scores between separate accounts with zero cross-contamination', () => {
      const accountATrades = [
        T({ accountId: 'acc-A', mistakes: {}, riskChecklist: { '1%': true }, riskPercent: 1 }),
      ];
      const accountBTrades = [
        T({ accountId: 'acc-B', mistakes: ['Revenge Trade', 'FOMO Entry'], riskChecklist: { '1%': false }, riskPercent: 1 }),
      ];

      const scoreA = computeDisciplineScore20(accountATrades, { riskCriteria: ['1%'] });
      const scoreB = computeDisciplineScore20(accountBTrades, { riskCriteria: ['1%'] });

      expect(scoreA.score).toBeGreaterThan(scoreB.score!);
      expect(scoreA.components.find((c) => c.key === 'mistake')?.score).toBe(100);
      expect(scoreB.components.find((c) => c.key === 'mistake')?.score).toBe(0);
    });
  });
});
