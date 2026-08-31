// Supabase Client for React Native / Expo

import { createClient } from '@supabase/supabase-js';
import { storageService } from './storageService';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mock-supabase.edgejournal.internal';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
