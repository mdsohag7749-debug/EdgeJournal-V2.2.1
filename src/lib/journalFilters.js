// Journal Filters — the single, shared engine behind every trade list filter
// on the Trading Journal page (and reusable by any future list view). One set
// of pure predicates is the source of truth, so the UI can never drift from
// the logic that the tests verify. This is an ADDITIVE superset of the filters
// the journal shipped with: every existing single-value filter behaves
// identically, and multi-select (`pairs`/`directions`/`sessions`/...) adds OR
// semantics within one dimension and strict AND across dimensions.
//
// Semantics (documented here because they are the contract):
//   - Filters are combined with AND across filters.
//   - A multi-select array (e.g. `pairs: ['GBPJPY','XAUUSD']`) matches a trade
//     when the trade's value is ANY of the listed values.
//   - A single filter that is blank/'All'/'false' is inactive.
//   - The optional globetrotting `favoritesOnly` flag is an independent AND.
//   - Sorting is a pure, deterministic comparator; ties break on trade id so
//     the ordering never flickers.
//   - Every string compared is normalized once (lowercased, trimmed) so the
//     search is case-insensitive and safe.
//
// No field is invented: every key referenced below exists on the real trade
// schema (see src/lib/tradesApi.js fromTradeRow).

// The canonical blank filter state. Mirrors the pre-existing journal shape and
// adds only dimensions whose underlying fields actually exist (multi pairs,
// multi directions, multi sessions, multi timeframes, multi result, multi
// emotion, multi setup, multi mistake tags, min/max net PnL).
export const BLANK_FILTERS = {
  account: 'All',
  pair: 'All',
  direction: 'All',
  session: 'All',
  timeframe: 'All',
  result: 'All',
  emotion: 'All',
  model: 'All',
  tag: 'All',
  reviewStatus: 'All',
  newsTrade: false,
  aPlus: false,
  dateFrom: '',
  dateTo: '',
  rrMin: '',
  rrMax: '',
  riskPctMin: '',
  riskPctMax: '',
  pnlMin: '',
  pnlMax: '',
  ratingMin: '',
  ratingMax: '',
  // Multi-select OR arrays (empty = inactive).
  pairs: [],
  directions: [],
  sessions: [],
  timeframes: [],
  models: [],
  results: [],
  emotions: [],
  mistakes: [],
};

// Order matches the app's pre-existing Journal sort (Win < BE < Loss) so
// switching the production page onto this engine does not reorder it.
export const RESULT_ORDER = { Win: 0, BE: 1, Loss: 2 };
export const REVIEW_STATUS = ['All', 'Reviewed', 'Pending Review'];
export const MISTAKE_PRESENCE = ['All', 'Any', 'None'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' ? n : null;
};

// A multi-select (OR) dimension: inactive when the array is empty.
const inAny = (value, list) => {
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(value);
};

// Presence check for an object-valued field (mistakes/psychology/checklists).
const truthyKeys = (o) => Object.entries(o || {}).filter(([, v]) => v).map(([k]) => k);

// --- Text search -------------------------------------------------------------
// Searches the real, user-typed free-text fields only. Nested objects are
// flattened to their TRUTHY keys (mistakes names, psychology scores rows,
// checklist items) so a query like "fomo" or "revenge" or "plan approved"
// finds the trade without ever reading internal/expanded data.
function searchFields(t, accountNameOf) {
  const fields = [
    t.instrument,
    t.direction,
    t.result,
    t.session,
    t.timeframe,
    t.model,
    t.tradeGrade,
    t.emotion,
    t.notes,
    t.confluences,
    t.lessonsLearned,
    t.tradeManagement,
    t.rating,
    t.id,
  ];
  if (accountNameOf && t.accountId) fields.push(accountNameOf(t.accountId));
  if (Array.isArray(t.tags)) fields.push(...t.tags);
  fields.push(...truthyKeys(t.mistakes));
  fields.push(...truthyKeys(t.psychology));
  fields.push(...truthyKeys(t.riskChecklist));
  fields.push(...truthyKeys(t.tradeChecklist));
  fields.push(t.review?.reviewSummary);
  fields.push(t.review?.lessonLearned);
  return fields
    .filter((x) => x !== null && x !== undefined && x !== '')
    .map((v) => String(v).toLowerCase());
}

export function tradeMatchesText(t, q, accountNameOf) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  return searchFields(t, accountNameOf).some((f) => f.includes(needle));
}

