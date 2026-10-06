import { describe, it, expect } from 'vitest';
import {
  PSYCH_EMOTIONS,
  EmotionMeta,
  validatePsychRating,
  parsePsychology,
  parseChecklist,
  computeChecklistScore,
  DEFAULT_RISK_CRITERIA,
  DEFAULT_CHECKLIST_CRITERIA,
} from '../src/utils/psychologyUtils';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('P0.2 — Psychology Matrix & Checklists', () => {
  describe('Psychology Emotion Definitions', () => {
    it('exports exactly 8 standard psychology emotions', () => {
      expect(PSYCH_EMOTIONS).toHaveLength(8);
    });

    it('includes all 3 positive (pos) emotions', () => {
      const positives = PSYCH_EMOTIONS.filter((e) => e.tone === 'pos').map((e) => e.key);
      expect(positives).toContain('Confidence');
      expect(positives).toContain('Patience');
      expect(positives).toContain('Focus');
    });

    it('includes all 5 negative (neg) emotions', () => {
      const negatives = PSYCH_EMOTIONS.filter((e) => e.tone === 'neg').map((e) => e.key);
      expect(negatives).toContain('Fear');
      expect(negatives).toContain('Greed');
      expect(negatives).toContain('FOMO');
      expect(negatives).toContain('Revenge');
      expect(negatives).toContain('Stress');
    });

    it('each emotion has a key, label, and tone', () => {
      PSYCH_EMOTIONS.forEach((e: EmotionMeta) => {
        expect(e.key).toBeTruthy();
        expect(e.label).toBeTruthy();
        expect(['pos', 'neg']).toContain(e.tone);
      });
    });
  });

  describe('Psychology Rating Validation (1–5)', () => {
    it('accepts integers 1 through 5 as valid', () => {
      for (let n = 1; n <= 5; n++) {
        expect(validatePsychRating(n)).toBe(true);
      }
    });

    it('rejects 0 as invalid', () => {
      expect(validatePsychRating(0)).toBe(false);
    });

    it('rejects 6 as invalid', () => {
      expect(validatePsychRating(6)).toBe(false);
    });

    it('rejects non-integers (floats) as invalid', () => {
      expect(validatePsychRating(2.5)).toBe(false);
      expect(validatePsychRating(3.9)).toBe(false);
    });

    it('rejects strings as invalid', () => {
      expect(validatePsychRating('3')).toBe(false);
    });

    it('rejects null/undefined as invalid', () => {
      expect(validatePsychRating(null)).toBe(false);
      expect(validatePsychRating(undefined)).toBe(false);
    });
  });

  describe('Psychology Persistence and Loading', () => {
    it('parses a full, valid psychology object from DB row', () => {
      const raw = { Confidence: 4, Patience: 3, Focus: 5, Fear: 1, Greed: 2, FOMO: 3, Revenge: 1, Stress: 2 };
      const parsed = parsePsychology(raw);
      expect(parsed['Confidence']).toBe(4);
      expect(parsed['Fear']).toBe(1);
      expect(Object.keys(parsed)).toHaveLength(8);
    });

    it('returns empty object for null psychology (unpopulated trade)', () => {
      expect(parsePsychology(null)).toEqual({});
    });

    it('returns empty object for malformed psychology values', () => {
      const raw = { Confidence: 'good', Fear: null, Focus: -1 };
      const parsed = parsePsychology(raw);
      expect(Object.keys(parsed)).toHaveLength(0);
    });

    it('parses a partial psychology object correctly', () => {
      const raw = { Confidence: 5, FOMO: 2 };
      const parsed = parsePsychology(raw);
      expect(parsed['Confidence']).toBe(5);
      expect(parsed['FOMO']).toBe(2);
      expect(parsed['Fear']).toBeUndefined();
    });

    it('strips out-of-range values from DB row', () => {
      const raw = { Confidence: 5, Fear: 7, Patience: 0 };
      const parsed = parsePsychology(raw);
      expect(parsed['Confidence']).toBe(5);
      expect(parsed['Fear']).toBeUndefined();
      expect(parsed['Patience']).toBeUndefined();
    });

    it('returns existing value when same rating re-selected (toggle-off simulation)', () => {
      const psychology: Record<string, number> = { Confidence: 4 };
      // Simulate toggle-off: same value selected again → delete key
      const current = psychology['Confidence'];
      const tapped = 4; // same
      if (current === tapped) delete psychology['Confidence'];
      expect(psychology['Confidence']).toBeUndefined();
    });
  });

  describe('Risk Management Checklist', () => {
    it('exports 3 default risk criteria', () => {
      expect(DEFAULT_RISK_CRITERIA).toHaveLength(3);
    });

    it('includes required risk items', () => {
      expect(DEFAULT_RISK_CRITERIA).toContain('Risk does not exceed max daily loss limit');
      expect(DEFAULT_RISK_CRITERIA).toContain('Position size matches plan');
      expect(DEFAULT_RISK_CRITERIA).toContain('Stop loss placed before entry');
    });

    it('toggles a checklist item to true', () => {
      const checklist: Record<string, boolean> = {};
      checklist['Risk does not exceed max daily loss limit'] = true;
      expect(checklist['Risk does not exceed max daily loss limit']).toBe(true);
    });

    it('computes 0/3 score for empty checklist', () => {
      const { checked, total } = computeChecklistScore({}, DEFAULT_RISK_CRITERIA);
      expect(checked).toBe(0);
      expect(total).toBe(3);
    });

    it('computes full 3/3 score when all criteria checked', () => {
      const checklist: Record<string, boolean> = {};
      DEFAULT_RISK_CRITERIA.forEach((c) => (checklist[c] = true));
      const { checked, total } = computeChecklistScore(checklist, DEFAULT_RISK_CRITERIA);
      expect(checked).toBe(3);
      expect(total).toBe(3);
    });
  });

  describe('Trade Execution Checklist', () => {
    it('exports 3 default trade checklist criteria', () => {
      expect(DEFAULT_CHECKLIST_CRITERIA).toHaveLength(3);
    });

    it('includes required execution items', () => {
      expect(DEFAULT_CHECKLIST_CRITERIA).toContain('Aligned with pre-market bias');
      expect(DEFAULT_CHECKLIST_CRITERIA).toContain('Entered at planned level');
      expect(DEFAULT_CHECKLIST_CRITERIA).toContain('Confirmation candle present');
    });

    it('correctly computes partial score 1/3', () => {
      const checklist: Record<string, boolean> = {
        'Aligned with pre-market bias': true,
        'Entered at planned level': false,
        'Confirmation candle present': false,
      };
      const { checked } = computeChecklistScore(checklist, DEFAULT_CHECKLIST_CRITERIA);
      expect(checked).toBe(1);
    });
  });

  describe('Checklist Data Safety', () => {
    it('parses valid boolean checklist safely', () => {
      const raw = { 'Risk does not exceed max daily loss limit': true, 'Position size matches plan': false };
      const parsed = parseChecklist(raw);
      expect(parsed['Risk does not exceed max daily loss limit']).toBe(true);
      expect(parsed['Position size matches plan']).toBe(false);
    });

    it('strips non-boolean values without throwing', () => {
      const malformed = { 'Stop loss placed before entry': 'yes', 'Position size matches plan': 1 };
      const parsed = parseChecklist(malformed);
      expect(Object.keys(parsed)).toHaveLength(0);
    });

    it('returns empty object for null checklist', () => {
      expect(parseChecklist(null)).toEqual({});
    });

    it('returns empty object for non-object checklist', () => {
      expect(parseChecklist('invalid')).toEqual({});
      expect(parseChecklist(42)).toEqual({});
    });
  });

  describe('Cross-platform Field Mapping', () => {
    it('DB column risk_checklist maps to riskChecklist in Trade interface', () => {
      // Simulate mapTradeFromDb behaviour
      const row = {
        risk_checklist: { 'Position size matches plan': true },
        trade_checklist: { 'Aligned with pre-market bias': false },
        psychology: { Confidence: 4, Fear: 2 },
      };

      const mapped = {
        riskChecklist: typeof row.risk_checklist === 'object' && row.risk_checklist !== null ? row.risk_checklist : {},
        tradeChecklist: typeof row.trade_checklist === 'object' && row.trade_checklist !== null ? row.trade_checklist : {},
        psychology: typeof row.psychology === 'object' && row.psychology !== null ? row.psychology : {},
      };

      expect(mapped.riskChecklist['Position size matches plan']).toBe(true);
      expect(mapped.tradeChecklist['Aligned with pre-market bias']).toBe(false);
      expect(mapped.psychology['Confidence']).toBe(4);
    });

    it('falls back to empty object when DB column is null (new trade / not yet set)', () => {
      const row = { risk_checklist: null, trade_checklist: null, psychology: null };
      const mapped = {
        riskChecklist: typeof row.risk_checklist === 'object' && row.risk_checklist !== null ? row.risk_checklist : {},
        tradeChecklist: typeof row.trade_checklist === 'object' && row.trade_checklist !== null ? row.trade_checklist : {},
        psychology: typeof row.psychology === 'object' && row.psychology !== null ? row.psychology : {},
      };
      expect(mapped.riskChecklist).toEqual({});
      expect(mapped.tradeChecklist).toEqual({});
      expect(mapped.psychology).toEqual({});
    });
  });
});
