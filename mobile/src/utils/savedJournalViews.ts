// Mobile Saved Journal Views — exact parity with Web saved-view semantics.
//
// A Saved View is PURE CONFIGURATION: it NEVER contains trade records or
// derived analytics. It consists of filter state + metadata. Persisting
// a view is safe by construction (only configuration is serialized).
//
// Storage follows the project convention (`njh_` prefix) via storageService.
// Views are deliberately NOT imported/exported as part of account backups.
//
// Isolation contract: every view is stamped with the `accountId` it was saved
// under. Views with empty accountId are user-wide. The Journal context
// already scopes trades to the selected account, so a view can never leak
// another account's trades; the accountId stamp additionally lets the UI show
// only views for the current account.

import { JournalFilterState, BLANK_JOURNAL_FILTERS } from './journalFilters';
import { storageService } from '../services/storageService';

export const SAVED_JOURNAL_VIEWS_KEY = 'njh_saved_journal_views';

export interface SavedJournalView {
  id: string;
  name: string;
  accountId: string; // '' = user-wide, or specific account ID
  filters: JournalFilterState;
  createdAt: string; // ISO string
}

// Generate a unique ID (same approach as web: simple UUID-like string)
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// --- Pure list helpers (deterministic, testable without storage) -----------

/**
 * Normalizes view name: trims and ensures uniqueness against existing list.
 * Empty names return ''. Duplicates get auto-suffix " (n)".
 */
export function normalizeViewName(name: string, views: SavedJournalView[] = []): string {
  let candidate = String(name || '').trim();
  if (!candidate) return '';
  const names = new Set(views.map((v) => v.name));
  if (!names.has(candidate)) return candidate;
  let i = 2;
  while (names.has(`${candidate} (${i})`)) i += 1;
  return `${candidate} (${i})`;
}

/**
 * Creates a new SavedJournalView with normalized name and metadata.
 * Returns null if name is empty/whitespace after normalization.
 */
export function createSavedView(
  config: {
    name: string;
    filters: JournalFilterState;
    accountId?: string;
  },
  existing: SavedJournalView[] = []
): SavedJournalView | null {
  const safeName = normalizeViewName(config.name, existing);
  if (!safeName) return null;

  return {
    id: generateId(),
    name: safeName,
    accountId: config.accountId || '',
    filters: { ...config.filters },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Renames a view by ID. Returns { views, error }.
 * Error is set if the new name is empty.
 */
export function renameView(
  views: SavedJournalView[],
  id: string,
  newName: string
): { views: SavedJournalView[]; error: string | null } {
  const safeName = normalizeViewName(newName, views.filter((v) => v.id !== id));
  if (!safeName) return { views, error: 'View name cannot be empty.' };

  return {
    views: views.map((v) => (v.id === id ? { ...v, name: safeName } : v)),
    error: null,
  };
}

/**
 * Deletes a view by ID. Returns the new views list.
 */
export function deleteView(views: SavedJournalView[], id: string): SavedJournalView[] {
  return views.filter((v) => v.id !== id);
}

/**
 * Filters views to only those matching the account scope.
 * Views with empty accountId are user-wide and returned for any account.
 */
export function viewsForAccount(views: SavedJournalView[], accountId: string): SavedJournalView[] {
  return (views || []).filter((v) => !v.accountId || v.accountId === accountId);
}

// --- Persistence (async) ---------------------------------------------------

/**
 * Loads all saved views from storage.
 * Returns [] on error or if storage is unavailable.
 */
export async function loadSavedViews(): Promise<SavedJournalView[]> {
  try {
    const stored = await storageService.getJSON<SavedJournalView[]>(
      SAVED_JOURNAL_VIEWS_KEY,
      []
    );

    // Defensive: filter to valid views only
    return Array.isArray(stored)
      ? stored.filter(
          (v) =>
            v &&
            typeof v === 'object' &&
            typeof v.name === 'string' &&
            typeof v.filters === 'object'
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Persists the full views list to storage.
 */
export async function saveViews(views: SavedJournalView[]): Promise<boolean> {
  try {
    await storageService.setJSON(SAVED_JOURNAL_VIEWS_KEY, views);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates and persists a new saved view.
 * Returns { views, view, error }.
 */
export async function persistNewView(
  existing: SavedJournalView[],
  config: {
    name: string;
    filters: JournalFilterState;
    accountId?: string;
  }
): Promise<{ views: SavedJournalView[]; view: SavedJournalView | null; error: string | null }> {
  const created = createSavedView(config, existing);
  if (!created) {
    return { views: existing, view: null, error: 'View name cannot be empty.' };
  }

  const views = [...existing, created];
  const success = await saveViews(views);

  if (!success) {
    return { views: existing, view: null, error: 'Failed to save view.' };
  }

  return { views, view: created, error: null };
}

/**
 * Renames an existing view and persists.
 * Returns { views, error }.
 */
export async function persistRenameView(
  existing: SavedJournalView[],
  id: string,
  newName: string
): Promise<{ views: SavedJournalView[]; error: string | null }> {
  const { views, error } = renameView(existing, id, newName);
  if (!error) {
    await saveViews(views);
  }
  return { views, error };
}

/**
 * Deletes a view and persists.
 * Returns the new views list.
 */
export async function persistDeleteView(
  existing: SavedJournalView[],
  id: string
): Promise<SavedJournalView[]> {
  const views = deleteView(existing, id);
  await saveViews(views);
  return views;
}
