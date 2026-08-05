-- EdgeJournal — Account Balance Engine (Phase: persistence layer)
--
-- Keeps the `public.accounts` equity statistics truthful in Supabase so the
-- stored row always matches what the client derives from real trade history.
-- On every trade insert/update/delete a trigger recomputes the owning
-- account's stats from that account's actual trades (+ its starting balance):
--
--   current_balance  = starting_balance + sum(trades.net_pnl)
--   net_profit       = sum(trades.net_pnl)
--   net_pct          = net_profit / starting_balance * 100
--   peak_balance     = highest running balance ever reached (incl. starting)
--   drawdown         = peak_balance - current_balance   (current, absolute)
--   drawdown_pct     = drawdown / peak_balance * 100
--   max_drawdown     = deepest peak-to-trough during the life of the account
--
-- The file is additive and idempotent — safe to re-run, never breaks existing
-- rows, RLS, or the client's read/write flow. Existing accounts are back-filled
-- in the trailing block. The client (src/lib/accountStats.js + useAccounts.js)
-- mirrors these numbers live so the UI updates instantly and offline; this
-- migration just guarantees the persisted value is real too.

-- ============================================================
-- Derived equity columns on accounts
-- ============================================================

alter table public.accounts
  add column if not exists net_profit     numeric not null default 0,
  add column if not exists net_pct        numeric not null default 0,
  add column if not exists peak_balance   numeric not null default 0,
  add column if not exists drawdown       numeric not null default 0,
  add column if not exists drawdown_pct   numeric not null default 0,
  add column if not exists max_drawdown   numeric not null default 0;

-- ============================================================
-- Recalculation helper (single source of truth for the math)
-- ============================================================

create or replace function public.recalculate_account_stats(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starting      numeric;
  v_current       numeric;
  v_net_profit    numeric;
  v_peak          numeric;
  v_running       numeric := 0;
  v_max_drawdown  numeric := 0;
  v_drawdown      numeric;
  r               record;
begin
  select coalesce(starting_balance, 0)
    into v_starting
    from public.accounts
   where id = p_account_id;

  if v_starting is null then
    -- Account row is gone (deleted between trigger fire and here) — nothing to do.
    return;
  end if;

  v_peak := v_starting;
  v_running := v_starting;

  for r in
    select coalesce(net_pnl, 0) as pnl
      from public.trades
     where account_id = p_account_id
     order by date asc, entry_time asc nulls last, created_at asc
  loop
    v_running := v_running + r.pnl;
    v_net_profit := v_net_profit + r.pnl;
    if v_running > v_peak then
      v_peak := v_running;
    end if;
    if (v_peak - v_running) > v_max_drawdown then
      v_max_drawdown := v_peak - v_running;
    end if;
  end loop;

  v_current    := v_starting + coalesce(v_net_profit, 0);
  v_drawdown   := v_peak - v_current;

  update public.accounts
     set current_balance = v_current,
         net_profit      = coalesce(v_net_profit, 0),
         net_pct         = case when v_starting > 0 then (coalesce(v_net_profit, 0) / v_starting) * 100 else 0 end,
         peak_balance    = v_peak,
         drawdown        = v_drawdown,
         drawdown_pct    = case when v_peak > 0 then (v_drawdown / v_peak) * 100 else 0 end,
         max_drawdown    = v_max_drawdown
   where id = p_account_id;
end;
$$;

revoke all on function public.recalculate_account_stats(uuid) from public;
grant execute on function public.recalculate_account_stats(uuid) to authenticated;

-- ============================================================
-- Triggers: recalc the owning account(s) on every trade change
-- ============================================================

create or replace function public.trades_recalc_account_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recompute the (possibly two) affected accounts. An UPDATE that moves a
  -- trade between accounts must refresh both the old and the new owner.
  perform public.recalculate_account_stats(OLD.account_id)
    where OLD.account_id is not null and (TG_OP = 'UPDATE' or TG_OP = 'DELETE');
  perform public.recalculate_account_stats(NEW.account_id)
    where NEW.account_id is not null;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trades_recalc_account_stats on public.trades;
create trigger trades_recalc_account_stats
  after insert or update or delete on public.trades
  for each row execute procedure public.trades_recalc_account_stats();

-- ============================================================
-- Back-fill existing accounts on apply
-- ============================================================

do $$
declare
  r record;
begin
  for r in select id from public.accounts loop
    perform public.recalculate_account_stats(r.id);
  end loop;
end $$;