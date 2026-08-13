// Rule Compliance — the single, canonical engine for measuring how faithfully
// a trader follows their configured trading rules. Computed entirely from the
// account's real trades plus the user's System settings (Risk Checklist +
// Trade Checklist). Account-scoped upstream in DataContext, so it is multi-
// account and filter-aware by construction.
//
// This module is the ONE place the risk / trade checklists and logged mistakes
// are turned into a compliance number. The Discipline Score reuses its output
// (ruleScore) instead of recomputing checklist adherence elsewhere, so there
// are no duplicate calculations.
//
// Metrics calculated:
//   - compliancePct       overall % of applicable rules followed (0–100)
//   - breakPct            % of trades carrying at least one logged mistake
//   - perfectCount/perfectPct  trades that were fully compliant with no breaks
//   - byRule              per-rule followed/present/broken + compliance
//   - mostBrokenRule      the rule broken most often
//   - weekly/monthly      compliancePct bucketed by calendar week / month
//   - trend               asymmetric weekly compliance series for a sparkline

import { mondayKey, monthLabel, weekLabel } from './utils.js';

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

// Number of mistakes (rule breaks) logged on a trade — any truthy entry in the
// `mistakes` map, real data only.
function mistakeCount(t) {
  const m = t?.mistakes || {};
  return Object.keys(m).filter((k) => m[k]).length;
}

export function computeRuleCompliance(trades, { riskCriteria = [], checklistCriteria = [] } = {}) {
  const list = Array.isArray(trades) ? trades : [];
  const configRisk = (riskCriteria || []).filter(Boolean);
  const configExec = (checklistCriteria || []).filter(Boolean);

  const sorted = [...list].sort((a, b) => (a.date + ' ' + (a.entryTime || '')).localeCompare(b.date + ' ' + (b.entryTime || '')));

  const perTradeCompliance = []; // { base, compliance, perfect, date }
  const ruleStats = {}; // name -> { followed, present }

  sorted.forEach((t) => {
    const rc = t.riskChecklist || {};
    const tc = t.tradeChecklist || {};
    const engagedRisk = configRisk.length && Object.keys(rc).length;
    const engagedExec = configExec.length && Object.keys(tc).length;

    // Denominator / numerator only for trades that actually engaged the
    // configured checklists — real data only, no fabricated expectations.
    if (engagedRisk || engagedExec) {
      const rDen = engagedRisk ? configRisk.length : 0;
      const rNum = engagedRisk ? configRisk.filter((r) => rc[r] === true).length : 0;
      const eDen = engagedExec ? configExec.length : 0;
      const eNum = engagedExec ? configExec.filter((c) => tc[c] === true).length : 0;
      const den = rDen + eDen;
      const base = den ? Math.round((rNum + eNum) / den * 100) : 100;

      const breaks = mistakeCount(t);
      const compliance = Math.max(0, base - breaks * 20);
      const perfect = base === 100 && breaks === 0;

      perTradeCompliance.push({ base, compliance, perfect, date: t.date });

      if (engagedRisk) {
        configRisk.forEach((r) => {
          if (!(r in rc)) return;
          if (!ruleStats[r]) ruleStats[r] = { name: r, followed: 0, broken: 0 };
          if (rc[r] === true) ruleStats[r].followed += 1;
          else ruleStats[r].broken += 1;
        });
      }
      if (engagedExec) {
        configExec.forEach((c) => {
          if (!(c in tc)) return;
          if (!ruleStats[c]) ruleStats[c] = { name: c, followed: 0, broken: 0 };
          if (tc[c] === true) ruleStats[c].followed += 1;
          else ruleStats[c].broken += 1;
        });
      }
    }
  });

  const total = list.length;
  const compliancePct = perTradeCompliance.length
    ? perTradeCompliance.reduce((s, p) => s + p.compliance, 0) / perTradeCompliance.length
    : 0;
  const perfectCount = perTradeCompliance.filter((p) => p.perfect).length;

  // Rule Break % = share of all trades that logged at least one mistake.
  const tradesWithBreaks = list.filter((t) => mistakeCount(t) > 0).length;
  const breakPct = total ? (tradesWithBreaks / total) * 100 : 0;
  const perfectPct = perTradeCompliance.length ? (perfectCount / perTradeCompliance.length) * 100 : 0;

  const byRule = Object.values(ruleStats)
    .map((r) => ({ ...r, present: r.followed + r.broken, compliancePct: r.followed + r.broken ? Math.round((r.followed / (r.followed + r.broken)) * 100) : 0 }))
    .sort((a, b) => b.broken - a.broken || b.present - a.present);

  const mostBrokenRule = byRule.length ? byRule[0] : null;

  // Bucketing: weeks (Mon–Sun) and months with real engagement.
  const weekAgg = {};
  const monthAgg = {};
  perTradeCompliance.forEach((p) => {
    if (!p.date) return;
    const wk = mondayKey(p.date);
    const mo = monthKey(p.date);
    if (wk) {
      if (!weekAgg[wk]) weekAgg[wk] = { sum: 0, n: 0, key: wk, label: weekLabel(wk) };
      weekAgg[wk].sum += p.compliance;
      weekAgg[wk].n += 1;
    }
    if (mo) {
      if (!monthAgg[mo]) monthAgg[mo] = { sum: 0, n: 0, key: mo, label: monthLabel(mo) };
      monthAgg[mo].sum += p.compliance;
      monthAgg[mo].n += 1;
    }
  });

  const weekly = Object.values(weekAgg)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((w) => ({ label: w.label, compliancePct: Math.round(w.sum / w.n) }));

  const monthly = Object.values(monthAgg)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((w) => ({ label: w.label, compliancePct: Math.round(w.sum / w.n) }));

  // Trend = the weekly series, an easy-to-render compliance trajectory.
  const trend = weekly;

  // The single 0–100 score reused by the Discipline engine (equal to the
  // overall compliance % — checklists count exactly once, everywhere).
  const ruleScore = Math.max(0, Math.min(100, Math.round(compliancePct)));

  return {
    total,
    engagedTrades: perTradeCompliance.length,
    hasChecklistData: perTradeCompliance.length > 0 || tradesWithBreaks > 0,
    compliancePct: Math.round(compliancePct),
    ruleScore,
    breakPct: Math.round(breakPct),
    perfectCount,
    perfectPct: Math.round(perfectPct),
    byRule,
    mostBrokenRule,
    weekly,
    monthly,
    trend,
  };
}