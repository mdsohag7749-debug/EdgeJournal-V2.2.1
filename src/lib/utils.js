export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Returns the time-of-day greeting for the given IANA timezone, falling
// back to the browser's local timezone when none is provided. Periods:
// Morning 05:00–11:59, Afternoon 12:00–16:59, Evening 17:00–20:59,
// Night 21:00–04:59.
export function timeGreeting(timezone) {
  let hour;
  try {
    if (timezone) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).formatToParts(new Date());
      hour = Number(parts.find((p) => p.type === 'hour')?.value);
    }
  } catch (e) {
    hour = undefined;
  }
  if (Number.isNaN(hour)) hour = new Date().getHours();
  hour = (hour || 0) % 24; // normalize (e.g. some engines report midnight as 24)
  if (hour >= 5 && hour < 12) return { label: 'Morning', emoji: '☀️' };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon', emoji: '🌤️' };
  if (hour >= 17 && hour < 21) return { label: 'Evening', emoji: '🌆' };
  return { label: 'Night', emoji: '🌙' };
}

export function formatMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMoneyShort(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function pnlClass(n) {
  const v = Number(n) || 0;
  if (v > 0) return 'pnl-pos';
  if (v < 0) return 'pnl-neg';
  return 'pnl-flat';
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function resultTagClass(result) {
  if (result === 'Win') return 'tag-win';
  if (result === 'Loss') return 'tag-loss';
  return 'tag-be';
}

// Buy = green (bullish), Sell = red (bearish). The `.tag` class uppercases
// the text, so this renders as BUY / SELL everywhere it's used.
export function directionTagClass(direction) {
  if (direction === 'Buy') return 'tag-win';
  if (direction === 'Sell') return 'tag-loss';
  return 'tag-neutral';
}

// Canonical trading-session windows (entry-hour → session) shared by every
// analytics module. `sessionOf` helpers in each module keep their own
// unparseable fallback ('Unknown' vs null); only the table itself is shared.
export const SESSION_WINDOWS = [
  { session: 'Asia', start: 0, end: 8 },
  { session: 'London', start: 8, end: 13 },
  { session: 'New York', start: 13, end: 21 },
  { session: 'After Hours', start: 21, end: 24 },
];

// Canonical mistake vocabulary, shared between the trade form's mistake
// checkboxes and every analytics module that tallies mistakes — so the form
// and the analytics can never drift apart. Kept in canonical display order.
export const MISTAKE_NAMES = [
  'Late Entry',
  'Early Exit',
  'Moved Stop Loss',
  'No Stop Loss',
  'Over Risk',
  'Counter Trend',
  'News Chase',
  'Over Trading',
  'Missed Plan',
  'Revenge Trade',
  'FOMO Entry',
  'Impatience',
];

// 'YYYY-MM-DD' key for a Date (local calendar).
export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monday ('YYYY-MM-DD') of the week containing `dateStr` — used to bucket
// trades into calendar weeks without pulling in a date library.
export function mondayKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return dateKey(d);
}

// 'YYYY-MM' → "Mon YYYY" (e.g. "2024-03" → "Mar 2024").
export function monthLabel(key) {
  const d = new Date(key + '-01T00:00:00');
  return isNaN(d) ? key : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// 'YYYY-MM-DD' → "Mon d" (e.g. "2024-03-05" → "Mar 5").
export function weekLabel(key) {
  if (!key) return key;
  const d = new Date(key + 'T00:00:00');
  return isNaN(d) ? key : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Resolves a promise but rejects with a timeout error if it doesn't
// settle within `ms`. Keeps a hanging network request from leaving the
// app stuck on a loading screen forever — the caller treats the
// resulting error like being offline (falls back to cache / queue).
export function withTimeout(promise, ms = 15000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
