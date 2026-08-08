import { describe, it, expect } from 'vitest';
import {
  BLANK_FILTERS,
  RESULT_ORDER,
  REVIEW_STATUS,
  MISTAKE_PRESENCE,
  tradeMatches,
  tradeMatchesText,
  filterTrades,
  sortTrades,
  activeFilters,
} from '../journalFilters';

const T = (o = {}) => ({
  id: 'x1',
  accountId: 'acc-main',
  date: '2024-01-02',
  entryTime: '09:00',
  instrument: 'EURUSD',
  session: 'London',
  model: 'Breakout',
  timeframe: 'H1',
  direction: 'Buy',
  result: 'Win',
  netPnl: 100,
  rr: 2,
  riskPercent: 1,
  rating: 4,
  tags: [],
  mistakes: {},
  psychology: {},
  riskChecklist: {},
  tradeChecklist: {},
  review: {},
  ...o,
});

const fullReview = {
  tradeManagement: 'x',
  reviewSummary: 'x',
  lessonLearned: 'x',
  psychology: 'x',
  nextAction: 'x',
};

describe('BLANK_FILTERS — shape', () => {
  it('exposes every dimension and the empty multi-select arrays', () => {
    expect(BLANK_FILTERS.pair).toBe('All');
    expect(BLANK_FILTERS.account).toBe('All');
    expect(BLANK_FILTERS.newsTrade).toBe(false);
    expect(BLANK_FILTERS.sessions).toEqual([]);
    expect(BLANK_FILTERS.models).toEqual([]);
    expect(BLANK_FILTERS.mistakes).toEqual([]);
  });
});

describe('tradeMatches — single-select dimensions', () => {
  it('blank filters match every trade', () => {
    expect(tradeMatches(T(), BLANK_FILTERS)).toBe(true);
    expect(tradeMatches(T({ instrument: 'GBPUSD', result: 'Loss', netPnl: -60 }), BLANK_FILTERS)).toBe(true);
  });

  it('pair filter is exact', () => {
    const f = { ...BLANK_FILTERS, pair: 'GBPUSD' };
    expect(tradeMatches(T({ instrument: 'GBPUSD' }), f)).toBe(true);
    expect(tradeMatches(T({ instrument: 'EURUSD' }), f)).toBe(false);
  });

  it('direction / session / timeframe / model / emotion filters are exact', () => {
    expect(tradeMatches(T({ direction: 'Sell' }), { ...BLANK_FILTERS, direction: 'Sell' })).toBe(true);
    expect(tradeMatches(T({ direction: 'Buy' }), { ...BLANK_FILTERS, direction: 'Sell' })).toBe(false);
    expect(tradeMatches(T({ session: 'New York' }), { ...BLANK_FILTERS, session: 'New York' })).toBe(true);
    expect(tradeMatches(T({ timeframe: 'M15' }), { ...BLANK_FILTERS, timeframe: 'M15' })).toBe(true);
    expect(tradeMatches(T({ result: 'Loss' }), { ...BLANK_FILTERS, result: 'Loss' })).toBe(true);
    expect(tradeMatches(T({ emotion: 'Calm' }), { ...BLANK_FILTERS, emotion: 'Calm' })).toBe(true);
    expect(tradeMatches(T({ emotion: 'FOMO' }), { ...BLANK_FILTERS, emotion: 'Calm' })).toBe(false);
  });

  it('account filter matches accountId', () => {
    expect(tradeMatches(T({ accountId: 'acc-b' }), { ...BLANK_FILTERS, account: 'acc-b' })).toBe(true);
    expect(tradeMatches(T({ accountId: 'acc-a' }), { ...BLANK_FILTERS, account: 'acc-b' })).toBe(false);
  });

  it('tag filter needs the tag inside the array', () => {
    expect(tradeMatches(T({ tags: ['news'] }), { ...BLANK_FILTERS, tag: 'news' })).toBe(true);
    expect(tradeMatches(T({ tags: [] }), { ...BLANK_FILTERS, tag: 'news' })).toBe(false);
    expect(tradeMatches(T(), { ...BLANK_FILTERS, tag: 'news' })).toBe(false);
  });
});

