import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { KEYS, loadJSON, saveJSON } from '../lib/storage';
import { uid } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { toTradeRow, fromTradeRow } from '../lib/tradesApi';
import { toGoalRow, fromGoalRow } from '../lib/goalsApi';

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

// Unchanged: localStorage-backed collection, still used for plans,
// reflections, and study — `trades` and `goals` are now Supabase-backed
// (see useSupabaseCollection below).
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
// three extras (`importMany`, `refetch`, `loading`) used by System.jsx's
// backup restore and by AppShell's initial-load gate. Every query is
// additionally scoped to `user_id = userId` client-side as defense in
// depth — Row Level Security on the underlying table is what actually
// enforces "every user can only access their own data". `trades` and
// `goals` are both thin wrappers around this (see below).
function useSupabaseCollection(table, userId, { toRow, fromRow, orderColumn, ascending = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from(table).select('*').eq('user_id', userId);
    if (orderColumn) query = query.order(orderColumn, { ascending });
    const { data, error } = await query;

    if (error) {
      console.error(`Failed to load ${table} from Supabase:`, error.message);
      setItems([]);
    } else {
      setItems((data || []).map(fromRow));
    }
    setLoading(false);
  }, [table, userId, orderColumn, ascending, fromRow]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const add = useCallback(
    async (item) => {
      if (!userId) return null;
      const { data, error } = await supabase.from(table).insert(toRow(item, userId)).select().single();

      if (error) {
        console.error(`Failed to save ${table.slice(0, -1)} to Supabase:`, error.message);
        return null;
      }
      const saved = fromRow(data);
      setItems((prev) => [saved, ...prev]);
      return saved;
    },
    [table, userId, toRow, fromRow]
  );

  const update = useCallback(
    async (id, patch) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from(table)
        .update(toRow(patch, userId, { partial: true }))
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error(`Failed to update ${table.slice(0, -1)} in Supabase:`, error.message);
        return;
      }
      const saved = fromRow(data);
      setItems((prev) => prev.map((it) => (it.id === id ? saved : it)));
    },
    [table, userId, toRow, fromRow]
  );

  const remove = useCallback(
    async (id) => {
      if (!userId) return;
      const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);

      if (error) {
        console.error(`Failed to delete ${table.slice(0, -1)} from Supabase:`, error.message);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
    },
    [table, userId]
  );

  // Bulk insert used only by System.jsx's "Import JSON Backup" — a
  // backup file's array for this collection gets pushed into Supabase
  // instead of localStorage.
  const importMany = useCallback(
    async (rows) => {
      if (!userId || !Array.isArray(rows) || rows.length === 0) return;
      const payload = rows.map((r) => toRow(r, userId));
      const { data, error } = await supabase.from(table).insert(payload).select();

      if (error) {
        console.error(`Failed to import ${table} into Supabase:`, error.message);
        throw error;
      }
      const saved = (data || []).map(fromRow);
      setItems((prev) => [...saved, ...prev]);
    },
    [table, userId, toRow, fromRow]
  );

  return { items, add, update, remove, setItems, importMany, refetch, loading };
}

function useTradesCollection(userId) {
  return useSupabaseCollection('trades', userId, {
    toRow: toTradeRow,
    fromRow: fromTradeRow,
    orderColumn: 'date',
    ascending: false,
  });
}

function useGoalsCollection(userId) {
  return useSupabaseCollection('goals', userId, {
    toRow: toGoalRow,
    fromRow: fromGoalRow,
    orderColumn: 'created_at',
    ascending: false,
  });
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const trades = useTradesCollection(userId);
  const goals = useGoalsCollection(userId);
  const plans = useCollection(KEYS.plans);
  const reflections = useCollection(KEYS.reflections);
  const study = useCollection(KEYS.study);

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
    plans.setItems(loadJSON(KEYS.plans, []));
    reflections.setItems(loadJSON(KEYS.reflections, []));
    study.setItems(loadJSON(KEYS.study, []));
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
