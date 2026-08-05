// Account service layer — keeps the Supabase row shape (snake_case
// columns) out of the rest of the app, same pattern as tradesApi.js /
// goalsApi.js / profileApi.js. These functions are the ONLY place that
// talks to the `public.accounts` table (plus the two RPC helpers defined
// in migration 0013). State management lives in src/hooks/useAccounts.js
// and the global provider in src/context/AccountContext.jsx.

import { supabase } from './supabase';

const TEXT_FIELDS = {
  name: 'name',
  broker: 'broker',
  accountType: 'account_type',
  platform: 'platform',
  currency: 'currency',
  status: 'status',
};

// Converts an app-shape account (or partial patch) into a row ready to
// insert/update in `public.accounts`. `userId` is stamped onto every
// write so it always matches the authenticated user (RLS also enforces
// this server-side). Pass `{ partial: true }` for update() calls so only
// the keys present in `account` are included.
export function toAccountRow(account, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in account) {
      row[dbKey] = account[jsKey] ?? null;
    }
  }

  if (!partial || 'startingBalance' in account) row.starting_balance = toNumberOrNull(account.startingBalance);
  if (!partial || 'currentBalance' in account) row.current_balance = toNumberOrNull(account.currentBalance);
  if (!partial || 'isDefault' in account) row.is_default = !!account.isDefault;

  return row;
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Converts a raw `public.accounts` row back into the app-shape account
// object the rest of the app uses.
export function fromAccountRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || '',
    broker: row.broker || '',
    accountType: row.account_type || '',
    platform: row.platform || '',
    startingBalance: row.starting_balance ?? 0,
    currentBalance: row.current_balance ?? 0,
    currency: row.currency || 'USD',
    status: row.status || 'active',
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Fetches every account owned by the user. RLS scopes this server-side;
// we still filter by user_id client-side as defense in depth.
export async function fetchAccounts(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(fromAccountRow);
}

// Fetches a single account (owned by the user). Returns null if missing.
export async function fetchAccount(userId, accountId) {
  if (!userId || !accountId) return null;
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return fromAccountRow(data);
}

// Creates a new account for the user. Callers decide isDefault based on
// whether this is their first account; the server's partial unique index
// (one default per user) is the backstop.
export async function createAccount(userId, account) {
  if (!userId) throw new Error('createAccount requires a userId');
  const { data, error } = await supabase
    .from('accounts')
    .insert(toAccountRow(account, userId))
    .select()
    .single();

  if (error) throw error;
  return fromAccountRow(data);
}

// Updates an account with a partial patch (any subset of the editable
// fields). If the patch asks to make this the default account, it is
// routed through the atomic set_default_account RPC (which clears the
// previous default first) so the partial unique index is never violated.
export async function updateAccount(userId, accountId, patch) {
  if (!userId || !accountId) throw new Error('updateAccount requires a userId and accountId');
  const row = toAccountRow(patch, userId, { partial: true });

  if (row.is_default) {
    await setDefaultAccount(userId, accountId);
    delete row.is_default;
  }

  if (Object.keys(row).length === 0) {
    return fetchAccount(userId, accountId);
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(row)
    .eq('id', accountId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return fromAccountRow(data);
}

// Deletes an account. Trades are protected by `on delete restrict` on
// the FK (migration 0013), so an account that still owns trades can't be
// deleted and no trade is ever lost — the caller gets the FK error.
export async function deleteAccount(userId, accountId) {
  if (!userId || !accountId) throw new Error('deleteAccount requires a userId and accountId');
  const { error } = await supabase.from('accounts').delete().eq('id', accountId).eq('user_id', userId);
  if (error) throw error;
}

// Makes a user's account their default (atomically, via the RPC).
export async function setDefaultAccount(userId, accountId) {
  if (!userId || !accountId) throw new Error('setDefaultAccount requires a userId and accountId');
  const { error } = await supabase.rpc('set_default_account', {
    p_user_id: userId,
    p_account_id: accountId,
  });
  if (error) throw error;
}

// The runtime side of the "automatic migration": guarantees the user has
// exactly one default account (creating/promoting if needed) and
// back-fills any trades that still have no account into it. Idempotent —
// safe to call on every app boot / sign-in. Returns the default account.
export async function ensureDefaultAccount(userId) {
  if (!userId) return null;
  const { data: accountId, error } = await supabase.rpc('ensure_default_account', {
    p_user_id: userId,
  });
  if (error) throw error;
  if (!accountId) return null;
  return fetchAccount(userId, accountId);
}
