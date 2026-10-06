import { describe, it, expect } from 'vitest';
import {
  computeEmotionAnalytics,
  computeMistakePattern,
  computeRuleCompliance,
  computeDisciplineScore,
  computePsychologyOverview,
  classifyMistake,
  mistakesOfTrade,
  sessionOfTrade,
  PSYCH_KEYS,
} from '../src/utils/psychologyEngine';
import { Trade } from '../src/types/models';

describe('P1.3 Psychology & Mistake Intelligence Parity Suite', () => {
  // Test Fixtures
  const createMockTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 't-1',
    accountId: 'acc-1',
    symbol: 'EURUSD',
    direction: 'Long',
    entryDate: '2026-03-10',
    entryTime: '09:30',
    entryPrice: 1.085,
    size: 1,
    netPnl: 150,
    status: 'Closed',
    setup: 'Breakout',
    session: 'London',
    ...overrides,
  });

  describe('Phase 2 & 3: Emotion Analytics & Trends', () => {
    it('accurately aggregates all 8 emotion ratings, averages, frequencies, and tones', () => {
      const trades: Trade[] = [
        createMockTrade({
          id: 't1',
          psychology: {
            Confidence: 5,
            Patience: 4,
            Focus: 5,
            Fear: 1,
            Greed: 2,
            FOMO: 1,
            Revenge: 1,
            Stress: 2,
          },
        }),
        createMockTrade({
          id: 't2',
          psychology: {
            Confidence: 3,
            Patience: 2,
            Focus: 3,
            Fear: 4, // severe (>=4)
            Greed: 4, // severe (>=4)
            FOMO: 5, // severe (>=4)
            Revenge: 1,
            Stress: 4, // severe (>=4)
          },
        }),
      ];

      const res = computeEmotionAnalytics(trades);

      expect(res.total).toBe(2);
      expect(res.totalTrades).toBe(2);
      expect(res.avgConfidence).toBe(4.0);
      expect(res.avgPatience).toBe(3.0);
      expect(res.avgFocus).toBe(4.0);

      // Disruptive emotion frequencies (score >= 4)
      expect(res.fearFreq).toBe(50); // 1 of 2
      expect(res.greedFreq).toBe(50); // 1 of 2
      expect(res.fomoFreq).toBe(50); // 1 of 2
      expect(res.stressFreq).toBe(50); // 1 of 2
      expect(res.revengeFreq).toBe(0); // 0 of 2

      // Tone classifications
      const conf = res.perEmotion.find((e) => e.key === 'Confidence');
      const fear = res.perEmotion.find((e) => e.key === 'Fear');
      expect(conf?.tone).toBe('pos');
      expect(fear?.tone).toBe('neg');

      // Most common emotion (highest avg)
      expect(['Confidence', 'Focus']).toContain(res.mostCommonEmotion?.key);
    });

    it('handles partial, malformed, or missing psychology data safely', () => {
      const trades: Trade[] = [
        createMockTrade({ id: 't1', psychology: { Confidence: 4 } }),
        createMockTrade({ id: 't2', psychology: { Confidence: 99 as any, Focus: 3 } }), // 99 is invalid
        createMockTrade({ id: 't3', psychology: undefined }),
      ];

      const res = computeEmotionAnalytics(trades);
      expect(res.total).toBe(2); // t1 and t2 have valid fields
      expect(res.totalTrades).toBe(3);
      expect(res.avgConfidence).toBe(4);
      expect(res.avgFocus).toBe(3);
      expect(res.avgPatience).toBeNull();
    });

    it('builds chronological monthly emotion trends correctly', () => {
      const trades: Trade[] = [
        createMockTrade({
          id: 't1',
          entryDate: '2026-01-15',
          psychology: { Confidence: 4, Fear: 2 },
        }),
        createMockTrade({
          id: 't2',
          entryDate: '2026-01-20',
          psychology: { Confidence: 5, Fear: 2 },
        }),
        createMockTrade({
          id: 't3',
          entryDate: '2026-02-10',
          psychology: { Confidence: 3, Fear: 4 },
        }),
      ];

      const res = computeEmotionAnalytics(trades);
      expect(res.monthlyTrend.length).toBe(2);
      expect(res.monthlyTrend[0].key).toBe('2026-01');
      expect(res.monthlyTrend[0].Confidence).toBe(4.5);
      expect(res.monthlyTrend[0].Fear).toBe(2.0);
      expect(res.monthlyTrend[1].key).toBe('2026-02');
      expect(res.monthlyTrend[1].Confidence).toBe(3.0);
      expect(res.monthlyTrend[1].Fear).toBe(4.0);
    });

    it('correctly calculates emotionalHealth composite (0-100)', () => {
      const perfectTrades: Trade[] = [
        createMockTrade({
          psychology: {
            Confidence: 5,
            Patience: 5,
            Focus: 5,
            Fear: 1,
            Greed: 1,
            FOMO: 1,
            Revenge: 1,
            Stress: 1,
          },
        }),
      ];

      const res = computeEmotionAnalytics(perfectTrades);
      expect(res.emotionalHealth).toBe(100);
    });
  });

  describe('Phase 4 & 5: Mistake Pattern Intelligence & Impact', () => {
    it('classifies mistake occurrences according to transparent thresholds', () => {
      expect(classifyMistake(0)).toBe('No Data');
      expect(classifyMistake(1)).toBe('Occasional');
      expect(classifyMistake(2)).toBe('Occasional');
      expect(classifyMistake(3)).toBe('Recurring');
      expect(classifyMistake(4)).toBe('Recurring');
      expect(classifyMistake(5)).toBe('Frequent');
      expect(classifyMistake(8)).toBe('Frequent');
    });

    it('extracts mistakes from both string arrays and object maps', () => {
      const tArray = createMockTrade({ mistakes: ['FOMO Entry', 'Overleveraged'] });
      const tObject = createMockTrade({ mistakes: { 'Early Exit': true, 'Chased Move': false } as any });

      expect(mistakesOfTrade(tArray)).toEqual(['FOMO Entry', 'Overleveraged']);
      expect(mistakesOfTrade(tObject)).toEqual(['Early Exit']);
    });

    it('calculates occurrences, affected trades, win/loss stats, and net P&L impact', () => {
      const trades: Trade[] = [
        createMockTrade({
          id: 't1',
          symbol: 'EURUSD',
          setup: 'Breakout',
          session: 'London',
          netPnl: -200,
          mistakes: ['FOMO Entry'],
        }),
        createMockTrade({
          id: 't2',
          symbol: 'EURUSD',
          setup: 'Breakout',
          session: 'London',
          netPnl: -150,
          mistakes: ['FOMO Entry', 'Moved Stop'],
        }),
        createMockTrade({
          id: 't3',
          symbol: 'GBPJPY',
          setup: 'Pullback',
          session: 'New York',
          netPnl: 100, // Win with mistake
          mistakes: ['FOMO Entry'],
        }),
        createMockTrade({
          id: 't4',
          symbol: 'EURUSD',
          netPnl: 300,
          mistakes: [], // Clean trade
        }),
      ];

      const res = computeMistakePattern(trades);

      expect(res.totalTrades).toBe(4);
      expect(res.affectedTradeCount).toBe(3);
      expect(res.totalOccurrences).toBe(4);
      expect(res.mistakeRate).toBe(75);

      const fomo = res.rows.find((r) => r.name === 'FOMO Entry');
      expect(fomo).toBeDefined();
      expect(fomo?.occurrences).toBe(3);
      expect(fomo?.affectedTrades).toBe(3);
      expect(fomo?.status).toBe('Recurring');
      expect(fomo?.netPnl).toBe(-250); // -200 - 150 + 100
      expect(fomo?.wins).toBe(1);
      expect(fomo?.losses).toBe(2);
      expect(fomo?.winRate).toBe(33.3);
      expect(fomo?.lossRate).toBe(66.7);

      // Context Breakdown
      expect(fomo?.pairs[0]).toEqual({ label: 'EURUSD', count: 2 });
      expect(fomo?.sessions[0]).toEqual({ label: 'London', count: 2 });

      // Most Expensive leak
      expect(res.mostExpensive?.name).toBe('FOMO Entry');
    });

    it('respects ranking modes (affectedTrades, occurrences, netPnl, losses)', () => {
      const trades: Trade[] = [
        createMockTrade({ id: 't1', netPnl: -500, mistakes: ['Rare Big Loss'] }),
        createMockTrade({ id: 't2', netPnl: -10, mistakes: ['Frequent Small Loss'] }),
        createMockTrade({ id: 't3', netPnl: -10, mistakes: ['Frequent Small Loss'] }),
        createMockTrade({ id: 't4', netPnl: -10, mistakes: ['Frequent Small Loss'] }),
      ];

      const byFreq = computeMistakePattern(trades, { rank: 'affectedTrades' });
      expect(byFreq.rows[0].name).toBe('Frequent Small Loss');

      const byLoss = computeMistakePattern(trades, { rank: 'netPnl' });
      expect(byLoss.rows[0].name).toBe('Rare Big Loss');
    });
  });

  describe('Phase 6: Rule Compliance & Checklists', () => {
    it('computes checklist adherence with 20% mistake penalty per rule break', () => {
      const riskCriteria = ['Risk 1% Max', 'Stop Loss Set'];
      const checklistCriteria = ['Confirmation Present'];

      const trades: Trade[] = [
        // Perfect Trade (all 3 criteria true, 0 mistakes)
        createMockTrade({
          id: 't1',
          riskChecklist: { 'Risk 1% Max': true, 'Stop Loss Set': true },
          tradeChecklist: { 'Confirmation Present': true },
          mistakes: [],
        }),
        // Partial with 1 mistake (2/3 = 67% base - 20% mistake = 47%)
        createMockTrade({
          id: 't2',
          riskChecklist: { 'Risk 1% Max': true, 'Stop Loss Set': false },
          tradeChecklist: { 'Confirmation Present': true },
          mistakes: ['FOMO'],
        }),
      ];

      const res = computeRuleCompliance(trades, { riskCriteria, checklistCriteria });

      expect(res.engagedTrades).toBe(2);
      expect(res.perfectCount).toBe(1);
      expect(res.perfectPct).toBe(50);
      expect(res.compliancePct).toBe(Math.round((100 + 47) / 2)); // 74%
      expect(res.breakPct).toBe(50); // 1 of 2 had mistakes

      // Per-rule stats
      const stopRule = res.byRule.find((r) => r.name === 'Stop Loss Set');
      expect(stopRule?.followed).toBe(1);
      expect(stopRule?.broken).toBe(1);
      expect(stopRule?.compliancePct).toBe(50);

      expect(res.mostBrokenRule?.name).toBe('Stop Loss Set');
    });

    it('returns zero metrics when no trades engaged checklists', () => {
      const trades: Trade[] = [
        createMockTrade({ id: 't1', riskChecklist: {}, tradeChecklist: {} }),
      ];

      const res = computeRuleCompliance(trades);
      expect(res.engagedTrades).toBe(0);
      expect(res.compliancePct).toBe(0);
      expect(res.perfectCount).toBe(0);
    });
  });

  describe('Phase 7 & 8: Psychology Summary & Composite Score', () => {
    it('calculates full composite psychology score combining emotion, compliance, and discipline', () => {
      const trades: Trade[] = [
        createMockTrade({
          psychology: { Confidence: 5, Patience: 5, Focus: 5, Fear: 1, Stress: 1 },
          riskChecklist: { 'Max Risk': true },
          tradeChecklist: { 'Follow Plan': true },
          mistakes: [],
          netPnl: 200,
        }),
      ];

      const overview = computePsychologyOverview(trades, {
        riskCriteria: ['Max Risk'],
        checklistCriteria: ['Follow Plan'],
      });

      expect(overview.score).toBeGreaterThanOrEqual(80);
      expect(overview.statusLabel).toMatch(/Strong|Excellent/);
      expect(overview.mistakeFreeRate).toBe(100);
      expect(overview.dominantPositive).toBeDefined();
      expect(overview.recurringNegative).toBeNull();
    });
  });

  describe('Phase 10 & 11: Empty / Low-Data Handling & Account Isolation', () => {
    it('handles 0 trades gracefully without NaN or division by zero errors', () => {
      const emptyTrades: Trade[] = [];

      const emotion = computeEmotionAnalytics(emptyTrades);
      expect(emotion.total).toBe(0);
      expect(emotion.distribution).toEqual([]);
      expect(emotion.avgConfidence).toBeNull();
      expect(emotion.emotionalHealth).toBeNull();

      const mistakes = computeMistakePattern(emptyTrades);
      expect(mistakes.hasData).toBe(false);
      expect(mistakes.rows).toEqual([]);
      expect(mistakes.totalOccurrences).toBe(0);

      const rules = computeRuleCompliance(emptyTrades);
      expect(rules.compliancePct).toBe(0);
      expect(rules.perfectCount).toBe(0);

      const overview = computePsychologyOverview(emptyTrades);
      expect(overview.score).toBeNull();
      expect(overview.statusLabel).toBe('No Data');
    });

    it('handles low data (1 to 4 trades) without crashing', () => {
      const oneTrade: Trade[] = [createMockTrade({ id: 'single', netPnl: -50 })];

      const emotion = computeEmotionAnalytics(oneTrade);
      const mistakes = computeMistakePattern(oneTrade);
      const rules = computeRuleCompliance(oneTrade);
      const overview = computePsychologyOverview(oneTrade);

      expect(emotion.total).toBe(0); // not rated
      expect(mistakes.totalTrades).toBe(1);
      expect(rules.total).toBe(1);
      expect(overview.totalTrades).toBe(1);
    });

    it('verifies strict account isolation between distinct account datasets', () => {
      const accountATrades: Trade[] = [
        createMockTrade({
          accountId: 'acc-A',
          psychology: { Confidence: 5, Fear: 1 },
          mistakes: [],
          netPnl: 500,
        }),
      ];

      const accountBTrades: Trade[] = [
        createMockTrade({
          accountId: 'acc-B',
          psychology: { Confidence: 1, Fear: 5 },
          mistakes: ['Revenge Trading'],
          netPnl: -1000,
        }),
      ];

      const aEmotion = computeEmotionAnalytics(accountATrades);
      const bEmotion = computeEmotionAnalytics(accountBTrades);

      expect(aEmotion.avgConfidence).toBe(5);
      expect(bEmotion.avgConfidence).toBe(1);

      const aMistakes = computeMistakePattern(accountATrades);
      const bMistakes = computeMistakePattern(accountBTrades);

      expect(aMistakes.affectedTradeCount).toBe(0);
      expect(bMistakes.affectedTradeCount).toBe(1);
      expect(bMistakes.rows[0].name).toBe('Revenge Trading');
      expect(bMistakes.rows[0].netPnl).toBe(-1000);
    });
  });
});
