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

export function exportAllData(liveTrades, liveGoals, livePlans, liveReflections, liveStudy, extra = {}) {
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
    // Accounts and challenges live in Supabase too; they're passed in by
    // Settings' Backup section so a backup is complete and can be fully
    // restored (accounts first — trades/challenges reference them by id).
    accounts: Array.isArray(extra.accounts) ? extra.accounts : [],
    challenges: Array.isArray(extra.challenges) ? extra.challenges : [],
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

// Soft ceiling on backup payload size (serialized). Guards against a
// corrupt or accidentally-huge file being read entirely into memory and
// pushed at Supabase in one shot.
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // 50 MB

// Validates a parsed backup file's structure BEFORE anything is written.
// Throws a descriptive Error on the first problem so the caller can abort
// the import without mutating localStorage or Supabase. Only collections
// the app actually restores are checked; a genuine EdgeJournal export
// (object + arrays of records) always passes. This implements the
// "Validate before you commit" rule so a malformed file can never cause a
// partial restore or a silent false-positive "imported successfully".
export function validateBackupData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid backup: expected a JSON object.');
  }
  if (JSON.stringify(data).length > MAX_IMPORT_BYTES) {
    throw new Error('Backup file is too large to import.');
  }

  // The file must be recognizably an EdgeJournal backup — it has to carry
  // at least one of the known top-level keys, otherwise an unrelated JSON
  // object would be reported as "imported successfully" while writing
  // nothing.
  const knownKeys = ['trades', 'goals', 'plans', 'reflections', 'study', 'accounts', 'challenges', 'models', 'riskCriteria', 'checklistCriteria', 'tags', 'accountName'];
  if (!knownKeys.some((key) => data[key] !== undefined)) {
    throw new Error('Invalid backup: this file is not an EdgeJournal backup.');
  }

  // Record collections restore into Supabase.
  const collections = ['trades', 'goals', 'plans', 'reflections', 'study', 'accounts', 'challenges'];
  for (const key of collections) {
    if (data[key] === undefined) continue; // older backups may omit some
    if (!Array.isArray(data[key])) {
      throw new Error(`Invalid backup: "${key}" must be an array.`);
    }
    for (const item of data[key]) {
      if (!item || typeof item !== 'object') {
        throw new Error(`Invalid backup: "${key}" contains a malformed entry.`);
      }
    }
  }

  // Per-browser settings written straight to localStorage.
  for (const key of ['models', 'riskCriteria', 'checklistCriteria', 'tags']) {
    if (data[key] === undefined) continue;
    if (!Array.isArray(data[key])) {
      throw new Error(`Invalid backup: "${key}" must be an array.`);
    }
  }
  if (data.accountName !== undefined && typeof data.accountName !== 'string') {
    throw new Error('Invalid backup: "accountName" must be a string.');
  }
}

export function importAllData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
  // Structure is validated up front in validateBackupData() (called by the
  // import screen) before any write, so none of these writes happen against
  // a malformed payload.
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
