-- EdgeJournal — Multiple Account Management (Phase 1: backend)
--
-- Introduces a many-accounts-per-user model:
--   1. A new `public.accounts` table (one row per trading account).
--   2. An `account_id` column on `public.trades` so every trade belongs
--      to exactly one account (existing rows are back-filled to that
--      user's default account — no trade is ever lost).
--   3. Foreign keys, indexes, RLS, and two helper functions:
--        - ensure_default_account(user_id): idempotent guaranteed default
--          account + back-fill of account-less trades (used at signup and
--          by the one-time back-fill block below).
--        - set_default_account(user_id, account_id): atomic "make this my
--          default" that clears the others first.
--
-- The whole file is written to be idempotent so it is safe to re-run
-- (via SQL editor or `supabase db push`) — existing users only ever get
-- one default account and their trades are moved into it once.

-- ============================================================
-- accounts
-- ============================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null,
  broker text,
  account_type text,
  platform text,
  starting_balance numeric not null default 0,
  current_balance numeric not null default 0,
  currency text not null default 'USD',
  status text not null default 'active',
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One default account per user, guaranteed by a partial unique index
-- (only rows where is_default = true are constrained). set_default_account
-- clears the previous default before setting a new one so this index is
-- never violated by normal flow.
create unique index if not exists accounts_unique_default_idx
  on public.accounts (user_id)
  where is_default;

create index if not exists accounts_user_id_idx
  on public.accounts (user_id);

-- Data validity: a default account is always 'active'; keep the status
-- column to a closed set.
alter table public.accounts
  drop constraint if exists accounts_status_check,
  add constraint accounts_status_check check (status in ('active', 'inactive', 'archived'));

-- Generic updated_at trigger (function defined in 0001; re-declared here
-- idempotently so this migration stays self-contained if run standalone).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute procedure public.set_updated_at();

-- Row Level Security: every user can only ever see/change their own rows.
alter table public.accounts enable row level security;

drop policy if exists "Users can view their own accounts" on public.accounts;
create policy "Users can view their own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own accounts" on public.accounts;
create policy "Users can insert their own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own accounts" on public.accounts;
create policy "Users can update their own accounts"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own accounts" on public.accounts;
create policy "Users can delete their own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- ============================================================
-- trades.account_id
-- ============================================================

-- `on delete restrict` guarantees no trade is ever silently dropped
-- when its account is removed — deletion fails (and the service layer
-- can move/notify) rather than losing data.
alter table public.trades
  add column if not exists account_id uuid references public.accounts (id) on delete restrict;

create index if not exists trades_account_id_idx
  on public.trades (account_id);

-- Composite index matching the new read path (scope by user + account).
create index if not exists trades_user_id_account_id_date_idx
  on public.trades (user_id, account_id, date desc);

-- The existing trade RLS policies (owner-only, keyed on user_id) already
-- cover the added column — no policy change required.

-- ============================================================
-- Helper functions
-- ============================================================

-- Ensures a user has exactly one default account, creating it lazily if
-- none exists (reusing/ promoting an existing account before ever making
-- a duplicate), then back-fills any trades missing an account into it.
-- Returns the id of the default account. Idempotent and safe to call on
-- every sign-in / app boot.
create or replace function public.ensure_default_account(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  -- Reuse the current default if one already exists.
  select id into v_account
  from public.accounts
  where user_id = p_user_id and is_default
  limit 1;

  if v_account is null then
    -- No default yet: promote the user's oldest account rather than
    -- creating a duplicate, OR create the very first one if they have none.
    select id into v_account
    from public.accounts
    where user_id = p_user_id
    order by created_at asc
    limit 1;

    if v_account is not null then
      update public.accounts
      set is_default = true
      where id = v_account;
    else
      insert into public.accounts (user_id, name, starting_balance, current_balance, is_default)
      values (p_user_id, 'My Trading Account', 0, 0, true)
      returning id into v_account;
    end if;
  end if;

  -- Move every trade that still has no account into this user's default.
  update public.trades
  set account_id = v_account
  where user_id = p_user_id
    and account_id is null;

  return v_account;
end;
$$;

revoke all on function public.ensure_default_account(uuid) from public;
grant execute on function public.ensure_default_account(uuid) to authenticated;

-- Atomically makes a user's given account their default, clearing the
-- previous default in the same statement so the partial unique index is
-- never violated. Raises if the target account doesn't belong to them.
create or replace function public.set_default_account(p_user_id uuid, p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = p_user_id
  ) then
    raise exception 'Account not found for this user.';
  end if;

  update public.accounts
  set is_default = false
  where user_id = p_user_id;

  update public.accounts
  set is_default = true
  where id = p_account_id and user_id = p_user_id;
end;
$$;

revoke all on function public.set_default_account(uuid, uuid) from public;
grant execute on function public.set_default_account(uuid, uuid) to authenticated;

-- ============================================================
-- One-time back-fill for EXISTING users
-- ============================================================

-- Runs when the migration is applied: every existing auth user gets a
-- default account and their existing trades are moved into it. Both
-- operations are idempotent (ensure_default_account checks first), so
-- re-running the migration never creates a second account and never
-- touches a trade that already has an account.
do $$
declare
  r record;
begin
  for r in select id from auth.users loop
    perform public.ensure_default_account(r.id);
  end loop;
end $$;

-- ============================================================
-- New signups: ensure a default account exists
-- ============================================================

-- 0001 already created an `on_auth_user_created` trigger that calls
-- `handle_new_user()` to build the `profiles` row. Re-declare that
-- function (idempotent) so it now ALSO guarantees a default account for
-- the brand-new user, then back-fills any trades (none yet) — all via
-- the same idempotent ensure_default_account helper.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  perform public.ensure_default_account(new.id);

  return new;
end;
$$;