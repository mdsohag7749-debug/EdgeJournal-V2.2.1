// Discipline Score 2.0 — an ADDITIVE, transparent upgrade to the legacy
// equal-weight Discipline Score. It is fully derived from real account data
// and the user's System settings; it never invents a score, never pretends a
// missing data source is "perfect", and never reports a misleading 0/100.
//
// Five weighted components (weights total 100):
//   - Risk           30%  -> existing risk criteria: trade riskChecklist map,
//                            riskPercent, and the configured riskCriteria list.
//   - Plan & Checklist 25% -> pre-trade tradeChecklist adherence plus plan
//                            following (model selected from configured models).
//   - Execution      20%  -> execution completeness on each trade from the
//                            fields model / session / direction / entryTime /
//                            stopLoss / takeProfit.
//   - Mistake        15%  -> mistake-free rate, reusing Task 8.3's mistake
//                            counting (every truthy key in `t.mistakes`).
//   - Review         10%  -> closed-trade review completion (the 5 review
//                            items) and reflection activity from the
//                            Reflections collection.
//
// Data-availability-aware weighting: a component without real data is marked
// "NOT ENOUGH DATA", excluded from the total, and the total is recomputed over
// the remaining weight only. The overall result always stays 0–100, and the
// data-coverage % (weight present / 100) is exposed so a score computed on
// partial data is never hidden.
//
// Bands (conservative, applied to the overall score):
//   90–100 Excellent · 80–89 Strong · 70–79 Moderate · 60–69 Needs
//   Improvement · <60 High Improvement Priority
//
// Account scope is inherited from DataContext (trades.items is already scoped
// to the selected account); the Reflections collection is user-wide, so the
// Review component blends account-scoped closed-trade reviews with a user-wide
// reflection-activity signal. Filters (period / pair / session / setup /
// dateFrom / dateTo) operate on the same filtered dataset as the rest of the
// Analytics page, applied BEFORE any scoring, exactly like the other additive
// intelligence modules.

import { applyPeriodFilter } from './setupPerformance.js';
import { memoizeByArgs } from './memoize.js';
import { mondayKey, monthLabel, weekLabel, SESSION_WINDOWS } from './utils.js';
import { mistakesOf } from './mistakePattern.js';
import { isClosedTrade, reviewScoreForTrade } from './calculations.js';

export const UNASSIGNED_LABEL = 'Unassigned';

// The five components and their default weights (must total 100).
export const DISCIPLINE_COMPONENTS = [
  { key: 'risk', label: 'Risk Management', weight: 30 },
  { key: 'plan', label: 'Plan & Checklist', weight: 25 },
  { key: 'execution', label: 'Execution', weight: 20 },
  { key: 'mistake', label: 'Mistake Control', weight: 15 },
  { key: 'review', label: 'Review & Reflection', weight: 10 },
];

// Conservative overall-score bands.
export const BANDS = [
  { min: 90, max: 100, label: 'Excellent', color: '#16a34a', message: 'Institutional-level discipline across every logged data source.' },
  { min: 80, max: 89, label: 'Strong', color: '#3b82f6', message: 'Solid discipline. Close the small gaps in the lowest components.' },
  { min: 70, max: 79, label: 'Moderate', color: '#f59e0b', message: 'Consistent effort — tighten the weakest component to push higher.' },
  { min: 60, max: 69, label: 'Needs Improvement', color: '#f97316', message: 'Several components trail your own rules. Revisit the checklist habits below.' },
  { min: 0, max: 59, label: 'High Improvement Priority', color: '#dc2626', message: 'The fundamentals need attention — start with the lowest-scoring component.' },
];

// The execution-critical fields measured for Execution completeness.
export const EXECUTION_FIELDS = ['model', 'session', 'direction', 'entryTime', 'stopLoss', 'takeProfit'];

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// A field is "present" only when the trader actually recorded a real value —
// empty strings, null, undefined and zero are all treated as absent so an
// untouched default can never count as discipline.
function present(v) {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0;
  const s = String(v).trim();
  return s !== '' && s !== '0';
}

