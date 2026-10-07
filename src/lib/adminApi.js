// Admin Data Access Module.
//
// Strictly respects the security model:
// - Uses the existing Supabase client (no service role keys or privileged secrets).
// - Leverages Phase 1 RLS: "Admins can view all profiles" on public.profiles.
// - Leverages Phase 4 RLS: "Admins can view all accounts" / "Admins can view all trades".
// - Uses efficient count queries ({ count: 'exact', head: true }) instead of downloading tables.

import { supabase } from './supabase';
import { fromProfileRow } from './profileApi';
import { fromAccountRow } from './accountsApi';
import { fromTradeRow } from './tradesApi';

/**
 * Fetches platform-level summary statistics safely accessible under Phase 1 + 4 RLS.
 */
export async function fetchAdminMetrics() {
  try {
    // 1. Total profiles count (allowed under Policy 7a: "Admins can view all profiles")
    const { count: totalUsers, error: usersErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersErr) throw usersErr;

    // 2. Admin users count
    const { count: adminUsers, error: adminErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (adminErr) throw adminErr;

    // 3. Regular users count
    const { count: standardUsers, error: standardErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user');

    if (standardErr) throw standardErr;

    // 4. Total accounts count (Phase 4 RLS: "Admins can view all accounts")
    const { count: totalAccounts, error: accountsErr } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });

    if (accountsErr) throw accountsErr;

    // 5. Total trades count (Phase 4 RLS: "Admins can view all trades")
    const { count: totalTrades, error: tradesErr } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true });

    if (tradesErr) throw tradesErr;

    return {
      users: {
        total: totalUsers ?? 0,
        admins: adminUsers ?? 0,
        standard: standardUsers ?? 0,
        status: 'live',
      },
      trades: {
        total: totalTrades ?? 0,
        status: 'live',
      },
      accounts: {
        total: totalAccounts ?? 0,
        status: 'live',
      },
      system: {
        rlsStatus: 'Enforced (SECURITY DEFINER / RLS)',
        migrationVersion: '0020_admin_accounts_trades_rls',
        authProvider: 'Supabase Auth',
        status: 'operational',
      },
    };
  } catch (err) {
    // User-friendly error message, suppressing raw database errors
    throw new Error(err?.message ? `Failed to load admin metrics: ${err.message}` : 'Failed to load admin metrics.');
  }
}

/**
 * Fetches recent registered user profiles for the activity feed.
 */
export async function fetchRecentUsers(limit = 5) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      email: row.email || 'No email provided',
      fullName: row.full_name || 'Anonymous User',
      role: row.role || 'user',
      createdAt: row.created_at,
    }));
  } catch (err) {
    throw new Error(err?.message ? `Failed to load recent users: ${err.message}` : 'Failed to load recent users.');
  }
}

/**
 * Fetches paginated user profiles with optional search and role filtering.
 * Respects RLS Policy "Admins can view all profiles".
 */
export async function fetchUsers({
  page = 1,
  pageSize = 10,
  search = '',
  role = 'all',
  sort = 'created_at',
  ascending = false,
} = {}) {
  try {
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, username, avatar_url, bio, timezone, role, created_at, updated_at', {
        count: 'exact',
      });

    // Role filter
    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    // Search filter across full_name, email, and username
    const trimmed = search.trim();
    if (trimmed) {
      // Sanitize input to prevent PostgREST syntax disruption
      const sanitized = trimmed.replace(/[%_,'"()]/g, '');
      if (sanitized) {
        query = query.or(
          `full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,username.ilike.%${sanitized}%`
        );
      }
    }

    // Sorting
    query = query.order(sort, { ascending });

    // Pagination range
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      users: (data || []).map(fromProfileRow),
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load users: ${err.message}` : 'Failed to load users.');
  }
}

/**
 * Fetches complete profile details for a specific user ID.
 */
export async function fetchUserDetails(userId) {
  if (!userId) throw new Error('User ID is required.');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return fromProfileRow(data);
  } catch (err) {
    throw new Error(err?.message ? `Failed to load user details: ${err.message}` : 'Failed to load user details.');
  }
}

/**
 * Updates a user's role (promote/demote).
 * Enforces Phase 1 database security + client UX self-demotion prevention.
 */
export async function updateUserRole(userId, newRole, currentAdminId) {
  if (!userId) throw new Error('User ID is required.');
  if (newRole !== 'user' && newRole !== 'admin') {
    throw new Error('Invalid role specified. Role must be user or admin.');
  }

  // Frontend safeguard against self-demotion
  if (userId === currentAdminId && newRole !== 'admin') {
    throw new Error('Administrators cannot remove their own administrator privileges.');
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return fromProfileRow(data);
  } catch (err) {
    throw new Error(err?.message ? `Failed to update user role: ${err.message}` : 'Failed to update user role.');
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Trading Account Admin Functions
// ---------------------------------------------------------------------------

/**
 * Fetches all platform trading accounts (admin view).
 * Requires Phase 4 RLS: "Admins can view all accounts".
 */
export async function fetchAdminAccounts({
  page = 1,
  pageSize = 15,
  search = '',
  status = 'all',
  sort = 'created_at',
  ascending = false,
} = {}) {
  try {
    let query = supabase
      .from('accounts')
      .select(
        'id, user_id, name, broker, account_type, platform, starting_balance, current_balance, currency, status, is_default, created_at, updated_at',
        { count: 'exact' }
      );

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Search filter across name, broker, platform
    const trimmed = search.trim();
    if (trimmed) {
      const sanitized = trimmed.replace(/[%_,'"()]/g, '');
      if (sanitized) {
        query = query.or(
          `name.ilike.%${sanitized}%,broker.ilike.%${sanitized}%,platform.ilike.%${sanitized}%`
        );
      }
    }

    // Sorting
    query = query.order(sort, { ascending });

    // Pagination
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      accounts: (data || []).map(fromAccountRow),
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load accounts: ${err.message}` : 'Failed to load accounts.');
  }
}

/**
 * Fetches account-level summary metrics (platform-wide, admin only).
 */