describe('tradeMatches — multi-select (OR) dimensions', () => {
  it('inactive (empty) arrays never exclude', () => {
    expect(tradeMatches(T(), { ...BLANK_FILTERS, sessions: [], models: [], results: [] })).toBe(true);
  });

  it('pairs OR matching', () => {
    const f = { ...BLANK_FILTERS, pairs: ['GBPUSD', 'XAUUSD'] };
    expect(tradeMatches(T({ instrument: 'GBPUSD' }), f)).toBe(true);
    expect(tradeMatches(T({ instrument: 'XAUUSD' }), f)).toBe(true);
    expect(tradeMatches(T({ instrument: 'EURUSD' }), f)).toBe(false);
  });

  it('sessions OR matching', () => {
    const f = { ...BLANK_FILTERS, sessions: ['Asia', 'New York'] };
    expect(tradeMatches(T({ session: 'Asia' }), f)).toBe(true);
    expect(tradeMatches(T({ session: 'New York' }), f)).toBe(true);
    expect(tradeMatches(T({ session: 'London' }), f)).toBe(false);
  });

  it('models / timeframes / results / emotions OR matching', () => {
    expect(tradeMatches(T({ model: 'Pullback' }), { ...BLANK_FILTERS, models: ['Pullback', 'Reversal'] })).toBe(true);
    expect(tradeMatches(T({ model: 'Breakout' }), { ...BLANK_FILTERS, models: ['Pullback'] })).toBe(false);
    expect(tradeMatches(T({ timeframe: 'M5' }), { ...BLANK_FILTERS, timeframes: ['M5', 'M15'] })).toBe(true);
    expect(tradeMatches(T({ result: 'Loss' }), { ...BLANK_FILTERS, results: ['Loss', 'BE'] })).toBe(true);
    expect(tradeMatches(T({ result: 'Win' }), { ...BLANK_FILTERS, results: ['Loss'] })).toBe(false);
    expect(tradeMatches(T({ emotion: 'Revenge' }), { ...BLANK_FILTERS, emotions: ['Revenge', 'FOMO'] })).toBe(true);
  });

  it('mistakes OR matching reads truthy keys', () => {
    const f = { ...BLANK_FILTERS, mistakes: ['overtrading', 'no_stop'] };
    expect(tradeMatches(T({ mistakes: { overtrading: true, fomo: false } }), f)).toBe(true);
    expect(tradeMatches(T({ mistakes: { no_stop: true } }), f)).toBe(true);
    expect(tradeMatches(T({ mistakes: { fomo: true } }), f)).toBe(false);
    expect(tradeMatches(T({ mistakes: {} }), f)).toBe(false);
  });
});

describe('tradeMatches — crosses dimensions with strict AND', () => {
  it('a trade must satisfy every active filter at once', () => {
    const f = { ...BLANK_FILTERS, pair: 'EURUSD', direction: 'Buy', sessions: ['London'] };
    expect(tradeMatches(T({ instrument: 'EURUSD', direction: 'Buy', session: 'London' }), f)).toBe(true);
    expect(tradeMatches(T({ instrument: 'EURUSD', direction: 'Sell', session: 'London' }), f)).toBe(false);
  });
});

describe('tradeMatches — favorites / news / A+ / review status', () => {
  it('favoritesOnly requires isFavorite', () => {
    expect(tradeMatches(T({ isFavorite: true }), BLANK_FILTERS, { favoritesOnly: true })).toBe(true);
    expect(tradeMatches(T(), BLANK_FILTERS, { favoritesOnly: true })).toBe(false);
  });

  it('newsTrade filters on the news tag', () => {
    expect(tradeMatches(T({ tags: ['a+', 'news'] }), { ...BLANK_FILTERS, newsTrade: true })).toBe(true);
    expect(tradeMatches(T({ tags: [] }), { ...BLANK_FILTERS, newsTrade: true })).toBe(false);
  });

  it('aPlus filters on the a+ tag', () => {
    expect(tradeMatches(T({ tags: ['A+'] }), { ...BLANK_FILTERS, aPlus: true })).toBe(true);
    expect(tradeMatches(T({ tags: ['news'] }), { ...BLANK_FILTERS, aPlus: true })).toBe(false);
  });

  it('reviewStatus Reviewed needs a complete review block', () => {
    expect(tradeMatches(T({ review: fullReview }), { ...BLANK_FILTERS, reviewStatus: 'Reviewed' })).toBe(true);
    expect(tradeMatches(T({ review: {} }), { ...BLANK_FILTERS, reviewStatus: 'Reviewed' })).toBe(false);
    expect(tradeMatches(T({ review: {} }), { ...BLANK_FILTERS, reviewStatus: 'Pending Review' })).toBe(true);
  });
});

