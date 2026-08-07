// Setup / Model Performance Intelligence — an ADDITIVE, non-AI layer that
// interprets the existing saved Trade Model / Setup field to rank which setups
// are actually worth running. It reuses the existing computeAnalytics() engine
// (which already produces per-model win rate / net P&L / avg R:R / avg win / avg
// loss / profit factor) and adds only the small derived metrics those rows do not
// carry: per-model expectancy, a balanced composite score, a sample confidence
// band, and a risk flag. No existing module is touched and no second calculation
// engine is introduced.
//
// Minimum-sample protection:
//   - MIN_EMERGING = 3 : below this many decided trades a setup is labelled
//                        "Limited Data" and is never crowned a proven edge.
//   - MIN_RELIABLE = 8 : at/above this a setup is labelled "Reliable";
//                        between the two it is "Emerging".
//
// Ranking: never by P&L alone. A 0-100 balanced composite of win rate (30%),
// expectancy (30%), average R:R (20%) and profit factor (20%), with rank
// adjustments so tiny samples can't masquerade as strong setups and unusually
// risky ones aren't blindly called "best".
//
// Date filter / account scope reuse the existing patterns: account scope is
// applied upstream in DataContext; here the same All-Time / This-Month / This-Week
// filter is reused plus a local Last-30-Days window.

import { computeAnalytics } from './analytics';
import { applyFocusFilter } from './performanceInsights';

export const MIN_EMERGING = 3;
export const MIN_RELIABLE = 8;
export const MIN_UNDERPERFORM = 2;

const N = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (v) => Math.max(0, Math.min(100, v));

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Applies the active Analytics-like date scope. 'month' / 'week' delegate to the
// shared filter; '30' is a local trailing-30-day window.
function applyPeriod(trades, period) {
  if (!period || period === 'all') return trades;
  if (period === '30') {
    const start = new Date(Date.now() - 30 * 86400000);
    const startKey = dateKey(start);
    return trades.filter((t) => t.date && t.date >= startKey);
  }
  return applyFocusFilter(trades, period);
}

// Per-setup 0-100 composite from metrics already computed by the analytics engine.
function compositeScore(m) {
  const winScore = clamp(m.winRate);
  const rrScore = m.avgRR >= 2 ? 100 : m.avgRR <= 0 ? 0 : clamp(m.avgRR * 50);
  let pfScore = 0;
  if (m.grossLoss === 0 && m.grossProfit > 0) pfScore = 100;
  else if (m.profitFactor >= 3) pfScore = 95;
  else pfScore = clamp(m.profitFactor * 60);

  const mag = Math.max(Math.abs(m.avgWin), Math.abs(m.avgLoss));
  const expectancyScore = mag > 0 ? clamp(50 + (m.expectancy / mag) * 150) : 0;

  return Math.round(0.3 * winScore + 0.3 * expectancyScore + 0.2 * rrScore + 0.2 * pfScore);
}

function performanceStatus(score, decided, riskWarning) {
  if (decided < MIN_EMERGING) return 'Limited Data';
  let label;
  if (score >= 65) label = 'Strong';
  else if (score >= 55) label = 'Positive';
  else if (score >= 45) label = 'Neutral';
  else label = 'Weak';
  if (riskWarning && (label === 'Strong' || label === 'Positive')) label = `${label} (High Risk)`;
  return label;
}

function statusConfidence(decided) {
  if (decided >= MIN_RELIABLE) return 'Reliable';
  if (decided >= MIN_EMERGING) return 'Emerging';
  return 'Limited';
}

