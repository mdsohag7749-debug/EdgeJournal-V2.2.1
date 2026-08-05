import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { KEYS, loadJSON, saveJSON } from '../lib/storage';
import { uid, withTimeout } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useAccounts } from './AccountContext';
import { toTradeRow, fromTradeRow } from '../lib/tradesApi';
import { toGoalRow, fromGoalRow } from '../lib/goalsApi';
import { toPlanRow, fromPlanRow } from '../lib/plansApi';
import { toReflectionRow, fromReflectionRow } from '../lib/reflectionsApi';
import { toStudyRow, fromStudyRow } from '../lib/studyApi';
import { toChallengeRow, fromChallengeRow } from '../lib/challengesApi';
import {
  isOnline,
  isNetworkError,
  enqueueChange,
  dequeueChange,
  getQueueForTable,
  updateQueuedInsert,
  removeQueuedInsert,
  mergeQueueIntoItems,
  saveCache,
  loadCache,
  notifySyncComplete,
} from '../lib/offlineQueue';

const DataContext = createContext(null);

const DEFAULT_MODELS = ['Breakout', 'Pullback', 'Reversal', 'Range Fade'];
const DEFAULT_RISK_CRITERIA = [
  'Risk does not exceed max daily loss limit',
  'Position size matches plan',
  'Stop loss placed before entry',
];
const DEFAULT_CHECKLIST_CRITERIA = [
  'Aligned with pre-market bias',
  'Entered at planned level',
  'Confirmation candle present',
];

// Generic localStorage-backed collection. No longer used by any
// module now that `trades`, `goals`, `plans`, `reflections`, and
// `study` are all Supabase-backed (see useSupabaseCollection below) —
// kept here in case a future module needs a purely local collection.
function useCollection(key, defaultValue = []) {
  const [items, setItems] = useState(() => loadJSON(key, defaultValue));

  useEffect(() => {
    saveJSON(key, items);
  }, [key, items]);

  const add = useCallback((item) => {
    const withId = { id: uid(), createdAt: new Date().toISOString(), ...item };
    setItems((prev) => [withId, ...prev]);
    return withId;
  }, []);

  const update = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const replaceAll = useCallback((next) => setItems(next), []);

  return { items, add, update, remove, setItems: replaceAll };
}

