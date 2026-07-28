// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app. Every component still reads/writes the same camelCase goal
// object it always has (title, targetDate, successMetrics, subItems,
// ...) — only src/context/DataContext.jsx (via these two functions)
// ever sees a raw `goals` table row. Mirrors src/lib/tradesApi.js.

const TEXT_FIELDS = {
  title: 'title',
  period: 'period',
  targetDate: 'target_date',
  description: 'description',
  successMetrics: 'success_metrics',
};

// Converts an app-shape goal (or partial patch) into a row ready to
// insert/update in `public.goals`. `userId` is stamped onto every write
// so it always matches the authenticated user (RLS also enforces this
// server-side — this is defense in depth, not the only guard). Pass
// `{ partial: true }` for update() calls so only the keys present in
// `goal` are included, instead of overwriting untouched columns.
export function toGoalRow(goal, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in goal) {
      row[dbKey] = goal[jsKey] ?? null;
    }
  }

  if (!partial || 'subItems' in goal) row.sub_items = goal.subItems || [];
  if (!partial || 'completed' in goal) row.completed = !!goal.completed;

  return row;
}

// Converts a raw `public.goals` row back into the app-shape goal object
// every page (Goals.jsx, GoalFormPanel.jsx) already expects.
export function fromGoalRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || '',
    period: row.period || 'Weekly',
    targetDate: row.target_date || '',
    description: row.description || '',
    successMetrics: row.success_metrics || '',
    subItems: row.sub_items || [],
    completed: !!row.completed,
    createdAt: row.created_at,
  };
}
