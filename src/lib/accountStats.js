import { getQueueForTable } from './offlineQueue';

// ============================================================================
// Account Balance Engine (client-side)
//
// The pure derivation core of the multi-account equity system. Every account
// exposes:
//   Starting Balance   -> the user-provided baseline (starting_balance)
//   Current Balance    -> starting balance + sum of all trade PnL
//   Net Profit         -> sum of all trade PnL
//   Net %              -> Net Profit expressed as % of Starting Balance
//   Peak Balance       -> the highest running balance ever reached
//   Drawdown           -> distance from the current balance to the peak
//
// Everything is derived from the REAL trade history (each trade's netPnl),
// never from placeholders or guesses. The functions here are pure and
// self-contained so they can be unit tested and reused by the account state
// hook (src/hooks/useAccounts.js) and, if desired, by dashboards.
// ============================================================================

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Chronological ordering that mirrors how trades are rendered everywhere else
// (date first, then intra-day entry time).
function sortByDate(trades) {
  return [...trades].sort((a, b) => {
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(a.entryTime || '').localeCompare(String(b.entryTime || ''));
  });
}

// Computes the full set of balance statistics for ONE account from the list of
// its trades plus its starting balance. Accepts ledger-shaped trade fragments
// (at minimum `netPnl`; `date`/`entryTime` are used for peak/drawdown ordering).
export function computeAccountStats(trades, startingBalance) {
  const start = Number(startingBalance) || 0;
  const sorted = sortByDate(trades || []);

  let netProfit = 0;
  let running = start;
  let peak = start;
  let maxDrawdown = 0;

  for (const t of sorted) {
    const pnl = Number(t.netPnl) || 0;
    netProfit += pnl;
    running += pnl;
    if (running > peak) peak = running;
    const peakToTrough = peak - running;
    if (peakToTrough > maxDrawdown) maxDrawdown = peakToTrough;
  }

  netProfit = round2(netProfit);
  const currentBalance = round2(start + netProfit);
  const currentDrawdown = round2(peak - currentBalance);
  const netPct = start > 0 ? round2((netProfit / start) * 100) : 0;
  const drawdownPct = peak > 0 ? round2((currentDrawdown / peak) * 100) : 0;

  return {
    startingBalance: start,
    currentBalance,
    netProfit,
    netPct,
    peakBalance: round2(peak),
    drawdown: currentDrawdown,
    drawdownPct,
    maxDrawdown: round2(maxDrawdown),
  };
}

// ---------------------------------------------------------------------------
// Ledger helpers
// ---------------------------------------------------------------------------

// Maps a raw `public.trades` row (snake_case) into the compact ledger shape the
// balance engine needs. Only the columns required for balance math are read.
export function ledgerFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id || '',
    date: row.date || '',
    entryTime: row.entry_time || '',
    netPnl: row.net_pnl ?? 0,
  };
}

// Applies any still-queued offline trade changes on top of a freshly fetched
// (or previously cached) ledger baseline, so pending offline trades factor into
// every account's balance without waiting for a sync. Uses the same offline
// queue helpers as DataContext.
export function mergeLedgerQueue(baseItems, userId) {
  let list = [...baseItems];

  for (const entry of getQueueForTable('trades', userId)) {
    if (entry.type === 'insert') {
      list.push({ ...ledgerFromRow({ ...entry.item, id: entry.tempId }) });
    } else if (entry.type === 'update') {
      const base = list.find((l) => l.id === entry.itemId) || {};
      list = list.map((l) => (l.id === entry.itemId ? { ...l, ...ledgerFromRow({ ...base, ...entry.item, id: entry.itemId }) } : l));
    } else if (entry.type === 'delete') {
      list = list.filter((l) => l.id !== entry.itemId);
    }
  }

  return list;
}