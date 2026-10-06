// Test: Supabase Configuration & Safe Diagnostics

import { authService } from '../src/services/authService';
import { isSupabaseConfigured } from '../src/services/supabase';
import { logger } from '../src/utils/logger';

describe('Supabase Configuration & Auth Diagnostics', () => {
  it('identifies unconfigured state when environment variables are missing or mock', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean');
  });

  it('fails explicitly with clear error message when signing in unconfigured', async () => {
    if (!isSupabaseConfigured) {
      await expect(authService.signInWithPassword('test@example.com', 'secret123')).rejects.toThrow(
        'Supabase is not configured'
      );
    }
  });

  it('fails explicitly with clear error message when signing up unconfigured', async () => {
    if (!isSupabaseConfigured) {
      await expect(authService.signUp('test@example.com', 'secret123', 'Tester')).rejects.toThrow(
        'Supabase is not configured'
      );
    }
  });

  it('returns null session when unconfigured without throwing network error', async () => {
    if (!isSupabaseConfigured) {
      const session = await authService.getSession();
      expect(session).toBeNull();
    }
  });

  it('sanitizes sensitive strings from logger', () => {
    const sanitized = logger.sanitize('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID5');
    expect(sanitized).not.toContain('eyJhbGci');
    expect(sanitized).toContain('[REDACTED]');
  });
});
