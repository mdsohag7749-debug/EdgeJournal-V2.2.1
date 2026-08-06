const PREFIX = 'njh_';

export const KEYS = {
  trades: `${PREFIX}trades`,
  plans: `${PREFIX}plans`,
  reflections: `${PREFIX}reflections`,
  study: `${PREFIX}study`,
  goals: `${PREFIX}goals`,
  models: `${PREFIX}models`,
  riskCriteria: `${PREFIX}risk_criteria`,
  checklistCriteria: `${PREFIX}checklist_criteria`,
  accountName: `${PREFIX}account_name`,
  tags: `${PREFIX}tags`,
};

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load', key, e);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  
  } catch (e) {
    console.error('Failed to save', key, e);
    
  }
}

export function estimateStorageBytes() {
  let total = 0;
  for (const k in localStorage) {
    if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
    if (!k.startsWith(PREFIX)) continue;
    total += (localStorage[k]?.length || 0) + k.length;
  }
  return total;
}

export function exportAllData(liveTrades, liveGoals, livePlans, liveReflections, liveStudy) {
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'EdgeJournal',
    version: 1,
    // Trades, goals, plans, reflections, and study notes now all live in
    // Supabase, not localStorage — the caller (System.jsx) passes the
    // current trades.items/goals.items/plans.items/reflections.items/
    // study.items from DataContext. Falling back to the old localStorage
    // keys keeps this function safe to call without those arguments.
    trades: Array.isArray(liveTrades) ? liveTrades : loadJSON(KEYS.trades, []),
    plans: Array.isArray(livePlans) ? livePlans : loadJSON(KEYS.plans, []),
    reflections: Array.isArray(liveReflections) ? liveReflections : loadJSON(KEYS.reflections, []),
    study: Array.isArray(liveStudy) ? liveStudy : loadJSON(KEYS.study, []),
    goals: Array.isArray(liveGoals) ? liveGoals : loadJSON(KEYS.goals, []),
    models: loadJSON(KEYS.models, []),
    riskCriteria: loadJSON(KEYS.riskCriteria, []),
    checklistCriteria: loadJSON(KEYS.checklistCriteria, []),
    accountName: loadJSON(KEYS.accountName, 'My Trading Account'),
    tags: loadJSON(KEYS.tags, []),
  };
  return data;
}

export function downloadJSONFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importAllData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
  // Trades, goals, plans, reflections, and study notes are intentionally
  // not written here — they now live in Supabase, not localStorage.
  // System.jsx reads `data.trades` / `data.goals` / `data.plans` /
  // `data.reflections` / `data.study` itself and imports them via each
  // collection's importMany().
  if (Array.isArray(data.models)) saveJSON(KEYS.models, data.models);
  if (Array.isArray(data.riskCriteria)) saveJSON(KEYS.riskCriteria, data.riskCriteria);
  if (Array.isArray(data.checklistCriteria)) saveJSON(KEYS.checklistCriteria, data.checklistCriteria);
  if (typeof data.accountName === 'string') saveJSON(KEYS.accountName, data.accountName);
  if (Array.isArray(data.tags)) saveJSON(KEYS.tags, data.tags);
}
