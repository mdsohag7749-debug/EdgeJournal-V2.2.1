// Supabase Client for React Native / Expo
import { createClient } from '@supabase/supabase-js';
import { storageService } from './storageService';
import { logger } from '../utils/logger';

let extra: Record<string, any> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants');
  const expoConstants = Constants?.default || Constants;
  extra = expoConstants?.expoConfig?.extra || expoConstants?.manifest?.extra || {};
} catch {
  extra = {};
}

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '').trim();
const rawKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '').trim();
const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || 'https://edgejournal.app').trim();

// Determine if Supabase is properly configured with a real HTTPS endpoint
const isMockUrl = !rawUrl || rawUrl.includes('mock-supabase.edgejournal.internal') || rawUrl.includes('placeholder');
const isMockKey = !rawKey || rawKey === 'mock-anon-key' || rawKey === 'placeholder';
export const isSupabaseConfigured = Boolean(!isMockUrl && !isMockKey && rawUrl.startsWith('https://'));

// Safe diagnostic reporting (zero credentials logged)
let urlHostname = 'none';
if (rawUrl) {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    urlHostname = parsed.hostname;
  } catch {
    urlHostname = 'invalid-url-format';
  }
}

logger.info('SYSTEM', 'Supabase Environment Configuration', {
  'SUPABASE_URL configured': Boolean(rawUrl && !isMockUrl),
  'SUPABASE_ANON_KEY configured': Boolean(rawKey && !isMockKey),
  'SUPABASE_URL hostname': urlHostname,
  'API_BASE_URL': apiBase,
});

if (!isSupabaseConfigured) {
  logger.warn(
    'AUTH',
    'Supabase configuration missing or invalid. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in EAS / environment.'
  );
}

// Ensure valid URL format for createClient to avoid top-level module crash
const clientUrl = isSupabaseConfigured ? rawUrl : 'https://unconfigured.supabase.co';
const clientKey = isSupabaseConfigured ? rawKey : 'unconfigured-anon-key';

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    storage: {
      getItem: (key) => storageService.getItem(key),
      setItem: (key, value) => storageService.setItem(key, value),
      removeItem: (key) => storageService.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

