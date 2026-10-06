// Mobile Journal Filter Engine — exact parity with Web filter semantics (src/lib/journalFilters.js)

import { Trade } from '../types/models';

export interface JournalFilterState {
  datePreset: 'Today' | 'This Week' | 'This Month' | 'YTD' | 'All Time' | 'Custom';
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  direction: 'All' | 'Long' | 'Short';
  result: 'All' | 'Win' | 'Loss' | 'BE' | 'Open';
  sessions: string[]; // OR within dimension
  emotions: string[]; // OR within dimension
  mistakes: string[]; // OR within dimension
  tags: string[]; // OR within dimension
  models: string[]; // OR within dimension (setups)
  pairs: string[]; // OR within dimension
  rrMin?: string;
  rrMax?: string;
  pnlMin?: string;
  pnlMax?: string;
}

export const BLANK_JOURNAL_FILTERS: JournalFilterState = {
  datePreset: 'All Time',
  dateFrom: '',
  dateTo: '',
  direction: 'All',
  result: 'All',
  sessions: [],
  emotions: [],
  mistakes: [],
  tags: [],
  models: [],
  pairs: [],
  rrMin: '',
  rrMax: '',
  pnlMin: '',
  pnlMax: '',
};

export const STANDARD_SESSIONS = [
  'Asia',
  'London',
  'New York',
  'London + New York',
  'Pre-Market',
];

export const STANDARD_EMOTIONS = [
  'Confident',
  'Calm',
  'Fear',
  'Greed',
  'FOMO',
  'Revenge',
  'Hesitation',
  'Stress',
];

export const STANDARD_MISTAKES = [
  'FOMO',
  'Chased',
  'Early Exit',
  'Overleveraged',
  'Moved Stop Loss',
  'No Plan',
  'Revenge Trade',
  'Hesitation',
];

