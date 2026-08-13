// Safe server logging (Sprint 9.6).
//
// Only whitelisted, non-sensitive fields are logged: request id, kind, elapsed
// duration and normalized outcome. Never API keys, authorization headers,
// prompts, journal data, or raw provider errors.

export function safeLog(entry = {}) {
  const { requestId, kind, durationMs, ok, status } = entry;
  const line = {
    requestId: typeof requestId === 'string' && requestId ? requestId : 'edge-ai',
    kind: typeof kind === 'string' ? kind : 'unknown',
    ok: ok === true,
    status: typeof status === 'string' ? status : 'unknown',
  };
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) line.durationMs = Math.round(durationMs);
  console.log(`[edge-ai] ${JSON.stringify(line)}`);
}