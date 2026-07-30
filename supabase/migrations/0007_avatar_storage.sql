-- EdgeJournal — Avatar Upload module
-- Creates the `avatars` Storage bucket and the RLS policies on
-- storage.objects that let a user manage only their own avatar files.
--
-- File layout inside the bucket: avatars/{auth.uid()}/avatar.{ext}
-- so `(storage.foldername(name))[1]` (the first path segment) is
-- always the owning user's id — that's what every policy below checks.
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- or via the Supabase CLI: `supabase db push`.

-- Bucket is public so `getPublicUrl()` returns a URL that resolves
-- directly (avatars are meant to be visible wherever a profile is
-- shown), but writes are still locked down by the policies below.
-- file_size_limit is in bytes (5 MB). allowed_mime_types is enforced
-- by Storage itself as a second layer, on top of the client-side check
-- in avatarApi.js.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by default in Supabase.

-- Anyone can view avatars (needed for the public URL to resolve —
-- matches the bucket being public).
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A user may only upload into their own folder: avatars/{their uid}/...
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A user may overwrite (upsert) only their own avatar file.
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A user may delete only their own avatar file (used when replacing an
-- avatar uploaded with a different extension, e.g. .jpg -> .png).
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
