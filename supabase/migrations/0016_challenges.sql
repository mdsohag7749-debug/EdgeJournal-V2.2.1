-- EdgeJournal — Challenge Tracker Pro
--
-- Creates `public.challenges` for prop firm challenge tracking.
-- Each challenge is tied to a user and optionally to a specific trading account.
-- Challenge status is calculated client-side from real trade data.
--
-- Run in Supabase SQL Editor or via `supabase db push`.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  prop_firm text not null default '',
  account_id uuid references public.accounts (id) on delete set null,
  challenge_type text not null default 'Custom',
  starting_balance numeric not null default 0,
  profit_target numeric not null default 0,
  daily_drawdown numeric not null default 0,
  maximum_drawdown numeric not null default 0,
  min_trading_days integer not null default 0,
  start_date date,
  end_date date,
  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists challenges_user_id_idx
  on public.challenges (user_id);

create index if not exists challenges_account_id_idx
  on public.challenges (account_id);

create index if not exists challenges_status_idx
  on public.challenges (status);

alter table public.challenges enable row level security;

drop policy if exists "Users can view their own challenges" on public.challenges;
create policy "Users can view their own challenges"
  on public.challenges for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own challenges" on public.challenges;
create policy "Users can insert their own challenges"
  on public.challenges for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own challenges" on public.challenges;
create policy "Users can update their own challenges"
  on public.challenges for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own challenges" on public.challenges;
create policy "Users can delete their own challenges"
  on public.challenges for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_challenges_updated_at on public.challenges;
create trigger set_challenges_updated_at
  before update on public.challenges
  for each row execute procedure public.set_updated_at();