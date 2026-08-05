-- Adds tag and favorite support to `public.trades` for the Trading
-- Journal workspace:
--   - `tags`       text[]  — free-form labels (searchable, quick-edit,
--                            and bulk-editable). Defaults to an empty array.
--   - `is_favorite` boolean — lets users star trades and filter to only
--                            favorites. Defaults to false.
--
-- Both are additive and backward compatible; every existing row simply
-- defaults to no tags / not favorite, and all prior columns are untouched.

alter table public.trades
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists is_favorite boolean not null default false;

-- GIN index so tag searches on large journals stay fast.
create index if not exists trades_tags_gin_idx
  on public.trades using gin (tags);

create index if not exists trades_is_favorite_idx
  on public.trades (is_favorite);