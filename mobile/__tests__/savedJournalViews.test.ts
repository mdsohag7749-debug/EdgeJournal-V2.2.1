import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SAVED_JOURNAL_VIEWS_KEY,
  SavedJournalView,
  normalizeViewName,
  createSavedView,
  renameView,
  deleteView,
  viewsForAccount,
  loadSavedViews,
  saveViews,
  persistNewView,
  persistRenameView,
  persistDeleteView,
} from '../src/utils/savedJournalViews';
import { JournalFilterState, BLANK_JOURNAL_FILTERS } from '../src/utils/journalFilters';
import * as storageService from '../src/services/storageService';

// Mock storageService
vi.mock('../services/storageService', () => ({
  storageService: {
    getJSON: vi.fn(),
    setJSON: vi.fn(),
  },
}));

describe('savedJournalViews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- normalizeViewName ---

  describe('normalizeViewName', () => {
    it('trims and returns unchanged unique names', () => {
      expect(normalizeViewName('  Breakouts  ', [])).toBe('Breakouts');
    });

    it('returns empty for blank names', () => {
      expect(normalizeViewName('   ', [])).toBe('');
      expect(normalizeViewName('', [])).toBe('');
    });

    it('auto-suffixes duplicate names safely', () => {
      const views: SavedJournalView[] = [
        {
          id: '1',
          name: 'London',
          accountId: 'acc-a',
          filters: BLANK_JOURNAL_FILTERS,
          createdAt: new Date().toISOString(),
        },
      ];
      const result = normalizeViewName('London', views);
      expect(result).toBe('London (2)');
    });

    it('walks past (n) collisions', () => {
      const views: SavedJournalView[] = [
        {
          id: '1',
          name: 'Plan',
          accountId: '',
          filters: BLANK_JOURNAL_FILTERS,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Plan (2)',
          accountId: '',
          filters: BLANK_JOURNAL_FILTERS,
          createdAt: new Date().toISOString(),
        },
      ];
      const result = normalizeViewName('Plan', views);
      expect(result).toBe('Plan (3)');
    });
  });

  // --- createSavedView ---

  describe('createSavedView', () => {
    it('creates a config-only view stamped with the account', () => {
      const filters: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        direction: 'Long',
        sessions: ['London'],
      };

      const v = createSavedView({ name: '  London Longs  ', filters, accountId: 'acc-a' }, []);

      expect(v).not.toBeNull();
      expect(v?.name).toBe('London Longs');
      expect(v?.accountId).toBe('acc-a');
      expect(v?.filters.direction).toBe('Long');
      expect(v?.filters.sessions).toEqual(['London']);
      expect(v?.createdAt).toBeTruthy();
      expect(v?.id).toBeTruthy();
    });

    it('rejects empty/whitespace names', () => {
      expect(createSavedView({ name: '   ', filters: BLANK_JOURNAL_FILTERS }, [])).toBeNull();
      expect(createSavedView({ name: '', filters: BLANK_JOURNAL_FILTERS }, [])).toBeNull();
    });

    it('auto-suffixes duplicate names', () => {
      const existing = createSavedView({ name: 'London', filters: BLANK_JOURNAL_FILTERS }, []);
      expect(existing).not.toBeNull();

      const duplicate = createSavedView(
        { name: 'London', filters: BLANK_JOURNAL_FILTERS },
        [existing!]
      );
      expect(duplicate?.name).toBe('London (2)');
    });

    it('defaults accountId to empty string (user-wide)', () => {
      const v = createSavedView({ name: 'Test', filters: BLANK_JOURNAL_FILTERS }, []);
      expect(v?.accountId).toBe('');
    });
  });

  // --- renameView ---

  describe('renameView', () => {
    let views: SavedJournalView[];

    beforeEach(() => {
      views = [
        createSavedView({ name: 'Original', filters: BLANK_JOURNAL_FILTERS }, [])!,
        createSavedView({ name: 'Other', filters: BLANK_JOURNAL_FILTERS }, [])!,
      ];
    });

    it('renames and persists exactly', () => {
      const { views: next, error } = renameView(views, views[0].id, '  Updated  ');
      expect(error).toBeNull();
      expect(next.find((v) => v.id === views[0].id)?.name).toBe('Updated');
      expect(next.find((v) => v.id === views[1].id)?.name).toBe('Other');
    });

    it('rejects empty names', () => {
      const { views: next, error } = renameView(views, views[0].id, '   ');
      expect(error).toBe('View name cannot be empty.');
      expect(next).toHaveLength(2);
    });
  });

  // --- deleteView ---

  describe('deleteView', () => {
    it('removes only the targeted view', () => {
      const views = [
        createSavedView({ name: 'a', filters: BLANK_JOURNAL_FILTERS }, [])!,
        createSavedView({ name: 'b', filters: BLANK_JOURNAL_FILTERS }, [])!,
      ];
      const next = deleteView(views, views[1].id);
      expect(next).toHaveLength(1);
      expect(next[0].name).toBe('a');
    });
  });

  // --- viewsForAccount ---

  describe('viewsForAccount (account isolation)', () => {
    it('returns only views for the given account', () => {
      const views = [
        createSavedView({ name: 'A', filters: BLANK_JOURNAL_FILTERS, accountId: 'acc-a' }, [])!,
        createSavedView({ name: 'B', filters: BLANK_JOURNAL_FILTERS, accountId: 'acc-b' }, [])!,
        createSavedView({ name: 'Anon', filters: BLANK_JOURNAL_FILTERS, accountId: '' }, [])!,
      ];

      const forAccA = viewsForAccount(views, 'acc-a');
      expect(forAccA.map((v) => v.name).sort()).toEqual(['A', 'Anon']);

      const forAccX = viewsForAccount(views, 'acc-x');
      expect(forAccX.map((v) => v.name)).toEqual(['Anon']);
    });
  });

  // --- Persistence ---

  describe('loadSavedViews', () => {
    it('returns views from storage', async () => {
      const mockViews = [
        createSavedView({ name: 'Test', filters: BLANK_JOURNAL_FILTERS }, [])!,
      ];
      vi.spyOn(storageService.storageService, 'getJSON').mockResolvedValue(mockViews);

      const result = await loadSavedViews();
      expect(result).toEqual(mockViews);
    });

    it('returns empty array on error', async () => {
      vi.spyOn(storageService.storageService, 'getJSON').mockRejectedValue(
        new Error('Storage error')
      );

      const result = await loadSavedViews();
      expect(result).toEqual([]);
    });

    it('filters out invalid entries', async () => {
      vi.spyOn(storageService.storageService, 'getJSON').mockResolvedValue([
        createSavedView({ name: 'Valid', filters: BLANK_JOURNAL_FILTERS }, [])!,
        null,
        { name: 'NoFilters' } as any,
      ]);

      const result = await loadSavedViews();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid');
    });
  });

  describe('saveViews', () => {
    it('persists views to storage', async () => {
      const views = [createSavedView({ name: 'Test', filters: BLANK_JOURNAL_FILTERS }, [])!];
      vi.spyOn(storageService.storageService, 'setJSON').mockResolvedValue(undefined);

      const result = await saveViews(views);
      expect(result).toBe(true);
      expect(storageService.storageService.setJSON).toHaveBeenCalledWith(
        SAVED_JOURNAL_VIEWS_KEY,
        views
      );
    });

    it('returns false on error', async () => {
      vi.spyOn(storageService.storageService, 'setJSON').mockRejectedValue(
        new Error('Storage error')
      );

      const result = await saveViews([]);
      expect(result).toBe(false);
    });
  });

  // --- persistNewView ---

  describe('persistNewView', () => {
    it('creates and persists a new view', async () => {
      vi.spyOn(storageService.storageService, 'setJSON').mockResolvedValue(undefined);

      const result = await persistNewView([], {
        name: 'My View',
        filters: BLANK_JOURNAL_FILTERS,
        accountId: 'acc-a',
      });

      expect(result.view).not.toBeNull();
      expect(result.view?.name).toBe('My View');
      expect(result.views).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('rejects empty name', async () => {
      const result = await persistNewView([], {
        name: '   ',
        filters: BLANK_JOURNAL_FILTERS,
      });

      expect(result.view).toBeNull();
      expect(result.error).toBe('View name cannot be empty.');
    });

    it('returns error on storage failure', async () => {
      vi.spyOn(storageService.storageService, 'setJSON').mockRejectedValue(
        new Error('Storage error')
      );

      const result = await persistNewView([], {
        name: 'My View',
        filters: BLANK_JOURNAL_FILTERS,
      });

      expect(result.view).toBeNull();
      expect(result.error).toBe('Failed to save view.');
    });
  });

  // --- persistRenameView ---

  describe('persistRenameView', () => {
    it('renames and persists', async () => {
      const existing = [createSavedView({ name: 'Old', filters: BLANK_JOURNAL_FILTERS }, [])!];
      vi.spyOn(storageService.storageService, 'setJSON').mockResolvedValue(undefined);

      const result = await persistRenameView(existing, existing[0].id, 'New');

      expect(result.views[0].name).toBe('New');
      expect(result.error).toBeNull();
      expect(storageService.storageService.setJSON).toHaveBeenCalled();
    });

    it('rejects empty new name', async () => {
      const existing = [createSavedView({ name: 'Original', filters: BLANK_JOURNAL_FILTERS }, [])!];

      const result = await persistRenameView(existing, existing[0].id, '   ');

      expect(result.error).toBe('View name cannot be empty.');
    });
  });

  // --- persistDeleteView ---

  describe('persistDeleteView', () => {
    it('deletes and persists', async () => {
      const v1 = createSavedView({ name: 'a', filters: BLANK_JOURNAL_FILTERS }, [])!;
      const v2 = createSavedView({ name: 'b', filters: BLANK_JOURNAL_FILTERS }, [])!;
      const existing = [v1, v2];

      vi.spyOn(storageService.storageService, 'setJSON').mockResolvedValue(undefined);

      const result = await persistDeleteView(existing, v1.id);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('b');
      expect(storageService.storageService.setJSON).toHaveBeenCalled();
    });
  });

  // --- Filter preservation ---

  describe('filter preservation and serialization', () => {
    it('preserves all JournalFilterState fields', async () => {
      const filters: JournalFilterState = {
        datePreset: 'This Week',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-07',
        direction: 'Long',
        result: 'Win',
        sessions: ['London', 'New York'],
        emotions: ['Confident', 'Calm'],
        mistakes: ['FOMO'],
        tags: ['breakout', 'news'],
        models: ['reversal'],
        pairs: ['GBPJPY', 'EURUSD'],
        rrMin: '2',
        rrMax: '5',
        pnlMin: '100',
        pnlMax: '1000',
      };

      const v = createSavedView({ name: 'Complex', filters }, [])!;

      expect(v.filters).toEqual(filters);
    });

    it('survives round-trip serialization', async () => {
      const filters: JournalFilterState = {
        ...BLANK_JOURNAL_FILTERS,
        direction: 'Short',
        sessions: ['Asia'],
        tags: ['scalp'],
      };

      const v1 = createSavedView({ name: 'Test', filters }, [])!;
      const json = JSON.stringify(v1);
      const v2 = JSON.parse(json) as SavedJournalView;

      expect(v2.filters).toEqual(filters);
    });
  });

  // --- Account isolation edge cases ---

  describe('account isolation', () => {
    it('user-wide views are shared across accounts', () => {
      const userWideView = createSavedView({
        name: 'User Wide',
        filters: BLANK_JOURNAL_FILTERS,
        accountId: '', // empty = user-wide
      }, [])!;

      expect(viewsForAccount([userWideView], 'acc-a')).toHaveLength(1);
      expect(viewsForAccount([userWideView], 'acc-b')).toHaveLength(1);
      expect(viewsForAccount([userWideView], '')).toHaveLength(1);
    });

    it('account-specific views are isolated', () => {
      const accAView = createSavedView({
        name: 'Acc A Only',
        filters: BLANK_JOURNAL_FILTERS,
        accountId: 'acc-a',
      }, [])!;

      expect(viewsForAccount([accAView], 'acc-a')).toHaveLength(1);
      expect(viewsForAccount([accAView], 'acc-b')).toHaveLength(0);
      expect(viewsForAccount([accAView], '')).toHaveLength(0);
    });
  });
});
