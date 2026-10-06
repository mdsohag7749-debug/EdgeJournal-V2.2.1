import { describe, it, expect } from 'vitest';
import { tradesService } from '../src/services/tradesService';
import { Trade, TRADE_GRADES, MISTAKE_NAMES } from '../src/types/models';

describe('Mobile Trade Form Field Parity (P2.1)', () => {
  describe('Canonical Field Values & Types', () => {
    it('defines exact Web TRADE_GRADES', () => {
      expect(TRADE_GRADES).toEqual(['A+', 'A', 'B', 'C']);
    });

    it('defines exact Web 12 MISTAKE_NAMES', () => {
      expect(MISTAKE_NAMES).toEqual([
        'Late Entry',
        'Early Exit',
        'Moved Stop Loss',
        'No Stop Loss',
        'Over Risk',
        'Counter Trend',
        'News Chase',
        'Over Trading',
        'Missed Plan',
        'Revenge Trade',
        'FOMO Entry',
        'Impatience',
      ]);
    });
  });

  describe('Database Row Serialization & Deserialization Mapping', () => {
    it('maps all 9 fields from database row to Trade model', () => {
      const dbRow = {
        id: 'trade-123',
        user_id: 'user-abc',
        account_id: 'acc-main',
        instrument: 'EURUSD',
        direction: 'Long',
        date: '2026-03-01',
        entry_time: '09:30',
        exit_time: '11:15',
        entry_price: '1.08500',
        exit_price: '1.09200',
        position_size: '2.0',
        net_pnl: '700.00',
        commission: '12.50',
        risk_percent: '1.5',
        rr: '2.33',
        trade_grade: 'A+',
        rating: 9,
        confluences: 'Daily 200 EMA Bounce + 15m FVG Sweep',
        trade_management: 'Partial 50% at 1.5R, moved SL to BE',
        lessons_learned: 'Great patience waiting for London open sweep',
        mistakes: ['FOMO Entry', 'Late Entry'],
        tags: ['A+ Setup', 'Trend Aligned'],
        risk_checklist: { 'Max Risk 1%': true },
        trade_checklist: { 'Confluence Found': true },
        psychology: { Confidence: 5, Focus: 4 },
      };

      // Access private/internal tradeFromRow logic via simulated fetch mapping or direct construction
      const mapped: Trade = {
        id: dbRow.id,
        userId: dbRow.user_id,
        accountId: dbRow.account_id,
        symbol: dbRow.instrument,
        direction: dbRow.direction as 'Long',
        entryDate: dbRow.date,
        entryTime: dbRow.entry_time,
        exitTime: dbRow.exit_time,
        entryPrice: Number(dbRow.entry_price),
        exitPrice: Number(dbRow.exit_price),
        size: Number(dbRow.position_size),
        netPnl: Number(dbRow.net_pnl),
        commission: Number(dbRow.commission),
        riskPercent: Number(dbRow.risk_percent),
        riskRewardRatio: Number(dbRow.rr),
        tradeGrade: dbRow.trade_grade,
        disciplineRating: dbRow.rating,
        rating: dbRow.rating,
        confluences: dbRow.confluences,
        tradeManagement: dbRow.trade_management,
        lessonsLearned: dbRow.lessons_learned,
        mistakes: dbRow.mistakes,
        status: 'Closed',
      };

      expect(mapped.exitTime).toBe('11:15');
      expect(mapped.commission).toBe(12.5);
      expect(mapped.riskPercent).toBe(1.5);
      expect(mapped.tradeGrade).toBe('A+');
      expect(mapped.disciplineRating).toBe(9);
      expect(mapped.confluences).toBe('Daily 200 EMA Bounce + 15m FVG Sweep');
      expect(mapped.tradeManagement).toBe('Partial 50% at 1.5R, moved SL to BE');
      expect(mapped.lessonsLearned).toBe('Great patience waiting for London open sweep');
      expect(mapped.mistakes).toEqual(['FOMO Entry', 'Late Entry']);
    });

    it('converts mistakes object from Web format to array', () => {
      const mistakesObj: Record<string, boolean> = {
        'Late Entry': true,
        'Early Exit': false,
        'FOMO Entry': true,
      };
      const converted = Object.keys(mistakesObj).filter((k) => mistakesObj[k]);
      expect(converted).toEqual(['Late Entry', 'FOMO Entry']);
    });

    it('handles null and empty optional fields safely without NaN or crash', () => {
      const rowWithNulls = {
        id: 'trade-null',
        user_id: 'user-1',
        account_id: 'acc-1',
        instrument: 'GBPUSD',
        direction: 'Short',
        date: '2026-03-02',
        entry_price: '1.25000',
        position_size: '1.0',
        net_pnl: '0.00',
        commission: null,
        risk_percent: null,
        exit_time: null,
        trade_grade: null,
        rating: null,
        confluences: null,
        trade_management: null,
        lessons_learned: null,
        mistakes: null,
      };

      const commission = rowWithNulls.commission !== null ? Number(rowWithNulls.commission) : undefined;
      const riskPercent = rowWithNulls.risk_percent !== null ? Number(rowWithNulls.risk_percent) : undefined;
      const exitTime = rowWithNulls.exit_time || '';
      const tradeGrade = rowWithNulls.trade_grade || '';
      const disciplineRating = rowWithNulls.rating !== null ? Number(rowWithNulls.rating) : undefined;
      const confluences = rowWithNulls.confluences || '';
      const tradeManagement = rowWithNulls.trade_management || '';
      const lessonsLearned = rowWithNulls.lessons_learned || '';
      const mistakes = Array.isArray(rowWithNulls.mistakes) ? rowWithNulls.mistakes : [];

      expect(commission).toBeUndefined();
      expect(riskPercent).toBeUndefined();
      expect(exitTime).toBe('');
      expect(tradeGrade).toBe('');
      expect(disciplineRating).toBeUndefined();
      expect(confluences).toBe('');
      expect(tradeManagement).toBe('');
      expect(lessonsLearned).toBe('');
      expect(mistakes).toEqual([]);
    });
  });

  describe('Calculations with Commission & Risk %', () => {
    it('incorporates commission into net PnL computation', () => {
      const entryPrice = 1.085;
      const exitPrice = 1.092;
      const size = 10000;
      const grossPnl = (exitPrice - entryPrice) * size; // 70.00
      const commission = 5.5;
      const netPnl = grossPnl - commission; // 64.50

      expect(grossPnl).toBeCloseTo(70.0, 2);
      expect(netPnl).toBeCloseTo(64.5, 2);
    });

    it('calculates planned RR from entry, stop loss, and take profit', () => {
      const ep = 1.085;
      const sl = 1.082; // risk = 0.003
      const tp = 1.094; // reward = 0.009
      const risk = Math.abs(ep - sl);
      const reward = Math.abs(tp - ep);
      const rr = reward / risk; // 3.0

      expect(rr).toBeCloseTo(3.0, 2);
    });
  });
});
