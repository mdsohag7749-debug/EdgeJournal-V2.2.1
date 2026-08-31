import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Account } from '../types/models';
import { accountsService, ALL_ACCOUNTS_SENTINEL } from '../services/accountsService';
import { storageService } from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';

interface AccountContextType {
  accounts: Account[];
  loading: boolean;
  selectedAccountId: string | null;
  allAccounts: boolean;
  selectedAccount: Account | null;
  preferredAccountId: string | null;
  preferredAccount: Account | null;
  defaultAccount: Account | null;
  selectAccount: (id: string) => void;
  selectAllAccounts: () => void;
  createAccount: (input: Partial<Account>) => Promise<Account | null>;
  updateAccount: (id: string, patch: Partial<Account>) => Promise<Account | null>;
  deleteAccount: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const AccountContext = createContext<AccountContextType | null>(null);

function selectedStorageKey(userId?: string) {
  return `edgejournal_mobile_selected_account_${userId || 'anon'}`;
}

export function AccountProvider({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [rawSelection, setRawSelection] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setRawSelection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await accountsService.ensureDefaultAccount(userId);
      const list = await accountsService.fetchAccounts(userId);
      setAccounts(list);

      const stored = await storageService.getItem(selectedStorageKey(userId));
      const isValid = stored === ALL_ACCOUNTS_SENTINEL || list.some((a) => a.id === stored);
      const fallback = list.find((a) => a.isDefault) || list[0];
      const nextSelection = isValid ? stored : (fallback?.id || null);

      setRawSelection(nextSelection);
      if (nextSelection) {
        await storageService.setItem(selectedStorageKey(userId), nextSelection);
      }
    } catch (err: any) {
      logger.warn('ACCOUNT', 'Error fetching accounts', { error: err?.message });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const selectAccount = useCallback(
    (id: string) => {
      setRawSelection(id);
      if (userId) storageService.setItem(selectedStorageKey(userId), id);
    },
    [userId]
  );

  const selectAllAccounts = useCallback(() => {
    setRawSelection(ALL_ACCOUNTS_SENTINEL);
    if (userId) storageService.setItem(selectedStorageKey(userId), ALL_ACCOUNTS_SENTINEL);
  }, [userId]);

  const createAccount = useCallback(
    async (input: Partial<Account>) => {
      if (!userId) return null;
      const created = await accountsService.createAccount(userId, input);
      if (created) {
        setAccounts((prev) => [created, ...prev]);
        if (accounts.length === 0) {
          selectAccount(created.id);
        }
      }
      return created;
    },
    [userId, accounts.length, selectAccount]
  );

  const updateAccount = useCallback(
    async (id: string, patch: Partial<Account>) => {
      if (!userId) return null;
      const updated = await accountsService.updateAccount(userId, id, patch);
      if (updated) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
      return updated;
    },
    [userId]
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      if (!userId) return false;
      const success = await accountsService.deleteAccount(userId, id);
      if (success) {
        setAccounts((prev) => {
          const next = prev.filter((a) => a.id !== id);
          if (rawSelection === id) {
            const fallback = next.find((a) => a.isDefault) || next[0];
            selectAccount(fallback?.id || ALL_ACCOUNTS_SENTINEL);
          }
          return next;
        });
      }
      return success;
    },
    [userId, rawSelection, selectAccount]
  );

  const allAccounts = rawSelection === ALL_ACCOUNTS_SENTINEL;
  const selectedAccountId = !allAccounts ? rawSelection : null;
  const selectedAccount = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) || null : null;
  const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0] || null;
  const preferredAccountId = selectedAccountId || defaultAccount?.id || null;
  const preferredAccount = selectedAccount || defaultAccount || null;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        loading,
        selectedAccountId,
        allAccounts,
        selectedAccount,
        preferredAccountId,
        preferredAccount,
        defaultAccount,
        selectAccount,
        selectAllAccounts,
        createAccount,
        updateAccount,
        deleteAccount,
        refetch,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
