// Mobile AI Safety Layer
// TypeScript port of src/lib/ai/safety.js
//
// AI is an ANALYST/COACH — never an execution engine, never a source of truth
// for recorded facts or canonical metrics. This module encodes that contract
// in rules, a response shape, and defensive immutability helpers.

export const AI_SAFETY_RULES = [
  { id: 'advisory-only', label: 'AI output is advisory, never a trade directive.' },
  { id: 'no-execution', label: 'AI cannot create, edit, or delete trades.' },
  { id: 'no-mutation', label: 'AI cannot change balances, PnL, RR, risk, or journal data.' },
  { id: 'no-guarantees', label: 'AI never guarantees profit or outcomes.' },
  { id: 'no-fabrication', label: 'AI cannot invent facts that are missing from the journal.' },
  { id: 'no-cross-account', label: 'AI never mixes data across accounts.' },
  { id: 'canonical-authoritative', label: 'Recorded and calculated metrics remain the source of truth.' },
] as const;

// Shared directive / guarantee vocabulary enforced on EVERY sanitized AI
// output. Descriptive words are fine; explicit execution orders, directional
// commands, signals, risk-sizing orders and profit promises are not.
// This is the EXACT same regex used by the web server sanitizer.
export const AI_DIRECTIVE_PATTERN =
  /\b(?:buy now|sell now|buy signal|sell signal|entry signal|exit signal|place a buy|place a sell|place buy|place sell|buy at|sell at|go long|go short|long now|short now|buy only|sell only|only buy|only sell|take this trade|take the trade|take the position|guaranteed profit|guarantee.? profit|guaranteed returns|guaranteed outcome|guarantee.? outcome|price prediction|market prediction|predicted price|predicted profit|next (week|session|month).? price|lot recommendation|recommended lot|increase your risk|decrease your risk|increase risk|decrease risk|raise your risk|lower your risk|risk more|risk less|trade this signal|trade the signal|recommended entry|recommended exit|execute (this|the|a)? ?trade|automated trade|100% profit|stop trading|buy this pair|sell this pair|no.?risk|sure thing|guaranteed win)\b/i;

// Question-level injection pattern — catches prompt injection inside Ask Journal
// questions before any provider contact.
export const QUESTION_INJECTION_PATTERN =
  /\b(?:ignore (previous|above|all|prior|system)|disregard|override|new instruction|forget|you are now|act as|roleplay|pretend|bypass|jailbreak|unlock|system prompt|developer mode)\b/i;

/**
 * Throws a controlled error when free text contains directive / guarantee
 * language. Every feature sanitizer funnels its collected text through this so
 * there is exactly ONE vocabulary across the product.
 */
export function rejectDirectiveText(text: string): void {
  if (AI_DIRECTIVE_PATTERN.test(text)) {
    throw new Error('AI_INVALID_RESPONSE: AI returned directive or guarantee language.');
  }
}

/**
 * Recursively freezes an (already copied) object graph so downstream AI code
 * literally cannot mutate the structured context/response it was handed.
 * Mirrors web safety.js freezeDeep().
 */
export function freezeDeep<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value as Readonly<T>;
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === 'object') {
      (value as Record<string, unknown>)[key] = freezeDeep(child);
    }
  }
  return Object.freeze(value) as Readonly<T>;
}

export function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.keys(value as object).every((key) => isDeepFrozen((value as Record<string, unknown>)[key]));
}

export const AI_DISCLAIMER =
  'Edge AI is an analyst/coach. It is advisory only — it never executes trades, cashes out, or guarantees outcomes, and it never claims to. Review any output against your plan and rules.';

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item: string) => item.trim())
    .filter(Boolean);
}

export interface SanitizedAIResponse {
  summary: string;
  observations: string[];
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  improvements: string[];
  confidence: number | null;
  disclaimer: string;
}

/**
 * Copies ONLY the contract fields out of an arbitrary provider payload,
 * normalizing types and clamping confidence, and guarantees a safe disclaimer
 * is always present. Mirrors web safety.js sanitizeResponse().
 */
export function sanitizeAIResponse(raw: unknown, disclaimer = AI_DISCLAIMER): SanitizedAIResponse {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  let confidence: number | null = null;
  if (source.confidence !== null && source.confidence !== undefined) {
    const n = Number(source.confidence);
    confidence = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
  }

  const sanitized: SanitizedAIResponse = {
    summary: typeof source.summary === 'string' ? source.summary : '',
    observations: toList(source.observations),
    strengths: toList(source.strengths),
    weaknesses: toList(source.weaknesses),
    risks: toList(source.risks),
    improvements: toList(source.improvements),
    confidence,
    disclaimer: typeof source.disclaimer === 'string' && source.disclaimer ? source.disclaimer : disclaimer,
  };

  rejectDirectiveText(
    [
      sanitized.summary,
      ...sanitized.observations,
      ...sanitized.strengths,
      ...sanitized.weaknesses,
      ...sanitized.risks,
      ...sanitized.improvements,
    ]
      .filter(Boolean)
      .join(' \n ')
  );

  return freezeDeep(sanitized);
}
