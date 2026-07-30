// Trade Screenshot Upload module. Handles the Supabase Storage side
// (upload with progress, signed preview URLs, delete, replace) plus
// the `public.trade_screenshots` table that tracks which files belong
// to which trade — same "keep Supabase specifics out of the rest of
// the app" pattern as avatarApi.js / tradesApi.js.
//
// Storage layout: trade-screenshots/{auth.uid()}/{trade_id}/{uuid}.{ext}
// The bucket is PRIVATE (trade screenshots are a user's own trading
// data, not meant to be public like an avatar), so every read goes
// through a short-lived signed URL instead of getPublicUrl().

import { supabase } from './supabase';

const BUCKET = 'trade-screenshots';
export const MAX_SCREENSHOTS_PER_TRADE = 5;
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ACCEPTED_LABEL = 'JPG, PNG, or WEBP';

// Signed URLs are cached for this long — long enough to comfortably
// cover a single form/details session without re-signing on every
// render, short enough that a leaked link doesn't stay valid forever.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function assertValidFile(file) {
  if (!file) throw new Error('No file selected.');
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    throw new Error(`Unsupported file type. Please upload a ${ACCEPTED_LABEL} image.`);
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    throw new Error('Image is too large. Maximum size is 10 MB.');
  }
  return ext;
}

function toScreenshot(row) {
  return {
    id: row.id,
    tradeId: row.trade_id,
    path: row.storage_path,
    fileName: row.file_name || '',
    fileSize: row.file_size || 0,
    createdAt: row.created_at,
    url: null, // filled in by attachSignedUrls()
  };
}

// Batches every row's storage path into a single createSignedUrls()
// call instead of one round-trip per image.
async function attachSignedUrls(screenshots) {
  if (!screenshots.length) return screenshots;
  const paths = screenshots.map((s) => s.path);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const urlByPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  return screenshots.map((s) => ({ ...s, url: urlByPath.get(s.path) || null }));
}

// Returns every screenshot attached to `tradeId`, oldest first, each
// with a fresh signed preview URL.
export async function listScreenshots(tradeId) {
  if (!tradeId) return [];
  const { data, error } = await supabase
    .from('trade_screenshots')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return attachSignedUrls((data || []).map(toScreenshot));
}

// Uploads a signed PUT request directly to Supabase Storage via
// XMLHttpRequest (rather than the supabase-js helper) so we get real
// `progress` events — fetch-based uploads can't reliably report
// upload progress in the browser. onProgress receives 0-100.
function putWithProgress(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('cache-control', '3600');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (status ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(file);
  });
}

// Uploads one screenshot for `tradeId`, enforcing the 0-5 per trade
// limit, then records it in `trade_screenshots`. Returns the new
// screenshot (with a signed `url`) ready to add straight into gallery
// state. `onProgress` (0-100) is optional.
export async function uploadScreenshot(userId, tradeId, file, onProgress) {
  if (!userId) throw new Error('uploadScreenshot requires a userId');
  if (!tradeId) throw new Error('Save the trade before attaching screenshots.');
  const ext = assertValidFile(file);

  const { count, error: countError } = await supabase
    .from('trade_screenshots')
    .select('id', { count: 'exact', head: true })
    .eq('trade_id', tradeId);
  if (countError) throw countError;
  if ((count || 0) >= MAX_SCREENSHOTS_PER_TRADE) {
    throw new Error(`Each trade can have at most ${MAX_SCREENSHOTS_PER_TRADE} screenshots.`);
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${tradeId}/${filename}`;

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signError) throw signError;

  await putWithProgress(signed.signedUrl, file, onProgress);

  const { data: row, error: insertError } = await supabase
    .from('trade_screenshots')
    .insert({
      trade_id: tradeId,
      user_id: userId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
    })
    .select()
    .single();

  if (insertError) {
    // Don't leave an orphaned file in Storage if the DB insert failed
    // (e.g. the 5-per-trade trigger raced with another upload).
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }

  const [withUrl] = await attachSignedUrls([toScreenshot(row)]);
  return withUrl;
}

// Removes both the Storage object and its tracking row. Storage is
// removed first so we never end up with a DB row pointing at a
// deleted file; if Storage fails, the row (and file) are left intact
// so the user can retry rather than silently losing the reference.
export async function deleteScreenshot(screenshot) {
  if (!screenshot?.path) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([screenshot.path]);
  if (removeError) throw removeError;

  const { error: deleteError } = await supabase.from('trade_screenshots').delete().eq('id', screenshot.id);
  if (deleteError) throw deleteError;
}

// Swaps an existing screenshot for a new file: uploads the
// replacement first (so a failed upload never destroys the original),
// then deletes the old one. Returns the new screenshot.
export async function replaceScreenshot(userId, tradeId, oldScreenshot, newFile, onProgress) {
  const uploaded = await uploadScreenshot(userId, tradeId, newFile, onProgress);
  try {
    await deleteScreenshot(oldScreenshot);
  } catch (e) {
    // The replacement succeeded; failing to clean up the old file
    // just leaves one extra screenshot behind rather than losing data.
    console.error('Failed to remove replaced screenshot:', e.message);
  }
  return uploaded;
}

export { ACCEPTED_LABEL as SCREENSHOT_ACCEPTED_LABEL };
