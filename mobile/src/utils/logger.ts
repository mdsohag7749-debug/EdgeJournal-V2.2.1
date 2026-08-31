// Production-safe Error Observability & Logging Utility
// Ensures zero leakage of credentials, tokens, API keys, or raw dumps.

export type LogCategory = 'AUTH' | 'ACCOUNT' | 'DATA' | 'AI' | 'OFFLINE' | 'NAVIGATION' | 'SYSTEM';

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /ey[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]*/g, // JWTs
  /password["':\s]+[^\s,"'\}]+/gi,
  /secret["':\s]+[^\s,"'\}]+/gi,
  /api[_-]?key["':\s]+[^\s,"'\}]+/gi,
  /service[_-]?role["':\s]+[^\s,"'\}]+/gi,
];

function sanitize(input: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    let sanitized = input;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      return input.map(sanitize);
    }
    const copy: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('apikey') ||
        lower.includes('api_key') ||
        lower.includes('service_role')
      ) {
        copy[key] = '[REDACTED]';
      } else {
        copy[key] = sanitize(input[key]);
      }
    }
    return copy;
  }
  return input;
}

export interface ErrorReport {
  category: LogCategory;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  stack?: string;
}

const errorReportsHistory: ErrorReport[] = [];
const MAX_HISTORY = 50;

export const logger = {
  sanitize,

  debug(category: LogCategory, message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG][${category}] ${sanitize(message)}`, context ? sanitize(context) : '');
    }
  },

  info(category: LogCategory, message: string, context?: Record<string, any>) {
    console.info(`[INFO][${category}] ${sanitize(message)}`, context ? sanitize(context) : '');
  },

  warn(category: LogCategory, message: string, context?: Record<string, any>) {
    console.warn(`[WARN][${category}] ${sanitize(message)}`, context ? sanitize(context) : '');
  },

  error(category: LogCategory, errorOrMessage: any, context?: Record<string, any>): ErrorReport {
    const message =
      typeof errorOrMessage === 'string'
        ? errorOrMessage
        : errorOrMessage?.message || 'An unknown error occurred';
    const stack = errorOrMessage?.stack ? sanitize(String(errorOrMessage.stack)) : undefined;
    const sanitizedContext = context ? sanitize(context) : undefined;

    const report: ErrorReport = {
      category,
      message: sanitize(message),
      timestamp: new Date().toISOString(),
      context: sanitizedContext,
      stack,
    };

    errorReportsHistory.push(report);
    if (errorReportsHistory.length > MAX_HISTORY) {
      errorReportsHistory.shift();
    }

    console.error(`[ERROR][${category}] ${report.message}`, sanitizedContext || '');

    return report;
  },

  getRecentErrorReports(): readonly ErrorReport[] {
    return Object.freeze([...errorReportsHistory]);
  },

  clearErrorReports() {
    errorReportsHistory.length = 0;
  },
};
