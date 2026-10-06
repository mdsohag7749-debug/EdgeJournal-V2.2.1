// Trade Screenshot Service for Mobile — Supabase Storage & Database integration
// Uses the private `trade-screenshots` bucket and `public.trade_screenshots` table.

import { supabase } from './supabase';
import { TradeScreenshot, StagedScreenshot } from '../types/models';
import { logger } from '../utils/logger';

const BUCKET = 'trade-screenshots';
export const MAX_SCREENSHOTS_PER_TRADE = 10;
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10 MB
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export function validateImageFile(fileName?: string, mimeType?: string, fileSize?: number): string {
  // Reject SVG explicitly
  if (mimeType?.toLowerCase().includes('svg') || fileName?.toLowerCase().endsWith('.svg')) {
    throw new Error('SVG images are not supported. Please choose a JPG, PNG, or WEBP image.');
  }

  // Validate extension
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() : '';
  const mimeExt = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const effectiveExt = ext && ALLOWED_EXTENSIONS.includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : mimeExt;

  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    throw new Error('Unsupported image format. Please use JPG, PNG, or WEBP.');
  }

  if (fileSize && fileSize > MAX_SCREENSHOT_BYTES) {
    throw new Error('Image is too large. Maximum size is 10 MB.');
  }

  return effectiveExt || 'jpg';
}

function rowToScreenshot(row: any): TradeScreenshot {
  return {
    id: row.id,
    tradeId: row.trade_id,
    userId: row.user_id,
    storagePath: row.storage_path,
    fileName: row.file_name || '',
    fileSize: Number(row.file_size) || 0,
    createdAt: row.created_at,
    url: null,
  };
}

async function attachSignedUrls(screenshots: TradeScreenshot[]): Promise<TradeScreenshot[]> {
  if (!screenshots.length) return screenshots;
  try {
    const paths = screenshots.map((s) => s.storagePath);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (error) {
      logger.warn('SYSTEM', 'Failed to generate signed URLs for screenshots', { error: error.message });
      return screenshots;
    }

    const urlByPath = new Map((data || []).map((d: any) => [d.path, d.signedUrl]));
    return screenshots.map((s) => ({
      ...s,
      url: urlByPath.get(s.storagePath) || null,
    }));
  } catch (err: any) {
    logger.warn('SYSTEM', 'Error in attachSignedUrls', { error: err.message || err });
    return screenshots;
  }
}

export const screenshotService = {
  async listScreenshots(tradeId: string): Promise<TradeScreenshot[]> {
    if (!tradeId) return [];
    try {
      const { data, error } = await supabase
        .from('trade_screenshots')
        .select('*')
        .eq('trade_id', tradeId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('DATA', 'Failed to fetch trade screenshots', { error: error.message });
        return [];
      }

      const mapped = (data || []).map(rowToScreenshot);
      return await attachSignedUrls(mapped);
    } catch (err: any) {
      logger.warn('DATA', 'Error listing screenshots', { error: err.message || err });
      return [];
    }
  },

  async uploadScreenshot(
    userId: string,
    tradeId: string,
    fileUri: string,
    fileName?: string,
    mimeType?: string,
    fileSize?: number
  ): Promise<TradeScreenshot> {
    if (!userId) throw new Error('User is not authenticated.');
    if (!tradeId) throw new Error('Trade ID is required for upload.');

    const ext = validateImageFile(fileName, mimeType, fileSize);
    const safeMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    // Verify limit
    const { count, error: countError } = await supabase
      .from('trade_screenshots')
      .select('id', { count: 'exact', head: true })
      .eq('trade_id', tradeId);

    if (countError) throw countError;
    if ((count || 0) >= MAX_SCREENSHOTS_PER_TRADE) {
      throw new Error(`Each trade can have at most ${MAX_SCREENSHOTS_PER_TRADE} screenshots.`);
    }

    // Generate path
    const randomId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const storagePath = `${userId}/${tradeId}/${randomId}.${ext}`;

    // Read binary data from file URI
    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: safeMime,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      logger.warn('SYSTEM', 'Upload to storage failed', { error: uploadError.message });
      throw uploadError;
    }

    // Record in public.trade_screenshots table
    const { data: row, error: insertError } = await supabase
      .from('trade_screenshots')
      .insert({
        trade_id: tradeId,
        user_id: userId,
        storage_path: storagePath,
        file_name: fileName || `screenshot.${ext}`,
        file_size: fileSize || arrayBuffer.byteLength || 0,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up orphaned storage object
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw insertError;
    }

    const mapped = rowToScreenshot(row);
    const [withUrl] = await attachSignedUrls([mapped]);
    return withUrl;
  },

  async uploadStagedScreenshots(
    userId: string,
    tradeId: string,
    stagedScreenshots: StagedScreenshot[]
  ): Promise<TradeScreenshot[]> {
    if (!userId || !tradeId || !stagedScreenshots.length) return [];
    const uploaded: TradeScreenshot[] = [];
    const toUpload = stagedScreenshots.slice(0, MAX_SCREENSHOTS_PER_TRADE);

    for (const staged of toUpload) {
      try {
        const item = await this.uploadScreenshot(
          userId,
          tradeId,
          staged.uri,
          staged.fileName,
          staged.mimeType,
          staged.fileSize
        );
        uploaded.push(item);
      } catch (err: any) {
        logger.warn('SYSTEM', `Failed to upload staged screenshot ${staged.fileName}`, { error: err.message || err });
      }
    }
    return uploaded;
  },

  async deleteScreenshot(screenshot: TradeScreenshot): Promise<void> {
    if (!screenshot?.storagePath) return;

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([screenshot.storagePath]);
    if (removeError) {
      logger.warn('SYSTEM', 'Failed to remove object from storage', { error: removeError.message });
      throw removeError;
    }

    const { error: deleteError } = await supabase
      .from('trade_screenshots')
      .delete()
      .eq('id', screenshot.id);

    if (deleteError) {
      logger.warn('DATA', 'Failed to delete row from trade_screenshots', { error: deleteError.message });
      throw deleteError;
    }
  },
};
