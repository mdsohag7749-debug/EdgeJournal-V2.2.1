// Accounts Service - Multi-Account DB Scoping & RPC calls

import { supabase } from './supabase';
import { Account } from '../types/models';
import { logger } from '../utils/logger';

export const ALL_ACCOUNTS_SENTINEL = 'ALL_ACCOUNTS';

function accountFromRow(row: any): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    broker: row.broker || '',
    accountType: row.account_type || 'Futures',
    currency: row.currency || 'USD',
    startingBalance: Number(row.starting_balance) || 0,
    currentBalance: Number(row.starting_balance) || 0,
    totalPnl: 0,
    winRate: 0,
    tradeCount: 0,
    isDefault: !!row.is_default,
    status: row.status || 'Active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const accountsService = {
  async fetchAccounts(userId: string): Promise<Account[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.warn('ACCOUNT', 'Failed to fetch accounts', { error: error.message });
      return [];
    }
    return (data || []).map(accountFromRow);
  },

  async ensureDefaultAccount(userId: string): Promise<Account | null> {
    if (!userId) return null;
    const { data, error } = await supabase.rpc('ensure_default_account', {
      target_user_id: userId,
    });
    if (error) {
      logger.warn('ACCOUNT', 'ensure_default_account rpc error', { error: error.message });
      return null;
    }
    return data ? accountFromRow(data) : null;
  },

  async createAccount(userId: string, input: Partial<Account>): Promise<Account | null> {
    if (!userId) return null;
    const payload = {
      user_id: userId,
      name: input.name?.trim() || 'New Account',
      broker: input.broker?.trim() || '',
      account_type: input.accountType?.trim() || '',
      currency: input.currency?.trim() || 'USD',
      starting_balance: input.startingBalance || 0,
      is_default: !!input.isDefault,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('accounts')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return accountFromRow(data);
  },

  async updateAccount(userId: string, accountId: string, patch: Partial<Account>): Promise<Account | null> {
    if (!userId || !accountId) return null;
    const dbPatch: Record<string, any> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name.trim();
    if (patch.broker !== undefined) dbPatch.broker = patch.broker.trim();
    if (patch.accountType !== undefined) dbPatch.account_type = patch.accountType.trim();
    if (patch.currency !== undefined) dbPatch.currency = patch.currency.trim();
    if (patch.startingBalance !== undefined) dbPatch.starting_balance = patch.startingBalance;
    if (patch.isDefault !== undefined) dbPatch.is_default = patch.isDefault;
    if (patch.status !== undefined) dbPatch.status = patch.status;

    const { data, error } = await supabase
      .from('accounts')
      .update(dbPatch)
      .eq('id', accountId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return accountFromRow(data);
  },

  async deleteAccount(userId: string, accountId: string): Promise<boolean> {
    if (!userId || !accountId) return false;
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },
};
