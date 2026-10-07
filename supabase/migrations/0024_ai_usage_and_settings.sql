-- =============================================================================
-- Migration: 0024_ai_usage_and_settings.sql
-- Description: Create ai_usage_logs table, Row Level Security policies,
--              performance indexes, and safe default initial AI platform settings
--              for Phase 9: Edge AI Command Center & AI Insights.
--
-- Security model:
--   - Row Level Security (RLS) enabled on public.ai_usage_logs.
--   - Authenticated users can SELECT only their own AI usage logs (auth.uid() = user_id).
--   - Authenticated users can INSERT only their own AI usage logs (auth.uid() = user_id).
--   - Authenticated administrators (public.is_admin()) can SELECT all AI usage logs for
--     aggregate operational monitoring and telemetry.
--   - No UPDATE or DELETE policies: AI usage logs are immutable append-only records.
--   - No sensitive prompts, private journal text, or trade secrets stored in usage logs.
--   - Seeds default public AI system settings in public.system_settings without secret keys.
--   - Safe, non-destructive, idempotent migration.
--
-- Version: 0024
-- Depends on: 0019_admin_role.sql, 0023_system_settings.sql
-- Author: EdgeJournal
-- Date: 2026-10-07
-- Rollback: See supabase/rollback/0024_ai_usage_and_settings_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: Create public.ai_usage_logs table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  tokens_used integer DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 2: Performance Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id
  ON public.ai_usage_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_daily
  ON public.ai_usage_logs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- SECTION 3: Enable Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SECTION 4: RLS Policies for public.ai_usage_logs
-- ---------------------------------------------------------------------------

-- Policy 4a: Users can view their own AI usage logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_usage_logs'
      AND policyname = 'Users can view own AI usage logs'
  ) THEN
    CREATE POLICY "Users can view own AI usage logs"
      ON public.ai_usage_logs
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Policy 4b: Users can insert their own AI usage logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_usage_logs'
      AND policyname = 'Users can insert own AI usage logs'
  ) THEN
    CREATE POLICY "Users can insert own AI usage logs"
      ON public.ai_usage_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Policy 4c: Administrators can view all AI usage logs (aggregate telemetry)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_usage_logs'
      AND policyname = 'Admins can view all AI usage logs'
  ) THEN
    CREATE POLICY "Admins can view all AI usage logs"
      ON public.ai_usage_logs
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- SECTION 5: Seed Default Platform AI Settings (Idempotent)
-- ---------------------------------------------------------------------------
-- Reuses public.system_settings from Phase 8.
-- Note: NEVER store private API keys or provider secrets in system_settings.
INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
  (
    'ai_enabled',
    'true'::jsonb,
    'Global Edge AI master toggle: true enables AI features for entitled users',
    true
  ),
  (
    'ai_provider',
    '"gemini"'::jsonb,
    'Active AI provider backend identifier',
    true
  ),
  (
    'ai_maintenance_mode',
    'false'::jsonb,
    'AI-specific maintenance mode: pauses AI features when maintenance is active',
    true
  ),
  (
    'ai_daily_limit_pro',
    '50'::jsonb,
    'Maximum daily AI requests allowed for Pro subscribers',
    true
  ),
  (
    'ai_daily_limit_free',
    '0'::jsonb,
    'Maximum daily AI requests allowed for Free tier users (requires upgrade)',
    true
  ),
  (
    'ai_model',
    '"gemini-3.5-flash-lite"'::jsonb,
    'Configured generative AI model name for EdgeJournal analytical operations',
    true
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  updated_at = now();

-- =============================================================================
-- Post-migration checklist:
--   1. Verify table exists: SELECT to_regclass('public.ai_usage_logs');
--   2. Verify RLS is enabled: SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ai_usage_logs';
--   3. Verify policies: SELECT policyname FROM pg_policies WHERE tablename = 'ai_usage_logs';
--   4. Confirm seeded AI settings: SELECT key, value, is_public FROM public.system_settings WHERE key LIKE 'ai_%';
--   5. Rollback: supabase/rollback/0024_ai_usage_and_settings_rollback.sql
-- =============================================================================
