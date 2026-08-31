// Test: Production Logger — Redaction of Sensitive Data
// Verifies that tokens, passwords, and API keys are never leaked in log output.

import { logger } from '../../mobile/src/utils/logger';

describe('Error Observability Logger', () => {
  it('redacts JWT tokens from string messages', () => {
    const rawToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OX0.abc123signature';
    const sanitized = logger.sanitize(`Bearer ${rawToken}`);
    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain(rawToken);
  });

  it('redacts password fields in objects', () => {
    const obj = { username: 'trader@example.com', password: 'SuperSecret123!' };
    const sanitized = logger.sanitize(obj);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.username).toBe('trader@example.com');
  });

  it('redacts token fields in context objects', () => {
    const context = { accessToken: 'real-bearer-token-value', userId: 'user-123' };
    const sanitized = logger.sanitize(context);
    expect(sanitized.accessToken).toBe('[REDACTED]');
    expect(sanitized.userId).toBe('user-123');
  });

  it('redacts service_role keys in nested objects', () => {
    const obj = { service_role: 'service-role-secret-key', table: 'trades' };
    const sanitized = logger.sanitize(obj);
    expect(sanitized.service_role).toBe('[REDACTED]');
    expect(sanitized.table).toBe('trades');
  });

  it('redacts api_key fields', () => {
    const obj = { api_key: 'AIzaSyGeminiKey12345', model: 'gemini-pro' };
    const sanitized = logger.sanitize(obj);
    expect(sanitized.api_key).toBe('[REDACTED]');
    expect(sanitized.model).toBe('gemini-pro');
  });

  it('stores error reports in history', () => {
    logger.clearErrorReports();
    logger.error('AI', 'Test AI error', { module: 'EdgeAIScreen' });
    const reports = logger.getRecentErrorReports();
    expect(reports.length).toBeGreaterThanOrEqual(1);
    const last = reports[reports.length - 1];
    expect(last.category).toBe('AI');
    expect(last.message).toBe('Test AI error');
    expect(last.context?.module).toBe('EdgeAIScreen');
    expect(last.timestamp).toBeTruthy();
  });

  it('caps error history at 50 entries', () => {
    logger.clearErrorReports();
    for (let i = 0; i < 60; i++) {
      logger.error('SYSTEM', `Error ${i}`);
    }
    const reports = logger.getRecentErrorReports();
    expect(reports.length).toBeLessThanOrEqual(50);
  });
});