export function computeSetupIntelligence(trades, period = 'all') {
  const focused = applyPeriod(trades, period);
  const a = computeAnalytics(focused);
  // Drop the "Unassigned" bucket (trades that carry no model/setup) so missing
  // setups never surface as a ranked, possibly "Limited Data" row.
  const byModel = (a.byStrategy || []).filter((g) => g.label !== 'Unassigned');

  const totalTrades = focused.length;
  const decidedCount = a.wins + a.losses;
  const modeledCount = focused.filter((t) => (t.model && String(t.model).trim())).length;
  const anyModelAssigned = modeledCount > 0;

  const models = byModel.map((g) => {
    const wins = N(g.wins);
    const losses = N(g.losses);
    const gDecided = wins + losses;
    const winRate = gDecided ? (wins / gDecided) * 100 : 0;
    const grossProfit = N(g.grossProfit);
    const grossLoss = N(g.grossLoss);
    const avgLossAbs = Math.abs(N(g.avgLoss));
    const expectancy = gDecided
      ? (winRate / 100) * N(g.avgWin) - (1 - winRate / 100) * avgLossAbs
      : 0;
    const riskWarning = avgLossAbs > 0 && N(g.avgWin) > 0 && avgLossAbs > 1.6 * N(g.avgWin);

    const metricsBase = {
      winRate,
      avgRR: N(g.avgRR),
      avgWin: N(g.avgWin),
      avgLoss: N(g.avgLoss),
      expectancy,
      profitFactor: N(g.profitFactor),
      grossProfit,
      grossLoss,
    };
    const score = compositeScore(metricsBase);

    return {
      name: g.label,
      rank: 0,
      trades: N(g.trades),
      decided: gDecided,
      wins,
      losses,
      winRate,
      netPnl: N(g.netPnl),
      avgWin: N(g.avgWin),
      avgLoss: N(g.avgLoss),
      avgRR: N(g.avgRR),
      profitFactor: N(g.profitFactor),
      expectancy,
      score,
      riskWarning,
      status: performanceStatus(score, gDecided, riskWarning),
      confidence: statusConfidence(gDecided),
    };
  });

  // Ranking: composite desc; tiny-sample ("Limited Data") setups sink to the bottom.
  models.sort((a, b) => {
    const aStage = a.status === 'Limited Data' ? 1 : 0;
    const bStage = b.status === 'Limited Data' ? 1 : 0;
    if (aStage !== bStage) return aStage - bStage;
    return b.score - a.score;
  });
  models.forEach((m, i) => (m.rank = i + 1));

  // The single "best setup" must be backed by a real (non-Limited) sample.
  const best = models.find((m) => m.status !== 'Limited Data' && m.decided >= MIN_EMERGING) || null;

  // ---- Insight generation ---------------------------------------------------
  const insights = [];
  const eligible = models.filter((m) => m.decided >= MIN_EMERGING);
  const showPpl = eligible.filter((m) => m.expectancy);

  // a) Strongest expectancy (best "edge") — only from a sufficiently sampled setup.
  if (best && best.decided >= MIN_EMERGING) {
    let claim = `Your ${best.name} setup currently has the strongest edge`;
    if (best.riskWarning) claim += ', with unusually high relative risk';
    claim += ', averaged expectancy of ' + money(best.expectancy) + ' per trade.';
    insights.push({ key: 'bestExpectancy', signal: best.riskWarning ? 'warning' : 'positive', category: 'Model', claim });
  }

  // b) Positive but still-limited sample.
  const limitedFrontier = models.filter((m) => m.decided >= MIN_EMERGING && m.decided < MIN_RELIABLE && m.expectancy > 0);
  if (limitedFrontier.length && showPpl.length >= 1) {
    const ln = limitedFrontier[0]; // first by current sort (best score among them)
    insights.push({
      key: 'emerging',
      signal: 'neutral',
      category: 'Model',
      claim: `${ln.name} shows positive expectancy but its sample (${ln.decided} decided trades) is still limited — treat it as emerging, not proven.`,
    });
  }

  // c) A setup underperforming the others.
  const underperformers = eligible.filter((m) => m.expectancy < 0 && m.decided >= MIN_EMERGING);
  if (underperformers.length > 0 && eligible.length > 1) {
    const weak = underperformers.sort((x, y) => x.expectancy - y.expectancy)[0];
    insights.push({
      key: 'underperforming',
      signal: 'warning',
      category: 'Model',
      claim: `${weak.name} is currently underperforming your other setups, with negative expectancy (${money(weak.expectancy)}/trade).`,
    });
  }

  return {
    totalTrades,
    decidedCount,
    modeledCount,
    anyModelAssigned,
    models,
    best,
    insights,
    minEmerging: MIN_EMERGING,
    minReliable: MIN_RELIABLE,
  };
}

// small internal formatting helper
function money(x) {
  const v = Number(x) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}