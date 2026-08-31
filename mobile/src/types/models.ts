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
  screenshots?: string[];
  isFavorite?: boolean;
  review?: Record<string, any>;
  psychology?: Record<string, any>;
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
  status?: 'active' | 'completed' | 'abandoned';
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
