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

export function exportAllData() {
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'NJinix Journal Hub',
    version: 1,
    trades: loadJSON(KEYS.trades, []),
    plans: loadJSON(KEYS.plans, []),
    reflections: loadJSON(KEYS.reflections, []),
    study: loadJSON(KEYS.study, []),
    goals: loadJSON(KEYS.goals, []),
    models: loadJSON(KEYS.models, []),
    riskCriteria: loadJSON(KEYS.riskCriteria, []),
    checklistCriteria: loadJSON(KEYS.checklistCriteria, []),
    accountName: loadJSON(KEYS.accountName, 'My Trading Account'),
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
  if (Array.isArray(data.trades)) saveJSON(KEYS.trades, data.trades);
  if (Array.isArray(data.plans)) saveJSON(KEYS.plans, data.plans);
  if (Array.isArray(data.reflections)) saveJSON(KEYS.reflections, data.reflections);
  if (Array.isArray(data.study)) saveJSON(KEYS.study, data.study);
  if (Array.isArray(data.goals)) saveJSON(KEYS.goals, data.goals);
  if (Array.isArray(data.models)) saveJSON(KEYS.models, data.models);
  if (Array.isArray(data.riskCriteria)) saveJSON(KEYS.riskCriteria, data.riskCriteria);
  if (Array.isArray(data.checklistCriteria)) saveJSON(KEYS.checklistCriteria, data.checklistCriteria);
  if (typeof data.accountName === 'string') saveJSON(KEYS.accountName, data.accountName);
}
