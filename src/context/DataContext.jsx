import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { KEYS, loadJSON, saveJSON } from '../lib/storage';
import { uid } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { toTradeRow, fromTradeRow } from '../lib/tradesApi';

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
// reflections, study, and goals — only `trades` moved to Supabase.
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

// Supabase-backed replacement for `trades`, exposing the exact same
// shape (`items`, `add`, `update`, `remove`, `setItems`) plus two
// extras (`importMany`, `refetch`, `loading`) used by System.jsx's
// backup restore and by AppShell's initial-load gate. Every query is
// additionally scoped to `user_id = userId` client-side as defense in
// depth — Row Level Security on the `trades` table is what actually
// enforces "every user can only access their own data".
function useTradesCollection(userId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Failed to load trades from Supabase:', error.message);
      setItems([]);
    } else {
      setItems((data || []).map(fromTradeRow));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const add = useCallback(
    async (item) => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('trades')
        .insert(toTradeRow(item, userId))
        .select()
        .single();

      if (error) {
        console.error('Failed to save trade to Supabase:', error.message);
        return null;
      }
      const saved = fromTradeRow(data);
      setItems((prev) => [saved, ...prev]);
      return saved;
    },
    [userId]
  );

  const update = useCallback(
    async (id, patch) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('trades')
        .update(toTradeRow(patch, userId, { partial: true }))
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update trade in Supabase:', error.message);
        return;
      }
      const saved = fromTradeRow(data);
      setItems((prev) => prev.map((it) => (it.id === id ? saved : it)));
    },
    [userId]
  );

  const remove = useCallback(
    async (id) => {
      if (!userId) return;
      const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', userId);

      if (error) {
        console.error('Failed to delete trade from Supabase:', error.message);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
    },
    [userId]
  );

  // Bulk insert used only by System.jsx's "Import JSON Backup" — a
  // backup file's `trades` array gets pushed into Supabase instead of
  // localStorage.
  const importMany = useCallback(
    async (rows) => {
      if (!userId || !Array.isArray(rows) || rows.length === 0) return;
      const payload = rows.map((r) => toTradeRow(r, userId));
      const { data, error } = await supabase.from('trades').insert(payload).select();

      if (error) {
        console.error('Failed to import trades into Supabase:', error.message);
        throw error;
      }
      const saved = (data || []).map(fromTradeRow);
      setItems((prev) => [...saved, ...prev]);
    },
    [userId]
  );

  return { items, add, update, remove, setItems, importMany, refetch, loading };
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const trades = useTradesCollection(userId);
  const plans = useCollection(KEYS.plans);
  const reflections = useCollection(KEYS.reflections);
  const study = useCollection(KEYS.study);
  const goals = useCollection(KEYS.goals);

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
    plans.setItems(loadJSON(KEYS.plans, []));
    reflections.setItems(loadJSON(KEYS.reflections, []));
    study.setItems(loadJSON(KEYS.study, []));
    goals.setItems(loadJSON(KEYS.goals, []));
    setModelsState(loadJSON(KEYS.models, DEFAULT_MODELS));
    setRiskCriteriaState(loadJSON(KEYS.riskCriteria, DEFAULT_RISK_CRITERIA));
    setChecklistCriteriaState(loadJSON(KEYS.checklistCriteria, DEFAULT_CHECKLIST_CRITERIA));
    setAccountNameState(loadJSON(KEYS.accountName, 'My Trading Account'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    trades,
    plans,
    reflections,
    study,
    goals,
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
