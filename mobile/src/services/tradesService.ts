// Trades Data Access Service - Account Scoped
// Parity with Web tradesApi.js

import { supabase } from './supabase';
import { Trade } from '../types/models';
import { logger } from '../utils/logger';

function tradeFromRow(row: any): Trade {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || '',
    symbol: row.instrument || row.symbol || '',
    direction: row.direction === 'Short' ? 'Short' : 'Long',
    entryDate: row.date || row.entry_date || '',
    entryTime: row.entry_time || '',
    exitDate: row.exit_date || '',
    exitTime: row.exit_time || '',
    entryPrice: Number(row.entry_price) || 0,
    exitPrice: row.exit_price !== null && row.exit_price !== undefined ? Number(row.exit_price) : undefined,
    size: Number(row.position_size || row.contracts || row.size) || 0,
    netPnl: Number(row.net_pnl) || 0,
    grossPnl: row.gross_pnl !== undefined ? Number(row.gross_pnl) : undefined,
    commission: row.commission !== null && row.commission !== undefined ? Number(row.commission) : undefined,
    pnlPercentage: row.risk_percent !== undefined ? Number(row.risk_percent) : undefined,
    riskPercent: row.risk_percent !== null && row.risk_percent !== undefined ? Number(row.risk_percent) : undefined,
    riskRewardRatio: row.rr !== undefined && row.rr !== null ? Number(row.rr) : (row.risk_reward_ratio !== undefined ? Number(row.risk_reward_ratio) : undefined),
    stopLoss: row.stop_loss !== null ? Number(row.stop_loss) : undefined,
    takeProfit: row.take_profit !== null ? Number(row.take_profit) : undefined,
    status: row.result === 'Open' || row.status === 'Open' ? 'Open' : 'Closed',
    setup: row.model || row.setup || '',
    session: row.session || '',
    timeframe: row.timeframe || '',
    notes: row.notes || '',
    mistakes: typeof row.mistakes === 'object' && row.mistakes !== null && !Array.isArray(row.mistakes)
      ? Object.keys(row.mistakes).filter((k) => row.mistakes[k])
      : Array.isArray(row.mistakes)
      ? row.mistakes
      : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    emotionBefore: row.emotion || row.emotion_before || '',
    emotionDuring: row.emotion_during || '',
    emotionAfter: row.emotion_after || '',
    disciplineRating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : (row.discipline_rating ? Number(row.discipline_rating) : undefined),
    rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : (row.discipline_rating ? Number(row.discipline_rating) : undefined),
    tradeGrade: row.trade_grade || '',
    confluences: row.confluences || '',
    tradeManagement: row.trade_management || '',
    lessonsLearned: row.lessons_learned || '',
    isFavorite: !!row.is_favorite,
    screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
    riskChecklist: typeof row.risk_checklist === 'object' && row.risk_checklist !== null ? row.risk_checklist : {},
    tradeChecklist: typeof row.trade_checklist === 'object' && row.trade_checklist !== null ? row.trade_checklist : {},
    psychology: typeof row.psychology === 'object' && row.psychology !== null ? row.psychology : {},
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
      instrument: input.symbol?.toUpperCase().trim() || '',
      direction: input.direction || 'Long',
      date: input.entryDate || new Date().toISOString().split('T')[0],
      entry_time: input.entryTime || '',
      exit_date: input.exitDate || null,
      exit_time: input.exitTime || null,
      entry_price: input.entryPrice || 0,
      exit_price: input.exitPrice !== undefined && input.exitPrice !== null ? Number(input.exitPrice) : null,
      position_size: input.size || 0,
      contracts: input.size || 0,
      net_pnl: input.netPnl || 0,
      commission: input.commission !== undefined && input.commission !== null ? Number(input.commission) : null,
      risk_percent: input.riskPercent !== undefined && input.riskPercent !== null ? Number(input.riskPercent) : null,
      rr: input.riskRewardRatio !== undefined && input.riskRewardRatio !== null ? Number(input.riskRewardRatio) : null,
      stop_loss: input.stopLoss || null,
      take_profit: input.takeProfit || null,
      status: input.status || 'Closed',
      result: (Number(input.netPnl) || 0) >= 0 ? 'Win' : 'Loss',
      model: input.setup || '',
      session: input.session || '',
      timeframe: input.timeframe || '',
      notes: input.notes || '',
      tags: input.tags || [],
      mistakes: input.mistakes || [],
      trade_grade: input.tradeGrade || null,
      rating: input.disciplineRating ?? input.rating ?? 6,
      confluences: input.confluences || null,
      trade_management: input.tradeManagement || null,
      lessons_learned: input.lessonsLearned || null,
      risk_checklist: input.riskChecklist || {},
      trade_checklist: input.tradeChecklist || {},
      psychology: input.psychology || {},
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

