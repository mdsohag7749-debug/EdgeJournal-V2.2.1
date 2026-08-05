import { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useAccountsManager } from '../hooks/useAccounts';

// Global multi-account state. Provides the signed-in user's account
// list plus the single source of truth for WHICH account is currently
// selected (drives the trade-scoping in DataContext). Mounted once, above
// DataProvider, in src/layouts/AppShell.jsx — mirrors how DataContext
// exposes useData().

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const manager = useAccountsManager(user?.id ?? null);

  return <AccountContext.Provider value={manager}>{children}</AccountContext.Provider>;
}

export function useAccounts() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccounts must be used within AccountProvider');
  return ctx;
}
