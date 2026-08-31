import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  ScreenContainer,
  Header,
  Badge,
  Button,
  Input,
  Select,
  Modal,
} from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';
import { Account } from '../../types/models';
import { formatCurrency } from '../../utils/formatters';

const CURRENCY_OPTIONS = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'GBP (£)', value: 'GBP' },
  { label: 'AUD ($)', value: 'AUD' },
  { label: 'CAD ($)', value: 'CAD' },
];

const ACCOUNT_TYPES = [
  { label: 'Live Brokerage', value: 'Live' },
  { label: 'Prop Firm Funded', value: 'Prop Firm' },
  { label: 'Evaluation Challenge', value: 'Evaluation' },
  { label: 'Paper / Demo Account', value: 'Demo' },
];

export function AccountsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { accounts, selectedAccountId, selectAccount, createAccount, updateAccount, deleteAccount } = useAccounts();
  const { trades } = useData();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [name, setName] = useState('');
  const [broker, setBroker] = useState('');
  const [accountType, setAccountType] = useState('Live');
  const [currency, setCurrency] = useState('USD');
  const [startingBalance, setStartingBalance] = useState('10000');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an account name.');
      return;
    }
    setSaving(true);
    await createAccount({
      name: name.trim(),
      broker: broker.trim(),
      accountType,
      currency,
      startingBalance: Number(startingBalance) || 10000,
    });
    setSaving(false);
    setCreateModalOpen(false);
    setName('');
    setBroker('');
  };

  const handleEdit = async () => {
    if (!editingAccount || !name.trim()) return;
    setSaving(true);
    await updateAccount(editingAccount.id, {
      name: name.trim(),
      broker: broker.trim(),
      accountType,
      currency,
      startingBalance: Number(startingBalance) || editingAccount.startingBalance,
    });
    setSaving(false);
    setEditModalOpen(false);
    setEditingAccount(null);
  };

  const handleDelete = async (acc: Account) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete ${acc.name}? All trades assigned to this account will be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount(acc.id);
          },
        },
      ]
    );
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setBroker(acc.broker || '');
    setAccountType(acc.accountType || 'Live');
    setCurrency(acc.currency || 'USD');
    setStartingBalance(String(acc.startingBalance || '10000'));
    setEditModalOpen(true);
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Accounts"
        subtitle="Multi-Account Management & Balances"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.topAction}>
        <Button
          title="+ Add Account"
          onPress={() => {
            setName('');
            setBroker('');
            setStartingBalance('10000');
            setCreateModalOpen(true);
          }}
          variant="primary"
          size="sm"
        />
      </View>

      <View style={styles.list}>
        {accounts.map((acc) => {
          const isSelected = acc.id === selectedAccountId;
          const accTrades = trades.filter((t) => t.accountId === acc.id);
          const accPnl = accTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
          const liveBalance = acc.startingBalance + accPnl;

          return (
            <TouchableOpacity
              key={acc.id}
              activeOpacity={0.8}
              onPress={() => selectAccount(acc.id)}
              style={[
                styles.accountCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.name, { color: theme.colors.text }]}>
                    {acc.name} {acc.isDefault ? '• (Default)' : ''}
                  </Text>
                  <Text style={[styles.broker, { color: theme.colors.textMuted }]}>
                    {acc.broker || 'Manual Journal'} • {acc.accountType || 'Live'} • {acc.currency}
                  </Text>
                </View>

                {isSelected ? (
                  <Badge label="ACTIVE" variant="accent" size="sm" />
                ) : (
                  <Button
                    title="Select"
                    onPress={() => selectAccount(acc.id)}
                    variant="outline"
                    size="sm"
                  />
                )}
              </View>

              <View style={styles.balanceRow}>
                <View>
                  <Text style={[styles.balanceLabel, { color: theme.colors.textFaint }]}>Starting</Text>
                  <Text style={[styles.balanceValue, { color: theme.colors.text }]}>
                    {formatCurrency(acc.startingBalance)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.balanceLabel, { color: theme.colors.textFaint }]}>Realized P&L</Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      { color: accPnl >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger },
                    ]}
                  >
                    {formatCurrency(accPnl)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.balanceLabel, { color: theme.colors.textFaint }]}>Current Equity</Text>
                  <Text style={[styles.balanceValue, { color: theme.colors.text }]}>
                    {formatCurrency(liveBalance)}
                  </Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <TouchableOpacity onPress={() => openEdit(acc)}>
                  <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>

                {accounts.length > 1 && (
                  <TouchableOpacity onPress={() => handleDelete(acc)}>
                    <Text style={{ color: theme.colors.semantic.danger, fontSize: 13 }}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Create Account Modal */}
      <Modal visible={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Account">
        <Input
          label="Account Name"
          placeholder="e.g. Primary Equities or 100K Futures"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Broker / Platform (Optional)"
          placeholder="e.g. Interactive Brokers, Tradovate"
          value={broker}
          onChangeText={setBroker}
        />
        <Select
          label="Account Type"
          options={ACCOUNT_TYPES}
          selectedValue={accountType}
          onValueChange={setAccountType}
        />
        <Select
          label="Currency"
          options={CURRENCY_OPTIONS}
          selectedValue={currency}
          onValueChange={setCurrency}
        />
        <Input
          label="Starting Balance ($)"
          keyboardType="numeric"
          value={startingBalance}
          onChangeText={setStartingBalance}
        />
        <Button
          title="Create Account"
          onPress={handleCreate}
          loading={saving}
          variant="primary"
          size="md"
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* Edit Account Modal */}
      <Modal visible={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Account">
        <Input
          label="Account Name"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Broker / Platform"
          value={broker}
          onChangeText={setBroker}
        />
        <Select
          label="Account Type"
          options={ACCOUNT_TYPES}
          selectedValue={accountType}
          onValueChange={setAccountType}
        />
        <Input
          label="Starting Balance ($)"
          keyboardType="numeric"
          value={startingBalance}
          onChangeText={setStartingBalance}
        />
        <Button
          title="Save Changes"
          onPress={handleEdit}
          loading={saving}
          variant="primary"
          size="md"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topAction: {
    marginVertical: 12,
    alignItems: 'flex-end',
  },
  list: {
    gap: 12,
    marginBottom: 30,
  },
  accountCard: {
    padding: 16,
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  broker: {
    fontSize: 12,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  balanceLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
});