// Generic Supabase-backed collection, exposing the same shape as
// useCollection (`items`, `add`, `update`, `remove`, `setItems`) plus
// extras (`importMany`, `refetch`, `loading`, `syncPending`) used by
// System.jsx's backup restore, AppShell's initial-load gate, and the
// offline-sync effect below. Every query is additionally scoped to
// `user_id = userId` client-side as defense in depth — Row Level
// Security on the underlying table is what actually enforces "every
// user can only access their own data". `trades`, `goals`, `plans`,
// `reflections`, and `study` are all thin wrappers around this.
//
// Offline support: `add`/`update`/`remove` check connectivity (and
// fall back the same way if a call that started online turns out to
// hit a network error mid-flight) — instead of failing, the change is
// applied to local state optimistically (tagged `_pending: true`) and
// appended to the offline write queue (src/lib/offlineQueue.js).
// `refetch` caches every successful load to localStorage and, on
// failure, falls back to that cache so previously loaded data is still
// browsable offline. `syncPending` drains this table's slice of the
// queue once connectivity returns; the effect in DataProvider below
// calls it for all five collections.
//
// Optional `filter` restricts every read to matching rows (e.g. trades
// scoped to the selected account). Shape: `{ eq: { column, value } }`,
// `{ or: [clauses] }`, plus `scope` (cache-isolation key) and
// `clientFilter` (applied to offline-queued rows so pending writes can't
// leak across views). Optional `rowContext` is merged into every toRow()
// call so writes carry the same scope (e.g. account_id). Other collections
// pass neither and behave exactly as before.
function useSupabaseCollection(table, userId, { toRow, fromRow, orderColumn, ascending = false, label, filter, rowContext, onChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Latest items, kept in a ref so mutation handlers can hand the balance
  // engine the pre-change record (e.g. the previous account / PnL of an
  // edited trade) without turning the collection into a render-loop.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const rowOpts = useCallback((partial) => ({ ...rowContext, partial }), [rowContext]);

  // A filter can be:
  //   null / undefined        -> no scoping (All Accounts / no selection)
  //   { eq: { column, value } } -> `column = value`
  //   { or: [clauses] }         -> PostgREST .or() string clauses
  //   { scope, clientFilter }   -> cache-isolation key + client-side check
  //                                (applied to offline-queued rows that have
  //                                not reached the DB yet, so pending writes
  //                                can never leak across account views)
  const cacheScope = filter?.scope || '';
  const applyClientFilter = useCallback(
    (list) => (filter?.clientFilter ? list.filter(filter.clientFilter) : list),
    [filter]
  );

  // The instant the view scope changes (e.g. switching accounts), drop the
  // previous scope's rows so stale cross-account data is never rendered
  // while the scoped refetch is in flight. If the new scope already has its
  // own offline cache, seed it immediately so switches feel instant (and
  // correct offline) — the network refetch reconciles right after.
  const scopeRef = useRef(cacheScope);
  useEffect(() => {
    if (scopeRef.current !== cacheScope) {
      scopeRef.current = cacheScope;
      if (userId) {
        setItems(applyClientFilter(mergeQueueIntoItems(table, userId, loadCache(table, userId, cacheScope))));
      } else {
        setItems([]);
      }
    }
  }, [cacheScope, table, userId, applyClientFilter]);

  const refetch = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase.from(table).select('*').eq('user_id', userId);
      if (filter?.eq?.value) query = query.eq(filter.eq.column, filter.eq.value);
      if (filter?.or?.length) query = query.or(filter.or.join(','));
      if (orderColumn) query = query.order(orderColumn, { ascending });
      const { data, error } = await withTimeout(query, 15000);
      if (error) throw error;

      const fetched = (data || []).map(fromRow);
      saveCache(table, userId, fetched, cacheScope);
      setItems(applyClientFilter(mergeQueueIntoItems(table, userId, fetched)));
    } catch (err) {
      // Offline (or Supabase unreachable): fall back to the last
      // successful fetch for THIS view scope instead of wiping the screen,
      // so the dashboard/analytics/etc. stay browsable offline without
      // ever showing another account's rows.
      console.error(`Failed to load ${table} from Supabase, using cached data:`, err.message || err);
      setItems(applyClientFilter(mergeQueueIntoItems(table, userId, loadCache(table, userId, cacheScope))));
    }
    setLoading(false);
  }, [table, userId, orderColumn, ascending, fromRow, filter, cacheScope, applyClientFilter]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const add = useCallback(
    async (item) => {
      if (!userId) return null;

      const queueOffline = () => {
        const tempId = `pending_${uid()}`;
        const optimistic = { ...item, id: tempId, createdAt: new Date().toISOString(), _pending: true };
        setItems((prev) => [optimistic, ...prev]);
        enqueueChange({ table, userId, type: 'insert', tempId, item, label });
        return optimistic;
      };

      if (!isOnline()) {
        const optimistic = queueOffline();
        onChange?.({ type: 'created', trade: optimistic });
        return optimistic;
      }

      try {
        const { data, error } = await supabase.from(table).insert(toRow(item, userId, rowOpts(false))).select().single();
        if (error) throw error;
        const saved = fromRow(data);
        // A row saved to a different account than the one currently
        // being viewed shouldn't appear in this (account-scoped) list.
        const moved = rowContext?.accountId && saved?.accountId && saved.accountId !== rowContext.accountId;
        setItems((prev) => (moved ? prev : [saved, ...prev]));
        onChange?.({ type: 'created', trade: saved });
        return saved;
      } catch (err) {
        if (isNetworkError(err)) {
          const optimistic = queueOffline();
          onChange?.({ type: 'created', trade: optimistic });
          return optimistic;
        }
        console.error(`Failed to save ${table.slice(0, -1)} to Supabase:`, err.message || err);
        return null;
      }
    },
    [table, userId, toRow, fromRow, label, rowOpts, onChange]
  );

  const update = useCallback(
    async (id, patch) => {
      if (!userId) return;
      const isPendingItem = typeof id === 'string' && id.startsWith('pending_');
      const previous = itemsRef.current.find((it) => it.id === id);

      const queueOffline = () => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch, _pending: true } : it)));
        const merged = { ...(previous || {}), ...patch, id };
        onChange?.({ type: 'updated', trade: merged, previous });
        if (isPendingItem) {
          // Still-unsynced local record: fold the edit into the queued
          // insert rather than creating a separate update entry for an
          // id Supabase has never seen.
          updateQueuedInsert(table, userId, id, patch);
        } else {
          enqueueChange({ table, userId, type: 'update', itemId: id, item: patch, label });
        }
      };

      if (!isOnline() || isPendingItem) return queueOffline();

      try {
        const { data, error } = await supabase
          .from(table)
          .update(toRow(patch, userId, rowOpts(true)))
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const saved = fromRow(data);
        // If the trade was moved to a different account than the one
        // being viewed, drop it from this (account-scoped) list.
        const moved = rowContext?.accountId && saved?.accountId && saved.accountId !== rowContext.accountId;
        setItems((prev) => (moved ? prev.filter((it) => it.id !== id) : prev.map((it) => (it.id === id ? saved : it))));
        onChange?.({ type: 'updated', trade: saved, previous });
      } catch (err) {
        if (isNetworkError(err)) return queueOffline();
        console.error(`Failed to update ${table.slice(0, -1)} in Supabase:`, err.message || err);
      }
    },
    [table, userId, toRow, fromRow, label, rowOpts, onChange]
  );

  const remove = useCallback(
    async (id) => {
      if (!userId) return;
      const isPendingItem = typeof id === 'string' && id.startsWith('pending_');

      const queueOffline = () => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        onChange?.({ type: 'deleted', trade: { id } });
        if (isPendingItem) {
          // Never made it to the server — just drop the queued insert.
          removeQueuedInsert(table, userId, id);
        } else {
          enqueueChange({ table, userId, type: 'delete', itemId: id, label });
        }
      };

      if (!isOnline() || isPendingItem) return queueOffline();

      try {
        const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setItems((prev) => prev.filter((it) => it.id !== id));
        onChange?.({ type: 'deleted', trade: { id } });
      } catch (err) {
        if (isNetworkError(err)) return queueOffline();
        console.error(`Failed to delete ${table.slice(0, -1)} from Supabase:`, err.message || err);
      }
    },
    [table, userId, label, onChange]
  );

  // Bulk insert used only by System.jsx's "Import JSON Backup" — a
  // backup file's array for this collection gets pushed into Supabase
  // instead of localStorage.
  const importMany = useCallback(
    async (rows) => {
      if (!userId || !Array.isArray(rows) || rows.length === 0) return;
      const payload = rows.map((r) => toRow(r, userId, rowOpts(false)));
      const { data, error } = await supabase.from(table).insert(payload).select();

      if (error) {
        console.error(`Failed to import ${table} into Supabase:`, error.message);
        throw error;
      }
      const saved = (data || []).map(fromRow);
      setItems((prev) => [...applyClientFilter(saved), ...prev]);
    },
    [table, userId, toRow, fromRow, rowOpts, applyClientFilter]
  );

  // Drains this collection's slice of the offline write queue,
  // oldest-first, stopping at the first failure (connectivity can drop
  // again mid-sync) so the remaining entries stay queued for the next
  // attempt instead of being replayed out of order. Returns how many
  // entries were successfully synced.
  const syncPending = useCallback(async () => {
    if (!userId || !isOnline()) return 0;
    const queue = getQueueForTable(table, userId);
    let synced = 0;

    for (const entry of queue) {
      try {
        if (entry.type === 'insert') {
          const { data, error } = await supabase.from(table).insert(toRow(entry.item, userId, rowOpts(false))).select().single();
          if (error) throw error;
          const saved = fromRow(data);
          const moved = rowContext?.accountId && saved?.accountId && saved.accountId !== rowContext.accountId;
          setItems((prev) => (moved ? prev : prev.map((it) => (it.id === entry.tempId ? saved : it))));
        } else if (entry.type === 'update') {
          const { data, error } = await supabase
            .from(table)
            .update(toRow(entry.item, userId, rowOpts(true)))
            .eq('id', entry.itemId)
            .eq('user_id', userId)
            .select()
            .single();
          if (error) throw error;
          const saved = fromRow(data);
          const moved = rowContext?.accountId && saved?.accountId && saved.accountId !== rowContext.accountId;
          setItems((prev) => (moved ? prev.filter((it) => it.id !== entry.itemId) : prev.map((it) => (it.id === entry.itemId ? saved : it))));
        } else if (entry.type === 'delete') {
          const { error } = await supabase.from(table).delete().eq('id', entry.itemId).eq('user_id', userId);
          if (error) throw error;
          setItems((prev) => prev.filter((it) => it.id !== entry.itemId));
        }
        dequeueChange(entry.id);
        synced += 1;
      } catch (err) {
        console.error(`Failed to sync queued ${table} change, will retry later:`, err.message || err);
        break;
      }
    }

    return synced;
  }, [table, userId, toRow, fromRow, rowOpts]);

  return { items, add, update, remove, setItems, importMany, refetch, loading, syncPending };
}

