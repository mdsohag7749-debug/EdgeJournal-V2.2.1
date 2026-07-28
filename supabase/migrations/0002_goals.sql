-- EdgeJournal v2.2.2 — Goals module migration
-- Creates `goals`, protected by Row Level Security so every authenticated
-- user can only ever see/change their own goals. Mirrors the `trades`
-- table's pattern from 0001_profiles_and_trades.sql.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- goals
-- Mirrors the goal shape used throughout the app (see
-- src/lib/goalsApi.js for the camelCase <-> snake_case mapping and
-- src/pages/panels/GoalFormPanel.jsx for the form that produces it).
-- ============================================================

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text,
  period text not null default 'Weekly',
  target_date date,
  description text,
  success_metrics text,
  sub_items jsonb not null default '[]'::jsonb,
  completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists goals_user_id_created_at_idx on public.goals (user_id, created_at desc);

alter table public.goals enable row level security;

drop policy if exists "Users can view their own goals" on public.goals;
create policy "Users can view their own goals"
  on public.goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own goals" on public.goals;
create policy "Users can insert their own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own goals" on public.goals;
create policy "Users can update their own goals"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Users can delete their own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- Reuses the generic "touch updated_at" trigger function already
-- created in 0001_profiles_and_trades.sql.
drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
  before update on public.goals
  for each row execute procedure public.set_updated_at();
