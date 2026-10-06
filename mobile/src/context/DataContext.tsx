import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Trade, PreMarketPlan, Reflection, Goal, Challenge, StudyItem } from '../types/models';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAccounts } from '../hooks/useAccounts';
import { ALL_ACCOUNTS_SENTINEL } from '../services/accountsService';
import { backupService } from '../services/backupService';
import { offlineStorage } from '../services/offline/offlineStorage';
import { offlineQueue, QueuedMutation } from '../services/offline/offlineQueue';
import { storageService, KEYS } from '../services/storageService';
import { DEFAULT_MODELS, DEFAULT_RISK_CRITERIA, DEFAULT_CHECKLIST_CRITERIA } from '../utils/psychologyUtils';
import { logger } from '../utils/logger';

interface DataContextType {
  trades: Trade[];
  plans: PreMarketPlan[];
  reflections: Reflection[];
  goals: Goal[];
  challenges: Challenge[];
  study: StudyItem[];
  loading: boolean;
  refreshing: boolean;
  isOffline: boolean;
  pendingCount: number;
  lastSynced: string;
  refetch: () => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  // Trade Actions
  addTrade: (trade: Partial<Trade>) => Promise<Trade | null>;
  updateTrade: (id: string, patch: Partial<Trade>) => Promise<Trade | null>;
  deleteTrade: (id: string) => Promise<boolean>;
  // Pre-Market Plan Actions
  addPlan: (plan: Partial<PreMarketPlan>) => Promise<PreMarketPlan | null>;
  updatePlan: (id: string, patch: Partial<PreMarketPlan>) => Promise<PreMarketPlan | null>;
  deletePlan: (id: string) => Promise<boolean>;
  // Reflection Actions
  addReflection: (reflection: Partial<Reflection>) => Promise<Reflection | null>;
  updateReflection: (id: string, patch: Partial<Reflection>) => Promise<Reflection | null>;
  deleteReflection: (id: string) => Promise<boolean>;
  // Goal Actions
  addGoal: (goal: Partial<Goal>) => Promise<Goal | null>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<Goal | null>;
  deleteGoal: (id: string) => Promise<boolean>;
  // Challenge Actions
  addChallenge: (challenge: Partial<Challenge>) => Promise<Challenge | null>;
  updateChallenge: (id: string, patch: Partial<Challenge>) => Promise<Challenge | null>;
  deleteChallenge: (id: string) => Promise<boolean>;
  // Study Actions
  addStudyNote: (note: Partial<StudyItem>) => Promise<StudyItem | null>;
  updateStudyNote: (id: string, patch: Partial<StudyItem>) => Promise<StudyItem | null>;
  deleteStudyNote: (id: string) => Promise<boolean>;
  // System Settings (Models & Checklists)
  models: string[];
  setModels: (models: string[]) => Promise<void>;
  riskCriteria: string[];
  setRiskCriteria: (criteria: string[]) => Promise<void>;
  checklistCriteria: string[];
  setChecklistCriteria: (criteria: string[]) => Promise<void>;
  addModel: (name: string) => Promise<boolean>;
  updateModel: (oldName: string, newName: string) => Promise<boolean>;
  deleteModel: (name: string) => Promise<boolean>;
  addRiskCriterion: (text: string) => Promise<boolean>;
  updateRiskCriterion: (oldText: string, newText: string) => Promise<boolean>;
  deleteRiskCriterion: (text: string) => Promise<boolean>;
  addChecklistCriterion: (text: string) => Promise<boolean>;
  updateChecklistCriterion: (oldText: string, newText: string) => Promise<boolean>;
  deleteChecklistCriterion: (text: string) => Promise<boolean>;
  resetSystemSettings: () => Promise<void>;
  // Backup / Restore
  exportBackup: () => any;
  restoreBackup: (payload: any) => Promise<{ success: boolean; message: string }>;
}

export const DataContext = createContext<DataContextType | null>(null);

function mapTradeFromDb(row: any): Trade {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || '',
    symbol: row.instrument || row.symbol || '',
    direction: row.direction === 'Short' ? 'Short' : 'Long',
    entryDate: row.date || '',
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
    emotionDuring: '',
    emotionAfter: row.lessons_learned || '',
    disciplineRating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : (row.discipline_rating ? Number(row.discipline_rating) : undefined),
    rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : (row.discipline_rating ? Number(row.discipline_rating) : undefined),
    isFavorite: !!row.is_favorite,
    review: typeof row.review === 'object' && row.review !== null ? row.review : {},
    psychology: typeof row.psychology === 'object' && row.psychology !== null ? row.psychology : {},
    riskChecklist: typeof row.risk_checklist === 'object' && row.risk_checklist !== null ? row.risk_checklist : {},
    tradeChecklist: typeof row.trade_checklist === 'object' && row.trade_checklist !== null ? row.trade_checklist : {},
    tradeGrade: row.trade_grade || '',
    confluences: row.confluences || '',
    tradeManagement: row.trade_management || '',
    lessonsLearned: row.lessons_learned || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


function mapPlanFromDb(row: any): PreMarketPlan {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    date: row.date || '',
    bias: row.bias || 'Neutral',
    focusSymbols: row.targets ? row.targets.split(',').map((s: string) => s.trim()) : [],
    keyLevels: row.targets || '',
    riskPlan: row.game_plan || '',
    notes: row.notes || '',
    economicEvents: row.economic_events || '',
    dailyChart: row.daily_chart || '',
    intradayChart: row.intraday_chart || '',
    createdAt: row.created_at,
  };
}

