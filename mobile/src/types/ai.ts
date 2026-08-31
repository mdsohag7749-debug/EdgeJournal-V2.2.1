// Edge AI Contracts & Safety Types

export type AIRequestKind =
  | 'journalIntelligence'
  | 'tradeReview'
  | 'coaching'
  | 'askJournal';

export interface AIRequestContext {
  accountId?: string | null;
  trades?: any[];
  metrics?: Record<string, any>;
  prompt?: string;
  query?: string;
  timeframe?: string;
  [key: string]: any;
}

export interface AIAnalysisResult {
  headline?: string;
  summary?: string;
  insights?: Array<{
    title: string;
    description: string;
    impact?: 'positive' | 'negative' | 'neutral';
  }>;
  recommendations?: string[];
  strengths?: string[];
  weaknesses?: string[];
  score?: number;
  answer?: string;
  evidence?: string[];
  [key: string]: any;
}

export interface AIResponse {
  ok: boolean;
  status: string;
  message?: string;
  analysis: AIAnalysisResult | null;
  plan?: any;
}

export interface AIHealthProbe {
  ok: boolean;
  enabled: boolean;
  ready: boolean;
}

export type AIStatus = 'READY' | 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'ERROR';