describe('tradeMatches — numeric & date ranges', () => {
  it('date window is inclusive and lexicographic', () => {
    const f = { ...BLANK_FILTERS, dateFrom: '2024-01-02', dateTo: '2024-01-05' };
    expect(tradeMatches(T({ date: '2024-01-03' }), f)).toBe(true);
    expect(tradeMatches(T({ date: '2024-01-01' }), f)).toBe(false);
    expect(tradeMatches(T({ date: '2024-01-06' }), f)).toBe(false);
  });

  it('RR lower bound drops missing values', () => {
    expect(tradeMatches(T({ rr: 2 }), { ...BLANK_FILTERS, rrMin: '1.5' })).toBe(true);
    expect(tradeMatches(T({ rr: 1 }), { ...BLANK_FILTERS, rrMin: '1.5' })).toBe(false);
    expect(tradeMatches(T({ rr: undefined }), { ...BLANK_FILTERS, rrMin: '1.5' })).toBe(false);
  });

  it('PnL max excludes null netPnl', () => {
    expect(tradeMatches(T({ netPnl: 50 }), { ...BLANK_FILTERS, pnlMax: '100' })).toBe(true);
    expect(tradeMatches(T({ netPnl: 150 }), { ...BLANK_FILTERS, pnlMax: '100' })).toBe(false);
    expect(tradeMatches(T({ netPnl: undefined }), { ...BLANK_FILTERS, pnlMax: '100' })).toBe(false);
  });

  it('rating range applies', () => {
    expect(tradeMatches(T({ rating: 5 }), { ...BLANK_FILTERS, ratingMin: '4' })).toBe(true);
    expect(tradeMatches(T({ rating: 3 }), { ...BLANK_FILTERS, ratingMin: '4' })).toBe(false);
  });

  it('risk percent range applies', () => {
    expect(tradeMatches(T({ riskPercent: 2 }), { ...BLANK_FILTERS, riskPctMin: '1', riskPctMax: '3' })).toBe(true);
    expect(tradeMatches(T({ riskPercent: 5 }), { ...BLANK_FILTERS, riskPctMax: '3' })).toBe(false);
  });
});

describe('tradeMatchesText', () => {
  it('searches notes, tags, mistakes keys and nested review text case-insensitively', () => {
    expect(tradeMatchesText(T({ notes: 'Revenge trade after lunch' }), 'revenge')).toBe(true);
    expect(tradeMatchesText(T({ tags: ['FOMO edu'] }), 'fomo')).toBe(true);
    expect(tradeMatchesText(T({ mistakes: { no_stop: true } }), 'no_stop')).toBe(true);
    expect(tradeMatchesText(T({ review: { reviewSummary: 'Sloppy entry' } }), 'sloppy')).toBe(true);
    expect(tradeMatchesText(T({ instrument: 'EURUSD' }), 'GBP')).toBe(false);
  });

  it('empty query matches every trade', () => {
    expect(tradeMatchesText(T(), '   ')).toBe(true);
  });
});

