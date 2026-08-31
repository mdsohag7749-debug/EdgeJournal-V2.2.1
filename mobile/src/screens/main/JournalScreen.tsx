import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import {
  ScreenContainer,
  Header,
  AccountSelector,
  Tabs,
  Chip,
  TradeCard,
  Button,
  Input,
  EmptyState,
} from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';
import { formatCurrency } from '../../utils/formatters';

export function JournalScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { selectedAccount, allAccounts } = useAccounts();
  const { trades, refreshing, refetch } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedSetup, setSelectedSetup] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(false);

  // Tab counts
  const winCount = useMemo(() => trades.filter((t) => t.netPnl > 0).length, [trades]);
  const lossCount = useMemo(() => trades.filter((t) => t.netPnl < 0).length, [trades]);
  const openCount = useMemo(() => trades.filter((t) => t.status === 'Open').length, [trades]);

  const tabs = [
    { key: 'all', label: 'All', count: trades.length },
    { key: 'wins', label: 'Wins', count: winCount },
    { key: 'losses', label: 'Losses', count: lossCount },
    { key: 'open', label: 'Open', count: openCount },
  ];

  // Setups present in user trades
  const uniqueSetups = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) {
      if (t.setup) s.add(t.setup);
    }
    return Array.from(s);
  }, [trades]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        // Tab filter
        if (activeTab === 'wins' && t.netPnl <= 0) return false;
        if (activeTab === 'losses' && t.netPnl >= 0) return false;
        if (activeTab === 'open' && t.status !== 'Open') return false;

        // Direction filter
        if (selectedDirection && t.direction !== selectedDirection) return false;

        // Setup filter
        if (selectedSetup && t.setup !== selectedSetup) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSymbol = t.symbol.toLowerCase().includes(q);
          const matchSetup = t.setup?.toLowerCase().includes(q);
          const matchNotes = t.notes?.toLowerCase().includes(q);
          const matchTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
          if (!matchSymbol && !matchSetup && !matchNotes && !matchTags) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const da = `${a.entryDate} ${a.entryTime || ''}`;
        const db = `${b.entryDate} ${b.entryTime || ''}`;
        return sortAscending ? da.localeCompare(db) : db.localeCompare(da);
      });
  }, [trades, activeTab, selectedDirection, selectedSetup, searchQuery, sortAscending]);

  return (
    <ScreenContainer
      scrollable
      contentContainerStyle={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        ),
      } as any}
    >
      <Header
        title="Trading Journal"
        subtitle={allAccounts ? 'All Accounts' : selectedAccount?.name || 'Account'}
        rightAction={<AccountSelector />}
      />

      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <Input
          placeholder="Search ticker, setup, tags, notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchBox}
        />
        <Button
          title="+ Log Trade"
          onPress={() => navigation.navigate('AddTrade')}
          variant="primary"
          size="sm"
          style={styles.addBtn}
        />
      </View>

      {/* Win / Loss / Open Status Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Filter Chips */}
      <View style={styles.filterSection}>
        <View style={styles.chipRow}>
          <Chip
            label={sortAscending ? 'Oldest First ⇅' : 'Newest First ⇅'}
            selected={false}
            onPress={() => setSortAscending((prev) => !prev)}
          />
          <Chip
            label="All Directions"
            selected={selectedDirection === null}
            onPress={() => setSelectedDirection(null)}
          />
          <Chip
            label="Longs Only"
            selected={selectedDirection === 'Long'}
            onPress={() => setSelectedDirection(selectedDirection === 'Long' ? null : 'Long')}
          />
          <Chip
            label="Shorts Only"
            selected={selectedDirection === 'Short'}
            onPress={() => setSelectedDirection(selectedDirection === 'Short' ? null : 'Short')}
          />
        </View>

        {uniqueSetups.length > 0 && (
          <View style={styles.chipRow}>
            <Chip
              label="All Setups"
              selected={selectedSetup === null}
              onPress={() => setSelectedSetup(null)}
            />
            {uniqueSetups.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={selectedSetup === s}
                onPress={() => setSelectedSetup(selectedSetup === s ? null : s)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Trade Count & Summary Bar */}
      <View style={styles.countBar}>
        <Text style={[styles.countText, { color: theme.colors.textMuted }]}>
          Showing {filteredTrades.length} of {trades.length} trades
        </Text>
        {filteredTrades.length > 0 && (
          <Text style={[styles.netTotal, { color: theme.colors.text }]}>
            Net:{' '}
            <Text
              style={{
                color:
                  filteredTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0) >= 0
                    ? theme.colors.semantic.success
                    : theme.colors.semantic.danger,
                fontWeight: '700',
              }}
            >
              {formatCurrency(filteredTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0))}
            </Text>
          </Text>
        )}
      </View>

      {/* Trade Cards List */}
      {filteredTrades.length === 0 ? (
        <EmptyState
          title={trades.length === 0 ? 'No Trades Logged' : 'No Matching Trades'}
          description={
            trades.length === 0
              ? 'Start logging trades to build your journal history.'
              : 'Try clearing filters or search query to view trades.'
          }
          actionTitle={trades.length === 0 ? 'Log Trade' : 'Clear Filters'}
          onAction={() => {
            if (trades.length === 0) {
              navigation.navigate('AddTrade');
            } else {
              setSearchQuery('');
              setActiveTab('all');
              setSelectedSetup(null);
              setSelectedDirection(null);
            }
          }}
        />
      ) : (
        filteredTrades.map((t) => (
          <TradeCard
            key={t.id}
            trade={t}
            onPress={() => navigation.navigate('TradeDetails', { trade: t })}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  searchBox: {
    flex: 1,
    marginBottom: 0,
  },
  addBtn: {
    height: 44,
  },
  filterSection: {
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  countBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  countText: {
    fontSize: 12,
  },
  netTotal: {
    fontSize: 12,
  },
});
