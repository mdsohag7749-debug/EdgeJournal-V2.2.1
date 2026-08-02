// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app. Every component still reads/writes the same camelCase trade
// object it always has (date, entryTime, netPnl, riskChecklist, ...) —
// only src/context/DataContext.jsx (via these two functions) ever sees
// a raw `trades` table row.

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
  confluences: 'confluences',
  tradeManagement: 'trade_management',
  notes: 'notes',
  screenshot: 'screenshot',
};

const NUMERIC_FIELDS = {
  entryPrice: 'entry_price',
  exitPrice: 'exit_price',
  contracts: 'contracts',
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
// with null.
export function toTradeRow(trade, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

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

  return row;
}

// Converts a raw `public.trades` row back into the app-shape trade
// object every page already expects.
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
    netPnl: row.net_pnl ?? '',
    commission: row.commission ?? '',
    result: row.result || 'Win',
    planId: row.plan_id || '',
    rating: row.rating ?? 5,
    riskChecklist: row.risk_checklist || {},
    tradeChecklist: row.trade_checklist || {},
    confluences: row.confluences || '',
    tradeManagement: row.trade_management || '',
    notes: row.notes || '',
    screenshot: row.screenshot || '',
    createdAt: row.created_at,
  };
}
