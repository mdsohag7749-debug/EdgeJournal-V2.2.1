// Offline support engine for EdgeJournal.
//
// Three jobs live here, all backed by localStorage so they survive a
// full reload while offline:
//
// 1. A write queue ("njh_offline_queue") — every trade/goal/plan/
//    reflection/study-note create/edit/delete made while offline (or
//    made while online but hitting a network error) is appended here
//    instead of being lost. src/context/DataContext.jsx drains this
//    queue (oldest-first, per table) the moment the browser comes back
//    online.
// 2. A read cache ("njh_cache_<table>_<userId>") — the last successful
//    Supabase fetch for each collection, so the Dashboard/Analytics/etc.
//    pages still have something to render if a reload happens while
//    offline (requirement: "browse previously loaded data").
// 3. Small pub/sub helpers (isOnline/useOnlineStatus, useQueueCount,
//    useSyncToast) so the offline banner, the pending-sync indicator,
//    and the "synced!" toast can all react without prop drilling.
//
// Nothing here talks to Supabase directly — DataContext.jsx owns the
// actual insert/update/delete calls (it already has toRow/fromRow/table
// in scope for each collection). This file only persists + replays the
// intent.

import { useEffect, useState, useCallback } from 'react';
import { uid } from './utils';

const QUEUE_KEY = 'njh_offline_queue';
const QUEUE_EVENT = 'njh:queue-changed';
const TOAST_EVENT = 'njh:sync-toast';

// ---------------------------------------------------------------------
// Online/offline status
// ---------------------------------------------------------------------

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

// A network call can fail for reasons that have nothing to do with
// connectivity (a real validation error from Postgres, RLS rejecting a
// row, etc). Those should still surface as errors. This heuristic only
// catches the "we simply couldn't reach Supabase" case so those get
// queued for later instead of silently dropped.
export function isNetworkError(err) {
  if (!err) return false;
  if (!isOnline()) return true;
  const msg = String(err.message || err).toLowerCase();
  return (
    err.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('request timed out') ||
    msg.includes('the internet connection appears to be offline')
  );
}

// ---------------------------------------------------------------------
// Write queue
// ---------------------------------------------------------------------

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read offline queue', e);
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to persist offline queue', e);
  }
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { queue } }));
}

export function getQueueForTable(table, userId) {
  return loadQueue().filter((e) => e.table === table && e.userId === userId);
}

export function getQueueCount(userId) {
  return loadQueue().filter((e) => !userId || e.userId === userId).length;
}

// entry: { table, userId, type: 'insert'|'update'|'delete', tempId?,
//          itemId?, item?, label }
export function enqueueChange(entry) {
  const queue = loadQueue();
  const withId = { id: uid(), createdAt: new Date().toISOString(), ...entry };
  queue.push(withId);
  saveQueue(queue);
  return withId;
}

export function dequeueChange(id) {
  const queue = loadQueue().filter((e) => e.id !== id);
  saveQueue(queue);
}

// Editing/deleting a record that was itself created offline and hasn't
// synced yet: fold the change into the still-queued insert instead of
// creating a second queue entry, so we never send a stray update/delete
// for an id the server has never heard of.
export function updateQueuedInsert(table, userId, tempId, patch) {
  const queue = loadQueue();
  const idx = queue.findIndex((e) => e.table === table && e.userId === userId && e.type === 'insert' && e.tempId === tempId);
  if (idx === -1) return false;
  queue[idx] = { ...queue[idx], item: { ...queue[idx].item, ...patch } };
  saveQueue(queue);
  return true;
}

export function removeQueuedInsert(table, userId, tempId) {
  const queue = loadQueue();
  const next = queue.filter((e) => !(e.table === table && e.userId === userId && e.type === 'insert' && e.tempId === tempId));
  if (next.length === queue.length) return false;
  saveQueue(next);
  return true;
}

// Applies every still-queued change for a table on top of a freshly
// (or previously) fetched list, so pending offline edits stay visible
// even across a reload that happens before they've synced.
export function mergeQueueIntoItems(table, userId, baseItems) {
  const queue = getQueueForTable(table, userId);
  let items = [...baseItems];
  for (const entry of queue) {
    if (entry.type === 'insert') {
      items = [{ ...entry.item, id: entry.tempId, createdAt: entry.createdAt, _pending: true }, ...items];
    } else if (entry.type === 'update') {
      items = items.map((it) => (it.id === entry.itemId ? { ...it, ...entry.item, _pending: true } : it));
    } else if (entry.type === 'delete') {
      items = items.filter((it) => it.id !== entry.itemId);
    }
  }
  return items;
}

export function useQueueCount(userId) {
  const [count, setCount] = useState(() => getQueueCount(userId));

  useEffect(() => {
    function recalc() {
      setCount(getQueueCount(userId));
    }
    recalc();
    window.addEventListener(QUEUE_EVENT, recalc);
    window.addEventListener('storage', recalc);
    return () => {
      window.removeEventListener(QUEUE_EVENT, recalc);
      window.removeEventListener('storage', recalc);
    };
  }, [userId]);

  return count;
}

// ---------------------------------------------------------------------
// Read cache (for offline browsing of previously loaded data)
// ---------------------------------------------------------------------

function cacheKey(table, userId, scope) {
  return `njh_cache_${table}_${userId || 'anon'}${scope ? `_${scope}` : ''}`;
}

// `scope` isolates the cache per data view (e.g. the currently selected
// account), so switching views while offline never serves another view's
// rows. Omit it to keep the shared per-user cache used by non-scoped
// modules (accounts, balance ledger).
export function saveCache(table, userId, items, scope) {
  if (!userId) return;
  try {
    localStorage.setItem(cacheKey(table, userId, scope), JSON.stringify(items));
  } catch (e) {
    console.error(`Failed to cache ${table} for offline use`, e);
  }
}

export function loadCache(table, userId, scope) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(cacheKey(table, userId, scope));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Failed to read cached ${table}`, e);
    return [];
  }
}

// ---------------------------------------------------------------------
// Sync-completed toast
// ---------------------------------------------------------------------

export function notifySyncComplete(count) {
  if (!count) return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { count } }));
}

// Returns the most recent sync-toast payload ({count}) and a dismiss()
// function; auto-clears itself after `duration` ms.
export function useSyncToast(duration = 4000) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    function handle(e) {
      setToast(e.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), duration);
    }
    window.addEventListener(TOAST_EVENT, handle);
    return () => {
      window.removeEventListener(TOAST_EVENT, handle);
      clearTimeout(timer);
    };
  }, [duration]);

  const dismiss = useCallback(() => setToast(null), []);

  return [toast, dismiss];
}
