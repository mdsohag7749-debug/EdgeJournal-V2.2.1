// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app. Every component still reads/writes the same camelCase
// reflection object it always has (period, date, rating, title,
// reflection, wentWell, lessons, improvements) — only
// src/context/DataContext.jsx (via these two functions) ever sees a
// raw `reflections` table row. Mirrors src/lib/goalsApi.js and
// src/lib/plansApi.js.

const TEXT_FIELDS = {
  period: 'period',
  date: 'date',
  title: 'title',
  reflection: 'reflection',
  wentWell: 'went_well',
  lessons: 'lessons',
  improvements: 'improvements',
};

// Converts an app-shape reflection (or partial patch) into a row ready
// to insert/update in `public.reflections`. `userId` is stamped onto
// every write so it always matches the authenticated user (RLS also
// enforces this server-side — this is defense in depth, not the only
// guard). Pass `{ partial: true }` for update() calls so only the keys
// present in `reflection` are included, instead of overwriting
// untouched columns with null.
export function toReflectionRow(reflection, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in reflection) {
      row[dbKey] = reflection[jsKey] ?? null;
    }
  }

  if (!partial || 'rating' in reflection) row.rating = Number(reflection.rating) || 5;

  return row;
}

// Converts a raw `public.reflections` row back into the app-shape
// reflection object every page (Reflections.jsx,
// ReflectionFormPanel.jsx) already expects.
export function fromReflectionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    period: row.period || 'Daily',
    date: row.date || '',
    rating: row.rating ?? 5,
    title: row.title || '',
    reflection: row.reflection || '',
    wentWell: row.went_well || '',
    lessons: row.lessons || '',
    improvements: row.improvements || '',
    createdAt: row.created_at,
  };
}
