-- EdgeJournal — User Profile module
-- Extends the `public.profiles` table (created in
-- 0001_profiles_and_trades.sql) with the extra fields the Profile page
-- needs. RLS is already enabled on `profiles` with owner-only
-- select/insert/update policies from 0001 — nothing to change there,
-- this migration only adds columns.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists timezone text;

-- Case-insensitive uniqueness so "TraderJoe" and "traderjoe" can't both
-- exist. Partial (where username is not null) so rows created before a
-- user ever sets a username don't collide with each other.
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- profiles.updated_at is already kept current by the set_profiles_updated_at
-- trigger created in 0001_profiles_and_trades.sql — no new trigger needed.
