-- Store a separate close date so overnight and multi-day trades are represented accurately.
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS exit_date date;

-- Historical trades were recorded with a single date, so treat them as same-day trades.
UPDATE public.trades
SET exit_date = date
WHERE exit_date IS NULL;