// Trades are scoped to the currently selected account: reads are filtered
// to that account, and every write is stamped with a concrete account id.
// When viewing "All Accounts" (or no account is selected yet) the read
// filter is skipped so ALL of the user's trades are returned and
// aggregated together — while writes still target the preferred account.
function useTradesCollection(userId, selectedAccountId, preferredAccountId, onChange) {
  // Reads are scoped to the concrete selected account via `account_id`.
  // When viewing "All Accounts" (or no account is selected yet) the read
  // filter is skipped so ALL of the user's trades are returned together —
  // while writes still target the preferred account.
  const filter = useMemo(
    () =>
      selectedAccountId
        ? {
            eq: { column: 'account_id', value: selectedAccountId },
            scope: `account:${selectedAccountId}`,
            clientFilter: (it) => it.accountId === selectedAccountId,
          }
        : null,
    [selectedAccountId]
  );
  const rowContext = useMemo(() => ({ accountId: preferredAccountId }), [preferredAccountId]);

  return useSupabaseCollection('trades', userId, {
    toRow: toTradeRow,
    fromRow: fromTradeRow,
    orderColumn: 'date',
    ascending: false,
    label: 'Trade',
    filter,
    rowContext,
    onChange,
  });
}

function useGoalsCollection(userId) {
  return useSupabaseCollection('goals', userId, {
    toRow: toGoalRow,
    fromRow: fromGoalRow,
    orderColumn: 'created_at',
    ascending: false,
    label: 'Goal',
  });
}

