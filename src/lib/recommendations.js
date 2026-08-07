// Actionable Trading Recommendations — an ADDITIVE, non-AI decision-support
// layer. It computes nothing itself: it REUSES the detected outputs of Tasks
// 5.1–5.5 (Setup, Smart, Session & Pair, Risk & Execution Intelligence, Pattern
// Detection) and turns those patterns into concise, practical, evidence-backed
// actions. Account scope is applied upstream (DataContext); the shared date
// filter is passed straight through to the existing modules.
//
// Hard constraints:
//   - No trading signals (no buy/sell/long/short, no entries / SL / TP).
//   - No predictions ("you will win/lose/make money") and no generic advice.
//   - Every recommendation is tied to a real detected pattern + source data.
//   - Conflicts resolved in favour of the stronger-evidence action; capped list.

import { applyFocusFilter } from './performanceInsights';
import { computeSmartInsights } from './smartInsights';
import { computeSetupIntelligence } from './setupIntelligence';
import { computeSessionPairIntelligence } from './sessionIntelligence';
import { computeRiskExecutionIntelligence } from './riskExecutionIntelligence';
import { computePatternDetection } from './patternDetection';

export const MAX_RECOMMENDATIONS = 5;

const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 };

function norm(subject) {
  return String(subject || '')
    .replace(/^(Review|Revisit|Tighten|Dampen|Standardise|Check|Hold)\s+/i, '')
    .trim();
}

function pickPriority(signal, count, strength, confidence) {
  const warn = signal === 'warning' ? 2 : 0;
  const firm = strength === 'Strong Pattern' || confidence === 'High' ? 2
    : strength === 'Emerging Pattern' || strength === 'consistent' || confidence === 'Medium' ? 1 : 0;
  const size = count >= 8 ? 2 : count >= 5 ? 1 : 0;
  const total = warn + firm + size;
  if (total >= 4) return 'High';
  if (total >= 3) return 'Medium';
  return 'Low';
}

function pickCount(...xs) {
  for (const x of xs) if (x && x > 0) return x;
  return 3;
}

