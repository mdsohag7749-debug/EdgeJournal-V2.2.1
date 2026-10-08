-- =============================================================================
-- Migration: 0025_subscription_assignment_audit_realtime.sql
-- Description: Make admin subscription assignment auditing atomic and publish
--              subscription changes for immediate entitlement refresh.
-- =============================================================================

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
  v_status text := COALESCE(p_status, 'active');
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
    v_status,
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

  PERFORM public.log_admin_action(
    'assign_subscription',
    'subscriptions',
    v_sub_id::text,
    jsonb_build_object(
      'targetUserId', p_user_id,
      'planId', p_plan_id,
      'status', v_status,
      'expiresAt', p_expires_at
    )
  );

  RETURN v_sub_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_subscription(uuid, uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_subscription(uuid, uuid, text, timestamptz) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Required Supabase Realtime publication "supabase_realtime" does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
  END IF;
END
$$;
