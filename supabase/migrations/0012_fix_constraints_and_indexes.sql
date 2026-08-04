-- EdgeJournal v2.2.3 — Constraints and performance indexes migration
-- Enforces data validity on trades and adds missing composite indexes.

-- 1. Check constraints on trades.result and rating
alter table public.trades
  drop constraint if exists trades_result_check,
  add constraint trades_result_check check (result in ('Win', 'Loss', 'BE'));

alter table public.trades
  drop constraint if exists trades_rating_check,
  add constraint trades_rating_check check (rating >= 1 and rating <= 10);

-- 2. Non-negative numeric check constraints on trade metrics
alter table public.trades
  drop constraint if exists trades_prices_positive,
  add constraint trades_prices_positive check (
    (entry_price is null or entry_price >= 0) and
    (exit_price is null or exit_price >= 0) and
    (contracts is null or contracts >= 0) and
    (commission is null or commission >= 0)
  );

-- 3. Composite indexes for fast query filtering
create index if not exists trade_screenshots_trade_id_created_idx
  on public.trade_screenshots (trade_id, created_at asc);

create index if not exists premarket_plans_user_id_date_idx
  on public.premarket_plans (user_id, date desc);

create index if not exists reflections_user_id_date_idx
  on public.reflections (user_id, date desc);

create index if not exists study_notes_user_id_date_idx
  on public.study_notes (user_id, date desc);
