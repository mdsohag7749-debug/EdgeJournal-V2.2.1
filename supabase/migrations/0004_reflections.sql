-- EdgeJournal v2.2.2 — Reflections module migration
-- Creates `reflections`, protected by Row Level Security so every
-- authenticated user can only ever see/change their own reflections.
-- Mirrors the `goals` table's pattern from 0002_goals.sql and the
-- `premarket_plans` table's pattern from 0003_premarket_plans.sql.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- reflections
-- Mirrors the reflection shape used throughout the app (see
-- src/lib/reflectionsApi.js for the camelCase <-> snake_case mapping
-- and src/pages/panels/ReflectionFormPanel.jsx for the form that
-- produces it).
-- ============================================================

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  period text not null default 'Daily',
  date date not null,
  rating smallint not null default 5,
  title text,
  reflection text,
  went_well text,
  lessons text,
  improvements text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reflections_user_id_idx on public.reflections (user_id);
create index if not exists reflections_user_id_date_idx on public.reflections (user_id, date desc);

alter table public.reflections enable row level security;

drop policy if exists "Users can view their own reflections" on public.reflections;
create policy "Users can view their own reflections"
  on public.reflections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reflections" on public.reflections;
create policy "Users can insert their own reflections"
  on public.reflections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reflections" on public.reflections;
create policy "Users can update their own reflections"
  on public.reflections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own reflections" on public.reflections;
create policy "Users can delete their own reflections"
  on public.reflections for delete
  using (auth.uid() = user_id);

-- Reuses the generic "touch updated_at" trigger function already
-- created in 0001_profiles_and_trades.sql.
drop trigger if exists set_reflections_updated_at on public.reflections;
create trigger set_reflections_updated_at
  before update on public.reflections
  for each row execute procedure public.set_updated_at();
