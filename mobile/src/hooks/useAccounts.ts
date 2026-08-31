import { useContext } from 'react';
import { AccountContext } from '../context/AccountContext';

export function useAccounts() {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return ctx;
}