// Exactly mirrors analytics.js's session resolution so the Session filter can
// never disagree with the rest of the Analytics page.
function sessionOf(t) {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

function average(nums) {
  return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : 0;
}

// --- Component scorers. Each returns { score, available, engaged, note }. ---

// Risk Management (30%): average adherence to the risk checklist across trades
// that actually engaged it, plus the share of trades that defined a risk %.
function riskScore(trades, configuredRisk) {
  const rules = (configuredRisk || []).filter(Boolean);
  const engaged = trades.filter((t) => Object.keys(t.riskChecklist || {}).length > 0 || present(t.riskPercent));
  const adherence = [];
  engaged.forEach((t) => {
    const rc = t.riskChecklist || {};
    const list = rules.length ? rules : Object.keys(rc);
    if (!list.length) return;
    const followed = list.filter((r) => rc[r] === true).length;
    adherence.push((followed / list.length) * 100);
  });
  const riskDefined = trades.length ? (trades.filter((t) => present(t.riskPercent)).length / trades.length) * 100 : 0;
  const score = engaged.length ? clamp(average(adherence)) : null;
  return {
    score,
    available: engaged.length > 0,
    engaged: engaged.length,
    note: engaged.length
      ? `Measured across ${engaged.length} trade${engaged.length === 1 ? '' : 's'} that engaged the risk checklist`
      : 'No trade logged a Risk Management checklist or risk % yet',
    riskDefined,
  };
}

// Plan & Checklist (25%): average adherence to the trade checklist (the pre-
// trade plan) across trades that engaged it, blended with plan following when
// trading models are configured.
function planScore(trades, configuredModels, configuredChecklist) {
  const models = (configuredModels || []).filter(Boolean);
  const rules = (configuredChecklist || []).filter(Boolean);
  const engaged = trades.filter((t) => Object.keys(t.tradeChecklist || {}).length > 0);
  const adherence = [];
  engaged.forEach((t) => {
    const tc = t.tradeChecklist || {};
    const list = rules.length ? rules : Object.keys(tc);
    if (!list.length) return;
    const followed = list.filter((c) => tc[c] === true).length;
    adherence.push((followed / list.length) * 100);
  });
  const subScores = [];
  if (engaged.length) subScores.push(average(adherence));
  if (models.length && trades.length) {
    const planned = trades.filter((t) => t.model && models.includes(t.model)).length;
    subScores.push((planned / trades.length) * 100);
  }
  return {
    score: subScores.length ? clamp(average(subScores)) : null,
    available: subScores.length > 0,
    engaged: engaged.length,
    note: engaged.length
      ? `Measured across ${engaged.length} trade${engaged.length === 1 ? '' : 's'} with a logged trade checklist${models.length ? ', plus plan following' : ''}`
      : 'No trade logged a pre-trade checklist yet',
  };
}

// Execution (20%): average completeness of the execution-critical fields.
function executionScore(trades) {
  const rows = trades.map((t) => EXECUTION_FIELDS.filter((f) => present(t[f])).length / EXECUTION_FIELDS.length);
  return {
    score: trades.length ? clamp(average(rows) * 100) : null,
    available: trades.length > 0,
    engaged: trades.length,
    note: 'Share of execution fields (model, session, direction, entry time, SL, TP) actually recorded',
  };
}

// Mistake Control (15%): share of trades with no logged mistake — reuses the
// same truthy-mistake counting as Mistake Pattern Intelligence.
function mistakeScore(trades) {
  const free = trades.filter((t) => mistakesOf(t).length === 0).length;
  return {
    score: trades.length ? clamp((free / trades.length) * 100) : null,
    available: trades.length > 0,
    engaged: trades.length,
    note: trades.length ? `${trades.length - free} of ${trades.length} trades carried a logged mistake` : '',
  };
}

// Review & Reflection (10%): average 5-item review completion on closed trades,
// blended with user-wide reflection activity from the Reflections collection.
function reviewScore(trades, reflections) {
  const closed = trades.filter(isClosedTrade);
  const subScores = [];
  if (closed.length) subScores.push(average(closed.map(reviewScoreForTrade)));

  const refs = Array.isArray(reflections) ? reflections : [];
  const tradingDays = new Set(trades.map((t) => t.date).filter(Boolean)).size;
  if (refs.length && tradingDays > 0) {
    subScores.push(Math.min(100, (refs.length / tradingDays) * 100));
  }

  return {
    score: subScores.length ? clamp(average(subScores)) : null,
    available: subScores.length > 0,
    engaged: closed.length,
    note: closed.length
      ? `Average review completion across ${closed.length} closed trade${closed.length === 1 ? '' : 's'}`
      : 'No closed trades with review items yet',
  };
}

// Rule-based improvement areas — descriptive, never predictive.
function buildImprovements(components) {
  const items = [];
  const byKey = Object.fromEntries(components.map((c) => [c.key, c]));
  const available = components.filter((c) => c.available);
  const weakest = [...available].sort((a, b) => a.score - b.score)[0];

  const SUBS = {
    risk: 'engage the Risk Management checklist on every trade and set a risk %',
    plan: 'complete the pre-trade checklist (and pick a configured model) on every trade',
    execution: 'record the full execution set — model, session, direction, entry time, stop loss and take profit',
    mistake: 'log mistakes during trade reviews so repeat patterns become visible',
    review: 'finish the five review items on closed trades and write reflections',
  };

  available.forEach((c) => {
    if (c.score < 70) {
      items.push({ key: c.key, signal: c.score < 60 ? 'warning' : 'neutral', claim: `${c.label} is ${c.score}/100 — ${SUBS[c.key]}.` });
    }
  });
  components.forEach((c) => {
    if (!c.available) {
      items.push({ key: c.key, signal: 'neutral', claim: `No ${c.label} data yet — ${SUBS[c.key]} to unlock this component (${c.weight}% weight).` });
    }
  });
  if (!items.length && weakest) {
    items.push({ key: weakest.key, signal: 'positive', claim: `Strongest area to keep protecting: ${weakest.label} at ${weakest.score}/100.` });
  }
  return items.slice(0, 4);
}

function bandOf(score) {
  if (score === null || score === undefined) return null;
  return BANDS.find((b) => score >= b.min && score <= b.max) || BANDS[BANDS.length - 1];
}

// --- Weekly / monthly trend of the overall score. ---
// Each bucket only scores when it has trades; trends need at least two real
// data points or they report "Not enough historical data". Trend buckets are
// scored WITHOUT computing their own nested trends (no infinite recursion).
function trendSeries(trades, cfg, keyFn, labelFn) {
  const buckets = {};
  trades.forEach((t) => {
    if (!t.date) return;
    const k = keyFn(t.date);
    if (!k) return;
    if (!buckets[k]) buckets[k] = { key: k, label: labelFn(k), list: [] };
    buckets[k].list.push(t);
  });
  return Object.keys(buckets)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const row = computeDisciplineScore20(buckets[k].list, { ...cfg, includeTrend: false });
      return { label: buckets[k].label, score: row.score };
    })
    .filter((r) => r.score !== null);
}

