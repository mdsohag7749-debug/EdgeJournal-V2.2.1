import { describe, it, expect, beforeEach } from 'vitest';
import {
  SAVED_VIEWS_KEY,
  normalizeViewName,
  newSavedView,
  renameView,
  deleteView,
  viewsForAccount,
  persistNewView,
  persistRename,
  persistDelete,
  loadSavedViews,
} from '../savedViews';

const cfg = { filters: { pair: 'GBPUSD', sessions: ['London'] }, sortKey: 'date', sortDir: 'desc', favoritesOnly: false };

describe('newSavedView', () => {
  it('creates a config-only view stamped with the account', () => {
    const v = newSavedView({ name: '  London losses  ', filters: { pair: 'GBPUSD' }, accountId: 'acc-a' }, []);
    expect(v).not.toBeNull();
    expect(v.name).toBe('London losses');
    expect(v.accountId).toBe('acc-a');
    expect(v.sortKey).toBe('date');
    expect(v.sortDir).toBe('desc');
    expect(v).not.toHaveProperty('trades'); // config never contains trades
    expect(JSON.stringify(v).includes('"trades"')).toBe(false);
  });

  it('rejects an empty / whitespace name', () => {
    expect(newSavedView({ name: '   ' })).toBeNull();
    expect(newSavedView({ name: '' })).toBeNull();
  });

  it('auto-suffix duplicate names safely (never overwrite)', () => {
    const one = newSavedView({ name: 'London' }, []);
    const views = [one];
    const two = newSavedView({ name: 'London' }, views);
    expect(two.name).toBe('London (2)');
  });
});

describe('normalizeViewName', () => {
  it('trims and returns unchanged unique names', () => {
    expect(normalizeViewName('  Breakouts  ', [])).toBe('Breakouts');
  });
  it('returns empty for blank names', () => {
    expect(normalizeViewName('   ', [{ name: 'x' }])).toBe('');
  });
  it('walks past (n) collisions', () => {
    const views = [{ name: 'Plan (2)' }, { name: 'Plan' }];
    expect(normalizeViewName('Plan', views)).toBe('Plan (3)');
  });
});

describe('renameView', () => {
  const views = [newSavedView({ name: 'Original', filters: {} }), newSavedView({ name: 'Other', filters: {} })];
  it('renames and persists the exact view', () => {
    const { views: next, error } = renameView(views, views[0].id, '  Updated  ');
    expect(error).toBeNull();
    expect(next.find((v) => v.id === views[0].id).name).toBe('Updated');
    expect(next.find((v) => v.id === views[1].id).name).toBe('Other');
  });
  it('rejects empty names', () => {
    const { views: next, error } = renameView(views, views[0].id, '   ');
    expect(error).toBe('View name cannot be empty.');
    expect(next).toHaveLength(2);
  });
});

describe('deleteView', () => {
  it('removes only the targeted view', () => {
    const views = [newSavedView({ name: 'a', filters: [] }), newSavedView({ name: 'b', filters: [] })];
    const next = deleteView(views, views[1].id);
    expect(next.map((v) => v.name)).toEqual(['a']);
  });
});

describe('viewsForAccount (account isolation)', () => {
  it('only returns views for the given account', () => {
    const views = [
      newSavedView({ name: 'A', accountId: 'acc-a' }),
      newSavedView({ name: 'B', accountId: 'acc-b' }),
      newSavedView({ name: 'Anon', accountId: '' }),
    ];
    expect(viewsForAccount(views, 'acc-a').map((v) => v.name)).toEqual(['A', 'Anon']);
    expect(viewsForAccount(views, 'acc-x').map((v) => v.name)).toEqual(['Anon']);
  });
});

describe('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('persists created views and reloads them', () => {
    const { views, view } = persistNewView([], { name: 'GBPJPY London', filters: { pair: 'GBPJPY', sessions: ['London'] }, accountId: 'acc-a' });
    expect(view).not.toBeNull();
    expect(views).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY))).toHaveLength(1);
    const reloaded = loadSavedViews();
    expect(reloaded[0].name).toBe('GBPJPY London');
    expect(reloaded[0].filters.session).toBeUndefined();
    expect(Array.isArray(reloaded[0].filters.sessions)).toBe(true);
  });

  it('rename and delete round-trip to storage', () => {
    const { views } = persistNewView([], { name: 'Old', filters: {} });
    const id = views[0].id;
    const { views: renamed } = persistRename(views, id, 'New Name');
    expect(renamed[0].name).toBe('New Name');
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY))[0].name).toBe('New Name');
    const deleted = persistDelete(renamed, id);
    expect(deleted).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY))).toHaveLength(0);
  });

  it('handles a corrupt / non-array storage payload defensively', () => {
    localStorage.setItem(SAVED_VIEWS_KEY, 'not json');
    expect(loadSavedViews()).toEqual([]);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify({ not: 'an array' }));
    expect(loadSavedViews()).toEqual([]);
  });
});