function mapReflectionFromDb(row: any): Reflection {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    period: row.period || 'Daily',
    date: row.date || '',
    rating: row.rating ?? 5,
    dailyGrade: row.rating >= 4 ? 'A' : row.rating === 3 ? 'B' : 'C',
    title: row.title || '',
    reflection: row.reflection || '',
    wentWell: row.went_well || '',
    lessonsLearned: row.lessons || row.lessons_learned || '',
    improvements: row.improvements || '',
    createdAt: row.created_at,
  };
}

function mapGoalFromDb(row: any): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || '',
    period: row.period || 'Weekly',
    targetDate: row.target_date || '',
    description: row.description || '',
    successMetrics: row.success_metrics || '',
    subItems: Array.isArray(row.sub_items) ? row.sub_items : [],
    completed: !!row.completed,
    status: row.completed ? 'completed' : 'in_progress',
    createdAt: row.created_at,
  };
}

function mapStudyFromDb(row: any): StudyItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || '',
    date: row.date || '',
    sessionType: row.session_type || 'Daily',
    description: row.description || '',
    notes: row.description || '',
    chart: row.chart || '',
    tags: [],
    createdAt: row.created_at,
  };
}

function mapChallengeFromDb(row: any): Challenge {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || '',
    name: row.name || '',
    title: row.name || '',
    propFirm: row.prop_firm || '',
    challengeType: row.challenge_type || 'Custom',
    startingBalance: Number(row.starting_balance) || 0,
    profitTarget: Number(row.profit_target) || 0,
    dailyDrawdown: Number(row.daily_drawdown) || 0,
    maximumDrawdown: Number(row.maximum_drawdown) || 0,
    minTradingDays: Number(row.min_trading_days) || 0,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    status: row.status || 'active',
    createdAt: row.created_at,
  };
}

