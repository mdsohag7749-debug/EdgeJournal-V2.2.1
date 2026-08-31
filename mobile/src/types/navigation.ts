// Navigation Param Lists for React Navigation

import { NavigatorScreenParams } from '@react-navigation/native';
import { Trade } from './models';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  TradeDetails: { trade: Trade; tradeId?: string };
  AddTrade: { defaultAccountId?: string } | undefined;
  EditTrade: { trade: Trade };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  JournalTab: undefined;
  AnalyticsTab: undefined;
  EdgeAITab: { initialTrade?: Trade; initialFeature?: 'intelligence' | 'review' | 'coach' | 'ask' } | undefined;
  MoreTab: NavigatorScreenParams<MoreStackParamList>;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  PreMarket: undefined;
  Psychology: undefined;
  Reflections: undefined;
  Study: undefined;
  Goals: undefined;
  Challenges: undefined;
  Profile: undefined;
  Settings: undefined;
  BackupRestore: undefined;
  Accounts: undefined;
};
