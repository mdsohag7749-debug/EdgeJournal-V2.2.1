// Institutional Psychology Insights — a fully statistical insight engine for
// the trader's psychology. No AI, no GPT, no external services: every claim is
// derived from the account's real trade history (account-scoped upstream in
// DataContext, so multi-account and filter-aware by construction).
//
// Each rule inspects a real statistical relationship (averages, rates,
// sessions, weekdays) and only publishes an insight when the pattern is
// present AND the supporting sample is large enough to be meaningful. No
// fabricated claims are ever emitted for empty or tiny groups.

import { formatMoneyShort, SESSION_WINDOWS } from './utils';

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 1–5 emotion score for a trade, or null when not rated for that emotion.
function emo(t, key) {
  const v = t?.psychology?.[key];
  const n = Number(v);
  return n >= 1 && n <= 5 ? n : null;
}

const MIN_SAMPLE = 3;

function mean(values) {
  const v = values.filter((x) => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

function sortChronological(trades) {
  return [...trades].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));
}

function weekdayOf(t) {
  const d = new Date((t.date || '') + 'T00:00:00');
  if (isNaN(d)) return null;
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

function sessionOf(t) {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

function mistakeOf(t) {
  const m = t?.mistakes || {};
  return Object.keys(m).filter((k) => m[k]);
}

// ---- Rule helpers ---------------------------------------------------------

// 1) Confidence vs performance: trades logged with high confidence (≥4) vs
// lower (<3). Report which state produced the better average net P&L.
function confidenceEffect(sorted) {
  const high = sorted.filter((t) => (emo(t, 'Confidence') ?? 0) >= 4);
  const low = sorted.filter((t) => emo(t, 'Confidence') != null && emo(t, 'Confidence') <= 2);
  const highPnl = mean(high.map((t) => N(t.netPnl)));
  const lowPnl = mean(low.map((t) => N(t.netPnl)));
  if (highPnl != null && lowPnl != null && high.length >= MIN_SAMPLE && low.length >= MIN_SAMPLE) {
    return {
      key: 'confidence',
      type: highPnl > lowPnl ? 'positive' : 'watch',
      title: 'Confidence & Performance',
      claim: highPnl > lowPnl ? 'You trade best when confidence is high.' : 'Your results dip when you lack confidence.',
      detail: `Avg P&L at high confidence ${formatMoneyShort(highPnl)} vs ${formatMoneyShort(lowPnl)} at low confidence.`,
      metrics: [{ label: 'High conf. P&L', value: formatMoneyShort(highPnl) }, { label: 'Low conf. P&L', value: formatMoneyShort(lowPnl) }],
      sample: high.length + low.length,
    };
  }
  return null;
}

// 2) Fear after consecutive losses: compare the average Fear rating on trades
// that follow two straight losses vs the baseline Fear of all trades.
function fearAfterLosses(sorted) {
  const baseline = mean(sorted.map((t) => emo(t, 'Fear')));
  const afterTwo = [];
  let run = 0;
  sorted.forEach((t) => {
    if (run >= 2 && emo(t, 'Fear') != null) afterTwo.push(t);
    run = t.result === 'Loss' ? run + 1 : 0;
  });
  const fearAfter = mean(afterTwo.map((t) => emo(t, 'Fear')));
  if (fearAfter != null && baseline != null && afterTwo.length >= MIN_SAMPLE) {
    return {
      key: 'fearStreak',
      type: fearAfter > baseline ? 'watch' : 'positive',
      title: 'Emotional Tilt After Losses',
      claim: 'Fear increases after consecutive losses.',
      detail: `Average Fear of ${fearAfter.toFixed(1)}/5 after two straight losses, versus ${baseline.toFixed(1)}/5 across all trades.`,
      metrics: [{ label: 'After 2 losses', value: `${fearAfter.toFixed(1)}/5` }, { label: 'Overall', value: `${baseline.toFixed(1)}/5` }],
      sample: afterTwo.length + sorted.length,
    };
  }
  return null;
}

// 3) FOMO by session: which session carries the highest share of FOMO-elevated
// trades (FOMO ≥ 4).
function fomoBySession(sorted) {
  const total = sorted.filter((t) => emo(t, 'FOMO') != null);
  if (total.length < MIN_SAMPLE) return null;
  const elevated = total.filter((t) => emo(t, 'FOMO') >= 4).length;
  if (!elevated) return null;
  const group = {};
  elevated.forEach((t) => {
    const s = sessionOf(t);
    group[s] = (group[s] || 0) + 1;
  });
  const best = Object.entries(group).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < MIN_SAMPLE) return null;
  const share = Math.round((best[1] / elevated) * 100);
  return {
    key: 'fomoSession',
    type: 'watch',
    title: 'FOMO Triggers',
    claim: `FOMO happens most during the ${best[0]} session.`,
    detail: `${best[1]} of ${elevated} FOMO-rated trades (${share}%) happened in the ${best[0]} session.`,
    metrics: [{ label: 'Session', value: best[0] }, { label: 'FOMO trades', value: best[1] }],
    sample: elevated,
  };
}

// 4) Revenge trades vs average R:R.
function revengeEffect(sorted) {
  const revenge = sorted.filter((t) => emo(t, 'Revenge') >= 4);
  const others = sorted.filter((t) => emo(t, 'Revenge') != null && emo(t, 'Revenge') <= 2);
  const revengeRR = mean(revenge.map((t) => N(t.rr)));
  const baseRR = mean(others.map((t) => N(t.rr)));
  if (revengeRR != null && baseRR != null && revenge.length >= MIN_SAMPLE && others.length >= MIN_SAMPLE) {
    return {
      key: 'revengeRr',
      type: revengeRR < baseRR - 0.35 ? 'watch' : 'info',
      title: 'Revenge & Reward',
      claim: revengeRR < baseRR - 0.35 ? 'Revenge trades reduce your average R:R.' : 'Revenge trades show no R:R penalty.',
      detail: `Trades with high revenge average ${revengeRR.toFixed(2)}R vs ${baseRR.toFixed(2)}R otherwise.`,
      metrics: [{ label: 'Revenge R:R', value: revengeRR.toFixed(2) }, { label: 'Other trades', value: baseRR.toFixed(2) }],
      sample: revenge.length + others.length,
    };
  }
  return null;
}

// 5) Patience vs profitability: which positive emotion associates with the
// highest average net P&L when elevated.
function profitabilityByPatience(sorted) {
  const pos = ['Patience', 'Focus', 'Confidence'];
  let best = null;
  pos.forEach((k) => {
    const group = sorted.filter((t) => (emo(t, k) ?? 0) >= 4);
    const pnl = mean(group.map((t) => N(t.netPnl)));
    if (pnl != null && group.length >= MIN_SAMPLE && (!best || pnl > best.pnl)) {
      best = { key: k, pnl, count: group.length };
    }
  });
  if (best) {
    const claim = best.key === 'Patience' ? 'Patience produces your highest profitability.' : `${best.key} produces your highest profitability.`;
    return {
      key: 'patienceProfit',
      type: best.pnl > 0 ? 'positive' : 'info',
      title: 'State & Profitability',
      claim,
      detail: `Avg P&L when your ${best.key} is high is ${formatMoneyShort(best.pnl)} (${best.count} trades).`,
      metrics: [{ label: 'Best mood', value: best.key }, { label: 'Avg P&L', value: formatMoneyShort(best.pnl) }],
      sample: best.count,
    };
  }
  return null;
}

// 6) Most disciplined weekday: weekday whose trades are cleanest (no mistakes),
// by mistake-free share.
function disciplinedWeekdaySorted(sorted) {
  const group = {};
  sorted.forEach((t) => {
    const wd = weekdayOf(t);
    if (!wd) return;
    if (!group[wd]) group[wd] = { total: 0, clean: 0 };
    group[wd].total += 1;
    if (mistakeOf(t).length === 0) group[wd].clean += 1;
  });
  const best = Object.entries(group)
    .map(([day, g]) => ({ day, rate: g.clean / g.total, count: g.total }))
    .filter((d) => d.count >= MIN_SAMPLE)
    .sort((a, b) => b.rate - a.rate)[0];
  if (!best) return null;
  return {
    key: 'disciplineWeekday',
    type: best.rate >= 0.75 ? 'positive' : 'info',
    title: 'Discipline Rhythm',
    claim: `Your most disciplined weekday is ${best.day}.`,
    detail: `${Math.round(best.rate * 100)}% of ${best.day} trades were mistake-free (${best.count} trades).`,
    metrics: [{ label: 'Weekday', value: best.day }, { label: 'Clean rate', value: `${Math.round(best.rate * 100)}%` }],
    sample: best.count,
  };
}

// 7) Most emotional session: the session with the highest average disruptive
// emotion presence (Fear/Greed/FOMO/Revenge/Stress).
function emotionalSession(sorted) {
  const DISRUPTIVE = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress'];
  const group = {};
  sorted.forEach((t) => {
    const s = sessionOf(t);
    const dist = mean(DISRUPTIVE.map((k) => emo(t, k)));
    if (dist == null) return;
    if (!group[s]) group[s] = { sum: 0, n: 0 };
    group[s].sum += dist;
    group[s].n += 1;
  });
  const best = Object.entries(group)
    .map(([s, g]) => ({ session: s, avg: g.sum / g.n, count: g.n }))
    .filter((d) => d.count >= MIN_SAMPLE)
    .sort((a, b) => b.avg - a.avg)[0];
  if (!best) return null;
  return {
    key: 'emotionalSession',
    type: best.avg >= 2.5 ? 'watch' : 'info',
    title: 'Emotional Sessions',
    claim: `Your most emotional trading session is ${best.session}.`,
    detail: `Average disruptive emotion score in the ${best.session} session is ${best.avg.toFixed(1)}/5 across ${best.count} trades.`,
    metrics: [{ label: 'Session', value: best.session }, { label: 'Avg emotion', value: `${best.avg.toFixed(1)}/5` }],
    sample: best.count,
  };
}

// ---- Entry point ------------------------------------------------------------

export function computePsychologyInsights(trades) {
  const sorted = sortChronological(trades || []);
  const candidates = [
    confidenceEffect(sorted),
    fearAfterLosses(sorted),
    fomoBySession(sorted),
    revengeEffect(sorted),
    profitabilityByPatience(sorted),
    disciplinedWeekdaySorted(sorted),
    emotionalSession(sorted),
  ].filter(Boolean);

  // Strengthen ordering: positive wins first, then info, then watch; within a
  // type keep the original order.
  const rank = { positive: 0, info: 1, watch: 2 };
  const insights = candidates.map((c) => ({ ...c, signal: c.type })).sort((a, b) => (rank[a.type] - rank[b.type]) || 0);

  return { insights, sourceCount: sorted.length };
}