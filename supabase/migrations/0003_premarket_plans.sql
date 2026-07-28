-- EdgeJournal v2.2.2 — Pre-Market Plans module migration
-- Creates `premarket_plans`, protected by Row Level Security so every
-- authenticated user can only ever see/change their own plans. Mirrors
-- the `goals` table's pattern from 0002_goals.sql.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- premarket_plans
-- Mirrors the plan shape used throughout the app (see
-- src/lib/plansApi.js for the camelCase <-> snake_case mapping and
-- src/pages/panels/PlanFormPanel.jsx for the form that produces it).
-- ============================================================

create table if not exists public.premarket_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  date date not null,
  bias text not null default 'Neutral',
  economic_events text,
  targets text,
  game_plan text,
  notes text,
  daily_chart text,
  intraday_chart text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists premarket_plans_user_id_idx on public.premarket_plans (user_id);
create index if not exists premarket_plans_user_id_date_idx on public.premarket_plans (user_id, date desc);

alter table public.premarket_plans enable row level security;

drop policy if exists "Users can view their own premarket plans" on public.premarket_plans;
create policy "Users can view their own premarket plans"
  on public.premarket_plans for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own premarket plans" on public.premarket_plans;
create policy "Users can insert their own premarket plans"
  on public.premarket_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own premarket plans" on public.premarket_plans;
create policy "Users can update their own premarket plans"
  on public.premarket_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own premarket plans" on public.premarket_plans;
create policy "Users can delete their own premarket plans"
  on public.premarket_plans for delete
  using (auth.uid() = user_id);

-- Reuses the generic "touch updated_at" trigger function already
-- created in 0001_profiles_and_trades.sql.
drop trigger if exists set_premarket_plans_updated_at on public.premarket_plans;
create trigger set_premarket_plans_updated_at
  before update on public.premarket_plans
  for each row execute procedure public.set_updated_at();
