// GET /api/ai/health — public readiness probe (Sprint 9.6).
//
// Response is deliberately tiny and free of anything sensitive:
//   { "enabled": true, "ready": true }
//   { "enabled": true, "ready": false }
//   { "enabled": false, "ready": false }
//
// Never returns: the API key, provider secret, tokens, internal exceptions,
// stack traces, or any environment values.

import { createAIConfig } from './config.js';
import { createRateLimiter } from './rateLimit.js';
import { runServerHealth } from './provider.js';
import { safeLog } from './log.js';

const healthLimiter = createRateLimiter({ max: 60, windowMs: 60000 });

export async function handleHealth({ source, ip, fetcher } = {}) {
  const started = Date.now();
  const cfg = createAIConfig(source);

  const key = `${ip || 'unknown'}:health`;
  if (!healthLimiter.tryConsume(key, started)) {
    return { status: 200, json: { enabled: cfg.enabled === true, ready: false } };
  }

  if (!cfg.enabled) {
    return { status: 200, json: { enabled: false, ready: false } };
  }

  if (!cfg.configured) {
    return { status: 200, json: { enabled: true, ready: false } };
  }

  const health = await runServerHealth(cfg, { fetcher });
  safeLog({
    requestId: `health-${ip || 'unknown'}`,
    kind: 'health',
    durationMs: Date.now() - started,
    ok: health.ok,
    status: health.status,
  });

  return { status: 200, json: { enabled: true, ready: health.ready } };
}