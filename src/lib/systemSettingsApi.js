// Public and client-side system settings accessor module.
//
// Allows normal users and unauthenticated guests to read public platform
// settings (e.g. registration_enabled, public_app_name, default_timezone)
// governed by Row Level Security (RLS Policy: "Public read for public system settings").
//
// Never exposes private/admin-only configuration keys.

import { supabase } from './supabase';

export const DEFAULT_PUBLIC_SETTINGS = {
  public_app_name: 'EdgeJournal',
  public_support_email: 'support@edgejournal.com',
  default_timezone: 'America/New_York',
  default_currency: 'USD',
  registration_enabled: true,
  maintenance_mode: false,
  ai_enabled: true,
  ai_provider: 'gemini',
  ai_maintenance_mode: false,
  ai_daily_limit_pro: 50,
  ai_daily_limit_free: 0,
  ai_model: 'gemini-3.5-flash-lite',
};

/**
 * Fetches all public settings visible to standard or anonymous callers.
 * Returns an object dictionary of key -> value.
 */
export async function fetchPublicSystemSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value, description, is_public')
      .eq('is_public', true);

    if (error) throw error;

    const settingsMap = { ...DEFAULT_PUBLIC_SETTINGS };
    (data || []).forEach((row) => {
      settingsMap[row.key] = row.value;
    });

    return settingsMap;
  } catch (err) {
    console.warn('Public settings query note (using defaults):', err?.message);
    return { ...DEFAULT_PUBLIC_SETTINGS };
  }
}

/**
 * Fetches a single public system setting value by key, with a provided fallback.
 */
export async function fetchPublicSetting(key, fallback = null) {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .eq('is_public', true)
      .maybeSingle();

    if (error) throw error;
    if (data?.value !== undefined && data.value !== null) {
      return data.value;
    }

    if (DEFAULT_PUBLIC_SETTINGS[key] !== undefined) {
      return DEFAULT_PUBLIC_SETTINGS[key];
    }

    return fallback;
  } catch (err) {
    console.warn(`Public setting fetch note for "${key}" (using fallback):`, err?.message);
    return DEFAULT_PUBLIC_SETTINGS[key] !== undefined ? DEFAULT_PUBLIC_SETTINGS[key] : fallback;
  }
}