function usePlansCollection(userId) {
  return useSupabaseCollection('premarket_plans', userId, {
    toRow: toPlanRow,
    fromRow: fromPlanRow,
    orderColumn: 'date',
    ascending: false,
    label: 'Pre-Market Plan',
  });
}

function useReflectionsCollection(userId) {
  return useSupabaseCollection('reflections', userId, {
    toRow: toReflectionRow,
    fromRow: fromReflectionRow,
    orderColumn: 'date',
    ascending: false,
    label: 'Reflection',
  });
}

function useStudyCollection(userId) {
  return useSupabaseCollection('study_notes', userId, {
    toRow: toStudyRow,
    fromRow: fromStudyRow,
    orderColumn: 'date',
    ascending: false,
    label: 'Study Note',
  });
}

function useChallengesCollection(userId, selectedAccountId) {
  // Challenges are isolated per selected account, exactly like trades:
  // reads only return challenges linked to the selected account, plus any
  // that have no account linked at all ("general" challenges users rely on
  // staying visible in every single-account view — this preserves the
  // existing single-account experience). "All Accounts" returns everything.
  // Writes are stamped with the viewed account so a challenge created while
  // viewing a specific account is scoped to it (and hidden from other ones).
  const filter = useMemo(
    () =>
      selectedAccountId
        ? {
            or: [`account_id.eq.${selectedAccountId}`, 'account_id.is.null'],
            scope: `account:${selectedAccountId}`,
            clientFilter: (it) => !it.accountId || it.accountId === selectedAccountId,
          }
        : null,
    [selectedAccountId]
  );
  const rowContext = useMemo(() => ({ accountId: selectedAccountId }), [selectedAccountId]);

  return useSupabaseCollection('challenges', userId, {
    toRow: toChallengeRow,
    fromRow: fromChallengeRow,
    orderColumn: 'created_at',
    ascending: false,
    label: 'Challenge',
    filter,
    rowContext,
  });
}

