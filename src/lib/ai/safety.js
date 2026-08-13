// Lightweight AI safety layer.
//
// AI is an ANALYST/COACH — never an execution engine, never a source of truth
// for recorded facts or canonical metrics. This module encodes that contract
// in rules, a response shape, and defensive immutability helpers.

import { AIError } from './errors';
import { AI_ERROR_CODES, AI_DISCLAIMER, RESPONSE_KEYS, RESPONSE_LIST_KEYS } from './types';

// Machine-readable guard rails. Used by future UI/tests; not a moderation
// system — each rule is a single assertion a reviewer or test can verify.
export const AI_SAFETY_RULES = [
  { id: 'advisory-only', label: 'AI output is advisory, never a trade directive.' },
  { id: 'no-execution', label: 'AI cannot create, edit, or delete trades.' },
  { id: 'no-mutation', label: 'AI cannot change balances, PnL, RR, risk, or journal data.' },
  { id: 'no-guarantees', label: 'AI never guarantees profit or outcomes.' },
  { id: 'no-fabrication', label: 'AI cannot invent facts that are missing from the journal.' },
  { id: 'no-cross-account', label: 'AI never mixes data across accounts.' },
  { id: 'canonical-authoritative', label: 'Recorded and calculated metrics remain the source of truth.' },
];

// Recursively freezes an (already copied) object graph so downstream AI code
// literally cannot mutate the structured context/response it was handed.
export function freezeDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === 'object') value[key] = freezeDeep(child);
  }
  return Object.freeze(value);
}

export function isDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.keys(value).every((key) => isDeepFrozen(value[key]));
}

// --- Response contract enforcement -------------------------------------------

// Copies ONLY the contract fields out of an arbitrary provider payload,
// normalizing types and clamping confidence, and guarantees a safe disclaimer
// is always present.
export function sanitizeResponse(raw, { disclaimer = AI_DISCLAIMER } = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  let confidence = null;
  if (source.confidence !== null && source.confidence !== undefined) {
    const n = Number(source.confidence);
    confidence = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
  }

  const sanitized = {
    summary: typeof source.summary === 'string' ? source.summary : '',
    observations: toList(source.observations),
    strengths: toList(source.strengths),
    weaknesses: toList(source.weaknesses),
    risks: toList(source.risks),
    improvements: toList(source.improvements),
    confidence,
    disclaimer: typeof source.disclaimer === 'string' && source.disclaimer ? source.disclaimer : disclaimer,
  };

  return freezeDeep(sanitized);
}

export function validateResponseContract(response) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return { ok: false, errors: ['AI response must be a single object.'], response: null };
  }

  const errors = [];

  if (response.summary !== undefined && typeof response.summary !== 'string') {
    errors.push('summary must be a string');
  }
  for (const key of RESPONSE_LIST_KEYS) {
    if (response[key] !== undefined && !Array.isArray(response[key])) {
      errors.push(`${key} must be an array`);
    }
  }
  if (response.confidence !== undefined && response.confidence !== null) {
    const n = Number(response.confidence);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      errors.push('confidence must be a number between 0 and 1, or null');
    }
  }
  if (response.disclaimer !== undefined && typeof response.disclaimer !== 'string') {
    errors.push('disclaimer must be a string');
  }

  return { ok: errors.length === 0, errors, response };
}

export function assertResponseContract(response) {
  const check = validateResponseContract(response);
  if (!check.ok) {
    throw new AIError(AI_ERROR_CODES.AI_INVALID_RESPONSE, 'AI returned a response outside the allowed contract.');
  }
  return check.response;
}

function toList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}