// --- the full predicate ------------------------------------------------------
// Pure and side-effect free: given a single trade + the current filter state it
// returns true/false. `accountName` is optional (used by text search); it never
// blocks a result, it only adds a searchable label.
export function tradeMatches(t, filters = BLANK_FILTERS, { favoritesOnly = false, accountNameOf = null, query = '' } = {}) {
  const f = { ...BLANK_FILTERS, ...filters };

  if (favoritesOnly && !t.isFavorite) return false;
  if (f.account !== 'All' && t.accountId !== f.account) return false;

  // Single-select dimensions.
  if (f.pair !== 'All' && t.instrument !== f.pair) return false;
  if (f.direction !== 'All' && t.direction !== f.direction) return false;
  if (f.session !== 'All' && t.session !== f.session) return false;
  if (f.timeframe !== 'All' && t.timeframe !== f.timeframe) return false;
  if (f.result !== 'All' && t.result !== f.result) return false;
  if (f.emotion !== 'All' && t.emotion !== f.emotion) return false;
  if (f.model !== 'All' && t.model !== f.model) return false;
  if (f.tag !== 'All' && !(Array.isArray(t.tags) && t.tags.includes(f.tag))) return false;

  // Multi-select (OR) dimensions.
  if (!inAny(t.instrument, f.pairs)) return false;
  if (!inAny(t.direction, f.directions)) return false;
  if (!inAny(t.session, f.sessions)) return false;
  if (!inAny(t.timeframe, f.timeframes)) return false;
  if (!inAny(t.model, f.models)) return false;
  if (!inAny(t.result, f.results)) return false;
  if (!inAny(t.emotion, f.emotions)) return false;

  // Mistake tags (OR within — matches when ANY configured mistake is present).
  if (Array.isArray(f.mistakes) && f.mistakes.length) {
    const present = truthyKeys(t.mistakes);
    if (!f.mistakes.some((m) => present.includes(m))) return false;
  }

  // News / A+ pseudo-filters are implemented via the existing tags field.
  if (f.newsTrade) {
    if (!(Array.isArray(t.tags) ? t.tags : []).some((x) => x.toLowerCase() === 'news')) return false;
  }
  if (f.aPlus) {
    if (!(Array.isArray(t.tags) ? t.tags : []).some((x) => x.toLowerCase() === 'a+')) return false;
  }

  // Review status derived from the real review completion.
  if (f.reviewStatus !== 'All') {
    const done = truthyKeys(t.review).length >= 5;
    const wantReviewed = f.reviewStatus === 'Reviewed';
    if (done !== wantReviewed) return false;
  }

  // Date range: ISO date strings compare lexicographically.
  if (f.dateFrom && (t.date || '') < f.dateFrom) return false;
  if (f.dateTo && (t.date || '') > f.dateTo) return false;

  // Numeric ranges (RR / Risk % / net PnL / rating).
  const rr = num(t.rr);
  if (f.rrMin !== '' && rr === null) return false;
  if (f.rrMin !== '' && rr < Number(f.rrMin)) return false;
  if (f.rrMax !== '' && rr > Number(f.rrMax)) return false;

  const risk = num(t.riskPercent);
  if (f.riskPctMin !== '' && risk < Number(f.riskPctMin)) return false;
  if (f.riskPctMax !== '' && risk > Number(f.riskPctMax)) return false;

  const pnl = num(t.netPnl);
  if (f.pnlMin !== '' && (pnl === null || pnl < Number(f.pnlMin))) return false;
  if (f.pnlMax !== '' && (pnl === null || pnl > Number(f.pnlMax))) return false;

  const rating = num(t.rating);
  if (f.ratingMin !== '' && (rating === null || rating < Number(f.ratingMin))) return false;
  if (f.ratingMax !== '' && (rating === null || rating > Number(f.ratingMax))) return false;

  // Global text search.
  if (query && !tradeMatchesText(t, query, accountNameOf)) return false;

  return true;
}

// --- sort ---------------------------------------------------------------------
// Deterministic: primary key + a stable tie-break on the trade id so equal
// rows never reorder between renders.
const ss = (v) => String(v || '');
const nn = (v) => num(v) || 0;