// Timezone-safe ISO date helpers
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDatePresetRange(preset: JournalFilterState['datePreset']): { dateFrom: string; dateTo: string } {
  const today = getTodayISO();
  const d = new Date();

  switch (preset) {
    case 'Today':
      return { dateFrom: today, dateTo: today };

    case 'This Week': {
      // Monday as start of week
      const day = d.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);

      const mYear = monday.getFullYear();
      const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
      const mDay = String(monday.getDate()).padStart(2, '0');
      return { dateFrom: `${mYear}-${mMonth}-${mDay}`, dateTo: today };
    }

    case 'This Month': {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return { dateFrom: `${year}-${month}-01`, dateTo: today };
    }

    case 'YTD': {
      const year = d.getFullYear();
      return { dateFrom: `${year}-01-01`, dateTo: today };
    }

    case 'All Time':
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

// Presence in array (empty array means inactive filter)
function inAny(val?: string, list?: string[]): boolean {
  if (!list || list.length === 0) return true;
  if (!val) return false;
  return list.some((item) => item.toLowerCase() === val.toLowerCase());
}

// Text search against all textual trade fields
export function tradeMatchesSearch(t: Trade, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const searchable = [
    t.symbol,
    t.direction,
    t.setup,
    t.session,
    t.timeframe,
    t.notes,
    t.emotionBefore,
    t.emotionDuring,
    t.emotionAfter,
    ...(t.tags || []),
    ...(t.mistakes || []),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  return searchable.some((text) => text.includes(needle));
}

// Single trade match predicate
export function tradeMatchesFilters(
  t: Trade,
  filters: JournalFilterState = BLANK_JOURNAL_FILTERS,
  query: string = ''
): boolean {
  // 1. Global Text Search
  if (query && !tradeMatchesSearch(t, query)) return false;

  // 2. Direction Filter (Single)
  if (filters.direction !== 'All') {
    const dir = filters.direction.toLowerCase();
    const tradeDir = t.direction.toLowerCase();
    const isMatch =
      dir === tradeDir ||
      (dir === 'long' && tradeDir === 'buy') ||
      (dir === 'short' && tradeDir === 'sell');
    if (!isMatch) return false;
  }

  // 3. Result Filter (Single)
  if (filters.result !== 'All') {
    const isWin = t.netPnl > 0;
    const isLoss = t.netPnl < 0;
    const isBE = t.netPnl === 0;
    const isOpen = t.status === 'Open';

    if (filters.result === 'Open' && !isOpen) return false;
    if (filters.result === 'Win' && !isWin) return false;
    if (filters.result === 'Loss' && !isLoss) return false;
    if (filters.result === 'BE' && !isBE) return false;
  }

  // 4. Multi-select Sessions (OR within)
  if (!inAny(t.session, filters.sessions)) return false;

  // 5. Multi-select Models/Setups (OR within)
  if (!inAny(t.setup, filters.models)) return false;

  // 6. Multi-select Pairs/Symbols (OR within)
  if (!inAny(t.symbol, filters.pairs)) return false;

  // 7. Multi-select Emotions (OR within)
  if (filters.emotions && filters.emotions.length > 0) {
    const tradeEmotions = [t.emotionBefore, t.emotionDuring, t.emotionAfter].filter(Boolean) as string[];
    const matchesEmotion = filters.emotions.some((e) =>
      tradeEmotions.some((te) => te.toLowerCase() === e.toLowerCase())
    );
    if (!matchesEmotion) return false;
  }

  // 8. Multi-select Mistakes (OR within)
  if (filters.mistakes && filters.mistakes.length > 0) {
    const tradeMistakes = t.mistakes || [];
    const matchesMistake = filters.mistakes.some((m) =>
      tradeMistakes.some((tm) => tm.toLowerCase() === m.toLowerCase())
    );
    if (!matchesMistake) return false;
  }

  // 9. Multi-select Tags (OR within)
  if (filters.tags && filters.tags.length > 0) {
    const tradeTags = t.tags || [];
    const matchesTag = filters.tags.some((tag) =>
      tradeTags.some((tt) => tt.toLowerCase() === tag.toLowerCase())
    );
    if (!matchesTag) return false;
  }

  // 10. Date Range (Inclusive boundaries, YYYY-MM-DD)
  const tradeDate = t.entryDate || '';
  if (filters.dateFrom && tradeDate < filters.dateFrom) return false;
  if (filters.dateTo && tradeDate > filters.dateTo) return false;

  // 11. Numeric Ranges
  if (filters.rrMin && filters.rrMin.trim() !== '') {
    const min = Number(filters.rrMin);
    if (isNaN(min) || (t.riskRewardRatio ?? 0) < min) return false;
  }
  if (filters.rrMax && filters.rrMax.trim() !== '') {
    const max = Number(filters.rrMax);
    if (isNaN(max) || (t.riskRewardRatio ?? 0) > max) return false;
  }

  if (filters.pnlMin && filters.pnlMin.trim() !== '') {
    const min = Number(filters.pnlMin);
    if (isNaN(min) || t.netPnl < min) return false;
  }
  if (filters.pnlMax && filters.pnlMax.trim() !== '') {
    const max = Number(filters.pnlMax);
    if (isNaN(max) || t.netPnl > max) return false;
  }

  return true;
}

// Active Filter Chip descriptor
export interface ActiveFilterChip {
  id: string;
  label: string;
  key: keyof JournalFilterState | 'query';
  value?: string;
}

// Computes the active filter summary chips
export function getActiveFilterChips(
  filters: JournalFilterState,
  query: string = ''
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (query.trim()) {
    chips.push({ id: 'query', label: `Search: "${query.trim()}"`, key: 'query' });
  }

  if (filters.datePreset !== 'All Time') {
    chips.push({
      id: 'date',
      label:
        filters.datePreset === 'Custom'
          ? `${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`
          : filters.datePreset,
      key: 'datePreset',
    });
  } else if (filters.dateFrom || filters.dateTo) {
    chips.push({
      id: 'date',
      label: `${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`,
      key: 'dateFrom',
    });
  }

  if (filters.direction !== 'All') {
    chips.push({ id: 'direction', label: `Direction: ${filters.direction}`, key: 'direction' });
  }

  if (filters.result !== 'All') {
    chips.push({ id: 'result', label: `Result: ${filters.result}`, key: 'result' });
  }

  filters.sessions.forEach((s) => {
    chips.push({ id: `session:${s}`, label: `Session: ${s}`, key: 'sessions', value: s });
  });

  filters.models.forEach((m) => {
    chips.push({ id: `model:${m}`, label: `Setup: ${m}`, key: 'models', value: m });
  });

  filters.emotions.forEach((e) => {
    chips.push({ id: `emotion:${e}`, label: `Emotion: ${e}`, key: 'emotions', value: e });
  });

  filters.mistakes.forEach((m) => {
    chips.push({ id: `mistake:${m}`, label: `Mistake: ${m}`, key: 'mistakes', value: m });
  });

  filters.tags.forEach((t) => {
    chips.push({ id: `tag:${t}`, label: `#${t}`, key: 'tags', value: t });
  });

  return chips;
}

// Counts total active filter parameters
export function countActiveFilters(filters: JournalFilterState, query: string = ''): number {
  let count = 0;
  if (query.trim()) count += 1;
  if (filters.datePreset !== 'All Time' || filters.dateFrom || filters.dateTo) count += 1;
  if (filters.direction !== 'All') count += 1;
  if (filters.result !== 'All') count += 1;
  count += filters.sessions.length;
  count += filters.models.length;
  count += filters.emotions.length;
  count += filters.mistakes.length;
  count += filters.tags.length;
  count += filters.pairs.length;
  if (filters.rrMin || filters.rrMax) count += 1;
  if (filters.pnlMin || filters.pnlMax) count += 1;
  return count;
}
