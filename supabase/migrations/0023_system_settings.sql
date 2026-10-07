-- =============================================================================
-- Migration: 0023_system_settings.sql
-- Description: Create system_settings table, Row Level Security policies,
--              performance indexes, and safe default initial platform settings
--              for Phase 8: System Settings + Final Security & Production Hardening.
--
-- Security model:
--   - Row Level Security (RLS) enabled on public.system_settings.
--   - Public / anonymous / authenticated users can SELECT ONLY settings where
--     is_public = true (e.g., registration_enabled, public_app_name, etc.).
--   - Authenticated administrators (gated by public.is_admin()) can SELECT ALL
--     settings (both public and private/admin-only).
--   - Normal users CANNOT insert, update, or delete system settings.
--   - Only administrators (gated by public.is_admin()) can INSERT, UPDATE, or
--     DELETE system settings.
--   - Safe, non-destructive, idempotent migration.
--
-- Version: 0023
-- Depends on: 0019_admin_role.sql (is_admin() function)
-- Author: EdgeJournal
-- Date: 2026-10-07
-- Rollback: See supabase/rollback/0023_system_settings_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: Create public.system_settings table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 2: Performance Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_system_settings_key
  ON public.system_settings (key);

CREATE INDEX IF NOT EXISTS idx_system_settings_is_public
  ON public.system_settings (is_public);

-- ---------------------------------------------------------------------------
-- SECTION 3: Enable Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SECTION 4: RLS Policies for public.system_settings
-- ---------------------------------------------------------------------------

-- Policy 4a: Anyone (public / anon / authenticated) can read public settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'system_settings'
      AND policyname = 'Public read for public system settings'
  ) THEN
    CREATE POLICY "Public read for public system settings"
      ON public.system_settings
      FOR SELECT
      TO public
      USING (is_public = true);
  END IF;
END
$$;

-- Policy 4b: Administrators can view all system settings (public and private)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'system_settings'
      AND policyname = 'Admins can view all system settings'
  ) THEN
    CREATE POLICY "Admins can view all system settings"
      ON public.system_settings
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- Policy 4c: Administrators can insert system settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'system_settings'
      AND policyname = 'Admins can insert system settings'
  ) THEN
    CREATE POLICY "Admins can insert system settings"
      ON public.system_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- Policy 4d: Administrators can update system settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'system_settings'
      AND policyname = 'Admins can update system settings'
  ) THEN
    CREATE POLICY "Admins can update system settings"
      ON public.system_settings
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- Policy 4e: Administrators can delete system settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'system_settings'
      AND policyname = 'Admins can delete system settings'
  ) THEN
    CREATE POLICY "Admins can delete system settings"
      ON public.system_settings
      FOR DELETE
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- SECTION 5: Touch updated_at trigger
-- ---------------------------------------------------------------------------
-- Reuses existing public.set_updated_at() trigger function from migration 0001
DROP TRIGGER IF EXISTS set_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SECTION 6: Seed Default Platform Settings (Idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
  (
    'public_app_name',
    '"EdgeJournal"'::jsonb,
    'Official application brand name displayed across the platform',
    true
  ),
  (
    'public_support_email',
    '"support@edgejournal.com"'::jsonb,
    'Official customer support and contact email address',
    true
  ),
  (
    'default_timezone',
    '"America/New_York"'::jsonb,
    'Default platform timezone for trading sessions and timestamps',
    true
  ),
  (
    'default_currency',
    '"USD"'::jsonb,
    'Default base currency for account balances and trade calculations',
    true
  ),
  (
    'registration_enabled',
    'true'::jsonb,
    'Global registration toggle: true allows new user signups, false pauses registration',
    true
  ),
  (
    'maintenance_mode',
    'false'::jsonb,
    'Platform maintenance mode: true informs users of ongoing maintenance',
    true
  ),
  (
    'session_idle_timeout_minutes',
    '60'::jsonb,
    'Administrative session inactivity warning threshold in minutes (admin-only setting)',
    false
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  updated_at = now();

-- =============================================================================
-- Post-migration checklist:
--   1. Verify table exists: SELECT to_regclass('public.system_settings');
--   2. Verify RLS is enabled: SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'system_settings';
--   3. Verify policies: SELECT policyname FROM pg_policies WHERE tablename = 'system_settings';
--   4. Confirm seeded records: SELECT key, value, is_public FROM public.system_settings ORDER BY key;
--   5. Rollback: supabase/rollback/0023_system_settings_rollback.sql
-- =============================================================================
