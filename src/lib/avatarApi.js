// Avatar Upload module. Handles the Supabase Storage side (upload,
// replace, public URL) and stamps the result onto public.profiles via
// updateProfile() from profileApi.js — same "keep the row shape out of
// the rest of the app" pattern as the other *Api.js files.

import { supabase } from './supabase';
import { updateProfile } from './profileApi';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ACCEPTED_LABEL = 'JPG, PNG, or WEBP';

function assertValidFile(file) {
  if (!file) throw new Error('No file selected.');

  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    throw new Error(`Unsupported file type. Please upload a ${ACCEPTED_LABEL} image.`);
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Image is too large. Maximum size is 5 MB.');
  }
  return ext;
}

// Removes any existing file(s) in the user's avatar folder. Needed
// because a new upload can arrive with a different extension than the
// old one (e.g. replacing avatar.jpg with avatar.png) — uploading with
// upsert alone wouldn't clean up the old file in that case.
async function removeExistingAvatar(userId) {
  const { data: existing, error: listError } = await supabase.storage.from('avatars').list(userId);
  if (listError) throw listError;
  if (!existing?.length) return;

  const paths = existing.map((f) => `${userId}/${f.name}`);
  const { error: removeError } = await supabase.storage.from('avatars').remove(paths);
  if (removeError) throw removeError;
}

// Uploads a new avatar for `userId`, replacing any previous one, then
// updates public.profiles.avatar_url to point at it. Returns the
// updated app-shape profile (see fromProfileRow in profileApi.js).
export async function uploadAvatar(userId, file) {
  if (!userId) throw new Error('uploadAvatar requires a userId');
  const ext = assertValidFile(file);

  await removeExistingAvatar(userId);

  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path);

  // Cache-bust so the browser doesn't keep showing a stale image after
  // a same-extension replacement (the storage path itself doesn't
  // change, only the file's contents).
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;

  return updateProfile(userId, { avatarUrl: versionedUrl });
}
