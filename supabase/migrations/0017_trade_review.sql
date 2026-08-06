-- Adds the closed-trade Review & Reflection checklist to `public.trades`.
-- A trade's review completion is stored as a jsonb map keyed by review item id
-- (beforeScreenshot, afterScreenshot, reviewSummary, lessonLearned,
-- emotionReflection), each boolean.

alter table public.trades
  add column if not exists review jsonb not null default '{}'::jsonb;