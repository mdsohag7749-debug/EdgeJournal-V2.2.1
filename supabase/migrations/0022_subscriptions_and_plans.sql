-- =============================================================================
-- Migration: 0022_subscriptions_and_plans.sql
-- Description: Create plans and subscriptions tables, default seed plans,
--              Row Level Security policies, indexes, and administrative
--              subscription assignment helper for Phase 7.
--
-- Security model:
--   - Row Level Security (RLS) enabled on public.plans and public.subscriptions.
--   - Authenticated users can SELECT active plans.
--   - Authenticated users can SELECT only their own subscription (auth.uid() = user_id).
--   - Normal users CANNOT insert, update, or delete plans.
--   - Normal users CANNOT insert, update, or delete subscriptions (no client self-upgrade).
--   - Admins (gated by public.is_admin()) can view all plans and subscriptions,
--     create/update plans, and assign/modify subscriptions.
--   - Safe, non-destructive, additive migration.
--
-- Version: 0022
-- Depends on: 0019_admin_role.sql (is_admin() function)
-- Author: EdgeJournal
-- Date: 2026-10-07
-- Rollback: See supabase/rollback/0022_subscriptions_and_plans_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: Create public.plans table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'USD',
  billing_interval text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 2: Create public.subscriptions table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscriptions_user UNIQUE (user_id)
);

-- ---------------------------------------------------------------------------
-- SECTION 3: Performance Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_plans_slug ON public.plans (slug);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON public.plans (is_active);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);

-- ---------------------------------------------------------------------------
-- SECTION 4: Enable Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SECTION 5: RLS Policies for public.plans
-- ---------------------------------------------------------------------------

-- Policy 5a: Authenticated users can view active plans (admins see all)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plans'
      AND policyname = 'Authenticated users can view active plans'
  ) THEN
    CREATE POLICY "Authenticated users can view active plans"
      ON public.plans
      FOR SELECT
      TO authenticated
      USING (is_active = true OR public.is_admin());
  END IF;
END
$$;

-- Policy 5b: Admins can insert plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plans'
      AND policyname = 'Admins can insert plans'
  ) THEN
    CREATE POLICY "Admins can insert plans"
      ON public.plans
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- Policy 5c: Admins can update plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plans'
      AND policyname = 'Admins can update plans'
  ) THEN
    CREATE POLICY "Admins can update plans"
      ON public.plans
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- SECTION 6: RLS Policies for public.subscriptions
-- ---------------------------------------------------------------------------

-- Policy 6a: Users can view their own subscription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'subscriptions'
      AND policyname = 'Users can view own subscription'
  ) THEN
    CREATE POLICY "Users can view own subscription"
      ON public.subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Policy 6b: Admins can view all subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'subscriptions'
      AND policyname = 'Admins can view all subscriptions'
  ) THEN
    CREATE POLICY "Admins can view all subscriptions"
      ON public.subscriptions
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END
$$;

-- Policy 6c: Admins can insert subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'subscriptions'
      AND policyname = 'Admins can insert subscriptions'
  ) THEN
    CREATE POLICY "Admins can insert subscriptions"
      ON public.subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- Policy 6d: Admins can update subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'subscriptions'
      AND policyname = 'Admins can update subscriptions'
  ) THEN
    CREATE POLICY "Admins can update subscriptions"
      ON public.subscriptions
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

-- Note: Normal users CANNOT insert, update, or delete subscriptions.
-- Subscription changes require administrator action or backend verification.

-- ---------------------------------------------------------------------------
-- SECTION 7: Seed Default Platform Plans (Idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.plans (name, slug, description, price, currency, billing_interval, is_active, features, limits)
VALUES
  (
    'Free',
    'free',
    'Essential trade logging and personal performance tracking for everyday traders.',
    0.00,
    'USD',
    'monthly',
    true,
    '["journal", "analytics", "basic_reports", "goals", "reflections", "challenges"]'::jsonb,
    '{"accounts": 1, "trades": 500, "screenshots_per_trade": 5}'::jsonb
  ),
  (
    'Pro',
    'pro',
    'Advanced intelligence, multiple trading accounts, platform reporting, and CSV data export.',
    29.00,
    'USD',
    'monthly',
    true,
    '["journal", "analytics", "advanced_analytics", "multiple_accounts", "reports", "csv_export", "custom_goals", "unlimited_trades", "edge_ai"]'::jsonb,
    '{"accounts": 10, "trades": 10000, "screenshots_per_trade": 10}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  billing_interval = EXCLUDED.billing_interval,
  is_active = EXCLUDED.is_active,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- SECTION 8: Database Helper Functions
-- ---------------------------------------------------------------------------

-- 8a: Administrative subscription assignment helper
CREATE OR REPLACE FUNCTION public.admin_assign_subscription(
  p_user_id uuid,
  p_plan_id uuid,
  p_status text DEFAULT 'active',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can assign subscriptions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'Invalid plan ID specified';
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    started_at,
    expires_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_plan_id,
    COALESCE(p_status, 'active'),
    now(),
    p_expires_at,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING id INTO v_sub_id;

  RETURN v_sub_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_subscription(uuid, uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_subscription(uuid, uuid, text, timestamptz) TO authenticated;

-- =============================================================================
-- Post-migration checklist:
--   1. Verify tables exist: SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('plans', 'subscriptions');
--   2. Verify RLS is enabled: SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('plans', 'subscriptions');
--   3. Confirm default plans seeded: SELECT name, slug, price FROM public.plans;
--   4. Confirm standard user cannot INSERT/UPDATE/DELETE subscriptions.
--   5. Rollback: supabase/rollback/0022_subscriptions_and_plans_rollback.sql
-- =============================================================================
