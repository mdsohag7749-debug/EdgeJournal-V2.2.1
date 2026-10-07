// EdgeJournal AI — Unified Client Orchestration Layer.
//
// Mediates user queries, validates request structures, passes session
// authorization headers to the serverless AI API, and returns normalized safe
// analytical responses. Never accesses private API keys directly.

import { createAIProvider, resolveAIConfig } from './provider.js';
import { generateAIJournalAnswer } from './askJournal.js';
import { validateAIUserQuery } from './aiPrompts.js';
import { AIError } from './errors.js';
import { AI_ERROR_CODES } from './types.js';

/**
 * Submits a natural-language question to Edge AI about the user's journal.
 *
 * @param {Object} params
 * @param {string} params.question - User's question text
 * @param {Array} params.trades - Account-scoped trades array
 * @param {string} params.accountId - Concrete account ID
 * @param {string} [params.accountName] - Account display name
 * @param {Object} [params.provider] - Optional injected provider for tests
 * @param {AbortSignal} [params.signal] - Optional abort signal
 * @returns {Promise<Object>} Normalized AI answer object
 */
export async function askEdgeAI({
  question,
  trades = [],
  accountId,
  accountName,
  provider = null,
  signal = null,
} = {}) {
  // Validate query
  const queryCheck = validateAIUserQuery(question);
  if (!queryCheck.valid) {
    throw new AIError(AI_ERROR_CODES.AI_PROVIDER_ERROR, queryCheck.error);
  }

  if (!accountId) {
    throw new AIError(
      AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
      'Please select a specific trading account to analyze. Cross-account queries are not permitted.'
    );
  }

  const activeProvider = provider || createAIProvider(resolveAIConfig());

  // Use the canonical generateAIJournalAnswer pipeline
  return generateAIJournalAnswer({
    question: queryCheck.normalized,
    trades,
    accountId,
    accountName,
    provider: activeProvider,
    signal,
  });
}
