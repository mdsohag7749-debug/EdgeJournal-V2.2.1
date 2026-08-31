// Trades Data Access Service - Account Scoped

import { supabase } from './supabase';
import { Trade } from '../types/models';
import { logger } from '../utils/logger';

function tradeFromRow(row: any): Trade {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    symbol: row.symbol || '',
    direction: row.direction === 'Short' ? 'Short' : 'Long',
    entryDate: row.date || row.entry_date || '',
    entryTime: row.entry_time || '',
    exitDate: row.exit_date || '',
    exitTime: row.exit_time || '',
    entryPrice: Number(row.entry_price) || 0,
    exitPrice: row.exit_price !== null && row.exit_price !== undefined ? Number(row.exit_price) : undefined,
    size: Number(row.size) || 0,
    netPnl: Number(row.net_pnl) || 0,
    grossPnl: row.gross_pnl !== undefined ? Number(row.gross_pnl) : undefined,
    commission: row.commission !== undefined ? Number(row.commission) : undefined,
    pnlPercentage: row.pnl_percentage !== undefined ? Number(row.pnl_percentage) : undefined,
    riskRewardRatio: row.risk_reward_ratio !== undefined ? Number(row.risk_reward_ratio) : undefined,
    stopLoss: row.stop_loss !== null ? Number(row.stop_loss) : undefined,
    takeProfit: row.take_profit !== null ? Number(row.take_profit) : undefined,
    status: row.status === 'Open' ? 'Open' : 'Closed',
    setup: row.setup || '',
    session: row.session || '',
    notes: row.notes || '',
    mistakes: Array.isArray(row.mistakes) ? row.mistakes : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    emotionBefore: row.emotion_before || '',
    emotionDuring: row.emotion_during || '',
    emotionAfter: row.emotion_after || '',
    disciplineRating: row.discipline_rating ? Number(row.discipline_rating) : undefined,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const tradesService = {
  async fetchTrades(userId: string, accountId?: string | null): Promise<Trade[]> {
    if (!userId) return [];
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    // Multi-account scoping: if concrete accountId is provided, filter specifically
    if (accountId && accountId !== 'ALL_ACCOUNTS') {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;
    if (error) {
      logger.warn('DATA', 'Failed to fetch trades', { error: error.message });
      return [];
    }
    return (data || []).map(tradeFromRow);
  },

  async createTrade(userId: string, input: Partial<Trade>): Promise<Trade | null> {
    if (!userId || !input.accountId) return null;
    const payload = {
      user_id: userId,
      account_id: input.accountId,
      symbol: input.symbol?.toUpperCase().trim() || '',
      direction: input.direction || 'Long',
      date: input.entryDate || new Date().toISOString().split('T')[0],
      entry_time: input.entryTime || '',
      exit_date: input.exitDate || null,
      exit_time: input.exitTime || null,
      entry_price: input.entryPrice || 0,
      exit_price: input.exitPrice || null,
      size: input.size || 0,
      net_pnl: input.netPnl || 0,
      stop_loss: input.stopLoss || null,
      take_profit: input.takeProfit || null,
      status: input.status || 'Closed',
      setup: input.setup || '',
      session: input.session || '',
      notes: input.notes || '',
      tags: input.tags || [],
      mistakes: input.mistakes || [],
    };

    const { data, error } = await supabase
      .from('trades')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return tradeFromRow(data);
  },
};
