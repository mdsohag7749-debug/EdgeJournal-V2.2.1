-- =============================================================================
-- Migration Rollback: 0022_subscriptions_and_plans_rollback.sql
-- Description: Safely and idempotently removes objects created by 0022_subscriptions_and_plans.sql
-- Version: 0022 rollback
-- Date: 2026-10-07
-- =============================================================================

-- Step 1: Revoke privileges and drop admin subscription assignment function
REVOKE EXECUTE ON FUNCTION public.admin_assign_subscription(uuid, uuid, text, timestamptz) FROM authenticated;
DROP FUNCTION IF EXISTS public.admin_assign_subscription(uuid, uuid, text, timestamptz);

-- Step 2: Drop RLS policies on public.subscriptions
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

-- Step 3: Drop RLS policies on public.plans
DROP POLICY IF EXISTS "Admins can update plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can insert plans" ON public.plans;
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON public.plans;

-- Step 4: Drop indexes
DROP INDEX IF EXISTS public.idx_subscriptions_status;
DROP INDEX IF EXISTS public.idx_subscriptions_plan_id;
DROP INDEX IF EXISTS public.idx_subscriptions_user_id;
DROP INDEX IF EXISTS public.idx_plans_is_active;
DROP INDEX IF EXISTS public.idx_plans_slug;

-- Step 5: Drop tables in foreign-key dependency order
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.plans;
