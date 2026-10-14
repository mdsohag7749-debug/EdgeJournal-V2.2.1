-- Refresh the public EdgeJournal plan catalog. Existing plan rows stay in place
-- so subscriptions that reference an older plan remain valid for their users.
-- Apply through the normal Supabase migration process before enabling checkout.

UPDATE public.plans
SET is_active = false,
    updated_at = now()
WHERE is_active = true;

INSERT INTO public.plans
  (name, slug, description, price, currency, billing_interval, is_active, features, limits)
VALUES
  (
    'Free', 'free', 'Essential trade logging and personal performance tracking for everyday traders.',
    0.00, 'USD', 'monthly', true,
    '["journal", "analytics", "basic_reports", "goals", "reflections", "challenges"]'::jsonb,
    '{"accounts": 1, "trades": 500, "screenshots_per_trade": 5}'::jsonb
  ),
  (
    'Edge Plus', 'edge-plus', 'More room for active traders who want clearer performance insights.',
    9.00, 'USD', 'monthly', true,
    '["journal", "analytics", "basic_reports", "advanced_analytics", "multiple_accounts", "reports", "csv_export", "goals", "reflections", "challenges"]'::jsonb,
    '{"accounts": 3, "trades": 2500, "screenshots_per_trade": 10}'::jsonb
  ),
  (
    'Edge Pro', 'edge-pro', 'The complete EdgeJournal toolkit for serious performance review.',
    19.00, 'USD', 'monthly', true,
    '["journal", "analytics", "basic_reports", "advanced_analytics", "multiple_accounts", "reports", "csv_export", "custom_goals", "unlimited_trades", "edge_ai", "goals", "reflections", "challenges"]'::jsonb,
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

-- Move accounts off retired tiers. Keep their subscription row so user history
-- remains intact, but give them the new Free entitlements until they choose a
-- current plan. Current Free/Edge Plus/Edge Pro assignments are left untouched.
UPDATE public.subscriptions AS subscription
SET plan_id = free_plan.id,
    status = 'active',
    started_at = now(),
    expires_at = NULL,
    updated_at = now()
FROM public.plans AS old_plan,
     public.plans AS free_plan
WHERE subscription.plan_id = old_plan.id
  AND free_plan.slug = 'free'
  AND old_plan.slug NOT IN ('free', 'edge-plus', 'edge-pro');
