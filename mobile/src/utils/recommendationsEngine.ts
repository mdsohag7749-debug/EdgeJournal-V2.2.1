// Actionable Trading Recommendations Engine — Parity with Web (src/lib/recommendations.js)
import { Trade } from '../types/models';
import { computeDetailedAnalytics, getResult } from './analyticsEngine';

export const MAX_RECOMMENDATIONS = 5;

export type RecommendationPriority = 'High' | 'Medium' | 'Low';

export interface ActionRecommendation {
  category: 'Risk' | 'Setup' | 'Session' | 'Execution' | 'Psychology' | 'Direction';
  title: string;
  explanation: string;
  action: string;
  evidence: string;
  priority: RecommendationPriority;
  count: number;
}

export interface RecommendationsResult {
  decidedCount: number;
  limited: boolean;
  recommendations: ActionRecommendation[];
  max: number;
}

const PRIORITY_RANK: Record<RecommendationPriority, number> = { High: 3, Medium: 2, Low: 1 };

export function computeRecommendations(trades: Trade[]): RecommendationsResult {
  const decided = (trades || []).filter((t) => {
    const res = getResult(t);
    return res === 'Win' || res === 'Loss';
  });
  const decidedCount = decided.length;

  if (decidedCount < 3) {
    return {
      decidedCount,
      limited: true,
      recommendations: [],
      max: MAX_RECOMMENDATIONS,
    };
  }

  const a = computeDetailedAnalytics(trades);
  const recs: ActionRecommendation[] = [];

  const push = (
    category: ActionRecommendation['category'],
    title: string,
    explanation: string,
    action: string,
    evidence: string,
    priority: RecommendationPriority,
    count: number
  ) => {
    recs.push({ category, title, explanation, action, evidence, priority, count });
  };

  // 1. Post-loss risk behavior
  let postLossLosses = 0;
  for (let i = 1; i < trades.length; i++) {
    if (getResult(trades[i - 1]) === 'Loss' && getResult(trades[i]) === 'Loss') {
      postLossLosses++;
    }
  }
  if (postLossLosses >= 2) {
    push(
      'Risk',
      'Review post-loss risk behavior',
      'Your journal shows consecutive losses or elevated risk directly following a losing trade.',
      'Maintain standard position sizing after a loss and execute a pre-trade checklist before re-entering.',
      `${postLossLosses} consecutive loss sequences detected in your trade history.`,
      postLossLosses >= 3 ? 'High' : 'Medium',
      postLossLosses
    );
  }

  // 2. Oversized loss outlier
  if (a.avgLoss > 0 && Math.abs(a.worstTrade) > a.avgLoss * 2.2) {
    push(
      'Risk',
      'Tighten maximum loss per trade',
      'Your largest loss is more than 2x your average loss size, indicating position sizing drift.',
      'Enforce a strict stop loss limit and calculate contract/share size prior to order entry.',
      `Max loss of $${Math.abs(a.worstTrade).toFixed(2)} exceeds average loss of $${a.avgLoss.toFixed(2)}.`,
      'High',
      decidedCount
    );
  }

  // 3. Underperforming strategy / setup
  const weakSetup = a.byStrategy.find((s) => s.trades >= 3 && s.netPnl < 0 && s.key !== 'Unassigned');
  if (weakSetup) {
    push(
      'Setup',
      `Review "${weakSetup.label}" setup execution`,
      `The "${weakSetup.label}" model shows negative net expectancy across ${weakSetup.trades} trades.`,
      'Pause live execution of this setup to review past chart screenshots and refine your edge criteria.',
      `${weakSetup.label} has $${weakSetup.netPnl.toFixed(2)} Net P&L (${weakSetup.winRate.toFixed(1)}% win rate).`,
      weakSetup.trades >= 5 ? 'High' : 'Medium',
      weakSetup.trades
    );
  }

  // 4. Session weakness
  const weakSession = a.bySession.find((s) => s.trades >= 3 && s.netPnl < 0 && s.key !== 'Unknown');
  if (weakSession) {
    push(
      'Session',
      `Revisit ${weakSession.label} session trading`,
      `Performance in the ${weakSession.label} session has lagged behind your other trading windows.`,
      'Focus execution on your highest-performing sessions or reduce trade size during this window.',
      `${weakSession.label} session Net P&L is $${weakSession.netPnl.toFixed(2)} across ${weakSession.trades} trades.`,
      'Medium',
      weakSession.trades
    );
  }

  // 5. Recurring execution mistake
  const mistakeCounts: Record<string, number> = {};
  trades.forEach((t) => {
    const m = t.mistakes;
    if (Array.isArray(m)) {
      m.forEach((k) => {
        if (k) mistakeCounts[k] = (mistakeCounts[k] || 0) + 1;
      });
    } else if (m && typeof m === 'object') {
      Object.keys(m).forEach((k) => {
        if ((m as any)[k]) mistakeCounts[k] = (mistakeCounts[k] || 0) + 1;
      });
    }
  });
  const mistakeEntries = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]);
  if (mistakeEntries.length > 0 && mistakeEntries[0][1] >= 2) {
    const [topMistakeName, count] = mistakeEntries[0];
    push(
      'Execution',
      `Dampen "${topMistakeName}" occurrences`,
      `"${topMistakeName}" is your most frequently tagged execution mistake in journal entries.`,
      `Add a pre-entry checkpoint to confirm you are not executing under "${topMistakeName}" conditions.`,
      `Tagged in ${count} trade logs.`,
      count >= 4 ? 'High' : 'Medium',
      count
    );
  }

  // 6. Direction imbalance
  const longRow = a.byDirection.find((d) => d.key === 'Long');
  const shortRow = a.byDirection.find((d) => d.key === 'Short');
  if (longRow && shortRow && longRow.trades >= 3 && shortRow.trades >= 3) {
    const diff = Math.abs(longRow.winRate - shortRow.winRate);
    if (diff >= 30) {
      const weaker = longRow.winRate < shortRow.winRate ? longRow : shortRow;
      push(
        'Direction',
        `Evaluate ${weaker.label} trade asymmetry`,
        `Your ${weaker.label} trades have a ${weaker.winRate.toFixed(1)}% win rate compared to higher performance in opposite direction.`,
        `Review entry triggers for ${weaker.label} setups to ensure alignment with higher-timeframe trends.`,
        `${weaker.label}: ${weaker.winRate.toFixed(1)}% win rate vs ${diff.toFixed(1)}% discrepancy.`,
        'Low',
        weaker.trades
      );
    }
  }

  // Deduplicate and rank by priority
  const seen = new Set<string>();
  const uniqueRecs: ActionRecommendation[] = [];
  for (const r of recs) {
    const key = `${r.category}_${r.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecs.push(r);
    }
  }

  const recommendations = uniqueRecs
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.count - a.count)
    .slice(0, MAX_RECOMMENDATIONS);

  return {
    decidedCount,
    limited: false,
    recommendations,
    max: MAX_RECOMMENDATIONS,
  };
}
