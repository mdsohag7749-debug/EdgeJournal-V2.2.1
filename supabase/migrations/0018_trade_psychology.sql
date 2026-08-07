-- Adds the Trading Psychology emotion scores to `public.trades`.
-- A trade's psychology is stored as a jsonb map keyed by emotion name
-- (Confidence, Patience, Focus, Fear, Greed, FOMO, Revenge, Stress), each a
-- 1–5 integer rating captured in the trade form and used by Emotion Analytics.

alter table public.trades
  add column if not exists psychology jsonb not null default '{}'::jsonb;