function computeDisciplineScore20Uncached(
  trades,
  {
    models = [],
    riskCriteria = [],
    checklistCriteria = [],
    reflections = [],
    period = 'all',
    pair = 'All',
    session = 'All',
    setup = 'All',
    dateFrom,
    dateTo,
    includeTrend = true,
  } = {}
) {
  const list = Array.isArray(trades) ? trades : [];
  const periodFocus = applyPeriodFilter(list, period, dateFrom, dateTo);
  const focused = periodFocus.filter(
    (t) =>
      (pair === 'All' || !pair ? true : (t.instrument || UNASSIGNED_LABEL) === pair) &&
      (session === 'All' || !session ? true : sessionOf(t) === session) &&
      (setup === 'All' || !setup ? true : (t.model || UNASSIGNED_LABEL) === setup)
  );

  const raw = {
    risk: riskScore(focused, riskCriteria),
    plan: planScore(focused, models, checklistCriteria),
    execution: executionScore(focused),
    mistake: mistakeScore(focused),
    review: reviewScore(focused, reflections),
  };

  const components = DISCIPLINE_COMPONENTS.map((def) => {
    const r = raw[def.key];
    // `points` is the component's contribution in its own weight-unit range
    // (e.g. Risk out of 30) — score × weight ÷ 100. This is exactly the
    // "XX/30" style transparency the overall score is built from.
    return { ...def, score: r.score, points: r.score === null ? null : Math.round((r.score * def.weight) / 100), available: r.available, engaged: r.engaged, note: r.note };
  });

  const availableWeight = components.filter((c) => c.available).reduce((s, c) => s + c.weight, 0);
  const score = availableWeight
    ? Math.round(components.filter((c) => c.available).reduce((s, c) => s + (c.score * c.weight) / availableWeight, 0))
    : null;
  const availablePoints = score === null ? null : Math.round((score * availableWeight) / 100);
  const band = bandOf(score);

  // Trend buckets operate on the already-filtered set so filters stay applied.
  // Trend computation is skipped when this call is itself a trend bucket.
  const weekly = includeTrend ? trendSeries(focused, { models, riskCriteria, checklistCriteria, reflections }, mondayKey, weekLabel) : [];
  const monthly = includeTrend ? trendSeries(focused, { models, riskCriteria, checklistCriteria, reflections }, (d) => (d || '').slice(0, 7), monthLabel) : [];

  return {
    total: focused.length,
    hasData: focused.length > 0,
    score,
    availablePoints,
    denom: availableWeight,
    band,
    coveragePct: availableWeight, // weight (%) of the score covered by real data
    components,
    improvements: buildImprovements(components),
    weekly,
    monthly,
    hasTrend: weekly.length >= 2 || monthly.length >= 2,
    // Filter-scoped option lists derived from the FULL visible array so a
    // currently-visible value is always selectable — never invented.
    pairOptions: [...new Set(list.map((t) => t.instrument || UNASSIGNED_LABEL))].sort((a, b) => a.localeCompare(b)),
    sessionOptions: [...new Set(list.map(sessionOf))].sort((a, b) => a.localeCompare(b)),
    setupOptions: [...new Set(list.map((t) => t.model || UNASSIGNED_LABEL))].sort((a, b) => a.localeCompare(b)),
    period,
    minTrendPoints: 2,
  };
}

export const computeDisciplineScore20 = memoizeByArgs(computeDisciplineScore20Uncached);