describe('filterTrades & sortTrades', () => {
  const list = [
    T({ id: 'a', date: '2024-01-01', instrument: 'EURUSD', netPnl: 50, rr: 1 }),
    T({ id: 'b', date: '2024-01-02', instrument: 'GBPUSD', result: 'Loss', netPnl: -20, rr: 1 }),
    T({ id: 'c', date: '2024-01-03', instrument: 'EURUSD', netPnl: 120, rr: 3 }),
  ];

  it('filterTrades applies predicate and never mutates the input', () => {
    const snapshot = list.slice();
    const r = filterTrades(list, { filters: { ...BLANK_FILTERS, pair: 'EURUSD' } });
    expect(r.map((t) => t.id)).toEqual(['c', 'a']);
    expect(list).toEqual(snapshot);
  });

  it('sortTrades is deterministic — ties break on trade id', () => {
    const ties = [T({ id: 'z', netPnl: 10 }), T({ id: 'a', netPnl: 10 })];
    const sorted = sortTrades([T({ id: 'a', netPnl: 10 }), T({ id: 'z', netPnl: 10 })], 'profit', 'desc');
    expect(sorted.map((t) => t.id)).toEqual(['a', 'z']);
    expect(ties).toHaveLength(2);
  });

  it('desc is the default and asc reverses profit', () => {
    const res = filterTrades(list, { sortKey: 'profit', sortDir: 'asc' });
    expect(res.map((t) => t.netPnl)).toEqual([-20, 50, 120]);
  });

  it('unrecognised sort keys fall back to date', () => {
    const res = filterTrades(list, { sortKey: 'nonsense' });
    expect(res.map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('activeFilters — summaries & clear handles', () => {
  it('returns an empty summary for BLANK_FILTERS', () => {
    expect(activeFilters(BLANK_FILTERS)).toEqual([]);
  });

  it('labels single, multi and derived filters', () => {
    const chips = activeFilters(
      { ...BLANK_FILTERS, pair: 'GBPUSD', sessions: ['Asia', 'NY'], rrMin: '2', newsTrade: true },
      { query: 'fomo', favoritesOnly: true }
    );
    const labels = chips.map((c) => c.label);
    expect(labels).toContain('Pair: GBPUSD');
    expect(labels).toContain('Sessions: Asia OR NY');
    expect(labels).toContain('RR ≥ 2');
    expect(labels).toContain('News trade');
    expect(labels).toContain('Search: “fomo”');
    expect(labels).toContain('Favorites only');
    for (const c of chips) expect(c.id).toBeTruthy();
  });

  it('exports contract constants', () => {
    expect(RESULT_ORDER.Win).toBe(0);
    expect(REVIEW_STATUS).toContain('Reviewed');
    expect(MISTAKE_PRESENCE).toContain('Any');
  });

  it('range chips render both bounds', () => {
    const chips = activeFilters({ ...BLANK_FILTERS, rrMin: '1', rrMax: '3' });
    expect(chips.map((c) => c.label)).toContain('RR: 1–3');
  });
});

describe('account name search + sort (production Journal parity)', () => {
  const nameOf = (id) => (id === 'acc-main' ? 'Main Account' : id);

  it('text search includes the resolved account name', () => {
    expect(tradeMatchesText(T({ accountId: 'acc-main' }), 'main', nameOf)).toBe(true);
    expect(tradeMatchesText(T({ accountId: 'acc-main' }), 'main')).toBe(false);
  });

  it('tradeMatches search passes accountNameOf through', () => {
    const f = { ...BLANK_FILTERS };
    expect(tradeMatches(T({ accountId: 'acc-main', notes: 'x' }), f, { query: 'main', accountNameOf: nameOf })).toBe(true);
    expect(tradeMatches(T({ accountId: 'acc-main', notes: 'x' }), f, { query: 'other' })).toBe(false);
  });

  it('account sort uses the resolved display name, not the raw id', () => {
    const list = [
      T({ id: 'a', accountId: 'zzz' }),
      T({ id: 'b', accountId: 'acc-main' }),
    ];
    const asc = sortTrades(list, 'account', 'asc', nameOf);
    expect(asc.map((t) => t.id)).toEqual(['b', 'a']);
    const byId = sortTrades(list, 'account', 'asc');
    expect(byId.map((t) => t.id)).toEqual(['b', 'a']); // 'acc-main' < 'zzz' lexically
  });
});

describe('Sort options supported by the production Journal', () => {
  const list = [
    T({ id: 'a', instrument: 'EURUSD', model: 'Breakout', riskPercent: 3, netPnl: 50 }),
    T({ id: 'b', instrument: 'GBPUSD', model: 'Pullback', riskPercent: 1, netPnl: -20 }),
  ];

  it('risk: ascending sorts by risk percent', () => {
    expect(filterTrades(list, { sortKey: 'risk', sortDir: 'asc' }).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('setup: ascending sorts by model name', () => {
    expect(filterTrades(list, { sortKey: 'setup', sortDir: 'asc' }).map((t) => t.id)).toEqual(['a', 'b']);
  });
});