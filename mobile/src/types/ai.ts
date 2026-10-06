// Edge AI Contracts & Safety Types
// Aligned with web src/lib/ai/types.js and canonicalContext.js

export type AIRequestKind =
  | 'journalIntelligence'
  | 'tradeReview'
  | 'coaching'
  | 'askJournal';

// Mirrored from web AI_ERROR_CODES
export const AI_ERROR_CODES = {
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_ACCOUNT_SCOPE_ERROR: 'AI_ACCOUNT_SCOPE_ERROR',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_NOT_ENOUGH_DATA: 'AI_NOT_ENOUGH_DATA',
  AI_INVALID_QUESTION: 'AI_INVALID_QUESTION',
} as const;

export type AIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

// Data coverage levels — mirrors web canonicalContext.js DATA_COVERAGE
export type AIDataCoverage =
  | 'NOT_ENOUGH_DATA'
  | 'LIMITED_DATA'
  | 'EARLY_PATTERN'
  | 'NORMAL_PATTERN_ANALYSIS';

export interface AIDataQualityInfo {
  tradeCount: number;
  coverage: AIDataCoverage;
  label: string;
  limitations: string[];
}

// The canonical AI response contract — mirrors web safety.js RESPONSE_CONTRACT.
// These are the ONLY fields the server sanitizer allows through.
// Deterministic fields (performance, risk) are canonical and not model-authored.
export interface AIResponseContract {
  summary?: string;
  observations?: string[];
  strengths?: string[];
  weaknesses?: string[];
  risks?: string[];
  improvements?: string[];
  confidence?: number | null;
  disclaimer?: string;
  // Structured sections (journal intelligence / coaching)
  keyPatterns?: string[];
  actionPlan?: string[];
  psychology?: string[];
  // Legacy headline/score fields (backwards-compatible)
  headline?: string;
  score?: number;
  answer?: string;
  evidence?: string[];
  recommendations?: string[];
  insights?: Array<{
    title: string;
    description: string;
    impact?: 'positive' | 'negative' | 'neutral';
  }>;
  [key: string]: unknown;
}

/** @deprecated Use AIResponseContract directly */
export type AIAnalysisResult = AIResponseContract;

export interface AIResponse {
  ok: boolean;
  status: string;
  message?: string;
  analysis: AIResponseContract | null;
  plan?: unknown;
}

export interface AIHealthProbe {
  ok: boolean;
  enabled: boolean;
  ready: boolean;
}

export type AIStatus = 'READY' | 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'ERROR';

// The canonical context sent to the server for journal-level AI features.
// Only kind + context travel over the wire — never credentials or system prompt.
export interface CanonicalAIRequest {
  kind: AIRequestKind;
  context: CanonicalAIRequestContext;
}

export interface CanonicalAIRequestContext {
  accountId?: string | null;
  // Journal-level canonical blocks (pre-computed, model-read-only)
  dataQuality?: AIDataQualityInfo;
  performance?: Record<string, unknown>;
  risk?: Record<string, unknown>;
  completeness?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
  setupPerformance?: Record<string, unknown>;
  heatmap?: Record<string, unknown>;
  mistakeIntelligence?: Record<string, unknown>;
  disciplineScore?: Record<string, unknown>;
  emotion?: Record<string, unknown>;
  patterns?: Record<string, unknown>;
  recentTrades?: Record<string, unknown>[];
  // Ask Journal
  query?: string;
  intent?: 'performance' | 'qualitative';
  // Trade Review
  trade?: Record<string, unknown>;
  calculations?: Record<string, unknown>;
}

/** @deprecated Use AIRequestContext from canonicalContextEngine instead */
export interface AIRequestContext {
  accountId?: string | null;
  trades?: unknown[];
  metrics?: Record<string, unknown>;
  prompt?: string;
  query?: string;
  timeframe?: string;
  [key: string]: unknown;
}

