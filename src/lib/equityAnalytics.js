// Equity Analytics — an ADDITIVE companion to the Analytics module. All
// values derive from the real trade rows already in DataContext (account-
// scoped upstream) plus, for the balance baseline, the real account starting
// balance(s) passed in from the accounts context. No hardcoded values, and
// no existing module is touched.

// Basic equity math for abstract[Analytics] UI: given a chronological trade
// series (date, netPnl) and a starting equity baseline, this builds the
// running equity, balance and drawdown curves, plus equity extremes, overall
// growth, a daily timeline, and per-month growth comparisons.

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sortChronological(trades) {
  return [...trades].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));
}

function monthLabel(key) {
  // key 'YYYY-MM'
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function computeEquityAnalytics(trades, startingEquity = 0) {
  const sorted = sortChronological(trades);
  const base = Number.isFinite(Number(startingEquity)) ? Number(startingEquity) : 0;

  let cumulative = 0;
  let peak = base;
  const points = [];
  const monthly = {};
  const monthsOrder = [];

  sorted.forEach((t) => {
    // Capture the month's entering equity BEFORE this trade folds in, so the
    // per-month net/growth includes every trade of the month (previously the
    // first trade of each month was excluded from startEq).
    const key = (t.date || '').slice(0, 7);
    if (key && !monthly[key]) {
      monthly[key] = { startEq: base + cumulative, endEq: base + cumulative, net: 0 };
      monthsOrder.push(key);
    }

    cumulative += N(t.netPnl);
    const equity = base + cumulative;

    if (equity > peak) peak = equity;

    points.push({
      date: t.date,
      equity: Math.round(equity * 100) / 100,
      netPnl: Math.round(cumulative * 100) / 100,
      drawdown: Math.round((peak - equity) * 100) / 100,
      drawdownPct: peak > 0 ? Math.round(((peak - equity) / peak) * 10000) / 100 : 0,
    });

    if (key) {
      monthly[key].endEq = equity;
    }
  });

  // Final stats from the constructed curve.
  const highs = points.map((p) => p.equity).concat(base);
  const lows = points.map((p) => p.equity).concat(base);
  const highestEquity = highs.length ? Math.max(...highs) : base;
  const lowestEquity = lows.length ? Math.min(...lows) : base;
  const finalEquity = points.length ? points[points.length - 1].equity : base;
  const maxDrawdown = points.length ? Math.max(0, ...points.map((p) => p.drawdown)) : 0;
  const growthPct = base > 0 ? ((finalEquity - base) / base) * 100 : null;

  // Daily timeline (one point per trading day, last equity of the day).
  const byDay = new Map();
  points.forEach((p) => {
    byDay.set(p.date, p);
  });
  const timeline = Array.from(byDay.values()).map((p) => ({
    date: p.date,
    equity: p.equity,
    netPnl: p.netPnl,
    drawdown: p.drawdown,
  }));

  // Monthly growth comparison (chronological, per-month interval growth).
  const monthlyGrowth = monthsOrder.map((key) => {
    const m = monthly[key];
    const growth = m.startEq > 0 ? ((m.endEq - m.startEq) / m.startEq) * 100 : null;
    return {
      label: monthLabel(key),
      key,
      startEq: Math.round(m.startEq * 100) / 100,
      endEq: Math.round(m.endEq * 100) / 100,
      net: Math.round((m.endEq - m.startEq) * 100) / 100,
      growthPct: growth === null ? null : (Math.round(growth * 100) / 100),
    };
  });

  return {
    total: sorted.length,
    hasData: points.length > 0,
    base,
    points,
    highestEquity,
    lowestEquity,
    finalEquity,
    maxDrawdown,
    growthPct,
    timeline,
    monthlyGrowth,
  };
}