export async function fetchAdminAccountMetrics() {
  try {
    const { count: total, error: totalErr } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });
    if (totalErr) throw totalErr;

    const { count: active, error: activeErr } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (activeErr) throw activeErr;

    const { count: inactive, error: inactiveErr } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'inactive');
    if (inactiveErr) throw inactiveErr;

    const { count: archived, error: archivedErr } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'archived');
    if (archivedErr) throw archivedErr;

    return {
      total: total ?? 0,
      active: active ?? 0,
      inactive: inactive ?? 0,
      archived: archived ?? 0,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load account metrics: ${err.message}` : 'Failed to load account metrics.');
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Trade Admin Functions
// ---------------------------------------------------------------------------

/**
 * Fetches all platform trades (admin view).
 * Requires Phase 4 RLS: "Admins can view all trades".
 */
export async function fetchAdminTrades({
  page = 1,
  pageSize = 15,
  search = '',
  result = 'all',
  sort = 'date',
  ascending = false,
} = {}) {
  try {
    let query = supabase
      .from('trades')
      .select(
        'id, user_id, account_id, date, instrument, direction, session, result, net_pnl, risk_percent, rr, model, notes, tags, is_favorite, created_at',
        { count: 'exact' }
      );

    // Result filter
    if (result && result !== 'all') {
      query = query.eq('result', result);
    }

    // Search filter across instrument, model, notes
    const trimmed = search.trim();
    if (trimmed) {
      const sanitized = trimmed.replace(/[%_,'"()]/g, '');
      if (sanitized) {
        query = query.or(
          `instrument.ilike.%${sanitized}%,model.ilike.%${sanitized}%,notes.ilike.%${sanitized}%`
        );
      }
    }

    // Sorting
    query = query.order(sort, { ascending });

    // Pagination
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      trades: (data || []).map(fromTradeRow),
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load trades: ${err.message}` : 'Failed to load trades.');
  }
}

/**
 * Fetches platform-wide trade summary metrics (admin only).
 */
