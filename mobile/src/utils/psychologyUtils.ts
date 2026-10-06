// Shared psychology emotion definitions — importable in tests and components
// without triggering React/JSX parse issues

export interface EmotionMeta {
  key: string;
  label: string;
  tone: 'pos' | 'neg';
  desc?: string;
}

export const PSYCH_EMOTIONS: EmotionMeta[] = [
  { key: 'Confidence', label: 'Confidence', tone: 'pos', desc: 'Trust in strategy & execution' },
  { key: 'Patience', label: 'Patience', tone: 'pos', desc: 'Waited for clear confirmation' },
  { key: 'Focus', label: 'Focus', tone: 'pos', desc: 'Present & undisturbed by noise' },
  { key: 'Fear', label: 'Fear', tone: 'neg', desc: 'Hesitation or early exit anxiety' },
  { key: 'Greed', label: 'Greed', tone: 'neg', desc: 'Overleveraging / unrealistic target' },
  { key: 'FOMO', label: 'FOMO', tone: 'neg', desc: 'Chased entry after move started' },
  { key: 'Revenge', label: 'Revenge', tone: 'neg', desc: 'Urge to recover prior loss' },
  { key: 'Stress', label: 'Stress', tone: 'neg', desc: 'Physical / emotional tension' },
];

export const DEFAULT_MODELS = ['Breakout', 'Pullback', 'Reversal', 'Range Fade'];

export const DEFAULT_RISK_CRITERIA = [
  'Risk does not exceed max daily loss limit',
  'Position size matches plan',
  'Stop loss placed before entry',
];

export const DEFAULT_CHECKLIST_CRITERIA = [
  'Aligned with pre-market bias',
  'Entered at planned level',
  'Confirmation candle present',
];

/**
 * Validates that a psychology rating is an integer 1–5.
 * Malformed/out-of-range values must not be persisted.
 */
export function validatePsychRating(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 5;
}

/**
 * Safely parses a DB psychology JSONB column into a typed Record<string, number>,
 * stripping any invalid or out-of-range values.
 */
export function parsePsychology(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (validatePsychRating(v)) result[k] = v as number;
  }
  return result;
}

/**
 * Safely parses a DB checklist JSONB column into a typed Record<string, boolean>,
 * stripping non-boolean values that would corrupt the checklist state.
 */
export function parseChecklist(raw: unknown): Record<string, boolean> {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') result[k] = v;
  }
  return result;
}

/**
 * Computes how many checklist items are checked vs total configured.
 */
export function computeChecklistScore(
  checklist: Record<string, boolean>,
  criteria: string[]
): { checked: number; total: number } {
  const checked = criteria.filter((c) => !!checklist[c]).length;
  return { checked, total: criteria.length };
}

// Re-export deterministic calculation engine
export * from './psychologyEngine';

