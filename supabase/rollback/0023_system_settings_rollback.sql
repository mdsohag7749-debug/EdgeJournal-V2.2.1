-- =============================================================================
-- Migration Rollback: 0023_system_settings_rollback.sql
-- Description: Cleanly and idempotently rolls back migration 0023_system_settings.sql.
--              Drops trigger, RLS policies, indexes, and public.system_settings table.
--
-- Rollback order:
--   1. Drop trigger on public.system_settings
--   2. Drop policies on public.system_settings
--   3. Drop indexes on public.system_settings
--   4. Drop table public.system_settings
--
-- Author: EdgeJournal
-- Date: 2026-10-07
-- =============================================================================

-- 1. Drop trigger
DROP TRIGGER IF EXISTS set_system_settings_updated_at ON public.system_settings;

-- 2. Drop RLS policies
DROP POLICY IF EXISTS "Public read for public system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can view all system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can insert system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can delete system settings" ON public.system_settings;

-- 3. Drop indexes
DROP INDEX IF EXISTS public.idx_system_settings_key;
DROP INDEX IF EXISTS public.idx_system_settings_is_public;

-- 4. Drop table
DROP TABLE IF EXISTS public.system_settings;

-- =============================================================================
-- Verification:
--   SELECT to_regclass('public.system_settings'); -- Should return NULL
-- =============================================================================