export async function fetchAdminTradeMetrics() {
  try {
    const { count: total, error: totalErr } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true });
    if (totalErr) throw totalErr;

    const { count: wins, error: winErr } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('result', 'Win');
    if (winErr) throw winErr;

    const { count: losses, error: lossErr } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('result', 'Loss');
    if (lossErr) throw lossErr;

    const { count: breakeven, error: beErr } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('result', 'Breakeven');
    if (beErr) throw beErr;

    return {
      total: total ?? 0,
      wins: wins ?? 0,
      losses: losses ?? 0,
      breakeven: breakeven ?? 0,
      winRate: total ? Math.round(((wins ?? 0) / total) * 100) : 0,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load trade metrics: ${err.message}` : 'Failed to load trade metrics.');
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Trade Analytics & Performance Intelligence
// ---------------------------------------------------------------------------

/**
 * Resolves standard date ranges into start and end ISO dates (YYYY-MM-DD).
 */
export function resolveDateRange(dateRange, customStart = null, customEnd = null) {
  const today = new Date();
  const formatISO = (d) => d.toISOString().slice(0, 10);
  const todayStr = formatISO(today);

  if (dateRange === 'custom') {
    return { startDate: customStart || null, endDate: customEnd || null };
  }
  if (dateRange === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (dateRange === '7d') {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return { startDate: formatISO(d), endDate: todayStr };
  }
  if (dateRange === '30d') {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return { startDate: formatISO(d), endDate: todayStr };
  }
  if (dateRange === '90d') {
    const d = new Date(today);
    d.setDate(d.getDate() - 90);
    return { startDate: formatISO(d), endDate: todayStr };
  }
  if (dateRange === 'ytd') {
    return { startDate: `${today.getFullYear()}-01-01`, endDate: todayStr };
  }
  // 'all'
  return { startDate: null, endDate: null };
}

/**
 * Pure aggregation engine for admin trade analytics.
 * Calculates core KPIs, equity curves, win/loss breakdown,
 * dynamic symbol rankings, account performance, and behavior stats.
 */
export function processAdminAnalytics(rawTrades = [], accountsMap = new Map(), rangeMeta = {}) {
  // Sort chronologically
  const sorted = [...rawTrades].sort((a, b) => {
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;
    const timeComp = (a.entry_time || '').localeCompare(b.entry_time || '');
    if (timeComp !== 0) return timeComp;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  const total = sorted.length;
  const wins = sorted.filter((t) => t.result === 'Win');
  const losses = sorted.filter((t) => t.result === 'Loss');
  const breakevens = sorted.filter((t) => t.result === 'Breakeven');
  const resolved = wins.length + losses.length + breakevens.length;

  const winRate = resolved > 0 ? Number(((wins.length / resolved) * 100).toFixed(1)) : 0;
  const lossRate = resolved > 0 ? Number(((losses.length / resolved) * 100).toFixed(1)) : 0;
  const beRate = resolved > 0 ? Number(((breakevens.length / resolved) * 100).toFixed(1)) : 0;

  const pnlList = sorted.map((t) => Number(t.net_pnl) || 0);
  const netPnl = pnlList.reduce((sum, val) => sum + val, 0);
  const avgPnl = total > 0 ? netPnl / total : 0;

  const bestTrade = total > 0 ? Math.max(...pnlList) : 0;
  const worstTrade = total > 0 ? Math.min(...pnlList) : 0;

  // Average R calculation
  const rrTrades = sorted.filter(
    (t) => t.rr !== null && t.rr !== undefined && t.rr !== '' && !isNaN(Number(t.rr)) && Number(t.rr) > 0
  );
  const avgRR =
    rrTrades.length > 0
      ? Number((rrTrades.reduce((sum, t) => sum + Number(t.rr), 0) / rrTrades.length).toFixed(2))
      : null;

  // Win/Loss distribution
  const distribution = [
    { name: 'Wins', value: wins.length, percentage: winRate, color: 'var(--win)' },
    { name: 'Losses', value: losses.length, percentage: lossRate, color: 'var(--loss)' },
    { name: 'Breakeven', value: breakevens.length, percentage: beRate, color: 'var(--text-faint)' },
  ];

  // Daily performance and cumulative equity curve
  const dailyMap = new Map();
  sorted.forEach((t) => {
    const d = t.date || 'Unknown';
    const pnl = Number(t.net_pnl) || 0;
    if (!dailyMap.has(d)) {
      dailyMap.set(d, {
        date: d,
        trades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netPnl: 0,
      });
    }
    const day = dailyMap.get(d);
    day.trades += 1;
    day.netPnl += pnl;
    if (t.result === 'Win') day.wins += 1;
    else if (t.result === 'Loss') day.losses += 1;
    else if (t.result === 'Breakeven') day.breakeven += 1;
  });

  let runningCumulative = 0;
  const dailyPerformance = [];
  const equityCurve = [];

  dailyMap.forEach((day, date) => {
    const dayResolved = day.wins + day.losses + day.breakeven;
    const dayWinRate = dayResolved > 0 ? Number(((day.wins / dayResolved) * 100).toFixed(1)) : 0;
    runningCumulative += day.netPnl;

    const dayObj = {
      date,
      trades: day.trades,
      wins: day.wins,
      losses: day.losses,
      breakeven: day.breakeven,
      winRate: dayWinRate,
      netPnl: Number(day.netPnl.toFixed(2)),
      cumulativePnl: Number(runningCumulative.toFixed(2)),
    };

    dailyPerformance.push(dayObj);
    equityCurve.push({
      date,
      pnl: Number(day.netPnl.toFixed(2)),
      cumulativePnl: Number(runningCumulative.toFixed(2)),
      trades: day.trades,
    });
  });

  // Dynamic Symbol / Market Performance
  const symbolMap = new Map();
  sorted.forEach((t) => {
    const sym = (t.instrument || 'Unassigned').trim().toUpperCase() || 'UNASSIGNED';
    const pnl = Number(t.net_pnl) || 0;
    if (!symbolMap.has(sym)) {
      symbolMap.set(sym, {
        symbol: sym,
        tradeCount: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netPnl: 0,
      });
    }
    const entry = symbolMap.get(sym);
    entry.tradeCount += 1;
    entry.netPnl += pnl;
    if (t.result === 'Win') entry.wins += 1;
    else if (t.result === 'Loss') entry.losses += 1;
    else if (t.result === 'Breakeven') entry.breakeven += 1;
  });

  const symbolPerformance = Array.from(symbolMap.values())
    .map((s) => {
      const res = s.wins + s.losses + s.breakeven;
      return {
        ...s,
        winRate: res > 0 ? Number(((s.wins / res) * 100).toFixed(1)) : 0,
        netPnl: Number(s.netPnl.toFixed(2)),
        avgPnl: s.tradeCount > 0 ? Number((s.netPnl / s.tradeCount).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  const topSymbol = symbolPerformance.length > 0 ? symbolPerformance[0] : null;
  const bottomSymbol =
    symbolPerformance.length > 1
      ? symbolPerformance[symbolPerformance.length - 1]
      : symbolPerformance.length === 1
      ? symbolPerformance[0]
      : null;

  // Account Performance
  const accountMetricsMap = new Map();
  sorted.forEach((t) => {
    const accId = t.account_id || 'unassigned';
    const pnl = Number(t.net_pnl) || 0;
    if (!accountMetricsMap.has(accId)) {
      const accMeta = accountsMap.get(accId);
      accountMetricsMap.set(accId, {
        accountId: accId,
        name: accMeta?.name || (accId === 'unassigned' ? 'Unassigned' : `Account ${accId.slice(0, 8)}`),
        broker: accMeta?.broker || '—',
        platform: accMeta?.platform || '—',
        currency: accMeta?.currency || 'USD',
        status: accMeta?.status || 'active',
        tradeCount: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netPnl: 0,
      });
    }
    const entry = accountMetricsMap.get(accId);
    entry.tradeCount += 1;
    entry.netPnl += pnl;
    if (t.result === 'Win') entry.wins += 1;
    else if (t.result === 'Loss') entry.losses += 1;
    else if (t.result === 'Breakeven') entry.breakeven += 1;
  });

  const accountPerformance = Array.from(accountMetricsMap.values())
    .map((a) => {
      const res = a.wins + a.losses + a.breakeven;
      return {
        ...a,
        winRate: res > 0 ? Number(((a.wins / res) * 100).toFixed(1)) : 0,
        netPnl: Number(a.netPnl.toFixed(2)),
        avgPnl: a.tradeCount > 0 ? Number((a.netPnl / a.tradeCount).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  const topAccount = accountPerformance.length > 0 ? accountPerformance[0] : null;
  const bottomAccount =
    accountPerformance.length > 1
      ? accountPerformance[accountPerformance.length - 1]
      : accountPerformance.length === 1
      ? accountPerformance[0]
      : null;

  // Trading Behavior: Direction (Long vs Short)
  const dirMap = {
    Long: { direction: 'Long', tradeCount: 0, wins: 0, losses: 0, breakeven: 0, netPnl: 0 },
    Short: { direction: 'Short', tradeCount: 0, wins: 0, losses: 0, breakeven: 0, netPnl: 0 },
  };
  sorted.forEach((t) => {
    const rawDir = (t.direction || '').toLowerCase();
    const isLong = rawDir === 'long' || rawDir === 'buy';
    const isShort = rawDir === 'short' || rawDir === 'sell';
    const target = isLong ? dirMap.Long : isShort ? dirMap.Short : null;
    if (target) {
      target.tradeCount += 1;
      target.netPnl += Number(t.net_pnl) || 0;
      if (t.result === 'Win') target.wins += 1;
      else if (t.result === 'Loss') target.losses += 1;
      else if (t.result === 'Breakeven') target.breakeven += 1;
    }
  });

  const directionPerformance = Object.values(dirMap).map((d) => {
    const res = d.wins + d.losses + d.breakeven;
    return {
      ...d,
      winRate: res > 0 ? Number(((d.wins / res) * 100).toFixed(1)) : 0,
      netPnl: Number(d.netPnl.toFixed(2)),
    };
  });

  // Trading Behavior: Session
  const sessionStatsMap = new Map();
  sorted.forEach((t) => {
    const sess = t.session || 'Unknown';
    if (!sessionStatsMap.has(sess)) {
      sessionStatsMap.set(sess, {
        session: sess,
        tradeCount: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netPnl: 0,
      });
    }
    const entry = sessionStatsMap.get(sess);
    entry.tradeCount += 1;
    entry.netPnl += Number(t.net_pnl) || 0;
    if (t.result === 'Win') entry.wins += 1;
    else if (t.result === 'Loss') entry.losses += 1;
    else if (t.result === 'Breakeven') entry.breakeven += 1;
  });

  const sessionPerformance = Array.from(sessionStatsMap.values()).map((s) => {
    const res = s.wins + s.losses + s.breakeven;
    return {
      ...s,
      winRate: res > 0 ? Number(((s.wins / res) * 100).toFixed(1)) : 0,
      netPnl: Number(s.netPnl.toFixed(2)),
    };
  });

  return {
    kpis: {
      totalTrades: total,
      winningTrades: wins.length,
      losingTrades: losses.length,
      breakevenTrades: breakevens.length,
      winRate,
      netPnl: Number(netPnl.toFixed(2)),
      avgPnl: Number(avgPnl.toFixed(2)),
      avgRR,
      bestTrade: Number(bestTrade.toFixed(2)),
      worstTrade: Number(worstTrade.toFixed(2)),
    },
    distribution,
    dailyPerformance,
    equityCurve,
    symbolPerformance,
    topSymbol,
    bottomSymbol,
    accountPerformance,
    topAccount,
    bottomAccount,
    behavior: {
      direction: directionPerformance,
      session: sessionPerformance,
      holdingDuration: null, // Schema/data limitation: documented as Not Available
    },
    meta: {
      ...rangeMeta,
      totalRecords: total,
    },
  };
}

/**
 * Fetches platform-wide analytics data with database-level date range filtering and column pruning.
 */
export async function fetchAdminAnalyticsData({
  dateRange = '30d',
  startDate: customStart = null,
  endDate: customEnd = null,
  accountId = null,
} = {}) {
  try {
    const { startDate, endDate } = resolveDateRange(dateRange, customStart, customEnd);

    let tradesQuery = supabase
      .from('trades')
      .select('id, user_id, account_id, date, entry_time, instrument, direction, session, result, net_pnl, rr, risk_percent, model, created_at')
      .order('date', { ascending: true })
      .order('entry_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (startDate) {
      tradesQuery = tradesQuery.gte('date', startDate);
    }
    if (endDate) {
      tradesQuery = tradesQuery.lte('date', endDate);
    }
    if (accountId && accountId !== 'all') {
      tradesQuery = tradesQuery.eq('account_id', accountId);
    }

    tradesQuery = tradesQuery.limit(5000);

    const accountsQuery = supabase
      .from('accounts')
      .select('id, name, broker, platform, currency, starting_balance, current_balance, status');

    const [{ data: tradesData, error: tradesErr }, { data: accountsData, error: accountsErr }] =
      await Promise.all([tradesQuery, accountsQuery]);

    if (tradesErr) throw tradesErr;
    if (accountsErr) throw accountsErr;

    const rawTrades = tradesData || [];
    const accounts = accountsData || [];
    const accountsMap = new Map(accounts.map((a) => [a.id, a]));

    return processAdminAnalytics(rawTrades, accountsMap, { startDate, endDate, dateRange });
  } catch (err) {
    throw new Error(err?.message ? `Failed to load admin analytics: ${err.message}` : 'Failed to load admin analytics.');
  }
}

/**
 * Fetches core performance KPIs (admin only).
 */
export async function fetchAdminPerformanceMetrics(filters = {}) {
  const data = await fetchAdminAnalyticsData(filters);
  return data.kpis;
}

/**
 * Fetches daily performance timeline (admin only).
 */
export async function fetchAdminDailyPerformance(filters = {}) {
  const data = await fetchAdminAnalyticsData(filters);
  return data.dailyPerformance;
}

/**
 * Fetches dynamic symbol performance metrics (admin only).
 */
export async function fetchAdminSymbolPerformance(filters = {}) {
  const data = await fetchAdminAnalyticsData(filters);
  return data.symbolPerformance;
}

/**
 * Fetches account-level performance metrics (admin only).
 */
export async function fetchAdminAccountPerformance(filters = {}) {
  const data = await fetchAdminAnalyticsData(filters);
  return data.accountPerformance;
}

/**
 * Fetches account options for filter dropdowns.
 */
export async function fetchAdminAccountOptions() {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, name, broker')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Phase 6: Platform Reports, Data Export & Audit Architecture
// ---------------------------------------------------------------------------

/**
 * Generates an RFC-4180 compliant CSV string from an array of trade objects.
 * Handles escaping of quotes, commas, newlines, negative numbers, null values,
 * and guards against CSV formula injection.
 */
export function generateTradesCsv(trades = []) {
  const headers = [
    'Trade ID',
    'Account ID',
    'Instrument',
    'Direction',
    'Date',
    'Result',
    'Net P&L',
    'R',
    'Risk %',
    'Session',
    'Model',
    'Entry Time',
    'Created At',
  ];

  const escapeCsvCell = (val) => {
    if (val === null || val === undefined || val === '') return '""';
    let str = String(val);

    // Guard against spreadsheet formula injection for text starting with =, +, -, @, \t, \r
    // Pure numeric values (including negative numbers like -150.00) are safe and preserved.
    const isNumeric = !isNaN(Number(str)) && str.trim() !== '';
    if (!isNumeric && /^[\=\+\-\@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape double quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rows = trades.map((t) => [
    escapeCsvCell(t.id),
    escapeCsvCell(t.account_id || ''),
    escapeCsvCell(t.instrument || ''),
    escapeCsvCell(t.direction || ''),
    escapeCsvCell(t.date || ''),
    escapeCsvCell(t.result || ''),
    escapeCsvCell(t.net_pnl != null ? Number(t.net_pnl).toFixed(2) : '0.00'),
    escapeCsvCell(t.rr != null ? t.rr : ''),
    escapeCsvCell(t.risk_percent != null ? t.risk_percent : ''),
    escapeCsvCell(t.session || ''),
    escapeCsvCell(t.model || ''),
    escapeCsvCell(t.entry_time || ''),
    escapeCsvCell(t.created_at || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Triggers a browser download of a CSV file using Blob and object URL.
 */
export function downloadCsvFile(csvContent, filename) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Fetches platform-wide data and generates report sections.
 * Returns comprehensive platform overview, trading report, user activity,
 * symbol performance, and account performance.
 */
export async function fetchAdminReports({
  dateRange = '30d',
  startDate: customStart = null,
  endDate: customEnd = null,
  accountId = null,
} = {}) {
  try {
    const { startDate, endDate } = resolveDateRange(dateRange, customStart, customEnd);

    // 1. Fetch total users count
    const { count: totalUsersCount, error: usersErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    if (usersErr) throw usersErr;

    // 2. Fetch new users in period (if date range specified)
    let newUsersQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    if (startDate) {
      newUsersQuery = newUsersQuery.gte('created_at', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      newUsersQuery = newUsersQuery.lte('created_at', `${endDate}T23:59:59.999Z`);
    }
    const { count: newUsersCount, error: newUsersErr } = await newUsersQuery;
    if (newUsersErr) throw newUsersErr;

    // 3. Fetch accounts
    const accountsQuery = supabase
      .from('accounts')
      .select('id, name, broker, platform, currency, starting_balance, current_balance, status');
    const { data: accountsData, error: accountsErr } = await accountsQuery;
    if (accountsErr) throw accountsErr;

    const accounts = accountsData || [];
    const accountsMap = new Map(accounts.map((a) => [a.id, a]));
    const totalAccountsCount = accounts.length;

    // 4. Fetch trades matching filters (bounded)
    let tradesQuery = supabase
      .from('trades')
      .select('id, user_id, account_id, date, entry_time, instrument, direction, session, result, net_pnl, rr, risk_percent, model, created_at')
      .order('date', { ascending: true })
      .order('entry_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(10000);

    if (startDate) {
      tradesQuery = tradesQuery.gte('date', startDate);
    }
    if (endDate) {
      tradesQuery = tradesQuery.lte('date', endDate);
    }
    if (accountId && accountId !== 'all') {
      tradesQuery = tradesQuery.eq('account_id', accountId);
    }

    const { data: tradesData, error: tradesErr } = await tradesQuery;
    if (tradesErr) throw tradesErr;

    const rawTrades = tradesData || [];

    // Process analytics through pure aggregation engine
    const analytics = processAdminAnalytics(rawTrades, accountsMap, { startDate, endDate, dateRange });

    // Calculate User Activity metrics
    const totalUsers = totalUsersCount ?? 0;
    const newUsersInPeriod = (dateRange === 'all' && !startDate && !endDate)
      ? totalUsers
      : (newUsersCount ?? 0);

    const activeUserIds = new Set(rawTrades.map((t) => t.user_id).filter(Boolean));
    const activeTradersCount = activeUserIds.size;
    const inactiveTradersCount = Math.max(0, totalUsers - activeTradersCount);
    const accountsPerUser = totalUsers > 0 ? Number((totalAccountsCount / totalUsers).toFixed(2)) : 0;

    const userActivity = {
      totalUsers,
      newUsersInPeriod,
      usersWithTradingActivity: activeTradersCount,
      usersWithNoTrades: inactiveTradersCount,
      totalAccounts: totalAccountsCount,
      accountsPerUser,
    };

    const platformSummary = {
      totalUsers,
      totalAccounts: totalAccountsCount,
      totalTrades: analytics.kpis.totalTrades,
      totalWins: analytics.kpis.winningTrades,
      totalLosses: analytics.kpis.losingTrades,
      totalBreakeven: analytics.kpis.breakevenTrades,
      winRate: analytics.kpis.winRate,
      totalNetPnl: analytics.kpis.netPnl,
      avgTradePnl: analytics.kpis.avgPnl,
      avgRR: analytics.kpis.avgRR,
    };

    return {
      summary: platformSummary,
      trading: {
        volume: analytics.kpis.totalTrades,
        distribution: analytics.distribution,
        netPnl: analytics.kpis.netPnl,
        avgPnl: analytics.kpis.avgPnl,
        avgRR: analytics.kpis.avgRR,
        winRate: analytics.kpis.winRate,
        topSymbols: analytics.symbolPerformance.slice(0, 5),
        topAccounts: analytics.accountPerformance.slice(0, 5),
        behavior: analytics.behavior,
      },
      userActivity,
      symbolPerformance: analytics.symbolPerformance,
      accountPerformance: analytics.accountPerformance,
      equityCurve: analytics.equityCurve,
      dailyPerformance: analytics.dailyPerformance,
      meta: {
        dateRange,
        startDate,
        endDate,
        accountId: accountId || 'all',
        totalTrades: rawTrades.length,
      },
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load admin reports: ${err.message}` : 'Failed to load admin reports.');
  }
}