export function computeRecommendations(trades, period = 'all') {
  const focused = period === 'all' ? trades : applyFocusFilter(trades, period);
  const decided = focused.filter((t) => t.result === 'Win' || t.result === 'Loss');
  const decidedCount = decided.length;

  if (decidedCount < 5) {
    return { decidedCount, limited: true, recommendations: [], max: MAX_RECOMMENDATIONS, sourcesUsed: [] };
  }

  // Reuse Tasks 5.1–5.5 (never recompute the same analytics independently).
  const smart = computeSmartInsights(focused, period);
  const setup = computeSetupIntelligence(focused, period);
  const session = computeSessionPairIntelligence(focused, period);
  const risk = computeRiskExecutionIntelligence(focused, period);
  const pattern = computePatternDetection(focused, period);

  const smartById = (id) => smart.insights.find((i) => i.id === id) || null;
  const riskIns = (re) => risk.insights.find((i) => re.test(String(i.claim || ''))) || null;
  const riskByModel = risk.riskByModel || [];
  const riskBySession = risk.riskBySession || [];
  const setupKey = (k) => setup.insights.find((i) => i.key === k) || null;
  const pat = (re) => (pattern.patterns || []).find((p) => re.test(String(p.title || ''))) || null;

  // push(category, title, explanation, action, evidence, signal, count, strength, confidence)
  const recs = [];
  const push = (category, title, explanation, action, evidence, signal, count, strength, confidence) => {
    recs.push({
      category,
      title,
      explanation,
      action,
      evidence,
      priority: pickPriority(signal, count, strength, confidence),
      count,
    });
  };

  // 1. Risk after a loss / losing streak
  const postLoss = riskIns(/after (loss|losing)/i);
  const lossSpike = pat(/risk spike after a losing/i);
  const riskOnLosing = smartById('riskOnLosing');
  if (postLoss || lossSpike || riskOnLosing) {
    const n = pickCount(lossSpike && lossSpike.observations, riskOnLosing && riskOnLosing.sample, 6);
    push(
      'Risk', 'Review post-loss risk behaviour',
      'Your history shows risk tending higher in the trade that follows a loss.',
      'Keep your predefined risk unchanged after a losing trade and re-check the setup before re-entering.',
      (postLoss && postLoss.claim) || (lossSpike && `${lossSpike.title} (${lossSpike.observations} occurrences, ${lossSpike.strength})`) || 'Risk was higher on trades after a loss in your history.',
      (postLoss && postLoss.signal) || (lossSpike && lossSpike.strength === 'Strong Pattern' ? 'warning' : 'neutral') || (riskOnLosing && riskOnLosing.signal) || 'warning',
      n,
      (lossSpike && lossSpike.strength) || (postLoss && postLoss.confidence) || 'Emerging Pattern',
      (postLoss && postLoss.confidence) || (lossSpike && lossSpike.confidence) || 'Medium',
    );
  }

  // 2. Oversized trades
  const overRisk = smartById('overRisk');
  const sizedBig = riskIns(/sized well above|large outliers/i);
  if (overRisk || sizedBig) {
    const n = pickCount(overRisk && overRisk.sample, risk.riskCount, 6);
    push(
      'Risk', 'Tighten oversized-trade sizing',
      'Several trades are sized well above your typical risk level.',
      'Set a hard maximum % risk per trade before entry and log it on the pre-trade checklist.',
      (overRisk && overRisk.claim) || 'Oversized trade(s) detected vs your average risk.',
      (overRisk && overRisk.signal) || 'warning',
      n, 'Consistent Pattern', (overRisk && overRisk.signal === 'warning') ? 'High' : 'Medium',
    );
  }

  // 3. Setup weakness / setup risk
  const underModel = setupKey('underperforming');
  if (underModel) {
    push(
      'Setup', 'Review the underperforming setup',
      'One of your setups shows negative expectancy relative to your others.',
      'Pause trading that setup and review its rules plus a few worked examples before resuming it.',
      underModel.claim,
      'warning', setup.decidedCount, 'Emerging Pattern', 'Medium',
    );
  }
  const highRiskModel = riskByModel[0];
  if (highRiskModel && riskByModel.length >= 2) {
    push(
      'Setup', `Standardise risk on ${highRiskModel.name}`,
      'One setup is sized at noticeably higher average risk than your others.',
      `Apply your standard risk % for ${highRiskModel.name} instead of a separate bigger size.`,
      `${highRiskModel.name} averages ${highRiskModel.avgRisk.toFixed(2)}% risk — highest of ${riskByModel.length} setups.`,
      'neutral', highRiskModel.count || 5, 'Emerging Pattern', 'Medium',
    );
  }

  // 4. Session weakness
  const underCombos = (session.insights || []).filter((i) => i.domain === 'Combo' && i.signal === 'warning' && /underperform/i.test(i.claim));
  if (underCombos.length) {
    const c = underCombos[0];
    push(
      'Session', 'Revisit an underperforming pair + session window',
      'A specific pair-session window has trailed your others.',
      'Tighten entry criteria and reduce your size in that window until you rebuild evidence.',
      c.claim, c.signal, pickCount(c.sample, 8),
      c.confidence === 'High' ? 'Consistent Pattern' : 'Emerging Pattern', c.confidence,
    );
  } else if (riskBySession.length >= 2) {
    const a = riskBySession[0];
    const b = riskBySession[riskBySession.length - 1];
    push(
      'Session', 'Session sizing is uneven',
      `Your average risk differs by session (${a.name} ${a.avgRisk.toFixed(2)}% vs ${b.name} ${b.avgRisk.toFixed(2)}%).`,
      'Adopt one risk policy per session instead of letting the time of day change your size.',
      'Average risk by session differs in your history.', 'neutral', a.count || 5, 'Emerging Pattern', 'Medium',
    );
  }

  // 5. Execution: a recurring mistake underperforms
  const fomoPat = pat(/FOMO/i);
  const fomoSmart = smartById('fomoWinRate');
  const cluster = (pattern.patterns || []).find((p) => p.category === 'Mistake Cluster');
  if (fomoPat || fomoSmart || cluster) {
    const name = (fomoPat && fomoPat.title) || (fomoSmart && 'FOMO') || (cluster && cluster.title) || 'the recurring mistake';
    const n = pickCount(fomoPat && fomoPat.observations, fomoSmart && fomoSmart.sample, cluster && cluster.observations, 4);
    push(
      'Execution', `Dampen "${name}" executions`,
      `${name}-trades recur in your history and are linked with weaker results.`,
      `Add a pre-entry confirmation step (check your plan / rules) for trades where "${name}" is present.`,
      (fomoPat && fomoPat.detail) || (fomoSmart && fomoSmart.claim) || `"${name}" is a recurring mistake in your history.`,
      'warning', n, n >= 8 ? 'Consistent Pattern' : 'Emerging Pattern', n >= 8 ? 'High' : 'Medium',
    );
  }

  // 6. Psychology
  const psychPat = (pattern.patterns || []).find((p) => p.category === 'Psychology');
  if (psychPat) {
    push(
      'Psychology', 'Check a recorded psychology finding',
      'One of your psychology scores corresponds with different outcomes.',
      'When that emotion state is present, run a quick pre-trade state check before entering.',
      psychPat.detail, 'neutral', pickCount(psychPat.observations, 5),
      psychPat.strength, psychPat.confidence,
    );
  }

  // 7. Post-win habits
  const afterWin = pat(/after a win/i);
  if (afterWin) {
    push(
      'Psychology', 'Hold steady after a win',
      'More mistakes are logged on the trade right after a win.',
      'After consecutive wins, keep the same risk and rules rather than escalating.',
      afterWin.detail, 'neutral', pickCount(afterWin.observations, 5),
      afterWin.strength, afterWin.confidence,
    );
  }

  // Dedup + conflict resolution, then cap.
  const seen = new Map();
  for (const r of recs) {
    const key = `${r.category}|${norm(r.title)}`;
    const prev = seen.get(key);
    if (!prev || PRIORITY_RANK[r.priority] > PRIORITY_RANK[prev.priority]) seen.set(key, r);
  }
  const recommendations = [...seen.values()]
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.count - a.count)
    .slice(0, MAX_RECOMMENDATIONS);

  return {
    decidedCount,
    limited: false,
    recommendations,
    max: MAX_RECOMMENDATIONS,
    sourcesUsed: ['Smart', 'Setup', 'Session & Pair', 'Risk & Execution', 'Pattern Detection'],
  };
}