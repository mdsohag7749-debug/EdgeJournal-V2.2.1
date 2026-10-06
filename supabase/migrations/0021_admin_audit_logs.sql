-- =============================================================================
-- Migration: 0021_admin_audit_logs.sql
-- Description: Create admin_audit_logs table, indexes, Row Level Security policies,
--              and secure logging helper function for Phase 6 audit architecture.
--
-- Security model:
--   - Row Level Security (RLS) enabled on public.admin_audit_logs.
--   - Admins can SELECT all audit logs (gated by public.is_admin()).
--   - Normal users CANNOT select, insert, update, or delete audit logs.
--   - Effectively append-only: NO update or delete policies granted to anyone.
--   - Log insertion is strictly bound to the authenticated user ID (auth.uid())
--     via policy CHECK (public.is_admin() AND actor_user_id = auth.uid()) and
--     via the SECURITY DEFINER function public.log_admin_action().
--   - Zero client-side actor spoofing possible.
--
-- Version: 0021
-- Depends on: 0019_admin_role.sql (is_admin() function, profiles table)
-- Author: EdgeJournal
-- Date: 2026-10-07
-- Rollback: See supabase/rollback/0021_admin_audit_logs_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: Create admin_audit_logs table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 2: Enable Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SECTION 3: Create performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
  ON public.admin_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource
  ON public.admin_audit_logs (resource_type);

-- ---------------------------------------------------------------------------
-- SECTION 4: RLS Policies
-- ---------------------------------------------------------------------------

-- Policy 4a: Admins can SELECT all audit records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'admin_audit_logs'
      AND policyname = 'Admins can view audit logs'
  ) THEN
    CREATE POLICY "Admins can view audit logs"
      ON public.admin_audit_logs
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- Policy 4b: Admins can INSERT audit records, strictly bounded to auth.uid()
-- Prevents spoofing another administrator's user ID.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'admin_audit_logs'
      AND policyname = 'Admins can insert audit logs'
  ) THEN
    CREATE POLICY "Admins can insert audit logs"
      ON public.admin_audit_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin() AND actor_user_id = auth.uid());
  END IF;
END
$$;

-- Note: NO UPDATE or DELETE policies are created.
-- The audit log table is strictly append-only.

-- ---------------------------------------------------------------------------
-- SECTION 5: Secure Logging Helper Function
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so that the authenticated identity is verified and bound
-- to auth.uid() at the database level.
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can record administrative audit events';
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    v_caller_id,
    p_action,
    p_resource_type,
    p_resource_id,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Restrict execution to authenticated callers only (revoked from public)
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated;

-- =============================================================================
-- Post-migration checklist:
--   1. Verify table exists: SELECT to_regclass('public.admin_audit_logs');
--   2. Verify RLS is enabled: SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'admin_audit_logs';
--   3. Verify policies: SELECT policyname FROM pg_policies WHERE tablename = 'admin_audit_logs';
--   4. Verify no UPDATE/DELETE policies exist.
--   5. Rollback: supabase/rollback/0021_admin_audit_logs_rollback.sql
-- =============================================================================
