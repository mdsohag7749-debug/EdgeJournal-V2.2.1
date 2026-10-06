// Key-value storage abstraction with AsyncStorage & fallback
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'njh_';

export const KEYS = {
  trades: `${PREFIX}trades`,
  plans: `${PREFIX}plans`,
  reflections: `${PREFIX}reflections`,
  study: `${PREFIX}study`,
  goals: `${PREFIX}goals`,
  models: `${PREFIX}models`,
  riskCriteria: `${PREFIX}risk_criteria`,
  checklistCriteria: `${PREFIX}checklist_criteria`,
  accountName: `${PREFIX}account_name`,
  tags: `${PREFIX}tags`,
};

let memoryStore: Record<string, string> = {};

export const storageService = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      const val = await AsyncStorage.getItem(key);
      return val ?? memoryStore[key] ?? null;
    } catch {
      return memoryStore[key] ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      await AsyncStorage.setItem(key, value);
      memoryStore[key] = value;
    } catch {
      memoryStore[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      await AsyncStorage.removeItem(key);
      delete memoryStore[key];
    } catch {
      delete memoryStore[key];
    }
  },

  async getJSON<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },
};