export function DataProvider({ children}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { selectedAccountId, preferredAccountId, tradeChanged, reloadLedger } = useAccounts();

  // Feeds every trade create/edit/delete (online or offline) into the
  // Account Balance Engine so each account's equity stats recalculate
  // immediately — no manual refresh, real trade history only.
  const handleTradeChange = useCallback((payload) => {
    tradeChanged(payload);
  }, [tradeChanged]);

  const trades = useTradesCollection(userId, selectedAccountId, preferredAccountId, handleTradeChange);
  const goals = useGoalsCollection(userId);
  const plans = usePlansCollection(userId);
  const reflections = useReflectionsCollection(userId);
  const study = useStudyCollection(userId);
  const challenges = useChallengesCollection(userId, selectedAccountId);

  // Offline queue sync: the moment the browser reports connectivity
  // (on mount if already online, and on every subsequent 'online'
  // event), drain each collection's queued creates/edits/deletes into
  // Supabase. A ref-guarded flag stops overlapping runs (e.g. the
  // 'online' event firing again mid-sync), and a background interval
  // covers the case where the browser never fires 'online'/'offline'
  // reliably but connectivity is actually back.
  const syncingRef = useRef(false);
  const syncFns = [trades.syncPending, goals.syncPending, plans.syncPending, reflections.syncPending, study.syncPending, challenges.syncPending];

  useEffect(() => {
    if (!userId) return undefined;

    async function runSync() {
      if (syncingRef.current || !isOnline()) return;
      syncingRef.current = true;
      try {
        const results = await Promise.all(syncFns.map((fn) => fn()));
        const total = results.reduce((sum, n) => sum + n, 0);
        if (total > 0) notifySyncComplete(total);
        // Queued trades that just synced changed real account equity —
        // rebuild the balance ledger from the now-authoritative trade rows
        // (this also reconciles pending temp ids with real ids).
        if (results[0] > 0) reloadLedger();
      } finally {
        syncingRef.current = false;
      }
    }

    runSync();
    window.addEventListener('online', runSync);
    const interval = setInterval(runSync, 20000);

    return () => {
      window.removeEventListener('online', runSync);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadLedger, ...syncFns]);

  const [models, setModelsState] = useState(() => loadJSON(KEYS.models, DEFAULT_MODELS));
  const [riskCriteria, setRiskCriteriaState] = useState(() => loadJSON(KEYS.riskCriteria, DEFAULT_RISK_CRITERIA));
  const [checklistCriteria, setChecklistCriteriaState] = useState(() =>
    loadJSON(KEYS.checklistCriteria, DEFAULT_CHECKLIST_CRITERIA)
  );
  const [accountName, setAccountNameState] = useState(() => loadJSON(KEYS.accountName, 'My Trading Account'));

  useEffect(() => saveJSON(KEYS.models, models), [models]);
  useEffect(() => saveJSON(KEYS.riskCriteria, riskCriteria), [riskCriteria]);
  useEffect(() => saveJSON(KEYS.checklistCriteria, checklistCriteria), [checklistCriteria]);
  useEffect(() => saveJSON(KEYS.accountName, accountName), [accountName]);

  const reloadAllFromStorage = useCallback(() => {
    trades.refetch();
    goals.refetch();
    plans.refetch();
    reflections.refetch();
    study.refetch();
    challenges.refetch();
    setModelsState(loadJSON(KEYS.models, DEFAULT_MODELS));
    setRiskCriteriaState(loadJSON(KEYS.riskCriteria, DEFAULT_RISK_CRITERIA));
    setChecklistCriteriaState(loadJSON(KEYS.checklistCriteria, DEFAULT_CHECKLIST_CRITERIA));
    setAccountNameState(loadJSON(KEYS.accountName, 'My Trading Account'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    trades,
    goals,
    plans,
    reflections,
    study,
    challenges,
    models,
    setModels: setModelsState,
    riskCriteria,
    setRiskCriteria: setRiskCriteriaState,
    checklistCriteria,
    setChecklistCriteria: setChecklistCriteriaState,
    accountName,
    setAccountName: setAccountNameState,
    reloadAllFromStorage,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
