// Keeps the Supabase row shape (snake_case columns) out of the rest of
// the app, same pattern as tradesApi.js / goalsApi.js / plansApi.js /
// reflectionsApi.js / studyApi.js. `profiles` isn't a per-user
// *collection* like those (it's one row per auth user, keyed by `id`,
// not `user_id`), so it isn't wired through DataContext's generic
// useSupabaseCollection — Profile.jsx calls the two functions below
// directly instead.

import { supabase } from './supabase';

const EDITABLE_TEXT_FIELDS = {
  fullName: 'full_name',
  username: 'username',
  bio: 'bio',
  timezone: 'timezone',
  avatarUrl: 'avatar_url',
};

// Converts an app-shape profile patch into a row ready to update in
// `public.profiles`. Only `id` (from auth, never user-editable) and
// `email` (set at signup, read-only here) are excluded. Pass
// `{ partial: true }` so only the keys present in `profile` are
// included, instead of overwriting untouched columns with null.
export function toProfileRow(profile, { partial = false } = {}) {
  const row = {};
  for (const [jsKey, dbKey] of Object.entries(EDITABLE_TEXT_FIELDS)) {
    if (!partial || jsKey in profile) {
      row[dbKey] = profile[jsKey]?.trim ? profile[jsKey].trim() || null : profile[jsKey] ?? null;
    }
  }
  return row;
}

// Converts a raw `public.profiles` row into the app-shape profile
// object Profile.jsx expects.
export function fromProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || '',
    fullName: row.full_name || '',
    username: row.username || '',
    avatarUrl: row.avatar_url || '',
    bio: row.bio || '',
    timezone: row.timezone || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Fetches the signed-in user's own profile row. RLS restricts this to
// a single row (their own) regardless of the filter, but we still
// scope by id client-side as defense in depth. Returns `null` if the
// row doesn't exist yet (shouldn't normally happen — the
// handle_new_user trigger in 0001 creates it at signup).
export async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return fromProfileRow(data);
}

// Updates the signed-in user's own profile with a partial patch
// (any subset of fullName / username / bio / timezone / avatarUrl).
// Uses upsert so it also works the rare time a profile row is missing.
export async function updateProfile(userId, patch) {
  if (!userId) throw new Error('updateProfile requires a userId');
  const row = toProfileRow(patch, { partial: true });

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...row }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return fromProfileRow(data);
}
