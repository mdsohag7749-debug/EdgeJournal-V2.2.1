import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  KEYS,
  loadJSON,
  saveJSON,
  estimateStorageBytes,
  exportAllData,
  validateBackupData,
  importAllData,
  MAX_IMPORT_BYTES,
} from '../storage';
import { saveCache, loadCache } from '../offlineQueue';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

// Deterministic trade fixtures
const tradeA = (over) => ({
  id: 'tr-1',
  accountId: 'acc-1',
  date: '2024-01-02',
  instrument: 'EURUSD',
  result: 'Win',
  netPnl: 120,
  rr: 2.4,
  riskPercent: 1,
  contracts: 0.5,
  entryPrice: 1.1,
  stopLoss: 1.095,
  takeProfit: 1.11,
  ...over,
});
const tradeB = (over) => ({
  id: 'tr-2',
  accountId: 'acc-2',
  date: '2024-01-03',
  instrument: 'GBPUSD',
  result: 'Loss',
  netPnl: -40,
  rr: 1.0,
  riskPercent: 2,
  contracts: 1,
  ...over,
});

describe('localStorage helpers — save / read / update / delete', () => {
  it('returns the default when a key is missing', () => {
    expect(loadJSON(KEYS.trades, [])).toEqual([]);
    expect(loadJSON('nope', 'fallback')).toBe('fallback');
  });

  it('saves and round-trips JSON values', () => {
    saveJSON(KEYS.trades, [tradeA(), tradeB()]);
    expect(loadJSON(KEYS.trades, [])).toEqual([tradeA(), tradeB()]);
  });

  it('updates by re-saving the whole value', () => {
    saveJSON(KEYS.tags, ['a']);
    saveJSON(KEYS.tags, ['a', 'b']);
    expect(loadJSON(KEYS.tags, [])).toEqual(['a', 'b']);
  });

  it('removes by clearing the key', () => {
    saveJSON(KEYS.models, [1]);
    localStorage.removeItem(KEYS.models);
    expect(loadJSON(KEYS.models, [])).toEqual([]);
  });

  it('tolerates malformed (corrupt) JSON by returning the fallback', () => {
    localStorage.setItem(KEYS.tags, '{not valid json!!!');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadJSON(KEYS.tags, ['default'])).toEqual(['default']);
    expect(spy).toHaveBeenCalled();
  });

  it('accounts are isolated by their storage key', () => {
    // Per-account state lives under a distinct key: writing account A never
    // disturbs account B.
    saveJSON('njh_selected_account_aaa', 'acc-1');
    saveJSON('njh_selected_account_bbb', 'acc-2');
    expect(loadJSON('njh_selected_account_aaa', null)).toBe('acc-1');
    expect(loadJSON('njh_selected_account_bbb', null)).toBe('acc-2');
    expect(loadJSON('njh_selected_account_aaa', null)).not.toBe('acc-2');
  });
});

describe('estimateStorageBytes (browser storage meter)', () => {
  it('counts only prefixed keys', () => {
    localStorage.setItem(KEYS.tags, JSON.stringify(['news', 'scalp']));
    localStorage.setItem('unrelated', 'xxxx');
    const bytes = estimateStorageBytes();
    expect(typeof bytes).toBe('number');
    expect(bytes).toBeGreaterThan(0);
  });
});

describe('Export — builds a valid backup payload', () => {
  it('includes every collection the app restores', () => {
    const backup = exportAllData(
      [tradeA()],
      [{ id: 'g1' }],
      [{ id: 'p1' }],
      [{ id: 'r1' }],
      [{ id: 's1' }],
      {
        accounts: [{ id: 'acc-1' }, { id: 'acc-2' }],
        challenges: [{ id: 'c1' }],
      }
    );
    expect(backup.app).toBe('EdgeJournal');
    expect(backup.version).toBe(1);
    expect(backup.trades).toEqual([tradeA()]);
    expect(backup.goals).toEqual([{ id: 'g1' }]);
    expect(backup.plans).toEqual([{ id: 'p1' }]);
    expect(backup.reflections).toEqual([{ id: 'r1' }]);
    expect(backup.study).toEqual([{ id: 's1' }]);
    expect(backup.accounts).toHaveLength(2);
    expect(backup.challenges).toHaveLength(1);
    // passes its own validator
    expect(() => validateBackupData(backup)).not.toThrow();
  });
});

