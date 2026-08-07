// Trading Pattern Detection — an ADDITIVE, non-AI layer that finds repeated
// behavioural and performance patterns in the EXISTING saved trade sequence.
// It is strictly DESCRIPTIVE, never predictive: it reports what has repeatedly
// happened historically and never forecasts ("you will lose / revenge trade /
// make profit"). It does not recompute P&L, R:R, lot size or drawdown and does
// not touch the Log Trade calculator or the analytics engine.
//
// Sources: saved fields only — chronological trade order, date/entry time,
// pair (instrument), session, model/setup, result, rr, risk %, netPnl,
// psychology (1–5 scores), mistakes map, risk/trade checklists, account
// (already scoped upstream in DataContext) and the shared date filter.
//
// Detection areas:
//   1) Loss  → next-trade behaviour     (risk / FOMO+Revenge / win rate / rr)
//   2) Win   → next-trade behaviour     (risk / mistakes / rr)
//   3) Consecutive loss / win streaks   (risk & mistake shift during / after)
//   4) Mistake clusters                 (mistakes that co-occur in the same trade)
//   5) Psychology vs outcome            (scores vs win rate / mistake rate)
//   6) Session behaviour                (mistake / rule-break / risk by session)
//   7) Pair behaviour                   (mistake / early-exit / risk by pair)
//   8) Setup behaviour                  (mistake / psychology / risk by model)
//
// Sample protection & strength classification (same bands as the other
// intelligence layers):
//   - MIN_LIMITED  = 3  -> "Limited Data" (never a pattern)
//   - MIN_EMERGING = 5  -> "Emerging Pattern"
//   - MIN_STRONG   = 8  -> "Strong Pattern" (only this supports firm claims)
//
// Confidence = Low / Medium / High, derived from observation count and the
// size of the observed difference.

import { applyFocusFilter } from './performanceInsights';
import { memoizeByArgs } from './memoize';
import { MISTAKE_NAMES, SESSION_WINDOWS } from './utils';

export const MIN_OBS = 3;
export const MIN_EMERGING = 5;
export const MIN_STRONG = 8;

const PSYCH = {
  pos: ['Confidence', 'Patience', 'Focus'],
  neg: ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress'],
};
const REVENGE_FOMO = ['Revenge', 'FOMO'];

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mistakesOf = (t) => {
  const m = t && t.mistakes;
  if (!m || typeof m !== 'object') return [];
  return MISTAKE_NAMES.filter((k) => m[k]);
};
const hasMistake = (t) => mistakesOf(t).length > 0;
const hasAnyFomoRevenge = (t) => mistakesOf(t).some((k) => ['FOMO Entry', 'Revenge Trade'].includes(k));

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const fmtPct = (x) => `${N(x).toFixed(1)}%`;
const fmtRp = (x) => `${N(x).toFixed(2)}%`;
const fmtRr = (x) => `${N(x).toFixed(2)}`;

function winRateOf(list) {
  const d = list.filter((t) => t.result === 'Win' || t.result === 'Loss');
  return d.length ? (d.filter((t) => t.result === 'Win').length / d.length) * 100 : null;
}
function rrAvg(list) {
  return mean(list.map((t) => N(t.rr)).filter((r) => r > 0));
}
function riskAvg(list) {
  return mean(list.filter((t) => N(t.riskPercent) > 0).map((t) => N(t.riskPercent)));
}
function mistakeRate(list) {
  return list.length ? (list.filter((t) => hasMistake(t)).length / list.length) * 100 : 0;
}
function fomoRevengeRate(list) {
  return list.length ? (list.filter((t) => hasAnyFomoRevenge(t)).length / list.length) * 100 : 0;
}

