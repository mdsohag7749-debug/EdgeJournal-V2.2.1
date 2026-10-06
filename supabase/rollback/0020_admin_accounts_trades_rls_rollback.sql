-- =============================================================================
-- Rollback: 0020_admin_accounts_trades_rls_rollback.sql
-- Description: Removes admin read-only SELECT policies on public.accounts and
--              public.trades that were added in migration 0020.
--
-- Safe to run: DROP POLICY IF EXISTS is idempotent.
-- Does NOT affect: any user-owned RLS policies, is_admin(), or the profiles
--                  admin policies introduced in 0019.
--
-- Author: EdgeJournal
-- Date: 2026-10-06
-- =============================================================================

-- Remove admin SELECT policy from public.accounts
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;

-- Remove admin SELECT policy from public.trades
DROP POLICY IF EXISTS "Admins can view all trades" ON public.trades;

-- =============================================================================
-- Verification after rollback:
--   SELECT policyname FROM pg_policies
--   WHERE tablename IN ('accounts', 'trades')
--   AND policyname LIKE 'Admins%';
--   -- Should return 0 rows.
-- =============================================================================
