// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app. Every component still reads/writes the same camelCase study
// entry object it always has (date, sessionType, title, description,
// chart) — only src/context/DataContext.jsx (via these two functions)
// ever sees a raw `study_notes` table row. Mirrors src/lib/reflectionsApi.js
// and src/lib/plansApi.js.

const TEXT_FIELDS = {
  date: 'date',
  sessionType: 'session_type',
  title: 'title',
  description: 'description',
  chart: 'chart',
};

// Converts an app-shape study entry (or partial patch) into a row
// ready to insert/update in `public.study_notes`. `userId` is stamped
// onto every write so it always matches the authenticated user (RLS
// also enforces this server-side — this is defense in depth, not the
// only guard). Pass `{ partial: true }` for update() calls so only the
// keys present in `entry` are included, instead of overwriting
// untouched columns with null.
export function toStudyRow(entry, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in entry) {
      row[dbKey] = entry[jsKey] ?? null;
    }
  }

  return row;
}

// Converts a raw `public.study_notes` row back into the app-shape
// study entry object every page (Study.jsx, StudyFormPanel.jsx)
// already expects.
export function fromStudyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date || '',
    sessionType: row.session_type || 'Daily',
    title: row.title || '',
    description: row.description || '',
    chart: row.chart || '',
    createdAt: row.created_at,
  };
}