export function sortTrades(list, sortKey = 'date', sortDir = 'desc', accountNameOf) {
  const dir = sortDir === 'asc' ? 1 : -1;
  const nameOf = accountNameOf || ((id) => id);
  const cmpFns = {
    date: (a, b) => ss(a.date + (a.entryTime || '')).localeCompare(ss(b.date + (b.entryTime || ''))),
    pair: (a, b) => ss(a.instrument).localeCompare(ss(b.instrument)),
    profit: (a, b) => nn(a.netPnl) - nn(b.netPnl),
    rr: (a, b) => nn(a.rr) - nn(b.rr),
    result: (a, b) => (RESULT_ORDER[a.result] ?? 99) - (RESULT_ORDER[b.result] ?? 99),
    account: (a, b) => ss(nameOf(a.accountId)).localeCompare(ss(nameOf(b.accountId))),
    risk: (a, b) => nn(a.riskPercent) - nn(b.riskPercent),
    setup: (a, b) => ss(a.model).localeCompare(ss(b.model)),
    duration: (a, b) => nn(a.duration) - nn(b.duration),
    rating: (a, b) => nn(a.rating) - nn(b.rating),
  };
  const cmp = cmpFns[sortKey] || cmpFns.date;
  return [...list].sort((a, b) => {
    const v = cmp(a, b);
    if (v !== 0) return v * dir;
    return ss(a.id).localeCompare(ss(b.id));
  });
}

// Full pipeline: filter then sort. Pure — the input array is never mutated.
export function filterTrades(trades, { filters = BLANK_FILTERS, favoritesOnly = '', query = '', sortKey = 'date', sortDir = 'desc', accountNameOf } = {}) {
  const list = Array.isArray(trades) ? trades : [];
  const kept = list.filter((t) => tradeMatches(t, filters, { favoritesOnly, query, accountNameOf }));
  return sortTrades(kept, sortKey, sortDir, accountNameOf);
}

// --- active-filter summary --------------------------------------------------
// Returns a stable, labelable list of the *active* filters (single, multi and
// derived) for the "Active filter x GBPJPY × London × Losses × RR ≥ 2" chips.
// Each entry carries an `id` and a `clear` bor.
export function activeFilters(filters = BLANK_FILTERS, { query = '', favoritesOnly = '' } = {}) {
  const f = { ...BLANK_FILTERS, ...filters };
  const chips = [];
  const push = (id, label) => chips.push({ id, label });

  const single = (key, label) => {
    const v = f[key];
    if (typeof v === 'string' && v && v !== 'All' && v !== '') push(`filter:${key}`, `${label}: ${v}`);
  };
  const multi = (key, label) => {
    const list = f[key];
    if (Array.isArray(list) && list.length) push(`filter:${key}`, `${label}: ${list.join(' OR ')}`);
  };

  single('account', 'Account');
  single('pair', 'Pair');
  multi('pairs', 'Pairs');
  single('direction', 'Direction');
  multi('directions', 'Directions');
  single('session', 'Session');
  multi('sessions', 'Sessions');
  single('timeframe', 'Timeframe');
  multi('timeframes', 'Timeframes');
  single('result', 'Result');
  multi('results', 'Results');
  single('model', 'Setup');
  multi('models', 'Setups');
  single('emotion', 'Emotion');
  multi('emotions', 'Emotions');
  single('tag', 'Tag');
  single('reviewStatus', 'Review');

  if (f.newsTrade) push('filter:newsTrade', 'News trade');
  if (f.aPlus) push('filter:aPlus', 'A+ setup');

  if (f.dateFrom || f.dateTo) push('filter:date', `Date: ${f.dateFrom || '…'}${f.dateTo ? ` → ${f.dateTo}` : ' → …'}`);

  const ranges = [
    ['rrMin', 'rrMax', 'RR'],
    ['riskPctMin', 'riskPctMax', 'Risk %'],
    ['pnlMin', 'pnlMax', 'PnL'],
    ['ratingMin', 'ratingMax', 'Rating'],
  ];
  for (const [minK, maxK, label] of ranges) {
    const lo = f[minK]; const hi = f[maxK];
    if (lo !== '' && hi !== '') push(`filter:${[minK, maxK].join(':')}`, `${label}: ${lo}–${hi}`);
    else if (lo !== '') push(`filter:${minK}`, `${label} ≥ ${lo}`);
    else if (hi !== '') push(`filter:${maxK}`, `${label} ≤ ${hi}`);
  }

  if (Array.isArray(f.mistakes) && f.mistakes.length) push('filter:mistakes', `Mistakes: ${f.mistakes.join(' OR ')}`);
  if (query) push('query', `Search: “${query}”`);
  if (favoritesOnly) push('favorites', 'Favorites only');

  return chips;
}