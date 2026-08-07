// Deep Performance Analytics — an ADDITIVE companion to the Analytics
// module. It wraps the existing computeAnalytics() engine (reusing its
// by-pair / by-session / by-weekday / monthly breakdowns and the full
// summary wholesale) and layers on only the two things the existing engine
// doesn't already produce: an hourly performance breakdown and an average
// trade duration. No existing module is modified.
//
// Account scoping is handled upstream by DataContext (`trades.items` is
// already restricted to the selected account / all accounts), so every
// number below is multi-account aware for free and updates live whenever
// `trades.items` changes.

import { computeAnalytics } from './analytics';

// "HH:MM" -> minutes since midnight, or null when unparsable.
function toMinutes(t) {
  if (!t || !String(t).includes(':')) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Entry-hour (0..23) for a trade, or null when it has no usable entry time.
function toHour(t) {
  const minutes = toMinutes(t?.entryTime);
  if (minutes === null) return null;
  return Math.floor(minutes / 60);
}

// Average closed-trade duration in minutes (overnight-safe). Shares the
// exact HH:MM next-day rollover convention used by the trade form's live
// preview so the number shown on the form matches what we display here.
function avgDurationMinutes(trades) {
  const durations = [];
  trades.forEach((t) => {
    const inMin = toMinutes(t.entryTime);
    const outMin = toMinutes(t.exitTime);
    if (inMin === null || outMin === null) return;
    let diff = outMin - inMin;
    if (diff < 0) diff += 24 * 60;
    durations.push(diff);
  });
  if (!durations.length) return 0;
  return durations.reduce((s, n) => s + n, 0) / durations.length;
}

// minutes -> compact "2h 15m" / "45m" label (or '—' when none).
function toHhMm(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Aggregates trades into per-entry-hour buckets (0..23). Each bucket keeps
// the trade count, win rate, and net P&L used by the hourly chart.
function groupByHour(trades) {
  const buckets = {};
  trades.forEach((t) => {
    const hour = toHour(t);
    if (hour === null) return;
    if (!buckets[hour]) buckets[hour] = { hour, trades: 0, wins: 0, netPnl: 0 };
    const b = buckets[hour];
    const pnl = Number(t.netPnl) || 0;
    b.trades += 1;
    b.netPnl += pnl;
    if (t.result === 'Win') b.wins += 1;
  });
  return Object.keys(buckets)
    .map(Number)
    .sort((x, y) => x - y)
    .map((hour) => {
      const b = buckets[hour];
      return {
        key: hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        trades: b.trades,
        netPnl: Number(b.netPnl.toFixed(2)),
        winRate: b.trades ? (b.wins / b.trades) * 100 : 0,
      };
    });
}

export function computeDeepAnalytics(trades) {
  const a = computeAnalytics(trades);
  const avgDurationMin = avgDurationMinutes(trades);
  return {
    byPair: a.byPair,
    bySession: a.bySession,
    byWeekday: a.byWeekday,
    monthlyTrend: a.monthlyPerformance,
    byHour: groupByHour(trades),
    avgDurationMin,
    avgDurationLabel: toHhMm(avgDurationMin),
    summary: a,
  };
}