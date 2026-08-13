// Server-side response safety (Sprint 9.6).
//
// Reuses the EXISTING Sprint 9.x sanitizers + contract validators unchanged —
// the server never re-runs directive detection or allow-lists from scratch, so
// there is exactly ONE sanitizer for each kind across the whole product.

import { sanitizeResponse, assertResponseContract } from '../../src/lib/ai/safety.js';
import { sanitizeJournalResponse, assertJournalResponse } from '../../src/lib/ai/journalIntelligence.js';
import { sanitizeCoachingResponse, assertCoachingResponseContract } from '../../src/lib/ai/coaching.js';
import { sanitizeAskJournalResponse, assertAskJournalResponse } from '../../src/lib/ai/askJournal.js';

// Strictly maps a raw provider payload to the existing feature contract, then
// enforces it. Throws a controlled AIError(AI_INVALID_RESPONSE) when directive
// / guarantee language or an out-of-contract shape appears — that error is
// normalized by the provider layer before it can reach the client.
export function sanitizeForKind(kind, rawAnalysis) {
  switch (kind) {
    case 'journalIntelligence':
      return assertJournalResponse(sanitizeJournalResponse(rawAnalysis));
    case 'coaching':
      return assertCoachingResponseContract(sanitizeCoachingResponse(rawAnalysis));
    case 'askJournal':
      return assertAskJournalResponse(sanitizeAskJournalResponse(rawAnalysis));
    case 'tradeReview':
    default:
      return assertResponseContract(sanitizeResponse(rawAnalysis));
  }
}