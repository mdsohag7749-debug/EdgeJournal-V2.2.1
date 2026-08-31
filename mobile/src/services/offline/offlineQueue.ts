import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

export interface QueuedMutation {
  id: string;
  tempId: string;
  userId: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  createdAt: string;
}

const QUEUE_STORAGE_KEY = 'ej_mobile_offline_mutation_queue';

export const offlineQueue = {
  async getQueue(userId: string): Promise<QueuedMutation[]> {
    if (!userId) return [];
    try {
      const raw = await AsyncStorage.getItem(`${QUEUE_STORAGE_KEY}_${userId}`);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async enqueue(mutation: Omit<QueuedMutation, 'status' | 'retryCount' | 'createdAt'>): Promise<QueuedMutation> {
    const item: QueuedMutation = {
      ...mutation,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = await this.getQueue(mutation.userId);
      const updated = [...existing, item];
      await AsyncStorage.setItem(`${QUEUE_STORAGE_KEY}_${mutation.userId}`, JSON.stringify(updated));
    } catch (e: any) {
      logger.warn('OFFLINE', 'Failed to enqueue mutation', { table: mutation.table, error: e?.message });
    }
    return item;
  },

  async dequeue(userId: string, tempId: string): Promise<void> {
    try {
      const existing = await this.getQueue(userId);
      const filtered = existing.filter((it) => it.tempId !== tempId);
      await AsyncStorage.setItem(`${QUEUE_STORAGE_KEY}_${userId}`, JSON.stringify(filtered));
    } catch (e: any) {
      logger.warn('OFFLINE', 'Failed to dequeue mutation', { error: e?.message });
    }
  },

  async updateStatus(
    userId: string,
    tempId: string,
    status: 'pending' | 'syncing' | 'failed',
    incrementRetry = false
  ): Promise<void> {
    try {
      const existing = await this.getQueue(userId);
      const updated = existing.map((it) => {
        if (it.tempId === tempId) {
          return {
            ...it,
            status,
            retryCount: incrementRetry ? it.retryCount + 1 : it.retryCount,
          };
        }
        return it;
      });
      await AsyncStorage.setItem(`${QUEUE_STORAGE_KEY}_${userId}`, JSON.stringify(updated));
    } catch (e: any) {
      logger.warn('OFFLINE', 'Failed to update mutation status', { error: e?.message });
    }
  },

  async clearQueue(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${QUEUE_STORAGE_KEY}_${userId}`);
    } catch (e: any) {
      logger.warn('OFFLINE', 'Failed to clear queue', { error: e?.message });
    }
  },
};
