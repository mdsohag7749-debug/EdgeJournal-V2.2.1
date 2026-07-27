import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { KEYS, loadJSON, saveJSON } from '../lib/storage';
import { uid } from '../lib/utils';

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

export function DataProvider({ children }) {
  const trades = useCollection(KEYS.trades);
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
    trades.setItems(loadJSON(KEYS.trades, []));
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
