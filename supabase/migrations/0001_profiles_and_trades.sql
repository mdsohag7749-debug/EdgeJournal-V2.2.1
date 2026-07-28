-- EdgeJournal v2.2.2 — first database integration
-- Creates `profiles` and `trades`, both protected by Row Level Security
-- so every authenticated user can only ever see/change their own rows.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- profiles
-- One row per auth user. Auto-created by a trigger on signup so the
-- app never has to remember to insert one itself.
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by their owner" on public.profiles;
create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up. Reads the
-- `full_name` the Register page already sends via
-- supabase.auth.signUp({ options: { data: { full_name } } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Generic "touch updated_at" trigger, reused by both tables below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- trades
-- Mirrors the trade shape used throughout the app (see
-- src/lib/tradesApi.js for the camelCase <-> snake_case mapping and
-- src/pages/panels/TradeFormPanel.jsx for the form that produces it).
-- ============================================================

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  date date not null,
  entry_time text,
  exit_time text,
  instrument text,
  model text,
  protocol text,

  entry_price numeric,
  exit_price numeric,
  contracts numeric,
  net_pnl numeric,
  commission numeric,
  result text not null default 'Win',

  plan_id text,
  rating smallint not null default 5,

  risk_checklist jsonb not null default '{}'::jsonb,
  trade_checklist jsonb not null default '{}'::jsonb,

  confluences text,
  trade_management text,
  notes text,
  screenshot text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_user_id_date_idx on public.trades (user_id, date desc);

alter table public.trades enable row level security;

drop policy if exists "Users can view their own trades" on public.trades;
create policy "Users can view their own trades"
  on public.trades for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own trades" on public.trades;
create policy "Users can insert their own trades"
  on public.trades for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own trades" on public.trades;
create policy "Users can update their own trades"
  on public.trades for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own trades" on public.trades;
create policy "Users can delete their own trades"
  on public.trades for delete
  using (auth.uid() = user_id);

drop trigger if exists set_trades_updated_at on public.trades;
create trigger set_trades_updated_at
  before update on public.trades
  for each row execute procedure public.set_updated_at();
