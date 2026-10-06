// Authentication & Profile Service

import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile } from '../types/models';
import { logger } from '../utils/logger';

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in build environment.'
    );
  }
}

export const authService = {
  async getSession() {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!isSupabaseConfigured) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },

  async login(email: string, password: string) {
    return this.signInWithPassword(email, password);
  },

  async register(name: string, email: string, password: string) {
    return this.signUp(email, password, name);
  },

  async logout() {
    return this.signOut();
  },

  async signInWithPassword(email: string, password: string) {
    ensureConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logger.error('AUTH', error, { action: 'signInWithPassword' });
      throw error;
    }
    return data;
  },

  async signUp(email: string, password: string, fullName?: string) {
    ensureConfigured();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
      },
    });
    if (error) {
      logger.error('AUTH', error, { action: 'signUp' });
      throw error;
    }
    return data;
  },

  async signOut() {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPasswordForEmail(email: string) {
    ensureConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async fetchProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('AUTH', 'Failed to fetch profile', { error: error.message });
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      fullName: data.full_name || '',
      username: data.username || '',
      email: data.email || '',
      avatarUrl: data.avatar_url || '',
      bio: data.bio || '',
      timezone: data.timezone || 'UTC',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile | null> {
    const dbPatch: Record<string, any> = {};
    if (patch.fullName !== undefined) dbPatch.full_name = patch.fullName;
    if (patch.username !== undefined) dbPatch.username = patch.username;
    if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
    if (patch.bio !== undefined) dbPatch.bio = patch.bio;
    if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbPatch)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      fullName: data.full_name || '',
      username: data.username || '',
      email: data.email || '',
      avatarUrl: data.avatar_url || '',
      bio: data.bio || '',
      timezone: data.timezone || 'UTC',
    };
  },
};
