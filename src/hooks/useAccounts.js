// Account state-management hook (the "H" of multi-account backend).
// Owns the account list, the loading flag, the persisted per-user
// account selection, and every mutation (create / update / delete / make
// default). Wired into the global tree once via AccountContext — any
// component can read the same state through useAccounts().
//
// Selection model (Phase 3 — full-app integration):
//   - A concrete account id  -> only that account's data is shown.
//   - ALL_ACCOUNTS sentinel  -> "All Accounts" combined: trades from
//                               every account are aggregated together.
//   - null (no selection)    -> treated like All for reads (full
//                               backward compatibility).
// `preferredAccountId` always resolves to a concrete account (the
// selected one, or the default) so writes never lose their target.
//
// Automatic migration at runtime: on every load we call the idempotent
// ensure_default_account RPC (migration 0013) so a signed-in user who
// somehow has no default account (pre-migration signup, race at signup,
// account deleted, etc.) is healed instantly and their account-less
// trades are folded into it — mirroring what the SQL migration does for
// existing users at deploy time.

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { loadJSON, saveJSON } from '../lib/storage';
import { loadCache, saveCache } from '../lib/offlineQueue';
import { ALL_ACCOUNTS } from '../components/accounts/accounts';
import { computeAccountStats, ledgerFromRow, mergeLedgerQueue } from '../lib/accountStats';
import { fetchBalanceTrades } from '../lib/tradesApi';
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  ensureDefaultAccount,
} from '../lib/accountsApi';

const TABLE = 'accounts';
// The balance ledger is cached separately (it powers every account's equity
// stats even before Supabase is reachable).
const LEDGER_CACHE_TABLE = 'account_balance_ledger';

function selectedKey(userId) {
  return `njh_selected_account_${userId || 'anon'}`;
}

// The stored selection is valid if it's the All-Accounts sentinel or an
// account that still exists.
function isValidSelection(raw, accounts) {
  if (!raw) return false;
  if (raw === ALL_ACCOUNTS) return true;
  return accounts.some((a) => a.id === raw);
}