export function DataProvider({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { selectedAccountId, allAccounts, preferredAccountId, accounts } = useAccounts();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [plans, setPlans] = useState<PreMarketPlan[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [study, setStudy] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSynced, setLastSynced] = useState<string>('');

  // System Settings (Models & Checklists)
  const [models, setModelsState] = useState<string[]>(DEFAULT_MODELS);
  const [riskCriteria, setRiskCriteriaState] = useState<string[]>(DEFAULT_RISK_CRITERIA);
  const [checklistCriteria, setChecklistCriteriaState] = useState<string[]>(DEFAULT_CHECKLIST_CRITERIA);

  useEffect(() => {
    storageService.getJSON<string[]>(KEYS.models, DEFAULT_MODELS).then((res) => {
      if (Array.isArray(res) && res.length > 0) setModelsState(res);
    });
    storageService.getJSON<string[]>(KEYS.riskCriteria, DEFAULT_RISK_CRITERIA).then((res) => {
      if (Array.isArray(res) && res.length > 0) setRiskCriteriaState(res);
    });
    storageService.getJSON<string[]>(KEYS.checklistCriteria, DEFAULT_CHECKLIST_CRITERIA).then((res) => {
      if (Array.isArray(res) && res.length > 0) setChecklistCriteriaState(res);
    });
  }, []);

  const scopeKey = allAccounts ? 'all' : selectedAccountId || 'default';

  // Seed data from local cache on account switch
  useEffect(() => {
    if (!userId) return;
    offlineStorage.loadCache<Trade[]>('trades', userId, scopeKey).then((cached) => {
      if (cached && cached.length > 0) {
        setTrades(cached);
        setLoading(false);
      }
    });
    offlineQueue.getQueue(userId).then((q) => {
      setPendingCount(q.length);
    });
  }, [userId, scopeKey]);

  const fetchAllData = useCallback(async () => {
    if (!userId) {
      setTrades([]);
      setPlans([]);
      setReflections([]);
      setGoals([]);
      setChallenges([]);
      setStudy([]);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch trades
      let tradeQuery = supabase.from('trades').select('*').eq('user_id', userId).order('date', { ascending: false });
      if (!allAccounts && selectedAccountId) {
        tradeQuery = tradeQuery.eq('account_id', selectedAccountId);
      }
      const { data: tradeData, error: tradeErr } = await tradeQuery;
      if (tradeErr) throw tradeErr;

      if (tradeData) {
        const mappedTrades = tradeData.map(mapTradeFromDb);
        setTrades(mappedTrades);
        await offlineStorage.saveCache('trades', userId, scopeKey, mappedTrades);
      }

      // 2. Fetch plans
      const { data: planData } = await supabase
        .from('premarket_plans')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (planData) {
        const mappedPlans = planData.map(mapPlanFromDb);
        setPlans(mappedPlans);
        await offlineStorage.saveCache('plans', userId, 'all', mappedPlans);
      }

      // 3. Fetch reflections
      const { data: refData } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (refData) {
        const mappedRefs = refData.map(mapReflectionFromDb);
        setReflections(mappedRefs);
        await offlineStorage.saveCache('reflections', userId, 'all', mappedRefs);
      }

      // 4. Fetch goals
      const { data: goalData } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (goalData) {
        const mappedGoals = goalData.map(mapGoalFromDb);
        setGoals(mappedGoals);
        await offlineStorage.saveCache('goals', userId, 'all', mappedGoals);
      }

      // 5. Fetch challenges
      const { data: challData } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (challData) {
        const mappedChallenges = challData.map(mapChallengeFromDb);
        setChallenges(mappedChallenges);
        await offlineStorage.saveCache('challenges', userId, 'all', mappedChallenges);
      }

      // 6. Fetch study notes
      const { data: studyData } = await supabase
        .from('study_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (studyData) {
        const mappedStudy = studyData.map(mapStudyFromDb);
        setStudy(mappedStudy);
        await offlineStorage.saveCache('study', userId, 'all', mappedStudy);
      }

      setIsOffline(false);
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      logger.warn('DATA', 'Network error, using cached data', { error: err.message || err });
      setIsOffline(true);
      // Fallback to cache
      const cached = await offlineStorage.loadCache<Trade[]>('trades', userId, scopeKey);
      if (cached) setTrades(cached);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, selectedAccountId, allAccounts, scopeKey]);

  useEffect(() => {
    setLoading(true);
    fetchAllData();
  }, [fetchAllData]);

  const refetch = async () => {
    setRefreshing(true);
    await fetchAllData();
  };

  // Synchronize pending offline mutations
  const syncOfflineQueue = useCallback(async () => {
    if (!userId) return;
    const queue = await offlineQueue.getQueue(userId);
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        await offlineQueue.updateStatus(userId, item.tempId, 'syncing');
        if (item.type === 'insert' && item.table === 'trades') {
          const { error } = await supabase.from('trades').insert(item.payload);
          if (error) throw error;
        } else if (item.type === 'delete' && item.table === 'trades') {
          const { error } = await supabase.from('trades').delete().eq('id', item.payload.id).eq('user_id', userId);
          if (error) throw error;
        }
        await offlineQueue.dequeue(userId, item.tempId);
      } catch (err: any) {
        logger.warn('OFFLINE', `Error syncing ${item.tempId}`, { error: err.message || err });
        await offlineQueue.updateStatus(userId, item.tempId, 'failed', true);
      }
    }

    const remaining = await offlineQueue.getQueue(userId);
    setPendingCount(remaining.length);
    await fetchAllData();
  }, [userId, fetchAllData]);

  // --- Trade Mutations with Offline Interceptor ---
  const addTrade = useCallback(
    async (input: Partial<Trade>): Promise<Trade | null> => {
      if (!userId) return null;
      const targetAccId = input.accountId || preferredAccountId;
      if (!targetAccId) return null;

      const payload = {
        user_id: userId,
        account_id: targetAccId,
        instrument: input.symbol?.toUpperCase().trim() || '',
        direction: input.direction || 'Long',
        date: input.entryDate || new Date().toISOString().split('T')[0],
        entry_time: input.entryTime || '',
        exit_time: input.exitTime || null,
        entry_price: Number(input.entryPrice) || 0,
        exit_price: input.exitPrice !== undefined && input.exitPrice !== null ? Number(input.exitPrice) : null,
        position_size: Number(input.size) || 0,
        contracts: Number(input.size) || 0,
        net_pnl: Number(input.netPnl) || 0,
        commission: input.commission !== undefined && input.commission !== null ? Number(input.commission) : null,
        risk_percent: input.riskPercent !== undefined && input.riskPercent !== null ? Number(input.riskPercent) : null,
        stop_loss: input.stopLoss !== undefined && input.stopLoss !== null ? Number(input.stopLoss) : null,
        take_profit: input.takeProfit !== undefined && input.takeProfit !== null ? Number(input.takeProfit) : null,
        rr: input.riskRewardRatio !== undefined && input.riskRewardRatio !== null ? Number(input.riskRewardRatio) : 0,
        result: (Number(input.netPnl) || 0) >= 0 ? 'Win' : 'Loss',
        model: input.setup || '',
        session: input.session || '',
        timeframe: input.timeframe || '',
        notes: input.notes || '',
        tags: Array.isArray(input.tags) ? input.tags : [],
        mistakes: input.mistakes || [],
        is_favorite: !!input.isFavorite,
        risk_checklist: input.riskChecklist || {},
        trade_checklist: input.tradeChecklist || {},
        psychology: input.psychology || {},
        trade_grade: input.tradeGrade || null,
        rating: input.disciplineRating ?? input.rating ?? 6,
        confluences: input.confluences || null,
        trade_management: input.tradeManagement || null,
        lessons_learned: input.lessonsLearned || null,
      };

      try {
        const { data, error } = await supabase.from('trades').insert(payload).select().single();
        if (error) throw error;
        const saved = mapTradeFromDb(data);
        setTrades((prev) => [saved, ...prev]);
        return saved;
      } catch (err: any) {
        logger.warn('OFFLINE', 'Saving trade to offline pending queue', { error: err.message || err });
        // Queue offline mutation
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await offlineQueue.enqueue({
          id: tempId,
          tempId,
          userId,
          table: 'trades',
          type: 'insert',
          payload,
        });
        setPendingCount((c) => c + 1);
        setIsOffline(true);

        const optimisticTrade: Trade = {
          ...input,
          id: tempId,
          userId,
          accountId: targetAccId,
          symbol: payload.instrument,
          direction: payload.direction as any,
          entryDate: payload.date,
          entryPrice: payload.entry_price,
          size: payload.position_size,
          netPnl: payload.net_pnl,
          status: 'Closed',
          createdAt: new Date().toISOString(),
        } as Trade;

        setTrades((prev) => [optimisticTrade, ...prev]);
        return optimisticTrade;
      }
    },
    [userId, preferredAccountId]
  );

  const updateTrade = useCallback(
    async (id: string, patch: Partial<Trade>): Promise<Trade | null> => {
      if (!userId || !id) return null;
      const dbPatch: Record<string, any> = {};
      if (patch.symbol !== undefined) dbPatch.instrument = patch.symbol.toUpperCase().trim();
      if (patch.direction !== undefined) dbPatch.direction = patch.direction;
      if (patch.entryDate !== undefined) dbPatch.date = patch.entryDate;
      if (patch.entryTime !== undefined) dbPatch.entry_time = patch.entryTime;
      if (patch.exitTime !== undefined) dbPatch.exit_time = patch.exitTime;
      if (patch.entryPrice !== undefined) dbPatch.entry_price = Number(patch.entryPrice);
      if (patch.exitPrice !== undefined) dbPatch.exit_price = patch.exitPrice !== null ? Number(patch.exitPrice) : null;
      if (patch.size !== undefined) {
        dbPatch.position_size = Number(patch.size);
        dbPatch.contracts = Number(patch.size);
      }
      if (patch.netPnl !== undefined) {
        dbPatch.net_pnl = Number(patch.netPnl);
        dbPatch.result = Number(patch.netPnl) >= 0 ? 'Win' : 'Loss';
      }
      if (patch.commission !== undefined) dbPatch.commission = patch.commission !== null ? Number(patch.commission) : null;
      if (patch.riskPercent !== undefined) dbPatch.risk_percent = patch.riskPercent !== null ? Number(patch.riskPercent) : null;
      if (patch.stopLoss !== undefined) dbPatch.stop_loss = patch.stopLoss;
      if (patch.takeProfit !== undefined) dbPatch.take_profit = patch.takeProfit;
      if (patch.riskRewardRatio !== undefined) dbPatch.rr = Number(patch.riskRewardRatio);
      if (patch.setup !== undefined) dbPatch.model = patch.setup;
      if (patch.session !== undefined) dbPatch.session = patch.session;
      if (patch.timeframe !== undefined) dbPatch.timeframe = patch.timeframe;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.tags !== undefined) dbPatch.tags = patch.tags;
      if (patch.mistakes !== undefined) dbPatch.mistakes = patch.mistakes;
      if (patch.isFavorite !== undefined) dbPatch.is_favorite = patch.isFavorite;
      if (patch.accountId !== undefined) dbPatch.account_id = patch.accountId;
      if (patch.riskChecklist !== undefined) dbPatch.risk_checklist = patch.riskChecklist;
      if (patch.tradeChecklist !== undefined) dbPatch.trade_checklist = patch.tradeChecklist;
      if (patch.psychology !== undefined) dbPatch.psychology = patch.psychology;
      if (patch.tradeGrade !== undefined) dbPatch.trade_grade = patch.tradeGrade;
      if (patch.disciplineRating !== undefined || patch.rating !== undefined) dbPatch.rating = patch.disciplineRating ?? patch.rating;
      if (patch.confluences !== undefined) dbPatch.confluences = patch.confluences;
      if (patch.tradeManagement !== undefined) dbPatch.trade_management = patch.tradeManagement;
      if (patch.lessonsLearned !== undefined) dbPatch.lessons_learned = patch.lessonsLearned;

      try {
        const { data, error } = await supabase
          .from('trades')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const updated = mapTradeFromDb(data);
        setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
        return updated;
      } catch (err: any) {
        logger.error('DATA', 'Error updating trade', { id, error: err.message || err });
        return null;
      }
    },
    [userId]
  );


  const deleteTrade = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || !id) return false;
      try {
        const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setTrades((prev) => prev.filter((t) => t.id !== id));
        return true;
      } catch (err: any) {
        logger.warn('OFFLINE', 'Falling back to offline queue trade deletion', { id, error: err.message || err });
        const tempId = `temp_del_${Date.now()}`;
        await offlineQueue.enqueue({
          id: tempId,
          tempId,
          userId,
          table: 'trades',
          type: 'delete',
          payload: { id },
        });
        setPendingCount((c) => c + 1);
        setTrades((prev) => prev.filter((t) => t.id !== id));
        return true;
      }
    },
    [userId]
  );

  // --- Pre-Market Plan Mutations ---
  const addPlan = useCallback(
    async (plan: Partial<PreMarketPlan>): Promise<PreMarketPlan | null> => {
      if (!userId) return null;
      const payload = {
        user_id: userId,
        date: plan.date || new Date().toISOString().split('T')[0],
        bias: plan.bias || 'Neutral',
        targets: plan.keyLevels || (plan.focusSymbols ? plan.focusSymbols.join(', ') : ''),
        game_plan: plan.riskPlan || plan.gamePlan || '',
        notes: plan.notes || '',
        economic_events: plan.economicEvents || '',
      };
      try {
        const { data, error } = await supabase.from('premarket_plans').insert(payload).select().single();
        if (error) throw error;
        const saved = mapPlanFromDb(data);
        setPlans((prev) => [saved, ...prev]);
        return saved;
      } catch (err: any) {
        logger.error('DATA', 'Error adding plan', { error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const updatePlan = useCallback(
    async (id: string, patch: Partial<PreMarketPlan>): Promise<PreMarketPlan | null> => {
      if (!userId || !id) return null;
      const dbPatch: Record<string, any> = {};
      if (patch.bias !== undefined) dbPatch.bias = patch.bias;
      if (patch.keyLevels !== undefined) dbPatch.targets = patch.keyLevels;
      if (patch.riskPlan !== undefined) dbPatch.game_plan = patch.riskPlan;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.economicEvents !== undefined) dbPatch.economic_events = patch.economicEvents;

      try {
        const { data, error } = await supabase
          .from('premarket_plans')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const updated = mapPlanFromDb(data);
        setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
        return updated;
      } catch (err: any) {
        logger.error('DATA', 'Error updating plan', { id, error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const deletePlan = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || !id) return false;
      try {
        const { error } = await supabase.from('premarket_plans').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setPlans((prev) => prev.filter((p) => p.id !== id));
        return true;
      } catch (err: any) {
        logger.error('DATA', 'Error deleting plan', { id, error: err.message || err });
        return false;
      }
    },
    [userId]
  );

  // --- Reflection Mutations ---
  const addReflection = useCallback(
    async (ref: Partial<Reflection>): Promise<Reflection | null> => {
      if (!userId) return null;
      const payload = {
        user_id: userId,
        period: ref.period || 'Daily',
        date: ref.date || new Date().toISOString().split('T')[0],
        rating: ref.rating ?? 5,
        title: ref.title || '',
        reflection: ref.reflection || '',
        went_well: ref.wentWell || '',
        lessons: ref.lessonsLearned || '',
        improvements: ref.improvements || '',
      };
      try {
        const { data, error } = await supabase.from('reflections').insert(payload).select().single();
        if (error) throw error;
        const saved = mapReflectionFromDb(data);
        setReflections((prev) => [saved, ...prev]);
        return saved;
      } catch (err: any) {
        logger.error('DATA', 'Error adding reflection', { error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const updateReflection = useCallback(
    async (id: string, patch: Partial<Reflection>): Promise<Reflection | null> => {
      if (!userId || !id) return null;
      const dbPatch: Record<string, any> = {};
      if (patch.rating !== undefined) dbPatch.rating = patch.rating;
      if (patch.title !== undefined) dbPatch.title = patch.title;
      if (patch.reflection !== undefined) dbPatch.reflection = patch.reflection;
      if (patch.wentWell !== undefined) dbPatch.went_well = patch.wentWell;
      if (patch.lessonsLearned !== undefined) dbPatch.lessons = patch.lessonsLearned;
      if (patch.improvements !== undefined) dbPatch.improvements = patch.improvements;

      try {
        const { data, error } = await supabase
          .from('reflections')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const updated = mapReflectionFromDb(data);
        setReflections((prev) => prev.map((r) => (r.id === id ? updated : r)));
        return updated;
      } catch (err: any) {
        logger.error('DATA', 'Error updating reflection', { id, error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const deleteReflection = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || !id) return false;
      try {
        const { error } = await supabase.from('reflections').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setReflections((prev) => prev.filter((r) => r.id !== id));
        return true;
      } catch (err: any) {
        logger.error('DATA', 'Error deleting reflection', { id, error: err.message || err });
        return false;
      }
    },
    [userId]
  );

  // --- Goal Mutations ---
  const addGoal = useCallback(
    async (goal: Partial<Goal>): Promise<Goal | null> => {
      if (!userId) return null;
      const payload = {
        user_id: userId,
        title: goal.title || '',
        period: goal.period || 'Weekly',
        target_date: goal.targetDate || null,
        description: goal.description || '',
        success_metrics: goal.successMetrics || '',
        sub_items: goal.subItems || [],
        completed: !!goal.completed,
      };
      try {
        const { data, error } = await supabase.from('goals').insert(payload).select().single();
        if (error) throw error;
        const saved = mapGoalFromDb(data);
        setGoals((prev) => [saved, ...prev]);
        return saved;
      } catch (err: any) {
        logger.error('DATA', 'Error adding goal', { error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const updateGoal = useCallback(
    async (id: string, patch: Partial<Goal>): Promise<Goal | null> => {
      if (!userId || !id) return null;
      const dbPatch: Record<string, any> = {};
      if (patch.title !== undefined) dbPatch.title = patch.title;
      if (patch.completed !== undefined) dbPatch.completed = patch.completed;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.successMetrics !== undefined) dbPatch.success_metrics = patch.successMetrics;
      if (patch.subItems !== undefined) dbPatch.sub_items = patch.subItems;

      try {
        const { data, error } = await supabase
          .from('goals')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const updated = mapGoalFromDb(data);
        setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
        return updated;
      } catch (err: any) {
        logger.error('DATA', 'Error updating goal', { id, error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const deleteGoal = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || !id) return false;
      try {
        const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setGoals((prev) => prev.filter((g) => g.id !== id));
        return true;
      } catch (err: any) {
        logger.error('DATA', 'Error deleting goal', { id, error: err.message || err });
        return false;
      }
    },
    [userId]
  );

  // --- Challenge Mutations ---
  const addChallenge = useCallback(
    async (chall: Partial<Challenge>): Promise<Challenge | null> => {
      if (!userId) return null;
      const targetAccId = chall.accountId || preferredAccountId || null;
      const payload: Record<string, any> = {
        user_id: userId,
        account_id: targetAccId,
        name: chall.name || chall.title || 'New Challenge',
        prop_firm: chall.propFirm || '',
        challenge_type: chall.challengeType || 'Custom',
        starting_balance: Number(chall.startingBalance) || 100000,
        profit_target: Number(chall.profitTarget) || 10000,
        daily_drawdown: Number(chall.dailyDrawdown) || 5000,
        maximum_drawdown: Number(chall.maximumDrawdown) || 10000,
        min_trading_days: Number(chall.minTradingDays) || 0,
        start_date: chall.startDate || new Date().toISOString().split('T')[0],
        end_date: chall.endDate || null,
        status: chall.status || 'active',
      };
      try {
        const { data, error } = await supabase.from('challenges').insert(payload).select().single();
        if (error) throw error;
        const saved = mapChallengeFromDb(data);
        setChallenges((prev) => [saved, ...prev]);
        return saved;
      } catch (err: any) {
        logger.error('DATA', 'Error adding challenge', { error: err.message || err });
        return null;
      }
    },
    [userId, preferredAccountId]
  );

  const updateChallenge = useCallback(
    async (id: string, patch: Partial<Challenge>): Promise<Challenge | null> => {
      if (!userId || !id) return null;
      const dbPatch: Record<string, any> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.propFirm !== undefined) dbPatch.prop_firm = patch.propFirm;
      if (patch.challengeType !== undefined) dbPatch.challenge_type = patch.challengeType;
      if (patch.startingBalance !== undefined) dbPatch.starting_balance = Number(patch.startingBalance);
      if (patch.profitTarget !== undefined) dbPatch.profit_target = Number(patch.profitTarget);
      if (patch.dailyDrawdown !== undefined) dbPatch.daily_drawdown = Number(patch.dailyDrawdown);
      if (patch.maximumDrawdown !== undefined) dbPatch.maximum_drawdown = Number(patch.maximumDrawdown);
      if (patch.minTradingDays !== undefined) dbPatch.min_trading_days = Number(patch.minTradingDays);
      if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate;
      if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate;
      if (patch.accountId !== undefined) dbPatch.account_id = patch.accountId;
      if (patch.status !== undefined) dbPatch.status = patch.status;

      try {
        const { data, error } = await supabase
          .from('challenges')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const updated = mapChallengeFromDb(data);
        setChallenges((prev) => prev.map((c) => (c.id === id ? updated : c)));
        return updated;
      } catch (err: any) {
        logger.error('DATA', 'Error updating challenge', { id, error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const deleteChallenge = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || !id) return false;
      try {
        const { error } = await supabase.from('challenges').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setChallenges((prev) => prev.filter((c) => c.id !== id));
        return true;
      } catch (err: any) {
        logger.error('DATA', 'Error deleting challenge', { id, error: err.message || err });
        return false;
      }
    },
    [userId]
  );

  // --- Study Mutations ---
  const addStudyNote = useCallback(
    async (note: Partial<StudyItem>): Promise<StudyItem | null> => {
      if (!userId) return null;
      const payload = {
        user_id: userId,
        date: note.date || new Date().toISOString().split('T')[0],
        session_type: note.sessionType || 'Daily',
        title: note.title || '',
        description: note.description || note.notes || '',
        chart: note.chart || '',
      };
      try {
        const { data, error } = await supabase.from('study_notes').insert(payload).select().single();
        if (error) throw error;
        const saved = mapStudyFromDb(data);
        setStudy((prev) => [saved, ...prev]);
        return saved;
      } catch (err: any) {
        logger.error('DATA', 'Error adding study note', { error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const updateStudyNote = useCallback(
    async (id: string, patch: Partial<StudyItem>): Promise<StudyItem | null> => {
      if (!userId || !id) return null;
      const dbPatch: Record<string, any> = {};
      if (patch.title !== undefined) dbPatch.title = patch.title;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.sessionType !== undefined) dbPatch.session_type = patch.sessionType;

      try {
        const { data, error } = await supabase
          .from('study_notes')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        const updated = mapStudyFromDb(data);
        setStudy((prev) => prev.map((s) => (s.id === id ? updated : s)));
        return updated;
      } catch (err: any) {
        logger.error('DATA', 'Error updating study note', { id, error: err.message || err });
        return null;
      }
    },
    [userId]
  );

  const deleteStudyNote = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || !id) return false;
      try {
        const { error } = await supabase.from('study_notes').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        setStudy((prev) => prev.filter((s) => s.id !== id));
        return true;
      } catch (err: any) {
        logger.error('DATA', 'Error deleting study note', { id, error: err.message || err });
        return false;
      }
    },
    [userId]
  );

  // --- System Settings (Models & Checklists) Mutations & Helpers ---
  const setModels = useCallback(async (newModels: string[]) => {
    const valid = Array.isArray(newModels) ? newModels : DEFAULT_MODELS;
    setModelsState(valid);
    await storageService.setJSON(KEYS.models, valid);
  }, []);

  const setRiskCriteria = useCallback(async (newCriteria: string[]) => {
    const valid = Array.isArray(newCriteria) ? newCriteria : DEFAULT_RISK_CRITERIA;
    setRiskCriteriaState(valid);
    await storageService.setJSON(KEYS.riskCriteria, valid);
  }, []);

  const setChecklistCriteria = useCallback(async (newCriteria: string[]) => {
    const valid = Array.isArray(newCriteria) ? newCriteria : DEFAULT_CHECKLIST_CRITERIA;
    setChecklistCriteriaState(valid);
    await storageService.setJSON(KEYS.checklistCriteria, valid);
  }, []);

  const addModel = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = String(name || '').trim();
      if (!trimmed) return false;
      if (models.some((m) => m.toLowerCase() === trimmed.toLowerCase())) return false;
      const next = [...models, trimmed];
      await setModels(next);
      return true;
    },
    [models, setModels]
  );

  const updateModel = useCallback(
    async (oldName: string, newName: string): Promise<boolean> => {
      const trimmed = String(newName || '').trim();
      if (!trimmed || !oldName) return false;
      if (trimmed.toLowerCase() !== oldName.toLowerCase() && models.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
        return false;
      }
      const next = models.map((m) => (m === oldName ? trimmed : m));
      await setModels(next);
      return true;
    },
    [models, setModels]
  );

  const deleteModel = useCallback(
    async (name: string): Promise<boolean> => {
      const next = models.filter((m) => m !== name);
      await setModels(next);
      return true;
    },
    [models, setModels]
  );

  const addRiskCriterion = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return false;
      if (riskCriteria.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return false;
      const next = [...riskCriteria, trimmed];
      await setRiskCriteria(next);
      return true;
    },
    [riskCriteria, setRiskCriteria]
  );

  const updateRiskCriterion = useCallback(
    async (oldText: string, newText: string): Promise<boolean> => {
      const trimmed = String(newText || '').trim();
      if (!trimmed || !oldText) return false;
      if (trimmed.toLowerCase() !== oldText.toLowerCase() && riskCriteria.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        return false;
      }
      const next = riskCriteria.map((c) => (c === oldText ? trimmed : c));
      await setRiskCriteria(next);
      return true;
    },
    [riskCriteria, setRiskCriteria]
  );

  const deleteRiskCriterion = useCallback(
    async (text: string): Promise<boolean> => {
      const next = riskCriteria.filter((c) => c !== text);
      await setRiskCriteria(next);
      return true;
    },
    [riskCriteria, setRiskCriteria]
  );

  const addChecklistCriterion = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return false;
      if (checklistCriteria.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return false;
      const next = [...checklistCriteria, trimmed];
      await setChecklistCriteria(next);
      return true;
    },
    [checklistCriteria, setChecklistCriteria]
  );

  const updateChecklistCriterion = useCallback(
    async (oldText: string, newText: string): Promise<boolean> => {
      const trimmed = String(newText || '').trim();
      if (!trimmed || !oldText) return false;
      if (trimmed.toLowerCase() !== oldText.toLowerCase() && checklistCriteria.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        return false;
      }
      const next = checklistCriteria.map((c) => (c === oldText ? trimmed : c));
      await setChecklistCriteria(next);
      return true;
    },
    [checklistCriteria, setChecklistCriteria]
  );

  const deleteChecklistCriterion = useCallback(
    async (text: string): Promise<boolean> => {
      const next = checklistCriteria.filter((c) => c !== text);
      await setChecklistCriteria(next);
      return true;
    },
    [checklistCriteria, setChecklistCriteria]
  );

  const resetSystemSettings = useCallback(async (): Promise<void> => {
    await setModels(DEFAULT_MODELS);
    await setRiskCriteria(DEFAULT_RISK_CRITERIA);
    await setChecklistCriteria(DEFAULT_CHECKLIST_CRITERIA);
  }, [setModels, setRiskCriteria, setChecklistCriteria]);

  // --- Backup & Restore ---
  const exportBackup = useCallback(() => {
    return backupService.buildBackupPayload({
      accounts,
      trades,
      plans,
      reflections,
      goals,
      challenges,
      study,
      models,
      riskCriteria,
      checklistCriteria,
    });
  }, [accounts, trades, plans, reflections, goals, challenges, study, models, riskCriteria, checklistCriteria]);

  const restoreBackup = useCallback(
    async (payload: any): Promise<{ success: boolean; message: string }> => {
      if (!userId) return { success: false, message: 'Must be logged in to restore backup.' };
      const validation = backupService.validateBackupData(payload);
      if (!validation.valid) {
        return { success: false, message: validation.error || 'Invalid backup structure.' };
      }

      try {
        if (Array.isArray(payload.trades) && payload.trades.length > 0) {
          for (const t of payload.trades) {
            await addTrade(t);
          }
        }
        if (Array.isArray(payload.plans) && payload.plans.length > 0) {
          for (const p of payload.plans) {
            await addPlan(p);
          }
        }
        if (Array.isArray(payload.reflections) && payload.reflections.length > 0) {
          for (const r of payload.reflections) {
            await addReflection(r);
          }
        }
        if (Array.isArray(payload.goals) && payload.goals.length > 0) {
          for (const g of payload.goals) {
            await addGoal(g);
          }
        }
        if (Array.isArray(payload.models) && payload.models.length > 0) {
          await setModels(payload.models);
        }
        if (Array.isArray(payload.riskCriteria) && payload.riskCriteria.length > 0) {
          await setRiskCriteria(payload.riskCriteria);
        }
        if (Array.isArray(payload.checklistCriteria) && payload.checklistCriteria.length > 0) {
          await setChecklistCriteria(payload.checklistCriteria);
        }
        await fetchAllData();
        return { success: true, message: 'Backup restored successfully!' };
      } catch (err: any) {
        return { success: false, message: `Restore failed: ${err.message || err}` };
      }
    },
    [userId, addTrade, addPlan, addReflection, addGoal, setModels, setRiskCriteria, setChecklistCriteria, fetchAllData]
  );

  return (
    <DataContext.Provider
      value={{
        trades,
        plans,
        reflections,
        goals,
        challenges,
        study,
        loading,
        refreshing,
        isOffline,
        pendingCount,
        lastSynced,
        refetch,
        syncOfflineQueue,
        addTrade,
        updateTrade,
        deleteTrade,
        addPlan,
        updatePlan,
        deletePlan,
        addReflection,
        updateReflection,
        deleteReflection,
        addGoal,
        updateGoal,
        deleteGoal,
        addChallenge,
        updateChallenge,
        deleteChallenge,
        addStudyNote,
        updateStudyNote,
        deleteStudyNote,
        models,
        setModels,
        riskCriteria,
        setRiskCriteria,
        checklistCriteria,
        setChecklistCriteria,
        addModel,
        updateModel,
        deleteModel,
        addRiskCriterion,
        updateRiskCriterion,
        deleteRiskCriterion,
        addChecklistCriterion,
        updateChecklistCriterion,
        deleteChecklistCriterion,
        resetSystemSettings,
        exportBackup,
        restoreBackup,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
