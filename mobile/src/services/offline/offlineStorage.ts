import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

const CACHE_PREFIX = 'ej_mobile_cache';

export const offlineStorage = {
  async saveCache<T>(table: string, userId: string, scope: string, data: T): Promise<void> {
    if (!userId) return;
    const key = `${CACHE_PREFIX}_${userId}_${table}_${scope || 'all'}`;
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ data, savedAt: new Date().toISOString() }));
    } catch (e: any) {
      logger.warn('OFFLINE', `Failed to cache ${table}`, { error: e?.message });
    }
  },

  async loadCache<T>(table: string, userId: string, scope: string): Promise<T | null> {
    if (!userId) return null;
    const key = `${CACHE_PREFIX}_${userId}_${table}_${scope || 'all'}`;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data || null;
    } catch (e: any) {
      logger.warn('OFFLINE', `Failed to load cache for ${table}`, { error: e?.message });
      return null;
    }
  },

  async clearUserCache(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter((k) => k.startsWith(`${CACHE_PREFIX}_${userId}`));
      for (const k of userKeys) {
        await AsyncStorage.removeItem(k);
      }
    } catch (e: any) {
      logger.warn('OFFLINE', 'Failed to clear user cache', { error: e?.message });
    }
  },
};
