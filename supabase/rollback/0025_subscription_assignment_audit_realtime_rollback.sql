-- =============================================================================
-- Rollback: 0025_subscription_assignment_audit_realtime_rollback.sql
-- Restores the Phase 7 assignment function. The Realtime publication entry is
-- retained because it is non-destructive and may be used by active clients.
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
