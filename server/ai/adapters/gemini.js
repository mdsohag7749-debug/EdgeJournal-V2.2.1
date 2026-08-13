// Google Gemini provider adapter (Gemini migration sprint).
//
// The Free Tier uses the lightweight Flash-Lite / Flash class of models
// (verified on the official pricing page); the model is never hardcoded here —
// GEMINI_MODEL selects it (default gemini-3.5-flash-lite, free tier).
//
// Responsibilities (same contract as the server-side provider adapters):
//   - sends ONLY the allow-listed, account-scoped context it is handed
//   - uses the server-side Gemini API key via the x-goog-api-key header
//     (never exposed to the browser, never logged, not in the URL)
//   - enforces a timeout (AbortController) → controlled AI_TIMEOUT
//   - normalizes every provider failure into an existing AI_ERROR_CODE
//   - returns raw analysis that the shared server sanitizer then allow-lists
//   - never returns raw provider errors or credentials to the client
//
// `fetcher` / `endpoint` are injectable so deterministic tests can exercise
// the request shape, timeout and error normalization without network access.

import { AIError } from '../../../src/lib/ai/errors.js';
import { AI_ERROR_CODES, AI_STATUS_OK } from '../../../src/lib/ai/types.js';

const FAIL_SAFE_TIMEOUT_MS = 30000;

export function createGeminiAdapter({
  apiKey,
  model = 'gemini-3.5-flash-lite',
  timeoutMs = FAIL_SAFE_TIMEOUT_MS,
  fetcher = globalThis.fetch,
  endpoint = 'https://generativelanguage.googleapis.com/v1beta',
}) {
  function requireKey() {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new AIError(
        AI_ERROR_CODES.AI_NOT_CONFIGURED,
        'EdgeJournal AI is not configured yet. No journal data was sent to any provider.'
      );
    }
  }

  function analyzerURL() {
    return `${endpoint}/models/${encodeURIComponent(model)}:generateContent`;
  }

  function healthURL() {
    return `${endpoint}/models`;
  }

  async function analyze({ prompt, context } = {}) {
    requireKey();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetcher(analyzerURL(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt || '' }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: typeof context === 'string' ? context : JSON.stringify(context || {}) }],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err?.message || err)));
      if (aborted) {
        throw new AIError(AI_ERROR_CODES.AI_TIMEOUT, 'AI provider timed out. Your journal data was not changed.', { detail: 'timeout' });
      }
      throw new AIError(AI_ERROR_CODES.AI_PROVIDER_ERROR, 'AI provider could not be reached. Please try again later.', { detail: 'network' });
    } finally {
      clearTimeout(timer);
    }

    if (!response) {
      throw new AIError(AI_ERROR_CODES.AI_PROVIDER_ERROR, 'AI provider did not respond. Please try again later.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new AIError(
        AI_ERROR_CODES.AI_NOT_CONFIGURED,
        'EdgeJournal AI is not configured yet. No journal data was sent to any provider.'
      );
    }
    if (response.status === 429) {
      throw new AIError(AI_ERROR_CODES.AI_RATE_LIMITED, 'AI provider is rate-limited. Please try again shortly.');
    }
    if (response.status === 408 || response.status === 504) {
      throw new AIError(AI_ERROR_CODES.AI_TIMEOUT, 'AI provider was slow to respond. Please try again later.');
    }
    if (!response.ok) {
      throw new AIError(AI_ERROR_CODES.AI_PROVIDER_ERROR, 'AI provider reported a problem. Please try again later.');
    }

    const data = await response.json().catch(() => null);
    // Gemini returns parts[]; concatenate text parts into a single blob.
    const content = Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts.map((part) => (part && typeof part.text === 'string' ? part.text : '')).join('')
      : '';
    if (typeof content !== 'string' || !content.trim()) {
      throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned an unreadable response. Your journal data was not changed.');
    }

    return parseModelJson(content.trim());
  }

  async function healthCheck() {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return { ok: false, status: AI_ERROR_CODES.AI_NOT_CONFIGURED };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));
    try {
      const res = await fetcher(healthURL(), {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey.trim() },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 401 || res.status === 403) return { ok: false, status: AI_ERROR_CODES.AI_NOT_CONFIGURED };
      if (res.ok) return { ok: true, status: AI_STATUS_OK };
      return { ok: false, status: AI_ERROR_CODES.AI_UNAVAILABLE };
    } catch {
      clearTimeout(timer);
      return { ok: false, status: AI_ERROR_CODES.AI_UNAVAILABLE };
    }
  }

  return { analyze, healthCheck };
}

// Robust JSON extraction from model text output: plain JSON, fenced code
// blocks, or a JSON object embedded in prose.
function parseModelJson(content) {
  const trimmed = content.trim();
  if (!trimmed) throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned an unreadable response. Your journal data was not changed.');

  const plain = tryParse(trimmed);
  if (plain) return plain;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const json = tryParse(fenced[1].trim());
    if (json) return json;
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const json = tryParse(trimmed.slice(first, last + 1));
    if (json) return json;
  }

  throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned an unreadable response. Your journal data was not changed.');
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}