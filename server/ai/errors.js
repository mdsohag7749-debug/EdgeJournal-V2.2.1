// Server-side AI error helpers (Sprint 9.6).
//
// Thin re-export of the existing controlled error model so server code keeps
// ONE error vocabulary with the client foundation — no parallel error system.

export {
  AIError,
  isAIError,
  aiError,
  aiAccountScopeError,
  toSafeAIError,
  toSafeAIResult,
} from '../../src/lib/ai/errors';

export { AI_ERROR_CODES, AI_STATUS_OK, AI_PLANS, planForKey } from '../../src/lib/ai/types';