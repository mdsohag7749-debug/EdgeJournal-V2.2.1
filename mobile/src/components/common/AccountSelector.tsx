import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useAccounts } from '../../hooks/useAccounts';
import { useTheme } from '../../hooks/useTheme';
import { ALL_ACCOUNTS_SENTINEL } from '../../services/accountsService';
import { formatCurrency } from '../../utils/formatters';

export function AccountSelector() {
  const { theme } = useTheme();
  const { accounts, selectedAccountId, allAccounts, selectAccount, selectAllAccounts } = useAccounts();
  const [modalVisible, setModalVisible] = useState(false);

  const currentLabel = allAccounts
    ? 'All Accounts'
    : accounts.find((a) => a.id === selectedAccountId)?.name || 'Select Account';

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.full,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
        <Text style={[styles.label, { color: theme.colors.text }]} numberOfLines={1}>
          {currentLabel}
        </Text>
        <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.borderStrong,
                borderRadius: theme.radii.lg,
              },
              theme.shadows.modal,
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Switch Account</Text>

            <TouchableOpacity
              style={[
                styles.accountOption,
                allAccounts && { backgroundColor: theme.colors.accentDim },
              ]}
              onPress={() => {
                selectAllAccounts();
                setModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.optionName,
                  { color: allAccounts ? theme.colors.accent : theme.colors.text },
                ]}
              >
                All Accounts (Aggregated)
              </Text>
            </TouchableOpacity>

            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedAccountId && !allAccounts;
                return (
                  <TouchableOpacity
                    style={[
                      styles.accountOption,
                      isSelected && { backgroundColor: theme.colors.accentDim },
                    ]}
                    onPress={() => {
                      selectAccount(item.id);
                      setModalVisible(false);
                    }}
                  >
                    <View>
                      <Text
                        style={[
                          styles.optionName,
                          { color: isSelected ? theme.colors.accent : theme.colors.text },
                        ]}
                      >
                        {item.name} {item.isDefault ? '• Default' : ''}
                      </Text>
                      {item.broker ? (
                        <Text style={[styles.optionBroker, { color: theme.colors.textMuted }]}>
                          {item.broker} • {item.currency}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.optionBalance, { color: theme.colors.textMuted }]}>
                      {formatCurrency(item.startingBalance)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 130,
  },
  chevron: {
    fontSize: 9,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  accountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 2,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionBroker: {
    fontSize: 12,
    marginTop: 2,
  },
  optionBalance: {
    fontSize: 13,
  },
});
