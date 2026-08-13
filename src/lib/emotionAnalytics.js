// Emotion Analytics — an ADDITIVE companion to the Analytics module. Fully
// derived from the `psychology` object stored on every trade (the Trading
// Psychology 1–5 emotion scores captured in the trade form). Real trade data
// only, account-scoped upstream in DataContext — so it is multi-account and
// filter-aware by construction, just like every other analytics module.
//
// Metrics computed from stored trade fields:
//   - psychology.Confidence/Patience/Focus/Fear/Greed/FOMO/Revenge/Stress
//     (1–5) -> per-emotion averages, most common emotion, confidence mean,
//              fear / greed frequency, distribution, and monthly trend.

import { monthLabel } from './utils.js';

const PSYCH_KEYS = [
  'Confidence',
  'Patience',
  'Focus',
  'Fear',
  'Greed',
  'FOMO',
  'Revenge',
  'Stress',
];

// Positive emotions are the ones you want HIGH; disruptive ones (fear, greed,
// FOMO, revenge, stress) are the ones you want LOW. Used only for coloring.
const POSITIVE = ['Confidence', 'Patience', 'Focus'];

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

// A trade "counts" for emotion analytics once it carries a psychology object
// with at least one usable 1–5 rating. Trades logged before this feature
// (or without ratings) are ignored rather than skewing the averages.
function ratedTrades(trades) {
  return (trades || []).filter((t) => {
    const p = t.psychology;
    if (!p || typeof p !== 'object') return false;
    return PSYCH_KEYS.some((k) => toNum(p[k]) !== null);
  });
}

function avg(values) {
  const nums = values.filter((v) => toNum(v) !== null).map(toNum);
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function avgByKey(trades, key) {
  return avg(trades.map((t) => t.psychology?.[key]));
}

// Frequency (%) of a disruptive emotion being "present" — rated 4 or 5.
function frequency(trades, key) {
  const rated = trades.filter((t) => toNum(t.psychology?.[key]) !== null);
  if (!rated.length) return null;
  const present = rated.filter((t) => toNum(t.psychology?.[key]) >= 4).length;
  return (present / rated.length) * 100;
}

export function computeEmotionAnalytics(trades) {
  const rated = ratedTrades(trades);
  const total = rated.length;

  // Per-emotion averages -> distribution + most common emotion.
  const perEmotion = PSYCH_KEYS.map((key) => ({
    key,
    avg: avgByKey(rated, key),
    tone: POSITIVE.includes(key) ? 'pos' : 'neg',
  }));

  const available = perEmotion.filter((e) => e.avg !== null);
  const mostCommonEmotion = available.length
    ? available.reduce((best, e) => (e.avg > best.avg ? e : best))
    : null;

  // Monthly trend — chronological average of each emotion per calendar month.
  const monthMap = {};
  rated.forEach((t) => {
    if (!t.date) return;
    const key = t.date.slice(0, 7);
    if (!monthMap[key]) {
      monthMap[key] = { key, label: monthLabel(key), samples: {} };
    }
    PSYCH_KEYS.forEach((k) => {
      const v = toNum(t.psychology?.[k]);
      if (v === null) return;
      if (!monthMap[key].samples[k]) monthMap[key].samples[k] = [];
      monthMap[key].samples[k].push(v);
    });
  });
  const monthlyTrend = Object.values(monthMap)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => {
      const row = { key: m.key, label: m.label };
      PSYCH_KEYS.forEach((k) => {
        const vals = m.samples[k] || [];
        row[k] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      });
      return row;
    });

  return {
    total,
    perEmotion,
    distribution: available,
    mostCommonEmotion,
    avgConfidence: avgByKey(rated, 'Confidence'),
    avgFocus: avgByKey(rated, 'Focus'),
    avgPatience: avgByKey(rated, 'Patience'),
    fearFreq: frequency(rated, 'Fear'),
    greedFreq: frequency(rated, 'Greed'),
    fomoFreq: frequency(rated, 'FOMO'),
    stressFreq: frequency(rated, 'Stress'),
    monthlyTrend,
  };
}
