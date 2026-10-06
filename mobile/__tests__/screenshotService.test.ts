import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateImageFile,
  MAX_SCREENSHOTS_PER_TRADE,
  MAX_SCREENSHOT_BYTES,
  screenshotService,
} from '../src/services/screenshotService';

// Mock Supabase client
vi.mock('../src/services/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
    },
  };
});

import { supabase } from '../src/services/supabase';

describe('Mobile Screenshot Service (screenshotService.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateImageFile', () => {
    it('validates JPG, PNG, and WEBP formats and returns extension', () => {
      expect(validateImageFile('chart.jpg', 'image/jpeg', 1024)).toBe('jpg');
      expect(validateImageFile('chart.png', 'image/png', 1024)).toBe('png');
      expect(validateImageFile('chart.webp', 'image/webp', 1024)).toBe('webp');
    });

    it('rejects SVG files with an explicit error', () => {
      expect(() => validateImageFile('chart.svg', 'image/svg+xml', 1024)).toThrow(
        /SVG images are not supported/i
      );
    });

    it('rejects files exceeding 10MB', () => {
      expect(() =>
        validateImageFile('chart.png', 'image/png', MAX_SCREENSHOT_BYTES + 100)
      ).toThrow(/too large/i);
    });

    it('rejects unsupported MIME types', () => {
      expect(() => validateImageFile('doc.pdf', 'application/pdf', 1024)).toThrow(
        /Unsupported image format/i
      );
    });
  });

  describe('listScreenshots', () => {
    it('fetches trade screenshots and attaches signed URLs', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          {
            id: 's1',
            trade_id: 't1',
            user_id: 'u1',
            storage_path: 'u1/t1/pic1.jpg',
            file_name: 'pic1.jpg',
            file_size: 2048,
            created_at: '2026-09-01T10:00:00Z',
          },
        ],
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from = vi.fn().mockReturnValue({ select: mockSelect });

      const mockCreateSignedUrls = vi.fn().mockResolvedValue({
        data: [{ path: 'u1/t1/pic1.jpg', signedUrl: 'https://supabase.co/signed/pic1.jpg' }],
        error: null,
      });

      supabase.storage.from = vi.fn().mockReturnValue({
        createSignedUrls: mockCreateSignedUrls,
      });

      const result = await screenshotService.listScreenshots('t1');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('s1');
      expect(result[0].tradeId).toBe('t1');
      expect(result[0].storagePath).toBe('u1/t1/pic1.jpg');
      expect(result[0].url).toBe('https://supabase.co/signed/pic1.jpg');
    });
  });

  describe('deleteScreenshot', () => {
    it('removes storage object and deletes database row', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      supabase.storage.from = vi.fn().mockReturnValue({ remove: mockRemove });

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from = vi.fn().mockReturnValue({ delete: mockDelete });

      const item = {
        id: 's1',
        tradeId: 't1',
        storagePath: 'u1/t1/pic1.jpg',
        fileName: 'pic1.jpg',
        fileSize: 1024,
        createdAt: '2026-09-01T10:00:00Z',
        url: 'https://url',
      };

      await screenshotService.deleteScreenshot(item);
      expect(mockRemove).toHaveBeenCalledWith(['u1/t1/pic1.jpg']);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 's1');
    });
  });
});
