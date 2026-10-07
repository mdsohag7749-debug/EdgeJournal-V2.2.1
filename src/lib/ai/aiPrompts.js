// EdgeJournal AI — Client-side Prompt Architecture and Safety.
//
// Enforces prompt structure, separates untrusted user inputs,
// provides canonical prompt suggestions, and screens out prompt injection
// or directive language before requests leave the client.

import { ASK_QUESTION_INJECTION_PATTERN, ASK_JOURNAL_DIRECTIVE_PATTERN } from './askJournal.js';

/**
 * Pre-curated, grounded question templates for the Edge AI Command Center.
 * These queries are guaranteed to align with the analytical journal schema.
 */
export const QUICK_QUESTION_PROMPTS = [
  {
    id: 'performance_drop',
    category: 'Performance',
    label: 'Why did my performance drop this week?',
    query: 'Why did my performance drop recently? What does my journal indicate?',
  },
  {
    id: 'best_instrument',
    category: 'Instruments',
    label: 'Which pair performs best for me?',
    query: 'Which pair or instrument performs best for me based on recorded trades?',
  },
  {
    id: 'losing_mistakes',
    category: 'Psychology & Discipline',
    label: 'What mistakes appear most in my losses?',
    query: 'What mistakes appear most often in my losing trades?',
  },
  {
    id: 'risk_consistency',
    category: 'Risk Management',
    label: 'How consistent is my risk?',
    query: 'How consistent is my risk discipline and percentage per trade?',
  },
  {
    id: 'session_results',
    category: 'Sessions',
    label: 'What session gives me the best results?',
    query: 'What session gives me the best results and highest win rate?',
  },
  {
    id: 'last_20_trades',
    category: 'Summary',
    label: 'Summarize my last 20 trades.',
    query: 'Summarize my last 20 trades: key patterns, discipline, and outcomes.',
  },
  {
    id: 'recurring_weakness',
    category: 'Discipline',
    label: 'What is my biggest recurring trading mistake?',
    query: 'What is my biggest recurring trading mistake across all logged setups?',
  },
];

/**
 * Validates a user query for safety, length, and injection patterns.
 *
 * @param {string} raw - The user's input string
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function validateAIUserQuery(raw) {
  if (typeof raw !== 'string') {
    return { valid: false, normalized: '', error: 'Question must be text.' };
  }

  const normalized = raw.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return { valid: false, normalized: '', error: 'Please enter a question about your trading journal.' };
  }

  if (normalized.length < 5) {
    return { valid: false, normalized, error: 'Question is too short to be analytical.' };
  }

  if (normalized.length > 500) {
    return { valid: false, normalized, error: 'Question exceeds the maximum 500 characters.' };
  }

  // Check for automated trading or signal directive demands first
  if (ASK_JOURNAL_DIRECTIVE_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Edge AI is an analytical assistant only. It cannot generate trade signals, guarantee profits, or place orders.',
    };
  }

  // Check for prompt-injection or system instruction overrides
  if (
    ASK_QUESTION_INJECTION_PATTERN.test(normalized) ||
    /\b(?:gemini_api_key|api_key|service_role|supabase_service)\b/i.test(normalized)
  ) {
    return {
      valid: false,
      normalized,
      error: 'Query contains forbidden instructions. I can only analyze your recorded journal data.',
    };
  }

  return { valid: true, normalized };
}
