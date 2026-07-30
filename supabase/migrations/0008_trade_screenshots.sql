-- EdgeJournal — Trade Screenshot Upload module
-- Creates the `trade-screenshots` Storage bucket, the
-- `public.trade_screenshots` tracking table, and the RLS policies that
-- let a user manage only their own trades' screenshots.
--
-- File layout inside the bucket: trade-screenshots/{auth.uid()}/{trade_id}/{uuid}.{ext}
-- so `(storage.foldername(name))[1]` (the first path segment) is
-- always the owning user's id, and `[2]` is the trade id — that's what
-- the policies below check.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

-- ============================================================
-- Storage bucket
-- ============================================================

-- Unlike `avatars`, this bucket is PRIVATE — trade screenshots are a
-- user's own trading data, not meant to be publicly viewable. The app
-- reads them via short-lived signed URLs (see screenshotApi.js)
-- instead of getPublicUrl(). file_size_limit is in bytes (10 MB).
-- allowed_mime_types is enforced by Storage itself as a second layer,
-- on top of the client-side check in screenshotApi.js.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by default in Supabase.

drop policy if exists "Users can view their own trade screenshots" on storage.objects;
create policy "Users can view their own trade screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own trade screenshots" on storage.objects;
create policy "Users can upload their own trade screenshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Needed for replace-in-place (upsert) even though the app currently
-- uploads replacements under a fresh filename; kept for parity with
-- the avatars policy set and future-proofing.
drop policy if exists "Users can update their own trade screenshots" on storage.objects;
create policy "Users can update their own trade screenshots"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own trade screenshots" on storage.objects;
create policy "Users can delete their own trade screenshots"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- trade_screenshots
-- One row per uploaded image, so the gallery has a stable, orderable
-- source of truth instead of relying on storage.list() folder scans.
-- ============================================================

create table if not exists public.trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  storage_path text not null unique,
  file_name text,
  file_size bigint,

  created_at timestamptz not null default now()
);

create index if not exists trade_screenshots_trade_id_idx on public.trade_screenshots (trade_id);
create index if not exists trade_screenshots_user_id_idx on public.trade_screenshots (user_id);

alter table public.trade_screenshots enable row level security;

drop policy if exists "Users can view their own trade screenshots rows" on public.trade_screenshots;
create policy "Users can view their own trade screenshots rows"
  on public.trade_screenshots for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own trade screenshots rows" on public.trade_screenshots;
create policy "Users can insert their own trade screenshots rows"
  on public.trade_screenshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own trade screenshots rows" on public.trade_screenshots;
create policy "Users can delete their own trade screenshots rows"
  on public.trade_screenshots for delete
  using (auth.uid() = user_id);

-- Server-side backstop for the 0-5-per-trade rule enforced client-side
-- in screenshotApi.js — defense in depth against a race between two
-- concurrent uploads (e.g. two browser tabs).
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

  if existing_count >= 5 then
    raise exception 'Each trade can have at most 5 screenshots.';
  end if;

  return new;
end;
$$;

drop trigger if exists trade_screenshots_limit_check on public.trade_screenshots;
create trigger trade_screenshots_limit_check
  before insert on public.trade_screenshots
  for each row execute procedure public.enforce_trade_screenshot_limit();
