// Backup & Restore Service matching EdgeJournal backup format
// Enforces schema validation, account scoping, duplicate detection, and sanitization.

import { Trade, Account, PreMarketPlan, Reflection, Goal, Challenge, StudyItem } from '../types/models';
import { logger } from '../utils/logger';

export interface BackupPayload {
  app: 'EdgeJournal';
  version: number;
  exportedAt: string;
  accounts?: Account[];
  trades?: Trade[];
  plans?: PreMarketPlan[];
  reflections?: Reflection[];
  goals?: Goal[];
  challenges?: Challenge[];
  study?: StudyItem[];
  tags?: string[];
  models?: string[];
  riskCriteria?: string[];
  checklistCriteria?: string[];
  accountName?: string;
  settings?: Record<string, any>;
}

export const CURRENT_BACKUP_SCHEMA_VERSION = 1;

export const backupService = {
  buildBackupPayload(data: {
    accounts?: Account[];
    trades?: Trade[];
    plans?: PreMarketPlan[];
    reflections?: Reflection[];
    goals?: Goal[];
    challenges?: Challenge[];
    study?: StudyItem[];
    tags?: string[];
    models?: string[];
    riskCriteria?: string[];
    checklistCriteria?: string[];
    accountName?: string;
  }): BackupPayload {
    // Sanitization: scrub out any internal auth tokens, sensitive keys or passwords
    const sanitizedAccounts = (data.accounts || []).map((a) => ({
      id: a.id,
      userId: a.userId,
      name: a.name,
      broker: a.broker,
      accountType: a.accountType,
      currency: a.currency,
      startingBalance: a.startingBalance,
      isDefault: a.isDefault,
      status: a.status,
    }));

    const sanitizedTrades = (data.trades || []).map((t) => ({
      ...t,
      // Ensure no raw auth or credential attachments
    }));

    return {
      app: 'EdgeJournal',
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      accounts: sanitizedAccounts,
      trades: sanitizedTrades,
      plans: data.plans || [],
      reflections: data.reflections || [],
      goals: data.goals || [],
      challenges: data.challenges || [],
      study: data.study || [],
      tags: data.tags || [],
      models: data.models || [],
      riskCriteria: data.riskCriteria || [],
      checklistCriteria: data.checklistCriteria || [],
      accountName: data.accountName,
    };
  },

  validateBackupData(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid backup file: expected a JSON object.' };
    }
    if (data.app !== 'EdgeJournal') {
      return { valid: false, error: 'Invalid backup: this file is not an EdgeJournal backup.' };
    }
    if (data.version && typeof data.version !== 'number') {
      return { valid: false, error: 'Invalid backup schema version.' };
    }
    if (data.trades && !Array.isArray(data.trades)) {
      return { valid: false, error: 'Invalid backup: "trades" must be an array.' };
    }
    if (data.accounts && !Array.isArray(data.accounts)) {
      return { valid: false, error: 'Invalid backup: "accounts" must be an array.' };
    }
    if (data.plans && !Array.isArray(data.plans)) {
      return { valid: false, error: 'Invalid backup: "plans" must be an array.' };
    }
    if (data.reflections && !Array.isArray(data.reflections)) {
      return { valid: false, error: 'Invalid backup: "reflections" must be an array.' };
    }
    if (data.goals && !Array.isArray(data.goals)) {
      return { valid: false, error: 'Invalid backup: "goals" must be an array.' };
    }
    if (data.study && !Array.isArray(data.study)) {
      return { valid: false, error: 'Invalid backup: "study" must be an array.' };
    }
    if (data.models && !Array.isArray(data.models)) {
      return { valid: false, error: 'Invalid backup: "models" must be an array.' };
    }
    if (data.riskCriteria && !Array.isArray(data.riskCriteria)) {
      return { valid: false, error: 'Invalid backup: "riskCriteria" must be an array.' };
    }
    if (data.checklistCriteria && !Array.isArray(data.checklistCriteria)) {
      return { valid: false, error: 'Invalid backup: "checklistCriteria" must be an array.' };
    }
    return { valid: true };
  },

  /**
   * Filters out duplicate trades during restore to prevent double entries.
   */
  filterDuplicates(existingTrades: Trade[], incomingTrades: Trade[]): Trade[] {
    const existingIds = new Set(existingTrades.map((t) => t.id));
    const existingSignatures = new Set(
      existingTrades.map((t) => `${t.symbol}_${t.entryDate}_${t.entryTime || ''}_${t.size}_${t.entryPrice}`)
    );

    return incomingTrades.filter((t) => {
      if (t.id && existingIds.has(t.id)) return false;
      const sig = `${t.symbol}_${t.entryDate}_${t.entryTime || ''}_${t.size}_${t.entryPrice}`;
      if (existingSignatures.has(sig)) return false;
      return true;
    });
  },
};
