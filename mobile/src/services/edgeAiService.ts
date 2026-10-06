// Edge AI Client Service Bridge
// Communicates with backend server endpoint (/api/ai/analyze, /api/ai/health)
// Zero client-exposed secrets / API keys.

import { AIRequestKind, AIResponse, AIHealthProbe, AIStatus, CanonicalAIRequestContext } from '../types/ai';
import { supabase } from './supabase';
import { sanitizeAIResponse } from '../utils/aiSafety';

const DEFAULT_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://edgejournal.app';
const ANALYZE_ENDPOINT = `${DEFAULT_API_BASE}/api/ai/analyze`;
const HEALTH_ENDPOINT = `${DEFAULT_API_BASE}/api/ai/health`;

export const edgeAiService = {
  async analyze(kind: AIRequestKind, context: CanonicalAIRequestContext, timeoutMs = 45000): Promise<AIResponse> {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token || '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(ANALYZE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind,
          context: {
            ...context,
            accountId: context.accountId || null,
          },
        }),
        signal: controller.signal,
      });

      const json = await response.json();
      const rawAnalysis = json?.analysis || null;

      let safeAnalysis = null;
      if (rawAnalysis) {
        try {
          safeAnalysis = sanitizeAIResponse(rawAnalysis);
        } catch {
          // If safety sanitizer detects directive language in response, fail gracefully
          return {
            ok: false,
            status: 'AI_INVALID_RESPONSE',
            message: 'AI returned directive or guarantee language outside the allowed safety bounds.',
            analysis: null,
          };
        }
      }

      return {
        ok: json?.ok === true,
        status: json?.status || (response.ok ? 'ok' : 'AI_PROVIDER_ERROR'),
        message: json?.message || '',
        analysis: safeAnalysis || rawAnalysis,
        plan: json?.plan,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || /abort/i.test(String(err?.message || err));
      return {
        ok: false,
        status: isTimeout ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
        message: isTimeout
          ? 'AI provider timed out. Please try again later.'
          : 'EdgeJournal AI is temporarily unreachable. Please try again later.',
        analysis: null,
      };
    } finally {
      clearTimeout(timer);
    }
  },

  async healthCheck(timeoutMs = 5000): Promise<AIHealthProbe> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const body = await response.json();
      return {
        ok: body?.ok === true || response.ok,
        enabled: body?.enabled === true,
        ready: body?.ready === true,
      };
    } catch {
      return { ok: false, enabled: false, ready: false };
    } finally {
      clearTimeout(timer);
    }
  },

  interpretHealthProbe(probe: AIHealthProbe): AIStatus {
    if (!probe.ok) return 'UNAVAILABLE';
    if (!probe.enabled) return 'NOT_CONFIGURED';
    if (!probe.ready) return 'UNAVAILABLE';
    return 'READY';
  },
};