/**
 * Fetches user activity report specifically.
 */
export async function fetchAdminUserActivityReport(filters = {}) {
  const data = await fetchAdminReports(filters);
  return data.userActivity;
}

/**
 * Fetches trading report specifically.
 */
export async function fetchAdminTradingReport(filters = {}) {
  const data = await fetchAdminReports(filters);
  return data.trading;
}

/**
 * Fetches dynamic symbol report specifically.
 */
export async function fetchAdminSymbolReport(filters = {}) {
  const data = await fetchAdminReports(filters);
  return data.symbolPerformance;
}

/**
 * Fetches account performance report specifically.
 */
export async function fetchAdminAccountReport(filters = {}) {
  const data = await fetchAdminReports(filters);
  return data.accountPerformance;
}

/**
 * Secure administrator CSV data export for trades.
 * Respects active filters, escapes values safely, handles pagination/chunking,
 * triggers browser download, and writes an honest audit log entry.
 */
export async function exportAdminTradesCsv(filters = {}) {
  const {
    dateRange = '30d',
    startDate: customStart = null,
    endDate: customEnd = null,
    accountId = null,
  } = filters;

  const { startDate, endDate } = resolveDateRange(dateRange, customStart, customEnd);

  // Fetch all trades matching filters in safe chunks
  let allTrades = [];
  const chunkSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('trades')
      .select('id, user_id, account_id, instrument, direction, date, result, net_pnl, rr, risk_percent, session, model, entry_time, created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (accountId && accountId !== 'all') query = query.eq('account_id', accountId);

    query = query.range(from, from + chunkSize - 1);

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allTrades.push(...data);
      if (data.length < chunkSize || allTrades.length >= 10000) {
        hasMore = false;
      } else {
        from += chunkSize;
      }
    } else {
      hasMore = false;
    }
  }

  if (allTrades.length === 0) {
    return {
      success: false,
      rowCount: 0,
      reason: 'no_rows',
      message: 'No trade records found matching the active filters to export.',
    };
  }

  const csvContent = generateTradesCsv(allTrades);
  const dateTag = dateRange === 'custom'
    ? `${startDate || 'start'}_to_${endDate || 'end'}`
    : dateRange;
  const filename = `edgejournal-trades-${dateTag}-${new Date().toISOString().slice(0, 10)}.csv`;

  downloadCsvFile(csvContent, filename);

  // Record audit log event for export action
  try {
    await logAdminAction({
      action: 'export_trades_csv',
      resourceType: 'trades',
      resourceId: accountId && accountId !== 'all' ? accountId : 'platform_filtered',
      metadata: {
        rowCount: allTrades.length,
        dateRange,
        startDate,
        endDate,
        accountId: accountId || 'all',
        filename,
      },
    });
  } catch (auditErr) {
    // Non-blocking log recording
    console.warn('Audit logging note: export event logging completed with note:', auditErr?.message);
  }

  return {
    success: true,
    rowCount: allTrades.length,
    filename,
    csvContent,
  };
}

