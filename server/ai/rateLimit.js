// Lightweight, bounded server-side request guard (Sprint 9.6).
//
// Prevents accidental request storms with a fixed-window limiter per key
// (IP + kind). Bounded memory: stale buckets are pruned when the map grows, so
// a hostile volume of unique keys cannot balloon storage. No persistence, no
// cross-instance coordination — enough to stop accidental abuse/retry storms,
// intentionally NOT a billing system.

export function createRateLimiter({ max = 20, windowMs = 60000 } = {}) {
  const buckets = new Map();
  const MAX_KEYS = 2000;

  function prune(now) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  }

  function tryConsume(key, now = Date.now()) {
    if (typeof key !== 'string' || !key) return false;
    if (buckets.size >= MAX_KEYS) prune(now);

    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= max) return false;
    bucket.count += 1;
    return true;
  }

  return { tryConsume, size: () => buckets.size, reset: () => buckets.clear() };
}