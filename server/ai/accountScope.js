// Server-side account isolation (Sprint 9.6).
//
// Every AI request must stay account-scoped. The server enforces this twice:
//   1. STRUCTURAL — the validated request carries exactly one account id inside
//      its frozen context; a request without one (or with extra fields) is
//      rejected as AI_ACCOUNT_SCOPE_ERROR. Raw trade rows never cross the wire.
//   2. BINDING — the server requires a Supabase service role key AND the
//      browser's Supabase access token, then verifies account ownership and
//      the Phase 7 Edge AI entitlement before calling any provider.
//
// Structural validation alone is not authorization. Missing credentials,
// sessions, or authorization data fail closed.

import { AIError } from '../../src/lib/ai/errors.js';
import { AI_ERROR_CODES } from '../../src/lib/ai/types.js';

// Extracts the ONE account id carried by a validated context.
export function extractAccountId(kind, context) {
  if (kind === 'tradeReview') {
    return context?.metadata?.accountId && typeof context.metadata.accountId === 'string'
      ? context.metadata.accountId
      : null;
  }
  return context?.account?.id && typeof context.account.id === 'string' ? context.account.id : null;
}

function scopeError(detail) {
  return new AIError(
    AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
    'Account isolation: the requested analysis is outside the selected account.',
    { detail }
  );
}

function unavailableError(detail) {
  return new AIError(
    AI_ERROR_CODES.AI_UNAVAILABLE,
    'Edge AI authorization is temporarily unavailable. Please try again later.',
    { detail }
  );
}

function notEntitledError() {
  return new AIError(
    AI_ERROR_CODES.AI_NOT_ENTITLED,
    'Your active plan does not include Edge AI. Upgrade to Pro or an eligible plan to access Edge AI.',
    { detail: 'not-entitled' }
  );
}

// Resolves + verifies the account scope for a validated request.
// Returns `{ accountId, userId, supabase }` or throws an authorization error.
export async function resolveAccountScope({ kind, context, authorization, cfg, supabaseFactory } = {}) {
  const accountId = extractAccountId(kind, context);
  if (!accountId) throw scopeError('missing-account-id');

  const tokenMatch = typeof authorization === 'string' && authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch || !tokenMatch[1].trim()) throw scopeError('missing-authorization');
  if (!cfg?.supabaseUrl || !cfg?.supabaseServiceRoleKey) {
    throw unavailableError('authorization-not-configured');
  }

  const token = tokenMatch[1].trim();
  let sdk;
  try {
    sdk = supabaseFactory ? supabaseFactory() : await import('@supabase/supabase-js');
  } catch {
    throw unavailableError('supabase-client-unavailable');
  }

  const { createClient } = sdk;
  let supabase;
  try {
    supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    throw unavailableError('supabase-client-initialization-failed');
  }

  let userData;
  let userError;
  try {
    ({ data: userData, error: userError } = await supabase.auth.getUser(token));
  } catch {
    throw unavailableError('user-validation-failed');
  }
  if (userError || !userData?.user) throw scopeError('unauthorized-user');

  let row;
  let accountError;
  try {
    ({ data: row, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', userData.user.id)
      .maybeSingle());
  } catch {
    throw unavailableError('account-ownership-check-failed');
  }

  if (accountError) throw unavailableError('account-ownership-check-failed');
  if (!row) throw scopeError('account-not-owned');

  // Resolve entitlement from the same subscription/plan source as Phase 7.
  let sub;
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (error) throw unavailableError('subscription-check-failed');
    sub = data;
  } catch (subErr) {
    if (subErr?.code === AI_ERROR_CODES.AI_UNAVAILABLE) throw subErr;
    throw unavailableError('subscription-check-failed');
  }

  const { canUseFeature } = await import('../../src/lib/entitlements.js');
  if (!canUseFeature(sub, 'edge_ai')) throw notEntitledError();

  // Verify platform system settings and daily rate limit if tables exist
  try {
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['ai_enabled', 'ai_maintenance_mode', 'ai_daily_limit_pro', 'ai_daily_limit_free']);

    if (Array.isArray(settings) && settings.length > 0) {
      const sMap = {};
      for (const s of settings) sMap[s.key] = s.value;

      if (sMap.ai_enabled === false) {
        throw new AIError(
          AI_ERROR_CODES.AI_UNAVAILABLE,
          'Edge AI features are currently disabled in platform settings.',
          { detail: 'ai-disabled' }
        );
      }
      if (sMap.ai_maintenance_mode === true) {
        throw new AIError(
          AI_ERROR_CODES.AI_UNAVAILABLE,
          'Edge AI is temporarily offline for scheduled platform maintenance.',
          { detail: 'ai-maintenance' }
        );
      }

      const limit = Number(sMap.ai_daily_limit_pro) || 50;
      if (limit > 0) {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const { count: dailyCount } = await supabase
          .from('ai_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.user.id)
          .gte('created_at', todayStart.toISOString());

        if (dailyCount !== null && dailyCount !== undefined && dailyCount >= limit) {
          throw new AIError(
            AI_ERROR_CODES.AI_RATE_LIMITED,
            `Daily AI request limit (${limit}) reached for your account. Please try again tomorrow.`,
            { detail: 'daily-limit-exceeded' }
          );
        }
      }
    }
  } catch (settingErr) {
    if (
      settingErr?.code === AI_ERROR_CODES.AI_UNAVAILABLE ||
      settingErr?.code === AI_ERROR_CODES.AI_RATE_LIMITED
    ) {
      throw settingErr;
    }
  }

  return { accountId, userId: userData.user.id, supabase };
}