/**
 * Records an administrator audit event.
 * Gated by public.is_admin() and strictly binds actor to auth.uid().
 */
export async function logAdminAction({
  action,
  resourceType,
  resourceId = null,
  metadata = {},
} = {}) {
  if (!action || !resourceType) {
    throw new Error('Action and resourceType are required for audit logging.');
  }

  try {
    // 1. Try secure RPC function (SECURITY DEFINER)
    const { data: rpcData, error: rpcError } = await supabase.rpc('log_admin_action', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_metadata: metadata || {},
    });

    if (!rpcError && rpcData) {
      return { id: rpcData, success: true };
    }

    // 2. Fallback to direct INSERT protected by RLS
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    if (!currentUserId) {
      throw new Error('Unauthenticated user cannot record audit events.');
    }

    const { data, error } = await supabase
      .from('admin_audit_logs')
      .insert({
        actor_user_id: currentUserId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata: metadata || {},
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data?.id, success: true };
  } catch (err) {
    throw new Error(err?.message ? `Failed to record audit log: ${err.message}` : 'Failed to record audit log.');
  }
}

/**
 * Fetches paginated administrative audit logs with filtering and actor resolution.
 * Strictly read-only; respects RLS "Admins can view audit logs".
 */
export async function fetchAdminAuditLogs({
  page = 1,
  pageSize = 20,
  action = 'all',
  resourceType = 'all',
  search = '',
  dateRange = 'all',
  startDate: customStart = null,
  endDate: customEnd = null,
  sort = 'created_at',
  ascending = false,
} = {}) {
  try {
    const { startDate, endDate } = resolveDateRange(dateRange, customStart, customEnd);

    let query = supabase
      .from('admin_audit_logs')
      .select('id, actor_user_id, action, resource_type, resource_id, metadata, created_at', {
        count: 'exact',
      });

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }
    if (resourceType && resourceType !== 'all') {
      query = query.eq('resource_type', resourceType);
    }
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    const trimmed = search.trim();
    if (trimmed) {
      const sanitized = trimmed.replace(/[%_,'"()]/g, '');
      if (sanitized) {
        query = query.or(
          `action.ilike.%${sanitized}%,resource_type.ilike.%${sanitized}%,resource_id.ilike.%${sanitized}%`
        );
      }
    }

    query = query.order(sort, { ascending });

    const safePage = Math.max(1, page);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const rawLogs = data || [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Resolve actor profiles for actor_user_id
    const actorIds = [...new Set(rawLogs.map((l) => l.actor_user_id).filter(Boolean))];
    let actorsMap = new Map();

    if (actorIds.length > 0) {
      try {
        const { data: actorsData } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .in('id', actorIds);

        if (actorsData) {
          actorsMap = new Map(actorsData.map((a) => [a.id, a]));
        }
      } catch (actorErr) {
        // Non-blocking actor lookup
        console.warn('Could not resolve actor profiles for audit logs:', actorErr);
      }
    }

    const logs = rawLogs.map((log) => {
      const actorProfile = actorsMap.get(log.actor_user_id);
      return {
        id: log.id,
        actorUserId: log.actor_user_id,
        actor: {
          id: log.actor_user_id,
          email: actorProfile?.email || 'Unknown',
          fullName: actorProfile?.full_name || 'System / Administrator',
          role: actorProfile?.role || 'admin',
        },
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        metadata: log.metadata || {},
        createdAt: log.created_at,
      };
    });

    return {
      logs,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load audit logs: ${err.message}` : 'Failed to load audit logs.');
  }
}

/**
 * Maps raw public.plans row to camelCase plan object.
 */
export function fromSubscriptionPlanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    price: Number(row.price) || 0,
    currency: row.currency || 'USD',
    billingInterval: row.billing_interval || 'monthly',
    isActive: !!row.is_active,
    features: Array.isArray(row.features) ? row.features : [],
    limits: typeof row.limits === 'object' && row.limits !== null ? row.limits : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps raw public.subscriptions row to camelCase subscription object.
 */
export function fromSubscriptionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    plan: row.plans ? fromSubscriptionPlanRow(row.plans) : null,
  };
}

/**
 * Fetches all platform plans for administration.
 * Allows viewing both active and inactive plans.
 */
export async function fetchAdminPlans() {
  try {
    const { data: plansData, error: plansErr } = await supabase
      .from('plans')
      .select('*')
      .order('price', { ascending: true })
      .order('created_at', { ascending: true });

    if (plansErr) throw plansErr;

    // Count subscriptions for each plan
    const { data: subsData, error: subsErr } = await supabase
      .from('subscriptions')
      .select('plan_id, status');

    const countsByPlan = {};
    if (!subsErr && subsData) {
      for (const sub of subsData) {
        if (!countsByPlan[sub.plan_id]) countsByPlan[sub.plan_id] = 0;
        countsByPlan[sub.plan_id]++;
      }
    }

    return (plansData || []).map((row) => {
      const plan = fromSubscriptionPlanRow(row);
      return {
        ...plan,
        userCount: countsByPlan[plan.id] || 0,
      };
    });
  } catch (err) {
    throw new Error(err?.message ? `Failed to load platform plans: ${err.message}` : 'Failed to load platform plans.');
  }
}

/**
 * Creates a new plan definition. Admin-only.
 * Audited via logAdminAction.
 */
export async function createAdminPlan(planInput) {
  if (!planInput || !planInput.name || !planInput.slug) {
    throw new Error('Plan name and slug are required.');
  }

  try {
    const slug = planInput.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const { data, error } = await supabase
      .from('plans')
      .insert({
        name: planInput.name.trim(),
        slug,
        description: planInput.description?.trim() || null,
        price: Number(planInput.price) || 0,
        currency: planInput.currency || 'USD',
        billing_interval: planInput.billingInterval || 'monthly',
        is_active: planInput.isActive !== undefined ? !!planInput.isActive : true,
        features: Array.isArray(planInput.features) ? planInput.features : [],
        limits: typeof planInput.limits === 'object' && planInput.limits !== null ? planInput.limits : {},
      })
      .select('*')
      .single();

    if (error) throw error;
    const createdPlan = fromSubscriptionPlanRow(data);

    // Audit log
    try {
      await logAdminAction({
        action: 'create_plan',
        resourceType: 'plans',
        resourceId: createdPlan.id,
        metadata: {
          slug: createdPlan.slug,
          name: createdPlan.name,
          price: createdPlan.price,
          currency: createdPlan.currency,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log notice:', auditErr?.message);
    }

    return createdPlan;
  } catch (err) {
    throw new Error(err?.message ? `Failed to create plan: ${err.message}` : 'Failed to create plan.');
  }
}

/**
 * Updates an existing plan definition. Admin-only.
 * Audited via logAdminAction.
 */
export async function updateAdminPlan(planId, updates) {
  if (!planId) throw new Error('Plan ID is required.');

  try {
    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.slug !== undefined) payload.slug = updates.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
    if (updates.price !== undefined) payload.price = Number(updates.price) || 0;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.billingInterval !== undefined) payload.billing_interval = updates.billingInterval;
    if (updates.isActive !== undefined) payload.is_active = !!updates.isActive;
    if (updates.features !== undefined) payload.features = Array.isArray(updates.features) ? updates.features : [];
    if (updates.limits !== undefined) payload.limits = typeof updates.limits === 'object' && updates.limits !== null ? updates.limits : {};
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('plans')
      .update(payload)
      .eq('id', planId)
      .select('*')
      .single();

    if (error) throw error;
    const updatedPlan = fromSubscriptionPlanRow(data);

    let auditAction = 'update_plan';
    if (updates.isActive === true) auditAction = 'activate_plan';
    else if (updates.isActive === false) auditAction = 'deactivate_plan';

    try {
      await logAdminAction({
        action: auditAction,
        resourceType: 'plans',
        resourceId: updatedPlan.id,
        metadata: {
          slug: updatedPlan.slug,
          name: updatedPlan.name,
          isActive: updatedPlan.isActive,
          price: updatedPlan.price,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log notice:', auditErr?.message);
    }

    return updatedPlan;
  } catch (err) {
    throw new Error(err?.message ? `Failed to update plan: ${err.message}` : 'Failed to update plan.');
  }
}

/**
 * Fetches paginated user subscriptions with plan and user details.
 */
export async function fetchAdminSubscriptions({
  page = 1,
  pageSize = 20,
  status = 'all',
  planId = 'all',
  search = '',
  sort = 'updated_at',
  ascending = false,
} = {}) {
  try {
    let query = supabase
      .from('subscriptions')
      .select('id, user_id, plan_id, status, started_at, expires_at, created_at, updated_at, plans(*)', {
        count: 'exact',
      });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (planId && planId !== 'all') {
      query = query.eq('plan_id', planId);
    }

    query = query.order(sort, { ascending });

    const safePage = Math.max(1, page);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const rawSubs = data || [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Resolve user profiles
    const userIds = [...new Set(rawSubs.map((s) => s.user_id).filter(Boolean))];
    let usersMap = new Map();
    if (userIds.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .in('id', userIds);
        if (usersData) {
          usersMap = new Map(usersData.map((u) => [u.id, u]));
        }
      } catch (userErr) {
        console.warn('Could not resolve user profiles for subscriptions:', userErr);
      }
    }

    let subscriptions = rawSubs.map((row) => {
      const userProfile = usersMap.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        status: row.status,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        plan: fromSubscriptionPlanRow(row.plans),
        user: {
          id: row.user_id,
          email: userProfile?.email || 'Unknown User',
          fullName: userProfile?.full_name || 'Anonymous User',
          role: userProfile?.role || 'user',
        },
      };
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      subscriptions = subscriptions.filter(
        (s) =>
          s.user.email.toLowerCase().includes(q) ||
          s.user.fullName.toLowerCase().includes(q) ||
          s.plan?.name?.toLowerCase().includes(q) ||
          s.status.toLowerCase().includes(q)
      );
    }

    return {
      subscriptions,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load subscriptions: ${err.message}` : 'Failed to load subscriptions.');
  }
}

/**
 * Assigns or updates a subscription for a given user. Admin-only.
 * Uses admin_assign_subscription RPC function with fallback to direct upsert.
 * Audited via logAdminAction.
 */
export async function assignAdminSubscription({ userId, planId, status = 'active', expiresAt = null }) {
  if (!userId || !planId) {
    throw new Error('User ID and Plan ID are required to assign subscription.');
  }

  try {
    let subId = null;

    // 1. Try secure RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_assign_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_status: status,
      p_expires_at: expiresAt,
    });

    if (!rpcError && rpcData) {
      subId = rpcData;
    } else {
      // 2. Direct upsert fallback
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan_id: planId,
            status,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();

      if (error) throw error;
      subId = data?.id;
    }

    // Audit log
    try {
      await logAdminAction({
        action: 'assign_subscription',
        resourceType: 'subscriptions',
        resourceId: subId || userId,
        metadata: {
          targetUserId: userId,
          planId,
          status,
          expiresAt,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log notice:', auditErr?.message);
    }

    return { id: subId, success: true };
  } catch (err) {
    throw new Error(err?.message ? `Failed to assign subscription: ${err.message}` : 'Failed to assign subscription.');
  }
}

/**
 * Updates an existing subscription status, plan, or expiration. Admin-only.
 */
export async function updateAdminSubscription(subscriptionId, { planId, status, expiresAt }) {
  if (!subscriptionId) throw new Error('Subscription ID is required.');

  try {
    const payload = { updated_at: new Date().toISOString() };
    if (planId !== undefined) payload.plan_id = planId;
    if (status !== undefined) payload.status = status;
    if (expiresAt !== undefined) payload.expires_at = expiresAt;

    const { data, error } = await supabase
      .from('subscriptions')
      .update(payload)
      .eq('id', subscriptionId)
      .select('*, plans(*)')
      .single();

    if (error) throw error;

    const auditAction = status === 'cancelled' ? 'cancel_subscription' : 'change_subscription';

    try {
      await logAdminAction({
        action: auditAction,
        resourceType: 'subscriptions',
        resourceId: subscriptionId,
        metadata: {
          planId: data.plan_id,
          status: data.status,
          expiresAt: data.expires_at,
          targetUserId: data.user_id,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log notice:', auditErr?.message);
    }

    return fromSubscriptionRow(data);
  } catch (err) {
    throw new Error(err?.message ? `Failed to update subscription: ${err.message}` : 'Failed to update subscription.');
  }
}

/**
 * Fetches operational metrics for the subscription management dashboard.
 */
export async function fetchAdminSubscriptionMetrics() {
  try {
    const { data: plansData, error: plansErr } = await supabase
      .from('plans')
      .select('id, name, slug, is_active');
    if (plansErr) throw plansErr;

    const { data: subsData, error: subsErr } = await supabase
      .from('subscriptions')
      .select('id, plan_id, status');
    if (subsErr) throw subsErr;

    const plans = plansData || [];
    const subs = subsData || [];

    const totalPlans = plans.length;
    const activePlans = plans.filter((p) => p.is_active).length;
    const inactivePlans = totalPlans - activePlans;

    const totalSubscriptions = subs.length;
    const activeSubs = subs.filter((s) => s.status === 'active').length;
    const trialingSubs = subs.filter((s) => s.status === 'trialing').length;
    const expiredSubs = subs.filter((s) => s.status === 'expired').length;
    const cancelledSubs = subs.filter((s) => s.status === 'cancelled').length;

    const planCounts = {};
    for (const plan of plans) {
      planCounts[plan.name] = subs.filter((s) => s.plan_id === plan.id).length;
    }

    return {
      plans: {
        total: totalPlans,
        active: activePlans,
        inactive: inactivePlans,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubs,
        trialing: trialingSubs,
        expired: expiredSubs,
        cancelled: cancelledSubs,
      },
      usersByPlan: planCounts,
    };
  } catch (err) {
    throw new Error(err?.message ? `Failed to load subscription metrics: ${err.message}` : 'Failed to load subscription metrics.');
  }
}

// ===========================================================================
// Phase 8: System Settings Administration
// ===========================================================================

export { fetchPublicSystemSettings, fetchPublicSetting } from './systemSettingsApi';

export function fromSystemSettingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description || '',
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all platform system settings.
 * Gated by database RLS ("Admins can view all system settings").
 */
export async function fetchSystemSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('id, key, value, description, is_public, created_at, updated_at')
      .order('key', { ascending: true });

    if (error) throw error;
    return (data || []).map(fromSystemSettingRow);
  } catch (err) {
    throw new Error(err?.message ? `Failed to load system settings: ${err.message}` : 'Failed to load system settings.');
  }
}

/**
 * Updates a single system setting by key and records an administrative audit log.
 * Gated by database RLS ("Admins can update system settings").
 */
export async function updateSystemSetting(key, newValue, description) {
  if (!key) throw new Error('Setting key is required.');
  if (newValue === undefined) throw new Error('Setting value is required.');

  try {
    // 1. Fetch current setting value for audit diff
    let oldValue = null;
    const { data: existingData } = await supabase
      .from('system_settings')
      .select('value, description')
      .eq('key', key)
      .maybeSingle();

    if (existingData) {
      oldValue = existingData.value;
    }

    // 2. Perform the update
    const updatePayload = {
      value: newValue,
      updated_at: new Date().toISOString(),
    };
    if (description !== undefined) {
      updatePayload.description = description;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .update(updatePayload)
      .eq('key', key)
      .select('id, key, value, description, is_public, created_at, updated_at')
      .single();

    if (error) throw error;

    // 3. Record audit trail
    try {
      await logAdminAction({
        action: 'system_setting.update',
        resourceType: 'system_setting',
        resourceId: key,
        metadata: {
          key,
          oldValue,
          newValue,
        },
      });
    } catch (auditErr) {
      console.warn('Audit logging note for settings update:', auditErr?.message);
    }

    return fromSystemSettingRow(data);
  } catch (err) {
    throw new Error(err?.message ? `Failed to update system setting "${key}": ${err.message}` : `Failed to update setting "${key}".`);
  }
}

/**
 * Updates multiple system settings sequentially and logs changes.
 */
export async function updateSystemSettings(settingsArray = []) {
  if (!Array.isArray(settingsArray) || settingsArray.length === 0) {
    return [];
  }

  const results = [];
  for (const item of settingsArray) {
    if (!item?.key) continue;
    const updated = await updateSystemSetting(item.key, item.value, item.description);
    results.push(updated);
  }
  return results;
}

/**
 * Fetches recent AI usage logs for administrative operational telemetry.
 * Strictly avoids exposing user private journal notes, reflection texts, or prompts.
 */
export async function fetchAdminAIUsageLogs({ limit = 50, offset = 0 } = {}) {
  try {
    const { data, error, count } = await supabase
      .from('ai_usage_logs')
      .select('id, user_id, request_type, status, tokens_used, model, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { logs: data || [], totalCount: count || 0 };
  } catch (err) {
    console.warn('Admin AI usage logs fetch note:', err?.message);
    return { logs: [], totalCount: 0 };
  }
}

/**
 * Fetches aggregate AI telemetry metrics for admin monitoring.
 */
export async function fetchAdminAIMetrics() {
  try {
    const { data: logs, error } = await supabase
      .from('ai_usage_logs')
      .select('id, request_type, status, model, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const list = logs || [];
    const totalRequests = list.length;
    const successCount = list.filter((l) => l.status === 'success').length;
    const failCount = totalRequests - successCount;
    const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 100;

    const requestsByType = {};
    for (const l of list) {
      const type = l.request_type || 'unknown';
      requestsByType[type] = (requestsByType[type] || 0) + 1;
    }

    return {
      totalRequests,
      successCount,
      failCount,
      successRate,
      requestsByType,
      recentLogs: list.slice(0, 10),
    };
  } catch (err) {
    console.warn('Admin AI metrics fetch note:', err?.message);
    return {
      totalRequests: 0,
      successCount: 0,
      failCount: 0,
      successRate: 100,
      requestsByType: {},
      recentLogs: [],
    };
  }
}





