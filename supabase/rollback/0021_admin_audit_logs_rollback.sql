-- =============================================================================
-- Migration Rollback: 0021_admin_audit_logs_rollback.sql
-- Description: Safely and idempotently removes objects created by 0021_admin_audit_logs.sql
-- Version: 0021 rollback
-- Date: 2026-10-07
-- =============================================================================

-- Step 1: Revoke privileges and drop logging helper function
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM authenticated;
DROP FUNCTION IF EXISTS public.log_admin_action(text, text, text, jsonb);

-- Step 2: Drop RLS policies
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;

-- Step 3: Drop indexes
DROP INDEX IF EXISTS public.idx_admin_audit_logs_resource;
DROP INDEX IF EXISTS public.idx_admin_audit_logs_action;
DROP INDEX IF EXISTS public.idx_admin_audit_logs_actor;
DROP INDEX IF EXISTS public.idx_admin_audit_logs_created_at;

-- Step 4: Drop admin_audit_logs table
DROP TABLE IF EXISTS public.admin_audit_logs;
