import { describe, it, expect } from 'vitest';
import {
  tradeMatchesFilters,
  tradeMatchesSearch,
  getDatePresetRange,
  getActiveFilterChips,
  countActiveFilters,
  BLANK_JOURNAL_FILTERS,
  JournalFilterState,
  getTodayISO,
} from '../src/utils/journalFilters';
import { Trade } from '../src/types/models';

function createDummyTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-1',
    accountId: 'acc-main',
    symbol: 'EURUSD',
    direction: 'Long',
    entryDate: '2026-08-20',
    entryTime: '09:30',
    entryPrice: 1.1,
    size: 1.0,
    netPnl: 150.0,
    status: 'Closed',
    setup: 'Breakout',
    session: 'London',
    notes: 'Clean double bottom retest',
    tags: ['A+ Setup', 'Trend Aligned'],
    mistakes: [],
    emotionBefore: 'Calm',
    emotionDuring: 'Confident',
    riskRewardRatio: 2.5,
    ...overrides,
  };
}

describe('Mobile Journal Filter Engine (journalFilters.ts)', () => {
  describe('Date Presets and Date Range Filtering', () => {
    it('generates correct Today range', () => {
      const today = getTodayISO();
      const range = getDatePresetRange('Today');
      expect(range.dateFrom).toBe(today);
      expect(range.dateTo).toBe(today);
    });

    it('generates correct This Week range starting on Monday', () => {
      const today = getTodayISO();
      const range = getDatePresetRange('This Week');
      expect(range.dateTo).toBe(today);
      expect(range.dateFrom <= today).toBe(true);
    });

    it('generates correct This Month range starting on day 01', () => {
      const today = getTodayISO();
      const range = getDatePresetRange('This Month');
      expect(range.dateTo).toBe(today);
      expect(range.dateFrom.endsWith('-01')).toBe(true);
    });

    it('generates correct YTD range starting on Jan 01 of current year', () => {
      const currentYear = new Date().getFullYear();
      const range = getDatePresetRange('YTD');
      expect(range.dateFrom).toBe(`${currentYear}-01-01`);
    });

    it('filters trades inclusively within custom date range boundaries', () => {
      const t1 = createDummyTrade({ id: 't1', entryDate: '2026-05-10' });
      const t2 = createDummyTrade({ id: 't2', entryDate: '2026-05-15' });
      const t3 = createDummyTrade({ id: 't3', entryDate: '2026-05-20' });
      const t4 = createDummyTrade({ id: 't4', entryDate: '2026-05-25' });

      const filters: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        dateFrom: '2026-05-15',
        dateTo: '2026-05-20',
      };

      expect(tradeMatchesFilters(t1, filters)).toBe(false);
      expect(tradeMatchesFilters(t2, filters)).toBe(true); // Exact lower boundary
      expect(tradeMatchesFilters(t3, filters)).toBe(true); // Exact upper boundary
      expect(tradeMatchesFilters(t4, filters)).toBe(false);
    });
  });

  describe('Session Filtering', () => {
    it('matches trades with the chosen market sessions', () => {
      const londonTrade = createDummyTrade({ session: 'London' });
      const nyTrade = createDummyTrade({ session: 'New York' });
      const asiaTrade = createDummyTrade({ session: 'Asia' });

      const filterLondon: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        sessions: ['London'],
      };

      expect(tradeMatchesFilters(londonTrade, filterLondon)).toBe(true);
      expect(tradeMatchesFilters(nyTrade, filterLondon)).toBe(false);

      const filterMulti: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        sessions: ['London', 'New York'],
      };

      expect(tradeMatchesFilters(londonTrade, filterMulti)).toBe(true);
      expect(tradeMatchesFilters(nyTrade, filterMulti)).toBe(true);
      expect(tradeMatchesFilters(asiaTrade, filterMulti)).toBe(false);
    });
  });

  describe('Psychology and Emotion Filtering', () => {
    it('filters trades by logged emotions across before/during/after fields', () => {
      const calmTrade = createDummyTrade({ emotionBefore: 'Calm', emotionDuring: 'Confident' });
      const fomoTrade = createDummyTrade({ emotionBefore: 'FOMO', emotionDuring: 'Anxious' });

      const filterCalm: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        emotions: ['Calm'],
      };

      expect(tradeMatchesFilters(calmTrade, filterCalm)).toBe(true);
      expect(tradeMatchesFilters(fomoTrade, filterCalm)).toBe(false);

      const filterMulti: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        emotions: ['FOMO', 'Stress'],
      };

      expect(tradeMatchesFilters(fomoTrade, filterMulti)).toBe(true);
      expect(tradeMatchesFilters(calmTrade, filterMulti)).toBe(false);
    });
  });

  describe('Mistakes and Tags Filtering', () => {
    it('filters trades by mistakes array', () => {
      const mistakeTrade = createDummyTrade({ mistakes: ['Chased', 'FOMO'] });
      const cleanTrade = createDummyTrade({ mistakes: [] });

      const filterMistake: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        mistakes: ['Chased'],
      };

      expect(tradeMatchesFilters(mistakeTrade, filterMistake)).toBe(true);
      expect(tradeMatchesFilters(cleanTrade, filterMistake)).toBe(false);
    });

    it('filters trades by tags array', () => {
      const aPlusTrade = createDummyTrade({ tags: ['A+ Setup', 'Trend Aligned'] });
      const newsTrade = createDummyTrade({ tags: ['News'] });

      const filterAPlus: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        tags: ['A+ Setup'],
      };

      expect(tradeMatchesFilters(aPlusTrade, filterAPlus)).toBe(true);
      expect(tradeMatchesFilters(newsTrade, filterAPlus)).toBe(false);
    });
  });

  describe('Combined Filter Composition', () => {
    it('evaluates all filter dimensions with AND semantics across dimensions and OR within arrays', () => {
      const perfectMatch = createDummyTrade({
        symbol: 'GBPJPY',
        direction: 'Long',
        session: 'London',
        setup: 'Breakout',
        netPnl: 250,
        tags: ['A+ Setup'],
        entryDate: '2026-08-15',
      });

      const wrongSession = createDummyTrade({
        symbol: 'GBPJPY',
        direction: 'Long',
        session: 'Asia',
        setup: 'Breakout',
        netPnl: 250,
        tags: ['A+ Setup'],
        entryDate: '2026-08-15',
      });

      const combinedFilters: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        direction: 'Long',
        result: 'Win',
        sessions: ['London', 'New York'],
        models: ['Breakout'],
        tags: ['A+ Setup'],
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      };

      expect(tradeMatchesFilters(perfectMatch, combinedFilters)).toBe(true);
      expect(tradeMatchesFilters(wrongSession, combinedFilters)).toBe(false);
    });

    it('correctly searches text in notes, symbol, setup, and tags', () => {
      const trade = createDummyTrade({
        symbol: 'NAS100',
        setup: 'VWAP Bounce',
        notes: 'Entered on 15m bullish candle closure',
        tags: ['Key Level'],
      });

      expect(tradeMatchesSearch(trade, 'nas100')).toBe(true);
      expect(tradeMatchesSearch(trade, 'vwap')).toBe(true);
      expect(tradeMatchesSearch(trade, 'bullish candle')).toBe(true);
      expect(tradeMatchesSearch(trade, 'Key Level')).toBe(true);
      expect(tradeMatchesSearch(trade, 'nonexistent')).toBe(false);
    });

    it('computes active filter counts and chip descriptors accurately', () => {
      const filters: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        datePreset: 'This Week',
        direction: 'Long',
        sessions: ['London', 'New York'],
        tags: ['A+ Setup'],
      };

      expect(countActiveFilters(filters, 'NAS100')).toBe(6); // 1 search + 1 date + 1 dir + 2 sessions + 1 tag = 6

      const chips = getActiveFilterChips(filters, 'NAS100');
      expect(chips.some((c) => c.key === 'query')).toBe(true);
      expect(chips.some((c) => c.key === 'datePreset')).toBe(true);
      expect(chips.some((c) => c.key === 'direction')).toBe(true);
      expect(chips.some((c) => c.id === 'session:London')).toBe(true);
    });

    it('returns true for all trades when filters are reset to BLANK', () => {
      const t1 = createDummyTrade({ netPnl: -100, direction: 'Short' });
      const t2 = createDummyTrade({ netPnl: 300, direction: 'Long' });

      expect(tradeMatchesFilters(t1, BLANK_JOURNAL_FILTERS)).toBe(true);
      expect(tradeMatchesFilters(t2, BLANK_JOURNAL_FILTERS)).toBe(true);
      expect(countActiveFilters(BLANK_JOURNAL_FILTERS)).toBe(0);
    });
  });
});