function sessionOf(t) {
  if (t && t.session) return t.session;
  const hour = parseInt((t && t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return null;
  const w = SESSION_WINDOWS.find((x) => hour >= x.start && hour < x.end);
  return w ? w.session : null;
}

// strength + confidence from observation count and difference magnitude
function grade(n) {
  if (n < MIN_EMERGING) return { value: n < MIN_OBS ? 'Limited Data' : 'Emerging Pattern', confidence: 'Low' };
  if (n >= MIN_STRONG) return { value: 'Strong Pattern', confidence: 'High' };
  return { value: 'Emerging Pattern', confidence: 'Medium' };
}

export function computePatternDetectionUncached(trades, period = 'all') {
  const focused = period === 'all' ? trades : applyFocusFilter(trades, period);
  const decided = focused.filter((t) => t.result === 'Win' || t.result === 'Loss');
  const all = focused;
  const decidedCount = decided.length;

  const sorted = [...decided].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));

  const baseline = {
    winRate: mean(sorted.map((t) => (t.result === 'Win' ? 1 : 0))) * 100,
    avgRR: rrAvg(sorted),
    avgRisk: riskAvg(sorted),
    mistakeRate: mistakeRate(sorted),
    fomoRevenge: fomoRevengeRate(sorted),
  };

  const patterns = [];
  const push = (category, title, detail, observations, diff) => {
    const g = grade(observations);
    patterns.push({
      id: `${category}:${observations}:${title}`,
      category,
      title,
      detail,
      observations,
      strength: g.value,
      confidence: g.confidence,
      diff,
    });
  };

  // =======================================================================
  // 1 & 2. WIN→NEXT / LOSS→NEXT
  // =======================================================================
  const nextAfterLoss = [];
  const nextAfterWin = [];
  sorted.forEach((t, i) => {
    if (i === 0) return;
    const prev = sorted[i - 1];
    if (prev.result === 'Loss') nextAfterLoss.push(t);
    else if (prev.result === 'Win') nextAfterWin.push(t);
  });

  const nl = nextAfterLoss.length;
  if (nl >= MIN_EMERGING) {
    const r = riskAvg(nextAfterLoss);
    if (r > baseline.avgRisk * 1.15) {
      push('Loss→Next', 'Higher risk after a loss',
        `After losing trades, your next trades have shown higher average risk (${fmtRp(r)} vs ${fmtRp(baseline.avgRisk)} baseline on ${nl} next-trades).`,
        nl, r - baseline.avgRisk);
    }
    const fomo = fomoRevengeRate(nextAfterLoss);
    if (fomo > baseline.fomoRevenge * 1.5 && baseline.fomoRevenge < 80) {
      push('Loss→Next', 'More imprint/impulse after a loss',
        `Historically, FOMO or revenge is more frequently logged on the trade right after a loss (${fmtPct(fomo)} vs ${fmtPct(baseline.fomoRevenge)} baseline, ${nl} next-trades).`,
        nl, fomo - baseline.fomoRevenge);
    }
    const wr = winRateOf(nextAfterLoss);
    if (wr !== null && wr < baseline.winRate - 9) {
      push('Loss→Next', 'Lower win rate after a loss',
        `Trades immediately following a loss have shown a ${(baseline.winRate - wr).toFixed(1)} point lower win rate (${fmtPct(wr)} vs ${fmtPct(baseline.winRate)}).`,
        nl, wr - baseline.winRate);
    }
  }

  const nw = nextAfterWin.length;
  if (nw >= MIN_EMERGING) {
    const wr = winRateOf(nextAfterWin);
    if (wr !== null && wr < baseline.winRate - 9) {
      push('Win→Next', 'Lower win rate after a win',
        `Historically, the trade after a winning trade wins less often (${fmtPct(wr)} vs ${fmtPct(baseline.winRate)} baseline on ${nw} next-trades) — a possible over-listing effect.`,
        nw, wr - baseline.winRate);
    }
    const mrate = mistakeRate(nextAfterWin);
    if (mrate > baseline.mistakeRate * 1.2 && baseline.mistakeRate < 90) {
      push('Win→Next', 'More rule breaks after a win',
        `More mistakes are logged right after a winning trade (${fmtPct(mrate)} vs ${fmtPct(baseline.mistakeRate)} baseline, ${nw} next-trades) — patterns often follow success.`,
        nw, mrate - baseline.mistakeRate);
    }
  }

  // =======================================================================
  // 3. CONSECUTIVE LOSS / WIN STREAKS — risk & mistake shift during/after
  // =======================================================================
  // res = risk+depth of the first trade AFTER each streak of >=2 of same result
  const afterStreak = {};
  for (let i = 0; i < sorted.length; i++) {
    let streak = 1;
    while (i + streak < sorted.length && sorted[i + streak].result === sorted[i].result) streak += 1;
    if (streak >= 2) {
      const next = sorted[i + streak];
      if (next) {
        (afterStreak[sorted[i].result] = afterStreak[sorted[i].result] || []).push(next);
      }
      i += streak - 1;
    }
  }
  const riskAfterLossStreak = riskAvg(afterStreak.Loss || []);
  const riskAfterWinStreak = riskAvg(afterStreak.Win || []);
  const lossStreakCount = (afterStreak.Loss || []).length;
  const winStreakCount = (afterStreak.Win || []).length;

  if (lossStreakCount >= MIN_EMERGING && riskAfterLossStreak > baseline.avgRisk * 1.15) {
    push('Loss Streak', 'Risk spike after a losing streak',
      `Historically, after 2+ consecutive losses your next trade has been sized higher (${fmtRp(riskAfterLossStreak)} avg vs ${fmtRp(baseline.avgRisk)} baseline) on ${lossStreakCount} such occasions.`,
      lossStreakCount, riskAfterLossStreak - baseline.avgRisk);
  }

  if (winStreakCount >= MIN_EMERGING) {
    const mrate = mistakeRate(afterStreak.Win || []);
    if (mrate > baseline.mistakeRate * 1.2 && baseline.mistakeRate < 90) {
      push('Win Streak', 'More mistakes after a winning streak',
        `After 2+ consecutive wins the next trade logs more mistakes (${fmtPct(mrate)} vs ${fmtPct(baseline.mistakeRate)} overall) on ${winStreakCount} occasions — overconfidence tends to follow win streaks.`,
        winStreakCount, mrate - baseline.mistakeRate);
    }
  }
  // =======================================================================
  // 4. MISTAKE CLUSTERS — mistakes that co-occur in single trades
  // =======================================================================
  const coOccur = {};
  sorted.forEach((t) => {
    const ms = mistakesOf(t);
    if (ms.length < 2) return;
    for (let a = 0; a < ms.length; a++) {
      for (let b = a + 1; b < ms.length; b++) {
        const key = ms[a] < ms[b] ? `${ms[a]} + ${ms[b]}` : `${ms[b]} + ${ms[a]}`;
        coOccur[key] = (coOccur[key] || 0) + 1;
      }
    }
  });
  const clusters = Object.entries(coOccur).map(([combo, count]) => ({ combo, count })).sort((a, b) => b.count - a.count);
  clusters.slice(0, 3).forEach((c) => {
    if (c.count >= 2) {
      push('Mistake Cluster', `${c.combo}`, `"${c.combo}" appear together in ${c.count} trades — a recurring combination worth watching.`, c.count, c.count);
    }
  });

  // =======================================================================
  // 6. PSYCHOLOGY vs OUTCOMES
  // =======================================================================
  PSYCH.neg.forEach((key) => {
    const hi = sorted.filter((t) => N(t.psychology?.[key]) >= 3);
    const lo = sorted.filter((t) => N(t.psychology?.[key]) <= 2);
    if (hi.length >= MIN_EMERGING && lo.length >= MIN_EMERGING) {
      const wrHi = winRateOf(hi);
      const wrLo = winRateOf(lo);
      if (wrHi !== null && wrLo !== null && wrLo - wrHi >= 9) {
        push('Psychology', `Lower win rate when ${key} is high`,
          `Trades where ${key} was rated high (÷ on a 1–5 scale) win less often (${fmtPct(wrHi)} vs ${fmtPct(wrLo)} when low) — ${key} score may correspond to worse outcomes on ${hi.length} trades.`,
          hi.length, wrHi - wrLo);
      }
    }
  });
  // low confidence
  {
    const confLow = sorted.filter((t) => N(t.psychology?.Confidence) <= 2);
    const confOk = sorted.filter((t) => N(t.psychology?.Confidence) >= 4);
    if (confLow.length >= MIN_EMERGING && confOk.length >= MIN_EMERGING) {
      const mLow = mistakeRate(confLow);
      const mOk = mistakeRate(confOk);
      if (mOk !== null && mLow - mOk >= 8) {
        push('Psychology', 'More mistakes when confidence is low',
          `Trades logged with low Confidence (≤2/5) carry more mistakes (${fmtPct(mLow)} vs ${fmtPct(mOk)} at ≥4/5) on ${confLow.length} vs ${confOk.length} trades.`,
          confLow.length, mLow - mOk);
      }
    }
  }

  // =======================================================================
  // 7. SESSION BEHAVIOUR
  // =======================================================================
  const sessMap = {};
  focused.forEach((t) => {
    const s = sessionOf(t);
    if (!s) return;
    (sessMap[s] = sessMap[s] || []).push(t);
  });
  Object.entries(sessMap).forEach(([s, arr]) => {
    if (arr.length < MIN_EMERGING) return;
    const mk = mistakeRate(arr);
    if (mk > baseline.mistakeRate * 1.2 + 8) {
      push('Session', `${s}: higher mistake load`,
        `${s} carries a higher mistake rate (${fmtPct(mk)} vs ${fmtPct(baseline.mistakeRate)} overall) across ${arr.length} trades.`,
        arr.length, mk - baseline.mistakeRate);
    }
  });

  // =======================================================================
  // 8. PAIR BEHAVIOUR
  // =======================================================================
  const pairMap = {};
  focused.forEach((t) => {
    const p = (t.instrument || '').trim();
    if (!p) return;
    (pairMap[p] = pairMap[p] || []).push(t);
  });
  Object.entries(pairMap).forEach(([p, arr]) => {
    if (arr.length < MIN_EMERGING) return;
    const laten = arr.filter((t) => mistakesOf(t).includes('Early Exit'));
    if (laten.length >= MIN_EMERGING) {
      push('Pair', `${p}: clustered early exits`,
        `${laten.length} of ${arr.length} ${p} trades logged an early exit — an execution pattern clustered on this pair.`,
        laten.length, laten.length);
    }
    const mk = mistakeRate(arr);
    if (mk > baseline.mistakeRate * 1.2 + 8) {
      push('Pair', `${p}: higher mistake load`,
        `${p} shows more mistakes than your overall rate (${fmtPct(mk)} vs ${fmtPct(baseline.mistakeRate)}) across ${arr.length} trades.`,
        arr.length, mk - baseline.mistakeRate);
    }
  });

  // =======================================================================
  // 9. SETUP BEHAVIOUR
  // =======================================================================
  const modelMap = {};
  focused.forEach((t) => {
    const m = t.model && String(t.model).trim();
    if (!m) return;
    (modelMap[m] = modelMap[m] || []).push(t);
  });
  Object.entries(modelMap).forEach(([m, arr]) => {
    if (arr.length < MIN_EMERGING) return;
    const r = riskAvg(arr);
    if (baseline.avgRisk > 0 && r > baseline.avgRisk * 1.2) {
      push('Setup', `${m}: sized above average`,
        `Your ${m} setup trades with higher average risk (${fmtRp(r)} vs ${fmtRp(baseline.avgRisk)}) across ${arr.length} trades.`,
        arr.length, r - baseline.avgRisk);
    }
  });

  patterns.sort((a, b) => (b.observations - a.observations));

  return {
    decidedCount,
    total: focused.length,
    baseline,
    riskAfterLossStreak,
    riskAfterWinStreak,
    lossStreakCount,
    winStreakCount,
    clusters,
    patterns,
    minEmerging: MIN_EMERGING,
    minStrong: MIN_STRONG,
  };
}

export const computePatternDetection = memoizeByArgs(computePatternDetectionUncached);