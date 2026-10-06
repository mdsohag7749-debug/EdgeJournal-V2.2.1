// Discipline Score 2.0 Engine — Mobile Parity
// TypeScript implementation matching src/lib/disciplineScore.js exactly.
//
// Five weighted components (weights total 100):
//   - Risk           30%  -> trade riskChecklist adherence + riskPercent
//   - Plan & Checklist 25% -> tradeChecklist adherence + plan following (models)
//   - Execution      20%  -> completeness of model, session, direction, entryTime, SL, TP
//   - Mistake        15%  -> mistake-free rate (trades with 0 mistakes)
//   - Review         10%  -> 5-item closed-trade reviews + reflection activity
//
// Data-availability-aware weighting: components without data are excluded from denominator,
// normalizing the total over available weight only.

import { Trade, Reflection } from '../types/models';

export const UNASSIGNED_LABEL = 'Unassigned';

export interface DisciplineComponentDef {
  key: 'risk' | 'plan' | 'execution' | 'mistake' | 'review';
  label: string;
  weight: number;
}

export interface DisciplineComponentResult extends DisciplineComponentDef {
  score: number | null;
  points: number | null;
  available: boolean;
  engaged: number;
  note: string;
}

export interface DisciplineBand {
  min: number;
  max: number;
  label: string;
  color: string;
  message: string;
}

export interface ImprovementArea {
  key: string;
  signal: 'positive' | 'neutral' | 'warning';
  claim: string;
}

export interface TrendDataPoint {
  label: string;
  score: number;
}

export interface DisciplineScore20Options {
  models?: string[];
  riskCriteria?: string[];
  checklistCriteria?: string[];
  reflections?: Reflection[] | any[];
  period?: 'all' | 'month' | 'week' | '30' | string;
  pair?: string;
  session?: string;
  setup?: string;
  dateFrom?: string;
  dateTo?: string;
  includeTrend?: boolean;
}

export interface DisciplineScore20Result {
  total: number;
  hasData: boolean;
  score: number | null;
  availablePoints: number | null;
  denom: number;
  band: DisciplineBand | null;
  coveragePct: number;
  components: DisciplineComponentResult[];
  improvements: ImprovementArea[];
  weekly: TrendDataPoint[];
  monthly: TrendDataPoint[];
  hasTrend: boolean;
  pairOptions: string[];
  sessionOptions: string[];
  setupOptions: string[];
  period: string;
  minTrendPoints: number;
}

export const DISCIPLINE_COMPONENTS: DisciplineComponentDef[] = [
  { key: 'risk', label: 'Risk Management', weight: 30 },
  { key: 'plan', label: 'Plan & Checklist', weight: 25 },
  { key: 'execution', label: 'Execution', weight: 20 },
  { key: 'mistake', label: 'Mistake Control', weight: 15 },
  { key: 'review', label: 'Review & Reflection', weight: 10 },
];

export const BANDS: DisciplineBand[] = [
  { min: 90, max: 100, label: 'Excellent', color: '#16a34a', message: 'Institutional-level discipline across every logged data source.' },
  { min: 80, max: 89, label: 'Strong', color: '#3b82f6', message: 'Solid discipline. Close the small gaps in the lowest components.' },
  { min: 70, max: 79, label: 'Moderate', color: '#f59e0b', message: 'Consistent effort — tighten the weakest component to push higher.' },
  { min: 60, max: 69, label: 'Needs Improvement', color: '#f97316', message: 'Several components trail your own rules. Revisit the checklist habits below.' },
  { min: 0, max: 59, label: 'High Improvement Priority', color: '#dc2626', message: 'The fundamentals need attention — start with the lowest-scoring component.' },
];

export const EXECUTION_FIELDS = ['model', 'session', 'direction', 'entryTime', 'stopLoss', 'takeProfit'];

export const REVIEW_ITEMS = [
  { key: 'beforeScreenshot', label: 'Before Trade Screenshot' },
  { key: 'afterScreenshot', label: 'After Trade Screenshot' },
  { key: 'reviewSummary', label: 'Trade Review Summary' },
  { key: 'lessonLearned', label: 'Lesson Learned / Mistake' },
  { key: 'emotionReflection', label: 'Emotion & Psychology Reflection' },
];

