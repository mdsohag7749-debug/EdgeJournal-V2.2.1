// Managed tag library for Smart Trade Tags.
//
// A tag is `{ id, name, color }`. The library is the canonical list of
// tags a user can attach to trades; each entry carries a color so tags
// render as distinct colored chips everywhere. The library itself is
// stored per-browser (like trading models & checklists) via DataContext,
// while the tags actually attached to trades are persisted to Supabase on
// the `trades.tags` text[] column — so "save to Supabase" is satisfied by
// the trade rows themselves.
//
// Trades are fully backward compatible: they store tag names as plain
// strings (`text[]`), so trades tagged before this feature, or with tags
// that aren't in the library, keep working — they just render with a
// stable auto-derived color instead of a curated one.

export const TAG_PALETTE = [
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#ef4444',
];

// The twenty-nobody ships with a sensible, curated set of professional
// trade tags so a new journal is usable immediately.
export const DEFAULT_TAGS = [
  { name: 'SMC', color: '#3b82f6' },
  { name: 'ICT', color: '#8b5cf6' },
  { name: 'London', color: '#06b6d4' },
  { name: 'New York', color: '#ef4444' },
  { name: 'Scalp', color: '#f59e0b' },
  { name: 'Swing', color: '#10b981' },
  { name: 'News', color: '#f97316' },
  { name: 'Liquidity Sweep', color: '#14b8a6' },
  { name: 'BOS', color: '#22c55e' },
  { name: 'CHOCH', color: '#a855f7' },
  { name: 'FVG', color: '#0ea5e9' },
  { name: 'Breaker', color: '#ec4899' },
  { name: 'Mitigation', color: '#6366f1' },
  { name: 'A+', color: '#84cc16' },
  { name: 'High Confidence', color: '#f43f5e' },
];

export function hexToRgba(hex, alpha) {
  const h = (hex || '#111827').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(17, 24, 39, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Stable, deterministic color for a tag name — used as a fallback so
// trades with custom/unregistered tags still get a pleasing, consistent
// color chip. Curated library colors (from `library`) always win.
export function colorForTag(name, library) {
  if (Array.isArray(library)) {
    const match = library.find((t) => t && t.name === name);
    if (match && match.color) return match.color;
  }
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}