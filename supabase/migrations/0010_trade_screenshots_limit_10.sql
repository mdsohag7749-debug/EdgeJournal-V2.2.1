-- Raises the trade_screenshots per-trade limit from 5 to 10, to match
-- the new client-side MAX_SCREENSHOTS_PER_TRADE in
-- src/lib/screenshotApi.js. Replaces only the existing trigger
-- function's body (same function/trigger names) — no table, column,
-- or policy is touched.

create or replace function public.enforce_trade_screenshot_limit()
returns trigger
language plpgsql
as $$
declare
  existing_count int;
begin
  select count(*) into existing_count
  from public.trade_screenshots
  where trade_id = new.trade_id;

  if existing_count >= 10 then
    raise exception 'Each trade can have at most 10 screenshots.';
  end if;

  return new;
end;
$$;
