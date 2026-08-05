// Challenge Tracker — pure derivation core.
//
// Everything about a challenge's live progress is derived from the REAL
// trade history for the challenge's linked account (or the whole journal
// when no account is linked), scoped to the challenge's start/end date
// window. No placeholders — if there are no trades yet, every metric is
// simply 0 / at its starting value.
//
// Shared by both src/pages/Challenges.jsx and the Dashboard challenge
// widget so they can never drift out of sync with each other or with the
// underlying trade data.

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

function toISODate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toISODate(d);
}

// Distinct calendar days that have at least one trade, optionally bounded
// by the challenge's date window.
export function countTradingDays(trades = [], startDate, endDate) {
  const start = toISODate(startDate);
  const end = toISODate(endDate);
  const days = new Set();
  for (const t of trades) {
    const d = toISODate(t.date);
    if (!d) continue;
    if (start && d < start) continue;
    if (end && d > end) continue;
    days.add(d);
  }
  return days.size;
}

// Whole calendar days from today until the challenge's end date.
// Returns null when no end date is set, 0 or negative once it's passed.
export function daysRemaining(endDate) {
  const end = toISODate(endDate);
  if (!end) return null;
  const ms = new Date(end) - new Date(todayISO());
  return Math.round(ms / 86400000);
}

// Computes every live metric for one challenge from real trades.
//   challenge   the app-shape challenge row
//   trades      all trades for the linked account (or the whole journal)
//   Returns a flat object of derived numbers + the auto status.
export function computeChallengeMetrics(challenge, trades = [], account = null) {
  const startingBalance = Number(challenge.startingBalance) || 0;
  const profitTarget = Number(challenge.profitTarget) || 0;
  const dailyDrawdown = Number(challenge.dailyDrawdown) || 0;
  const maximumDrawdown = Number(challenge.maximumDrawdown) || 0;
  const minTradingDays = Number(challenge.minTradingDays) || 0;

  const start = toISODate(challenge.startDate);
  const end = toISODate(challenge.endDate);

  // Real trades scoped to the challenge window.
  const challengeTrades = (trades || []).filter((t) => {
    const d = toISODate(t.date);
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const netPnl = round2(challengeTrades.reduce((sum, t) => sum + (Number(t.netPnl) || 0), 0));
  const currentBalance = round2(startingBalance + netPnl);
  const equity = currentBalance; // no open-position data in the journal, so realized balance == equity

  // Daily drawdown = worst single-day loss inside the window.
  const byDay = {};
  for (const t of challengeTrades) {
    const d = toISODate(t.date);
    if (!d) continue;
    byDay[d] = round2((byDay[d] || 0) + (Number(t.netPnl) || 0));
  }
  const dailyLosses = Object.values(byDay).filter((v) => v < 0);
  const dailyDDUsed = dailyLosses.length ? round2(Math.min(...dailyLosses) * -1) : 0;

  // Max drawdown = deepest peak-to-trough from the challenge's starting
  // balance across the (chronologically ordered) trades.
  let running = startingBalance;
  let peak = startingBalance;
  let maxDDUsed = 0;
  [...challengeTrades]
    .sort((a, b) => (toISODate(a.date) || '').localeCompare(toISODate(b.date) || ''))
    .forEach((t) => {
      running += Number(t.netPnl) || 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDDUsed) maxDDUsed = dd;
    });
  maxDDUsed = round2(maxDDUsed);

  const profitProgress = profitTarget > 0 ? Math.max(0, netPnl / profitTarget) : netPnl > 0 ? 1 : 0;
  const profitRemaining = round2(profitTarget - netPnl);
  const dailyDDProgress = dailyDrawdown > 0 ? Math.min(1, dailyDDUsed / dailyDrawdown) : 0;
  const dailyDDRemaining = round2(dailyDrawdown - dailyDDUsed);
  const maxDDProgress = maximumDrawdown > 0 ? Math.min(1, maxDDUsed / maximumDrawdown) : 0;
  const maxDDRemaining = round2(maximumDrawdown - maxDDUsed);

  const tradingDaysCompleted = countTradingDays(challengeTrades, start, end);
  const tradingDaysProgress = minTradingDays > 0 ? Math.min(1, tradingDaysCompleted / minTradingDays) : tradingDaysCompleted > 0 ? 1 : 0;
  const tradingDaysRemaining = Math.max(0, minTradingDays - tradingDaysCompleted);
  const daysLeft = daysRemaining(end);

  // ---- Auto status from real rules ----
  let status = 'active';
  if (challenge.status === 'completed' || challenge.status === 'archived') {
    status = challenge.status;
  } else if (profitProgress >= 1 && tradingDaysCompleted >= minTradingDays) {
    status = 'completed';
  } else if (maxDDProgress >= 1 || dailyDDProgress >= 1) {
    status = 'failed';
  } else if (daysLeft !== null && daysLeft < 0) {
    status = 'failed';
  } else if (profitProgress >= 0.7 && maxDDProgress < 0.5) {
    status = 'pass';
  } else if (profitProgress >= 0.4 || maxDDProgress >= 0.7) {
    status = 'warning';
  }

  return {
    startingBalance,
    currentBalance,
    equity,
    netPnl,
    profitTarget,
    profitProgress,
    profitRemaining,
    dailyDrawdown,
    dailyDDUsed,
    dailyDDProgress,
    dailyDDRemaining,
    maximumDrawdown,
    maxDDUsed,
    maxDDProgress,
    maxDDRemaining,
    minTradingDays,
    tradingDaysCompleted,
    tradingDaysRemaining,
    tradingDaysProgress,
    startDate: start,
    endDate: end,
    daysRemaining: daysLeft,
    totalTrades: challengeTrades.length,
    status,
  };
}