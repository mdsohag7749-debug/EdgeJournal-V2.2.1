// Saved Views — filter+sort configurations for the Trading Journal.
//
// A Saved View is PURE configuration: it NEVER contains trade records or any
// derived analytics. A view is `{ id, name, accountId, filters, sortKey,
// sortDir, favoritesOnly, createdAt }`. Persisting a selection is safe by
// construction (only the config object is serialized).
//
// Storage follows the project convention (`njh_` prefix) via a dedicated
// namespaced key — nothing else in localStorage/Supabase is touched. Views are
// deliberately NOT imported/exported as part of account/challenge backups.
//
// Isolation contract: every view is stamped with the `accountId` it was saved
// under. The Journal's DataContext already scopes `trades.items` to the
// selected account, so a view can never leak another account's rows; the
// accountId stamp additionally lets the UI show only views for the account in
// use (see `viewsForAccount`).

import { uid } from './utils';

export const SAVED_VIEWS_KEY = 'njh_saved_views';

// --- pure list helpers (deterministic, testable without storage) -----------

// Trims the name and makes it unique against the provided list. Empty names
// normalize to '' (rejected by callers). Duplicates are handled safely: an
// incrementing " (n)" suffix is appended so an existing view is never
// overwritten or lost.
export function normalizeViewName(name, views) {
  let candidate = String(name || '').trim();
  if (!candidate) return '';
  const names = new Set((views || []).map((v) => v.name));
  if (!names.has(candidate)) return candidate;
  let i = 2;
  while (names.has(`${candidate} (${i})`)) i += 1;
  return `${candidate} (${i})`;
}

export function newSavedView({ name, filters, sortKey = 'date', sortDir = 'desc', favoritesOnly = false, accountId }, existing = []) {
  const safeName = normalizeViewName(name, existing);
  if (!safeName) return null;
  return {
    id: uid(),
    name: safeName,
    accountId: accountId || '',
    filters: { ...(filters || {}) },
    sortKey,
    sortDir,
    favoritesOnly: !!favoritesOnly,
    createdAt: new Date().toISOString(),
  };
}

export function renameView(views, id, newName) {
  const safeName = normalizeViewName(newName, views.filter((v) => v.id !== id));
  if (!safeName) return { views, error: 'View name cannot be empty.' };
  return { views: views.map((v) => (v.id === id ? { ...v, name: safeName } : v)), error: null };
}

export function deleteView(views, id) {
  return views.filter((v) => v.id !== id);
}

export function viewsForAccount(views, accountId) {
  return (views || []).filter((v) => !v.accountId || v.accountId === accountId);
}

// --- persistence ------------------------------------------------------------

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch {
    return false;
  }
}

export function loadSavedViews() {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v) => v && typeof v === 'object' && typeof v.name === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveViews(views) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(Array.isArray(views) ? views : []));
    return true;
  } catch {
    return false;
  }
}

// Commits the current selection as a view: appends, persists, and returns the
// new list + created view (or a human-readable error for an empty name).
export function persistNewView(existing, config) {
  const created = newSavedView(config, existing);
  if (!created) return { views: existing, view: null, error: 'View name cannot be empty.' };
  const views = [...existing, created];
  saveViews(views);
  return { views, view: created, error: null };
}

export function persistRename(existing, id, newName) {
  const { views, error } = renameView(existing, id, newName);
  if (!error) saveViews(views);
  return { views, error };
}

export function persistDelete(existing, id) {
  const views = deleteView(existing, id);
  saveViews(views);
  return views;
}