export function useAccountsManager(userId) {
  // Raw (un-augmented) account rows fetched from Supabase/cache.
  const [baseAccounts, setBaseAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Full trade PnL history ("ledger") for the user — the real trade data the
  // Account Balance Engine derives every account's equity stats from.
  const [ledger, setLedger] = useState([]);
  const ledgerRef = useRef([]);
  // Raw selection: a uuid, ALL_ACCOUNTS, or null.
  const [rawSelection, setRawSelection] = useState(null);

  // Mirrors the current selection so refetch/actions can read it without
  // becoming dependents of it (which would otherwise re-trigger refetch).
  const rawRef = useRef(null);

  const setRawSelectionSafe = useCallback(
    (raw) => {
      rawRef.current = raw;
      setRawSelection(raw);
      if (userId) saveJSON(selectedKey(userId), raw);
    },
    [userId]
  );

  // Reset to the user's stored selection whenever the user changes (or
  // signs out entirely).
  useEffect(() => {
    if (!userId) {
      rawRef.current = null;
      setRawSelection(null);
      return;
    }
    const stored = loadJSON(selectedKey(userId), null);
    rawRef.current = stored;
    setRawSelection(stored);
  }, [userId]);

  // Loads the user's full trade PnL ledger (baseline fetch + offline queue
  // merge) so every account's balance derives from real trade history. Falls
  // back to the cached ledger when offline. Idempotent — safe to call after
  // any trade mutation or sync completes.
  const loadLedger = useCallback(async () => {
    if (!userId) {
      ledgerRef.current = [];
      setLedger([]);
      return;
    }
    try {
      const fetched = await fetchBalanceTrades(userId);
      const merged = mergeLedgerQueue(fetched, userId);
      ledgerRef.current = merged;
      setLedger(merged);
      saveCache(LEDGER_CACHE_TABLE, userId, merged);
    } catch (err) {
      // Offline (or Supabase unreachable): use the last good ledger plus any
      // still-queued offline trade changes so balances stay live offline.
      console.error('Failed to load balance ledger, using cached data:', err.message || err);
      const cached = mergeLedgerQueue(loadCache(LEDGER_CACHE_TABLE, userId), userId);
      ledgerRef.current = cached;
      setLedger(cached);
    }
  }, [userId]);

  const refetch = useCallback(async () => {
    if (!userId) {
      rawRef.current = null;
      setBaseAccounts([]);
      ledgerRef.current = [];
      setLedger([]);
      setRawSelection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Idempotent runtime migration: guarantees a default account and
      // folds any account-less trades into it.
      const ensured = await ensureDefaultAccount(userId);
      const data = await fetchAccounts(userId);
      setBaseAccounts(data);
      saveCache(TABLE, userId, data);

      const prev = rawRef.current;
      const prevValid = isValidSelection(prev, data);
      const fallback = (ensured && data.find((a) => a.id === ensured.id)) || data.find((a) => a.isDefault) || data[0];
      const next = prevValid ? prev : fallback?.id || null;
      rawRef.current = next;
      setRawSelection(next);
      saveJSON(selectedKey(userId), next);
    } catch (err) {
      // Offline (or Supabase unreachable): fall back to the last good
      // cache so the account list stays browsable.
      console.error('Failed to load accounts from Supabase, using cached data:', err.message || err);
      const cached = loadCache(TABLE, userId);
      setBaseAccounts(cached);
      const prev = rawRef.current;
      const prevValid = isValidSelection(prev, cached);
      const next = prevValid ? prev : (cached.find((a) => a.isDefault) || cached[0])?.id || null;
      rawRef.current = next;
      setRawSelection(next);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
    loadLedger();
  }, [refetch, loadLedger]);

  const addAccount = useCallback(
    async (input) => {
      if (!userId) return null;
      try {
        const isFirst = baseAccounts.length === 0;
        const saved = await createAccount(userId, { ...input, isDefault: isFirst });
        setBaseAccounts((prev) => [saved, ...prev]);
        // Only auto-select a fresh first account; otherwise keep the
        // current view (single account or All) intact.
        if (isFirst && rawRef.current !== ALL_ACCOUNTS) setRawSelectionSafe(saved.id);
        return saved;
      } catch (err) {
        console.error('Failed to create account:', err.message || err);
        return null;
      }
    },
    [userId, baseAccounts.length, setRawSelectionSafe]
  );

  const saveAccount = useCallback(
    async (accountId, patch) => {
      if (!userId) return null;
      try {
        const saved = await updateAccount(userId, accountId, patch);
        setBaseAccounts((prev) => prev.map((a) => (a.id === accountId ? saved : a)));
        return saved;
      } catch (err) {
        console.error('Failed to update account:', err.message || err);
        return null;
      }
    },
    [userId]
  );

  const removeAccount = useCallback(
    async (accountId) => {
      if (!userId) return false;
      try {
        await deleteAccount(userId, accountId);
        setBaseAccounts((prev) => {
          const next = prev.filter((a) => a.id !== accountId);
          if (rawRef.current === accountId) {
            const fallback = next.find((a) => a.isDefault) || next[0];
            setRawSelectionSafe(fallback?.id || null);
          }
          return next;
        });
        return true;
      } catch (err) {
        // Typically the FK `on delete restrict` from trades blocking the
        // deletion — surface it so the UI can explain why.
        console.error('Failed to delete account (trades may still be attached):', err.message || err);
        return false;
      }
    },
    [userId, setRawSelectionSafe]
  );

  const makeDefault = useCallback(
    async (accountId) => {
      if (!userId) return;
      const saved = await saveAccount(accountId, { isDefault: true });
      if (saved?.isDefault) {
        setBaseAccounts((prev) => prev.map((a) => ({ ...a, isDefault: a.id === accountId })));
      }
    },
    [userId, saveAccount]
  );

  const selectAccount = useCallback(
    (id) => {
      setRawSelectionSafe(id);
    },
    [setRawSelectionSafe]
  );

  const selectAllAccounts = useCallback(() => {
    setRawSelectionSafe(ALL_ACCOUNTS);
  }, [setRawSelectionSafe]);

  // ---- Account Balance Engine: keep the ledger in sync with every
  // trade create / edit / delete (called by DataContext after each
  // mutation, online or offline). Recomputes the affected account's
  // equity stats instantly from real trade history. `previous` lets an
  // edit that changes the trade's account (or its PnL) remove the old
  // ledger entry cleanly.
  const tradeChanged = useCallback(
    (payload) => {
      if (!payload?.type || !payload?.trade) return;
      const { type, trade, previous } = payload;
      const current = ledgerRef.current;

      let next;
      if (type === 'created') {
        next = [...current, ledgerFromRow({ id: trade.id, account_id: trade.accountId, date: trade.date, entry_time: trade.entryTime, net_pnl: trade.netPnl })];
      } else if (type === 'deleted') {
        next = current.filter((l) => l.id !== trade.id);
      } else if (type === 'updated') {
        // Drop the old ledger entry (previous id, which also covers a move
        // between accounts) and insert the fresh values.
        const removedId = previous?.id || trade.id;
        const withoutOld = current.filter((l) => l.id !== removedId);
        next = [
          ...withoutOld,
          ledgerFromRow({ id: trade.id, account_id: trade.accountId, date: trade.date, entry_time: trade.entryTime, net_pnl: trade.netPnl }),
        ];
      } else {
        return;
      }

      ledgerRef.current = next;
      setLedger(next);
      if (userId) saveCache(LEDGER_CACHE_TABLE, userId, next);
    },
    [userId]
  );

  // ---- Derived selection (exposed) ----
  // Accounts are augmented with their live balance statistics computed from
  // the real trade ledger + starting balance. Consumers keep reading the
  // same account shape (currentBalance etc.) they always have.
  const accounts = useMemo(
    () =>
      baseAccounts.map((a) => ({
        ...a,
        ...computeAccountStats(ledger.filter((l) => l.accountId === a.id), a.startingBalance),
      })),
    [baseAccounts, ledger]
  );
  const allAccounts = rawSelection === ALL_ACCOUNTS;
  // Exposed selectedAccountId is the concrete account only (null while
  // viewing All Accounts) — matches the pre-Phase-3 contract so existing
  // consumers keep working unchanged.
  const selectedAccountId = !allAccounts ? rawSelection : null;
  const selectedAccount = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) || null : null;
  const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0] || null;
  // Concrete account to target for writes/forms (selected, else default).
  const preferredAccountId = selectedAccountId || defaultAccount?.id || null;
  const preferredAccount = selectedAccount || defaultAccount || null;

  const getAccountName = useCallback(
    (id) => {
      if (!id) return '';
      return accounts.find((a) => a.id === id)?.name || '';
    },
    [accounts]
  );

  return {
    accounts,
    loading,
    allAccounts,
    selectedAccountId,
    selectedAccount,
    preferredAccountId,
    preferredAccount,
    defaultAccount,
    selectAccount,
    selectAllAccounts,
    addAccount,
    saveAccount,
    removeAccount,
    makeDefault,
    getAccountName,
    refetch,
    // Account Balance Engine
    tradeChanged,
    reloadLedger: loadLedger,
  };
}