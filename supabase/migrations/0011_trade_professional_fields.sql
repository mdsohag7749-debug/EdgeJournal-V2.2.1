-- Adds columns for professional trade risk management and review fields
-- (Stop Loss, Take Profit, Risk %, RR, Position Size, Trade Grade, Emotion,
-- Mistakes checklist, Lessons Learned) to `public.trades`.

alter table public.trades
  add column if not exists stop_loss numeric,
  add column if not exists take_profit numeric,
  add column if not exists risk_percent numeric,
  add column if not exists rr numeric,
  add column if not exists position_size numeric,
  add column if not exists trade_grade text,
  add column if not exists emotion text,
  add column if not exists mistakes jsonb not null default '{}'::jsonb,
  add column if not exists lessons_learned text;
