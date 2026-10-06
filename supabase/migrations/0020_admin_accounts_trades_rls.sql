-- =============================================================================
-- Migration: 0020_admin_accounts_trades_rls.sql
-- Description: Add admin read-only RLS policies for public.accounts and
--              public.trades, enabling the Phase 4 Admin Panel to list all
--              platform trading accounts and trades without bypassing RLS.
--
-- Security model:
--   - Existing owner-only RLS policies on accounts and trades are UNCHANGED.
--   - Two new SELECT-only policies extend read access to admins, gated by
--     the SECURITY DEFINER is_admin() function from migration 0019.
--   - Admins CANNOT insert, update, or delete accounts or trades (read-only
--     oversight only; mutation access is not part of this phase).
--   - Uses DO blocks for idempotent policy creation (safe to re-run).
--
-- Version: 0020
-- Depends on: 0013_accounts.sql   (accounts + trades.account_id)
--             0019_admin_role.sql  (is_admin() function)
-- Author: EdgeJournal
-- Date: 2026-10-06
-- Rollback: See supabase/rollback/0020_admin_accounts_trades_rls_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: Admin read policy for public.accounts
-- ---------------------------------------------------------------------------
-- Allows administrators to SELECT any row in public.accounts.
-- Existing user-owned policies (select/insert/update/delete) are untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'accounts'
      AND policyname = 'Admins can view all accounts'
  ) THEN
    CREATE POLICY "Admins can view all accounts"
      ON public.accounts
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- SECTION 2: Admin read policy for public.trades
-- ---------------------------------------------------------------------------
-- Allows administrators to SELECT any row in public.trades.
-- Existing user-owned policies (select/insert/update/delete) are untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trades'
      AND policyname = 'Admins can view all trades'
  ) THEN
    CREATE POLICY "Admins can view all trades"
      ON public.trades
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- =============================================================================
-- Post-migration checklist:
--   1. Verify policies exist:
--      SELECT policyname, tablename FROM pg_policies
--      WHERE policyname IN (
--        'Admins can view all accounts',
--        'Admins can view all trades'
--      );
--   2. Confirm admin user can SELECT from public.accounts without user_id filter.
--   3. Confirm admin user can SELECT from public.trades without user_id filter.
--   4. Confirm standard user CANNOT SELECT accounts/trades belonging to others.
--   5. Confirm admin CANNOT INSERT/UPDATE/DELETE accounts or trades (SELECT only).
--   6. Rollback: supabase/rollback/0020_admin_accounts_trades_rls_rollback.sql
-- =============================================================================
