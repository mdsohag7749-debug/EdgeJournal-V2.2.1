-- Adds three new, nullable columns to the existing `public.trades` table
-- to support the Trade Direction, Session, and Timeframe fields added to
-- the Trade Entry form. Purely additive: no existing column, constraint,
-- policy, or table is modified or dropped.

alter table public.trades
  add column if not exists direction text,
  add column if not exists session text,
  add column if not exists timeframe text;
