-- EdgeJournal v2.2.2 — Study Notes module migration
-- Creates `study_notes`, protected by Row Level Security so every
-- authenticated user can only ever see/change their own study entries.
-- Mirrors the `reflections` table's pattern from 0004_reflections.sql.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- study_notes
-- Mirrors the study entry shape used throughout the app (see
-- src/lib/studyApi.js for the camelCase <-> snake_case mapping and
-- src/pages/panels/StudyFormPanel.jsx for the form that produces it).
-- ============================================================

create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  date date not null,
  session_type text not null default 'Daily',
  title text,
  description text,
  chart text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_notes_user_id_idx on public.study_notes (user_id);
create index if not exists study_notes_user_id_date_idx on public.study_notes (user_id, date desc);

alter table public.study_notes enable row level security;

drop policy if exists "Users can view their own study notes" on public.study_notes;
create policy "Users can view their own study notes"
  on public.study_notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own study notes" on public.study_notes;
create policy "Users can insert their own study notes"
  on public.study_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own study notes" on public.study_notes;
create policy "Users can update their own study notes"
  on public.study_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own study notes" on public.study_notes;
create policy "Users can delete their own study notes"
  on public.study_notes for delete
  using (auth.uid() = user_id);

-- Reuses the generic "touch updated_at" trigger function already
-- created in 0001_profiles_and_trades.sql.
drop trigger if exists set_study_notes_updated_at on public.study_notes;
create trigger set_study_notes_updated_at
  before update on public.study_notes
  for each row execute procedure public.set_updated_at();
