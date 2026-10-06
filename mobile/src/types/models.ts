// Domain Models matching EdgeJournal database and application contracts

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  broker?: string;
  accountType?: string;
  currency: string;
  startingBalance: number;
  currentBalance?: number;
  totalPnl?: number;
  winRate?: number;
  tradeCount?: number;
  isDefault: boolean;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export const TRADE_GRADES = ['A+', 'A', 'B', 'C'] as const;
export type TradeGrade = (typeof TRADE_GRADES)[number];

export const MISTAKE_NAMES = [
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
] as const;
export type MistakeName = (typeof MISTAKE_NAMES)[number];

export interface Trade {
  id: string;
  userId?: string;
  accountId: string;
  symbol: string;
  direction: 'Long' | 'Short';
  entryDate: string; // YYYY-MM-DD
  entryTime?: string; // HH:MM
  exitDate?: string;
  exitTime?: string;
  entryPrice: number;
  exitPrice?: number;
  size: number;
  netPnl: number;
  grossPnl?: number;
  commission?: number;
  pnlPercentage?: number;
  riskPercent?: number;
  riskRewardRatio?: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'Open' | 'Closed';
  setup?: string;
  session?: string;
  timeframe?: string;
  notes?: string;
  mistakes?: string[];
  tags?: string[];
  emotionBefore?: string;
  emotionDuring?: string;
  emotionAfter?: string;
  disciplineRating?: number;
  rating?: number;
  screenshots?: string[];
  isFavorite?: boolean;
  review?: Record<string, any>;
  riskChecklist?: Record<string, boolean>;
  tradeChecklist?: Record<string, boolean>;
  psychology?: Record<string, number>;
  tradeGrade?: string;
  confluences?: string;
  tradeManagement?: string;
  lessonsLearned?: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface PreMarketPlan {
  id: string;
  userId?: string;
  accountId?: string;
  date: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral' | 'Mixed';
  focusSymbols?: string[];
  keyLevels?: string;
  riskPlan?: string;
  mentalState?: string;
  economicEvents?: string;
  targets?: string;
  gamePlan?: string;
  notes?: string;
  dailyChart?: string;
  intradayChart?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reflection {
  id: string;
  userId?: string;
  accountId?: string;
  period?: 'Daily' | 'Weekly' | 'Monthly';
  date: string;
  rating?: number; // 1 to 5
  dailyGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
  title?: string;
  reflection?: string;
  wentWell?: string;
  lessonsLearned?: string;
  improvements?: string;
  rulesFollowed?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  userId?: string;
  title: string;
  period?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  targetDate?: string;
  description?: string;
  successMetrics?: string;
  subItems?: Array<{ id: string; text: string; done: boolean }>;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  deadline?: string;
  completed?: boolean;
  status?: 'in_progress' | 'completed' | 'failed';
  createdAt?: string;
  updatedAt?: string;
}

export interface Challenge {
  id: string;
  userId?: string;
  accountId?: string;
  name?: string;
  title?: string;
  propFirm?: string;
  description?: string;
  challengeType?: string;
  startingBalance?: number;
  profitTarget?: number;
  dailyDrawdown?: number;
  maximumDrawdown?: number;
  minTradingDays?: number;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'archived' | 'failed' | 'pass' | 'warning' | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudyItem {
  id: string;
  userId?: string;
  title: string;
  date?: string;
  sessionType?: 'Daily' | 'Weekly' | 'Playbook' | 'Concept' | 'Mistake';
  category?: string;
  description?: string;
  notes?: string;
  chart?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TradeScreenshot {
  id: string;
  tradeId: string;
  userId?: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  url: string | null;
}

export interface StagedScreenshot {
  id: string;
  uri: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}
