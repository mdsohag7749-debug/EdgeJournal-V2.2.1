
// Inline type compatible with NavigationContainer's `linking` prop.

// Avoids the @react-navigation/native export resolution mismatch under TS 5.x.
type LinkingConfig = {
  prefixes: string[];
  config?: {
    screens: Record<string, any>;
  };
};


export const linking: LinkingConfig = {
  prefixes: ['edgejournal://', 'https://edgejournal.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          HomeTab: 'home',
          JournalTab: 'journal',
          AnalyticsTab: 'analytics',
          EdgeAITab: 'ai',
          MoreTab: {
            screens: {
              MoreMenu: 'more',
              PreMarket: 'pre-market',
              Psychology: 'psychology',
              Reflections: 'reflections',
              Study: 'study',
              Goals: 'goals',
              Challenges: 'challenges',
              Profile: 'profile',
              Settings: 'settings',
              BackupRestore: 'backup',
              Accounts: 'accounts',
            },
          },
        },
      },
      TradeDetails: 'trade/:tradeId',
      AddTrade: 'trade/add',
      EditTrade: 'trade/edit',
    },
  },
};
