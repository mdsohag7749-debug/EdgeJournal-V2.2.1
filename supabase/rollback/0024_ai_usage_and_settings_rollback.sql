-- =============================================================================
-- Migration Rollback: 0024_ai_usage_and_settings_rollback.sql
-- Description: Cleanly and idempotently rolls back migration 0024_ai_usage_and_settings.sql.
--              Drops RLS policies, indexes, and public.ai_usage_logs table,
--              and cleans up seeded Phase 9 AI system settings.
--
-- Rollback order:
--   1. Drop policies on public.ai_usage_logs
--   2. Drop indexes on public.ai_usage_logs
--   3. Drop table public.ai_usage_logs
--   4. Delete Phase 9 seeded keys from public.system_settings
--
-- Author: EdgeJournal
-- Date: 2026-10-07
-- =============================================================================

-- 1. Drop RLS policies
DROP POLICY IF EXISTS "Users can view own AI usage logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Users can insert own AI usage logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Admins can view all AI usage logs" ON public.ai_usage_logs;

-- 2. Drop indexes
DROP INDEX IF EXISTS public.idx_ai_usage_logs_user_id;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_created_at;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_user_daily;

-- 3. Drop table
DROP TABLE IF EXISTS public.ai_usage_logs;

-- 4. Delete Phase 9 seeded keys from public.system_settings
DELETE FROM public.system_settings
WHERE key IN (
  'ai_enabled',
  'ai_provider',
  'ai_maintenance_mode',
  'ai_daily_limit_pro',
  'ai_daily_limit_free',
  'ai_model'
);

-- =============================================================================
-- Verification:
--   SELECT to_regclass('public.ai_usage_logs'); -- Should return NULL
--   SELECT count(*) FROM public.system_settings WHERE key LIKE 'ai_%'; -- Should return 0
-- =============================================================================