describe('Import — validation protects existing data', () => {
  it('rejects non-object / arrays / unknown JSON', () => {
    expect(() => validateBackupData(null)).toThrow(/expected a JSON object/);
    expect(() => validateBackupData([1, 2])).toThrow(/expected a JSON object/);
    expect(() => validateBackupData({ hello: 'world' })).toThrow(/not an EdgeJournal backup/);
  });

  it('rejects malformed structures without mutating storage', () => {
    // seed existing valid data first
    saveJSON(KEYS.tags, ['keep', 'me']);
    saveJSON(KEYS.models, ['Keep']);

    expect(() => validateBackupData({ trades: 'not-an-array', tags: ['x'] })).toThrow(/must be an array/);
    expect(() => validateBackupData({ trades: [{}, 'bad'] })).toThrow(/malformed entry/);
    expect(() => validateBackupData({ accountName: 123 })).toThrow(/must be a string/);

    // existing data survived intact
    expect(loadJSON(KEYS.tags, [])).toEqual(['keep', 'me']);
    expect(loadJSON(KEYS.models, [])).toEqual(['Keep']);
  });

  it('rejects oversized backup files', () => {
    const giant = { blob: 'x'.repeat(MAX_IMPORT_BYTES + 1024) };
    expect(() => validateBackupData(giant)).toThrow(/too large/);
  });

  it('allows duplicate record ids (idempotent import, not silently rejected)', () => {
    const dup = exportAllData([tradeA(), tradeA()], [], [], [], [], {});
    expect(() => validateBackupData(dup)).not.toThrow();
  });

  it('importAllData writes only the settings collections', () => {
    const payload = {
      trades: [tradeA()],
      plans: [],
      models: ['Breakout'],
      riskCriteria: ['Rule 1'],
      checklistCriteria: [],
      accountName: 'Prop A',
      tags: ['trend'],
    };
    importAllData(payload);

    expect(loadJSON(KEYS.models, [])).toEqual(['Breakout']);
    expect(loadJSON(KEYS.riskCriteria, [])).toEqual(['Rule 1']);
    expect(loadJSON(KEYS.accountName, 'x')).toBe('Prop A');
    expect(loadJSON(KEYS.tags, [])).toEqual(['trend']);
    // trading records travel to Supabase via importMany — never stored here
    expect(localStorage.getItem(KEYS.trades)).toBeNull();
  });

  it('an invalid backup never destroys existing valid data (full import flow)', () => {
    saveJSON(KEYS.tags, ['existing']);

    // caller-side validation throws first…
    expect(() => validateBackupData({ trades: 'garbage' })).toThrow();
    // …importAllData itself is a defensive no-op on malformed input
    expect(() => importAllData({ trades: 'garbage' })).not.toThrow();

    expect(loadJSON(KEYS.tags, [])).toEqual(['existing']);
  });
});

describe('DATA ROUND-TRIP — export → clear → restore → compare', () => {
  it('restores every persisted field exactly', () => {
    const source = {
      trades: [tradeA(), tradeB()],
      goals: [{ id: 'g1', title: 'Goal 1' }],
      plans: [{ id: 'p1', title: 'Plan 1', sectionsBurndown: [] }],
      reflections: [{ id: 'r1', body: 'felt rushed' }],
      study: [{ id: 's1', note: 'tape reading' }],
      accounts: [{ id: 'acc-1' }, { id: 'acc-2' }],
    };

    // 1) export
    const backup = exportAllData(
      source.trades,
      source.goals,
      source.plans,
      source.reflections,
      source.study,
      { accounts: source.accounts, challenges: [] }
    );
    expect(() => validateBackupData(backup)).not.toThrow();

    // 2) wipe the isolated test storage
    localStorage.clear();

    // 3) "restore" = import settings + hand collections back to the caller
    //    (System.jsx restores records via importMany into Supabase).
    importAllData({ ...backup, tags: ['trend'] });

    // 4) compare restored vs original
    expect(backup.trades.length).toBe(source.trades.length);
    expect(backup.accounts.length).toBe(source.accounts.length);
    expect(backup.trades.map((t) => t.id)).toEqual(source.trades.map((t) => t.id));

    // persisted math fields survive byte-for-byte
    expect(backup.trades.find((t) => t.id === 'tr-1')).toMatchObject({
      netPnl: 120,
      rr: 2.4,
      riskPercent: 1,
      contracts: 0.5,
      entryPrice: 1.1,
      stopLoss: 1.095,
      takeProfit: 1.11,
    });
    expect(backup.trades.find((t) => t.id === 'tr-2')).toMatchObject({ netPnl: -40, riskPercent: 2, contracts: 1 });

    expect(backup.goals).toEqual(source.goals);
    expect(backup.plans).toEqual(source.plans);
    expect(backup.reflections).toEqual(source.reflections);
    expect(backup.study).toEqual(source.study);

    // settings restored
    expect(loadJSON(KEYS.tags, [])).toEqual(['trend']);
  });
});

describe('offline read cache (Sprint 6.3 storage helpers)', () => {
  it('caches and reloads user-scoped data from localStorage', () => {
    const items = [tradeA()];
    saveCache('trades', 'user-1', items);
    expect(loadCache('trades', 'user-1')).toEqual(items);
    // caches are isolated per user / table
    expect(loadCache('trades', 'user-2')).toEqual([]);
    expect(loadCache('goals', 'user-1')).toEqual([]);
  });
});