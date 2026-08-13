// Server-side account isolation (Sprint 9.6).
//
// Every AI request must stay account-scoped. The server enforces this twice:
//   1. STRUCTURAL — the validated request carries exactly one account id inside
//      its frozen context; a request without one (or with extra fields) is
//      rejected as AI_ACCOUNT_SCOPE_ERROR. Raw trade rows never cross the wire.
//   2. BINDING (optional) — when the deployment provides a Supabase service
//      role key AND the browser attached its Supabase access token, the server
//      verifies the requested account actually belongs to that authenticated
//      user before calling any provider.
//
// When the binding credentials/token aren't present the structural guard still
// applies (the client-side features already never mix accounts); the optional
// check is what stops an authenticated user of Account A from analyzing
// Account B.

import { AIError } from '../../src/lib/ai/errors';
import { AI_ERROR_CODES } from '../../src/lib/ai/types';

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

// Resolves + verifies the account scope for a validated request.
// Returns `{ accountId, userId? }` or throws AI_ACCOUNT_SCOPE_ERROR.
export async function resolveAccountScope({ kind, context, authorization, cfg, supabaseFactory } = {}) {
  const accountId = extractAccountId(kind, context);
  if (!accountId) throw scopeError('missing-account-id');

  const canBind =
    cfg &&
    cfg.supabaseUrl &&
    cfg.supabaseServiceRoleKey &&
    typeof authorization === 'string' &&
    /^Bearer\s+/i.test(authorization);

  if (!canBind) {
    // No binding path provisioned — structural single-account enforcement only.
    return { accountId };
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  let sdk;
  try {
    sdk = supabaseFactory ? supabaseFactory() : await import('@supabase/supabase-js');
  } catch {
    // SDK unavailable at runtime ⇒ fall back to structural enforcement.
    return { accountId };
  }

  const { createClient } = sdk;
  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw scopeError('unauthorized-user');

  const { data: row } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!row) throw scopeError('account-not-owned');

  return { accountId, userId: userData.user.id };
}