export const SESSION_WINDOWS = [
  { session: 'Asia', start: 0, end: 8 },
  { session: 'London', start: 8, end: 13 },
  { session: 'New York', start: 13, end: 21 },
  { session: 'After Hours', start: 21, end: 24 },
];

function present(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0;
  const s = String(v).trim();
  return s !== '' && s !== '0';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  return mon;
}

export function mondayKey(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return dateKey(mondayOf(d));
}

export function weekLabel(monKey: string): string {
  if (!monKey) return '';
  const d = new Date(monKey + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return monKey;
  const sun = new Date(d);
  sun.setDate(d.getDate() + 6);
  const m = d.toLocaleString('en-US', { month: 'short' });
  return `${m} ${d.getDate()}–${sun.getDate()}`;
}

export function monthLabel(ymKey: string): string {
  if (!ymKey) return '';
  const [y, m] = ymKey.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return ymKey;
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function sessionOfTrade(t: any): string {
  if (t.session) return t.session;
  const hour = parseInt((t.entryTime || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return 'Unknown';
  const win = SESSION_WINDOWS.find((w) => hour >= w.start && hour < w.end);
  return win ? win.session : 'Unknown';
}

export function mistakesOfTrade(t: any): string[] {
  if (!t) return [];
  const m = t.mistakes;
  if (Array.isArray(m)) {
    return m.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
  }
  if (m && typeof m === 'object') {
    return Object.keys(m).filter((k) => !!m[k]);
  }
  return [];
}

export function isClosedTrade(t: any): boolean {
  if (!t) return false;
  if (Number(t.exitPrice) > 0) return true;
  const r = String(t.result || '').toLowerCase();
  return r === 'win' || r === 'loss' || r === 'be';
}

export function reviewScoreForTrade(t: any): number {
  const review = t?.review || {};
  const done = REVIEW_ITEMS.filter((i) => !!review[i.key]).length;
  return Math.round((done / REVIEW_ITEMS.length) * 100);
}

function modelOfTrade(t: any): string {
  if (t.setup !== undefined && t.setup !== null) return t.setup;
  if (t.model !== undefined && t.model !== null) return t.model;
  return '';
}

function symbolOfTrade(t: any): string {
  if (t.instrument !== undefined && t.instrument !== null && t.instrument !== '') return t.instrument;
  if (t.symbol !== undefined && t.symbol !== null && t.symbol !== '') return t.symbol;
  return UNASSIGNED_LABEL;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function average(nums: number[]): number {
  return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : 0;
}

export function applyFocusFilter(trades: any[], period: string): any[] {
  if (!period || period === 'all') return trades;
  const now = new Date();

  if (period === 'week') {
    const monday = mondayOf(now);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const start = dateKey(monday);
    const end = dateKey(sunday);
    return trades.filter((t) => {
      const d = t.date || t.entryDate;
      return d && d >= start && d <= end;
    });
  }

  if (period === 'month') {
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const end = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-31`;
    return trades.filter((t) => {
      const d = t.date || t.entryDate;
      return d && d >= start && d <= end;
    });
  }

  return trades;
}

export function applyPeriodFilter(list: any[], period = 'all', dateFrom?: string, dateTo?: string): any[] {
  if (!Array.isArray(list)) return [];
  let out = list;

  if (period && period !== 'all') {
    if (period === '30') {
      const start = dateKey(new Date(Date.now() - 30 * 86400000));
      out = out.filter((t) => {
        const d = t.date || t.entryDate;
        return d && d >= start;
      });
    } else {
      out = applyFocusFilter(out, period);
    }
  }

  if (dateFrom && dateTo) {
    out = out.filter((t) => {
      const d = t.date || t.entryDate;
      return d && d >= dateFrom && d <= dateTo;
    });
  }

  return out;
}

// Component Scorers

function riskScore(trades: any[], configuredRisk: string[]) {
  const rules = (configuredRisk || []).filter(Boolean);
  const engaged = trades.filter((t) => Object.keys(t.riskChecklist || {}).length > 0 || present(t.riskPercent));
  const adherence: number[] = [];
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

function planScore(trades: any[], configuredModels: string[], configuredChecklist: string[]) {
  const models = (configuredModels || []).filter(Boolean);
  const rules = (configuredChecklist || []).filter(Boolean);
  const engaged = trades.filter((t) => Object.keys(t.tradeChecklist || {}).length > 0);
  const adherence: number[] = [];
  engaged.forEach((t) => {
    const tc = t.tradeChecklist || {};
    const list = rules.length ? rules : Object.keys(tc);
    if (!list.length) return;
    const followed = list.filter((c) => tc[c] === true).length;
    adherence.push((followed / list.length) * 100);
  });
  const subScores: number[] = [];
  if (engaged.length) subScores.push(average(adherence));
  if (models.length && trades.length) {
    const planned = trades.filter((t) => {
      const m = modelOfTrade(t);
      return m && models.includes(m);
    }).length;
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

function executionScore(trades: any[]) {
  const rows = trades.map((t) => {
    let count = 0;
    if (present(modelOfTrade(t))) count++;
    if (present(t.session)) count++;
    if (present(t.direction)) count++;
    if (present(t.entryTime)) count++;
    if (present(t.stopLoss)) count++;
    if (present(t.takeProfit)) count++;
    return count / EXECUTION_FIELDS.length;
  });
  return {
    score: trades.length ? clamp(average(rows) * 100) : null,
    available: trades.length > 0,
    engaged: trades.length,
    note: 'Share of execution fields (model, session, direction, entry time, SL, TP) actually recorded',
  };
}

function mistakeScore(trades: any[]) {
  const free = trades.filter((t) => mistakesOfTrade(t).length === 0).length;
  return {
    score: trades.length ? clamp((free / trades.length) * 100) : null,
    available: trades.length > 0,
    engaged: trades.length,
    note: trades.length ? `${trades.length - free} of ${trades.length} trades carried a logged mistake` : '',
  };
}

function reviewScore(trades: any[], reflections: any[]) {
  const closed = trades.filter(isClosedTrade);
  const subScores: number[] = [];
  if (closed.length) subScores.push(average(closed.map(reviewScoreForTrade)));

  const refs = Array.isArray(reflections) ? reflections : [];
  const tradingDays = new Set(trades.map((t) => t.date || t.entryDate).filter(Boolean)).size;
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

function buildImprovements(components: DisciplineComponentResult[]): ImprovementArea[] {
  const items: ImprovementArea[] = [];
  const available = components.filter((c) => c.available);
  const weakest = [...available].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  const SUBS: Record<string, string> = {
    risk: 'engage the Risk Management checklist on every trade and set a risk %',
    plan: 'complete the pre-trade checklist (and pick a configured model) on every trade',
    execution: 'record the full execution set — model, session, direction, entry time, stop loss and take profit',
    mistake: 'log mistakes during trade reviews so repeat patterns become visible',
    review: 'finish the five review items on closed trades and write reflections',
  };

  available.forEach((c) => {
    if (c.score !== null && c.score < 70) {
      items.push({
        key: c.key,
        signal: c.score < 60 ? 'warning' : 'neutral',
        claim: `${c.label} is ${c.score}/100 — ${SUBS[c.key]}.`,
      });
    }
  });

  components.forEach((c) => {
    if (!c.available) {
      items.push({
        key: c.key,
        signal: 'neutral',
        claim: `No ${c.label} data yet — ${SUBS[c.key]} to unlock this component (${c.weight}% weight).`,
      });
    }
  });

  if (!items.length && weakest && weakest.score !== null) {
    items.push({
      key: weakest.key,
      signal: 'positive',
      claim: `Strongest area to keep protecting: ${weakest.label} at ${weakest.score}/100.`,
    });
  }

  return items.slice(0, 4);
}

function bandOf(score: number | null): DisciplineBand | null {
  if (score === null || score === undefined) return null;
  return BANDS.find((b) => score >= b.min && score <= b.max) || BANDS[BANDS.length - 1];
}

function trendSeries(
  trades: any[],
  cfg: DisciplineScore20Options,
  keyFn: (dateStr: string) => string,
  labelFn: (key: string) => string
): TrendDataPoint[] {
  const buckets: Record<string, { key: string; label: string; list: any[] }> = {};
  trades.forEach((t) => {
    const d = t.date || t.entryDate;
    if (!d) return;
    const k = keyFn(d);
    if (!k) return;
    if (!buckets[k]) buckets[k] = { key: k, label: labelFn(k), list: [] };
    buckets[k].list.push(t);
  });

  return Object.keys(buckets)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => {
      const row = computeDisciplineScore20(buckets[k].list, { ...cfg, includeTrend: false });
      return { label: buckets[k].label, score: row.score as number };
    })
    .filter((r) => r.score !== null && r.score !== undefined);
}

/**
 * Main entrypoint for Discipline Score 2.0.
 * Pure, deterministic calculation adhering 100% to Web specification.
 */
export function computeDisciplineScore20(
  trades: Trade[] | any[],
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
  }: DisciplineScore20Options = {}
): DisciplineScore20Result {
  const list = Array.isArray(trades) ? trades : [];
  const periodFocus = applyPeriodFilter(list, period, dateFrom, dateTo);
  const focused = periodFocus.filter(
    (t) =>
      (pair === 'All' || !pair ? true : symbolOfTrade(t) === pair) &&
      (session === 'All' || !session ? true : sessionOfTrade(t) === session) &&
      (setup === 'All' || !setup ? true : modelOfTrade(t) === setup)
  );

  const raw = {
    risk: riskScore(focused, riskCriteria),
    plan: planScore(focused, models, checklistCriteria),
    execution: executionScore(focused),
    mistake: mistakeScore(focused),
    review: reviewScore(focused, reflections),
  };

  const components: DisciplineComponentResult[] = DISCIPLINE_COMPONENTS.map((def) => {
    const r = raw[def.key];
    return {
      ...def,
      score: r.score,
      points: r.score === null ? null : Math.round((r.score * def.weight) / 100),
      available: r.available,
      engaged: r.engaged,
      note: r.note,
    };
  });

  const availableWeight = components.filter((c) => c.available).reduce((s, c) => s + c.weight, 0);
  const score = availableWeight
    ? Math.round(
        components.filter((c) => c.available).reduce((s, c) => s + ((c.score ?? 0) * c.weight) / availableWeight, 0)
      )
    : null;
  const availablePoints = score === null ? null : Math.round((score * availableWeight) / 100);
  const band = bandOf(score);

  const weekly = includeTrend
    ? trendSeries(focused, { models, riskCriteria, checklistCriteria, reflections }, mondayKey, weekLabel)
    : [];
  const monthly = includeTrend
    ? trendSeries(
        focused,
        { models, riskCriteria, checklistCriteria, reflections },
        (d) => (d || '').slice(0, 7),
        monthLabel
      )
    : [];

  const pairOptions = [
    ...new Set(list.map((t) => symbolOfTrade(t))),
  ].sort((a, b) => a.localeCompare(b));
  const sessionOptions = [...new Set(list.map(sessionOfTrade))].sort((a, b) => a.localeCompare(b));
  const setupOptions = [
    ...new Set(list.map((t) => modelOfTrade(t) || UNASSIGNED_LABEL)),
  ].sort((a, b) => a.localeCompare(b));

  return {
    total: focused.length,
    hasData: focused.length > 0,
    score,
    availablePoints,
    denom: availableWeight,
    band,
    coveragePct: availableWeight,
    components,
    improvements: buildImprovements(components),
    weekly,
    monthly,
    hasTrend: weekly.length >= 2 || monthly.length >= 2,
    pairOptions,
    sessionOptions,
    setupOptions,
    period,
    minTrendPoints: 2,
  };
}
