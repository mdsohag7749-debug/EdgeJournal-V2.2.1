// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app. Every component still reads/writes the same camelCase plan
// object it always has (date, bias, economicEvents, gamePlan, ...) —
// only src/context/DataContext.jsx (via these two functions) ever sees
// a raw `premarket_plans` table row. Mirrors src/lib/goalsApi.js.

const TEXT_FIELDS = {
  date: 'date',
  bias: 'bias',
  economicEvents: 'economic_events',
  targets: 'targets',
  gamePlan: 'game_plan',
  notes: 'notes',
  dailyChart: 'daily_chart',
  intradayChart: 'intraday_chart',
};

// Converts an app-shape plan (or partial patch) into a row ready to
// insert/update in `public.premarket_plans`. `userId` is stamped onto
// every write so it always matches the authenticated user (RLS also
// enforces this server-side — this is defense in depth, not the only
// guard). Pass `{ partial: true }` for update() calls so only the keys
// present in `plan` are included, instead of overwriting untouched
// columns with null.
export function toPlanRow(plan, userId, { partial = false } = {}) {
  const row = {};
  if (userId) row.user_id = userId;

  for (const [jsKey, dbKey] of Object.entries(TEXT_FIELDS)) {
    if (!partial || jsKey in plan) {
      row[dbKey] = plan[jsKey] ?? null;
    }
  }

  return row;
}

// Converts a raw `public.premarket_plans` row back into the app-shape
// plan object every page (PreMarketPlan.jsx, PlanFormPanel.jsx,
// TradeFormPanel.jsx, RecentActivity.jsx, Dashboard.jsx) already expects.
export function fromPlanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    bias: row.bias || 'Neutral',
    economicEvents: row.economic_events || '',
    targets: row.targets || '',
    gamePlan: row.game_plan || '',
    notes: row.notes || '',
    dailyChart: row.daily_chart || '',
    intradayChart: row.intraday_chart || '',
    createdAt: row.created_at,
  };
}
