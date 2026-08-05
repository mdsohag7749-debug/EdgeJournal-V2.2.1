// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app. Every component still reads/writes the same camelCase trade
// object it always has (date, entryTime, netPnl, riskChecklist, ...) —
// only src/context/DataContext.jsx (via these two functions) ever sees
// a raw `trades` table row.

import { supabase } from './supabase';
import { ledgerFromRow } from './accountStats';

const TEXT_FIELDS = {
  date: 'date',
  entryTime: 'entry_time',
  exitTime: 'exit_time',
  instrument: 'instrument',
  direction: 'direction',
  session: 'session',
  timeframe: 'timeframe',
  model: 'model',
  protocol: 'protocol',
  result: 'result',
  planId: 'plan_id',
  tradeGrade: 'trade_grade',
  emotion: 'emotion',
  confluences: 'confluences',
  tradeManagement: 'trade_management',
  notes: 'notes',
  lessonsLearned: 'lessons_learned',
  screenshot: 'screenshot',
};

const NUMERIC_FIELDS = {
  entryPrice: 'entry_price',
  exitPrice: 'exit_price',
  contracts: 'contracts',
  stopLoss: 'stop_loss',
  takeProfit: 'take_profit',
  riskPercent: 'risk_percent',
  rr: 'rr',
  positionSize: 'position_size',
  netPnl: 'net_pnl',
  commission: 'commission',
  rating: 'rating',
};

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Converts an app-shape trade (or partial patch) into a row ready to
// insert/update in `public.trades`. `userId` is stamped onto every
// write so it always matches the authenticated user (RLS also enforces
// this server-side — this is defense in depth, not the only guard).
// Pass `{ partial: true }` for update() calls so only the keys present
// in `trade` are included, instead of overwriting untouched columns
// with null. Pass `{ accountId }` as the currently selected account; a
// trade's own `trade.accountId` (set by the trade form, which defaults
// to the selection but can differ when editing) always wins, so a trade
// can be logged to or moved to a different account than the one viewed.
export function toTradeRow(trade, userId, { partial = false, accountId } = {}) {
  const row = {};
  if (userId) row.user_id = userId;
  const rowAccountId = trade.accountId || accountId;
  if (rowAccountId) row.account_id = rowAccountId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in trade) {
      row[dbKey] = trade[jsKey] ?? null;
    }
  }

  for (const [jsKey, dbKey] of Object.entries(NUMERIC_FIELDS)) {
    if (!partial || jsKey in trade) {
      row[dbKey] = toNumberOrNull(trade[jsKey]);
    }
  }

  if (!partial || 'riskChecklist' in trade) row.risk_checklist = trade.riskChecklist || {};
  if (!partial || 'tradeChecklist' in trade) row.trade_checklist = trade.tradeChecklist || {};
  if (!partial || 'mistakes' in trade) row.mistakes = trade.mistakes || {};

  // tags (text[]) and is_favorite (bool) — added by migration 0015.
  if (!partial || 'tags' in trade) row.tags = Array.isArray(trade.tags) ? trade.tags : [];
  if (!partial || 'isFavorite' in trade) row.is_favorite = !!trade.isFavorite;

  return row;
}

// Converts a raw `public.trades` row back into the app-shape trade
// object every page already expects.
// Fetches ONLY the columns the Account Balance Engine needs (account, date,
// entry time, and realized PnL) for the user's complete trade history. Used by
// src/hooks/useAccounts.js to compute every account's balance from real trades.
export async function fetchBalanceTrades(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('trades')
    .select('id, account_id, date, entry_time, net_pnl')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map((row) => ledgerFromRow(row));
}

export function fromTradeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    entryTime: row.entry_time || '',
    exitTime: row.exit_time || '',
    instrument: row.instrument || '',
    direction: row.direction || '',
    session: row.session || '',
    timeframe: row.timeframe || '',
    model: row.model || '',
    protocol: row.protocol || '',
    entryPrice: row.entry_price ?? '',
    exitPrice: row.exit_price ?? '',
    contracts: row.contracts ?? '',
    stopLoss: row.stop_loss ?? '',
    takeProfit: row.take_profit ?? '',
    riskPercent: row.risk_percent ?? '',
    rr: row.rr ?? '',
    positionSize: row.position_size ?? '',
    netPnl: row.net_pnl ?? '',
    commission: row.commission ?? '',
    result: row.result || 'Win',
    planId: row.plan_id || '',
    rating: row.rating ?? 5,
    riskChecklist: row.risk_checklist || {},
    tradeChecklist: row.trade_checklist || {},
    tradeGrade: row.trade_grade || '',
    emotion: row.emotion || '',
    mistakes: row.mistakes || {},
    confluences: row.confluences || '',
    tradeManagement: row.trade_management || '',
    notes: row.notes || '',
    lessonsLearned: row.lessons_learned || '',
    screenshot: row.screenshot || '',
    accountId: row.account_id || '',
    createdAt: row.created_at,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isFavorite: !!row.is_favorite,
  };
}

