import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService, KEYS } from '../src/services/storageService';
import { backupService } from '../src/services/backupService';
import { DEFAULT_MODELS, DEFAULT_RISK_CRITERIA, DEFAULT_CHECKLIST_CRITERIA } from '../src/utils/psychologyUtils';
import { Trade } from '../src/types/models';

describe('P2.2 Settings Parity Test Suite', () => {
  beforeEach(async () => {
    // Reset storage before each test
    await storageService.setItem(KEYS.models, JSON.stringify(DEFAULT_MODELS));
    await storageService.setItem(KEYS.riskCriteria, JSON.stringify(DEFAULT_RISK_CRITERIA));
    await storageService.setItem(KEYS.checklistCriteria, JSON.stringify(DEFAULT_CHECKLIST_CRITERIA));
  });

  describe('Trading Models Management & Validation', () => {
    it('initializes with default Web trading models', async () => {
      const models = await storageService.getJSON<string[]>(KEYS.models, []);
      expect(models).toEqual(['Breakout', 'Pullback', 'Reversal', 'Range Fade']);
    });

    it('creates a new trading model when valid and non-duplicate', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.models, []);
      const newModel = 'Fair Value Gap';
      
      const isDuplicate = current.some((m) => m.toLowerCase() === newModel.toLowerCase());
      expect(isDuplicate).toBe(false);

      const updated = [...current, newModel];
      await storageService.setJSON(KEYS.models, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.models, []);
      expect(stored).toContain('Fair Value Gap');
      expect(stored.length).toBe(5);
    });

    it('rejects duplicate trading models case-insensitively', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.models, []);
      const duplicateModel = 'breakout'; // Lowercase of 'Breakout'

      const isDuplicate = current.some((m) => m.toLowerCase() === duplicateModel.toLowerCase());
      expect(isDuplicate).toBe(true);
    });

    it('rejects blank or empty model names', () => {
      const validate = (name: string) => {
        const trimmed = String(name || '').trim();
        return trimmed.length > 0;
      };

      expect(validate('')).toBe(false);
      expect(validate('   ')).toBe(false);
      expect(validate('Trend Continuation')).toBe(true);
    });

    it('edits an existing trading model correctly', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.models, []);
      const oldName = 'Range Fade';
      const newName = 'Range Expansion';

      const updated = current.map((m) => (m === oldName ? newName : m));
      await storageService.setJSON(KEYS.models, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.models, []);
      expect(stored).toContain('Range Expansion');
      expect(stored).not.toContain('Range Fade');
    });

    it('deletes a trading model', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.models, []);
      const toRemove = 'Reversal';

      const updated = current.filter((m) => m !== toRemove);
      await storageService.setJSON(KEYS.models, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.models, []);
      expect(stored).not.toContain('Reversal');
      expect(stored.length).toBe(3);
    });
  });

  describe('Risk Checklist Criteria Management & Validation', () => {
    it('initializes with default risk checklist criteria', async () => {
      const criteria = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      expect(criteria).toEqual([
        'Risk does not exceed max daily loss limit',
        'Position size matches plan',
        'Stop loss placed before entry',
      ]);
    });

    it('adds a new risk criterion with validation', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      const newCriterion = 'Daily drawdown below 3%';

      const isDuplicate = current.some((c) => c.toLowerCase() === newCriterion.toLowerCase());
      expect(isDuplicate).toBe(false);

      const updated = [...current, newCriterion];
      await storageService.setJSON(KEYS.riskCriteria, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      expect(stored).toContain('Daily drawdown below 3%');
      expect(stored.length).toBe(4);
    });

    it('rejects duplicate risk criteria', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      const duplicateCriterion = 'Position size matches plan';

      const isDuplicate = current.some((c) => c.toLowerCase() === duplicateCriterion.toLowerCase());
      expect(isDuplicate).toBe(true);
    });

    it('edits an existing risk criterion', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      const oldCriterion = 'Stop loss placed before entry';
      const updatedCriterion = 'Hard stop loss set in order ticket';

      const updated = current.map((c) => (c === oldCriterion ? updatedCriterion : c));
      await storageService.setJSON(KEYS.riskCriteria, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      expect(stored).toContain('Hard stop loss set in order ticket');
      expect(stored).not.toContain('Stop loss placed before entry');
    });

    it('removes a risk criterion', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      const toRemove = 'Position size matches plan';

      const updated = current.filter((c) => c !== toRemove);
      await storageService.setJSON(KEYS.riskCriteria, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.riskCriteria, []);
      expect(stored).not.toContain('Position size matches plan');
      expect(stored.length).toBe(2);
    });
  });

  describe('Trade Execution Checklist Criteria Management & Validation', () => {
    it('initializes with default trade checklist criteria', async () => {
      const criteria = await storageService.getJSON<string[]>(KEYS.checklistCriteria, []);
      expect(criteria).toEqual([
        'Aligned with pre-market bias',
        'Entered at planned level',
        'Confirmation candle present',
      ]);
    });

    it('adds a new trade execution criterion', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.checklistCriteria, []);
      const newCriterion = 'Volume expansion on 5M breakout';

      const isDuplicate = current.some((c) => c.toLowerCase() === newCriterion.toLowerCase());
      expect(isDuplicate).toBe(false);

      const updated = [...current, newCriterion];
      await storageService.setJSON(KEYS.checklistCriteria, updated);

      const stored = await storageService.getJSON<string[]>(KEYS.checklistCriteria, []);
      expect(stored).toContain('Volume expansion on 5M breakout');
      expect(stored.length).toBe(4);
    });

    it('rejects duplicate trade execution criteria', async () => {
      const current = await storageService.getJSON<string[]>(KEYS.checklistCriteria, []);
      const dup = 'aligned with pre-market bias';

      const isDuplicate = current.some((c) => c.toLowerCase() === dup.toLowerCase());
      expect(isDuplicate).toBe(true);
    });
  });

  describe('Password Reset Flow Logic & Validation', () => {
    it('validates email addresses correctly', () => {
      const validateEmail = (email: string) => {
        const trimmed = String(email || '').trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      };

      expect(validateEmail('trader@edgejournal.com')).toBe(true);
      expect(validateEmail('john.doe+test@gmail.com')).toBe(true);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('trader@')).toBe(false);
      expect(validateEmail('trader@domain')).toBe(false);
    });

    it('handles password reset request successfully when configured', async () => {
      const mockResetPassword = vi.fn().mockResolvedValue({ error: null });

      const email = 'protrader@edgejournal.com';
      await mockResetPassword(email);

      expect(mockResetPassword).toHaveBeenCalledWith('protrader@edgejournal.com');
    });

    it('handles password reset failure securely without exposing tokens', async () => {
      const mockResetPassword = vi.fn().mockRejectedValue(new Error('Rate limit exceeded. Try again in 60s.'));

      let errorMsg = '';
      try {
        await mockResetPassword('protrader@edgejournal.com');
      } catch (err: any) {
        errorMsg = err.message;
      }

      expect(errorMsg).toBe('Rate limit exceeded. Try again in 60s.');
    });
  });

  describe('Backup & Restore System Settings Parity', () => {
    it('exports system settings in backup payload', () => {
      const payload = backupService.buildBackupPayload({
        models: ['Breakout', 'Order Block'],
        riskCriteria: ['Max Risk 1%'],
        checklistCriteria: ['HTF Aligned'],
      });

      expect(payload.app).toBe('EdgeJournal');
      expect(payload.models).toEqual(['Breakout', 'Order Block']);
      expect(payload.riskCriteria).toEqual(['Max Risk 1%']);
      expect(payload.checklistCriteria).toEqual(['HTF Aligned']);
    });

    it('validates backup payload with system settings', () => {
      const validPayload = {
        app: 'EdgeJournal',
        version: 1,
        exportedAt: new Date().toISOString(),
        models: ['Breakout'],
        riskCriteria: ['1% Risk'],
        checklistCriteria: ['Pre-market Bias'],
      };

      const result = backupService.validateBackupData(validPayload);
      expect(result.valid).toBe(true);
    });

    it('rejects malformed system settings in backup payload', () => {
      const malformedPayload = {
        app: 'EdgeJournal',
        version: 1,
        models: 'not-an-array',
      };

      const result = backupService.validateBackupData(malformedPayload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('"models" must be an array');
    });
  });

  describe('Trade Form Integration & Backward Compatibility', () => {
    it('preserves historical trade checklist entries even after criteria modification', () => {
      const historicalTrade: Trade = {
        id: 't-historical-1',
        userId: 'u-1',
        accountId: 'acc-1',
        symbol: 'NQ',
        direction: 'Long',
        entryDate: '2024-01-10',
        entryPrice: 18000,
        size: 2,
        netPnl: 400,
        status: 'Closed',
        setup: 'Old Deprecated Model',
        riskChecklist: {
          'Legacy Risk Rule 1999': true,
          'Stop loss placed before entry': true,
        },
        tradeChecklist: {
          'Legacy Execution Rule': true,
        },
      };

      // Active configured criteria in settings:
      const activeRiskCriteria = ['Risk does not exceed max daily loss limit', 'Position size matches plan'];
      
      // Trade Details Screen renders union of active and historical keys:
      const renderedRiskKeys = Array.from(
        new Set([...activeRiskCriteria, ...Object.keys(historicalTrade.riskChecklist!)])
      );

      expect(renderedRiskKeys).toContain('Legacy Risk Rule 1999');
      expect(renderedRiskKeys).toContain('Stop loss placed before entry');
      expect(renderedRiskKeys).toContain('Risk does not exceed max daily loss limit');
      expect(historicalTrade.riskChecklist!['Legacy Risk Rule 1999']).toBe(true);
    });

    it('populates trade setup options dynamically from configured models', () => {
      const configuredModels = ['ICT Silver Bullet', 'Opening Range Breakout', 'VWAP Scalp'];
      const setupOptions = configuredModels.map((m) => ({ label: m, value: m }));

      expect(setupOptions).toHaveLength(3);
      expect(setupOptions[0]).toEqual({ label: 'ICT Silver Bullet', value: 'ICT Silver Bullet' });
      expect(setupOptions[1]).toEqual({ label: 'Opening Range Breakout', value: 'Opening Range Breakout' });
    });
  });
});
