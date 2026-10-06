import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
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
import { JournalFilterSheet } from '../../components/journal/JournalFilterSheet';
import { SavedViewsBottomSheet } from '../../components/journal/SavedViewsBottomSheet';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';
import { formatCurrency } from '../../utils/formatters';
import {
  JournalFilterState,
  BLANK_JOURNAL_FILTERS,
  tradeMatchesFilters,
  getActiveFilterChips,
  countActiveFilters,
  getDatePresetRange,
} from '../../utils/journalFilters';

export function JournalScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { selectedAccount, allAccounts } = useAccounts();
  const { trades, refreshing, refetch } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<JournalFilterState>(BLANK_JOURNAL_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [sortAscending, setSortAscending] = useState(false);

  // Synchronize Tab selection with filters.result
  const activeTab = useMemo(() => {
    if (filters.result === 'Win') return 'wins';
    if (filters.result === 'Loss') return 'losses';
    if (filters.result === 'Open') return 'open';
    return 'all';
  }, [filters.result]);

  const handleTabChange = (key: string) => {
    let nextResult: JournalFilterState['result'] = 'All';
    if (key === 'wins') nextResult = 'Win';
    else if (key === 'losses') nextResult = 'Loss';
    else if (key === 'open') nextResult = 'Open';

    setFilters((prev) => ({ ...prev, result: nextResult }));
  };

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

  // Date preset fast-switch
  const handleSelectQuickDate = (preset: JournalFilterState['datePreset']) => {
    const range = getDatePresetRange(preset);
    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    }));
  };

  // Remove a single active filter chip
  const handleRemoveChip = (chipId: string, key: keyof JournalFilterState | 'query', val?: string) => {
    if (key === 'query') {
      setSearchQuery('');
      return;
    }

    if (key === 'datePreset' || key === 'dateFrom') {
      setFilters((prev) => ({ ...prev, datePreset: 'All Time', dateFrom: '', dateTo: '' }));
      return;
    }

    if (key === 'direction') {
      setFilters((prev) => ({ ...prev, direction: 'All' }));
      return;
    }

    if (key === 'result') {
      setFilters((prev) => ({ ...prev, result: 'All' }));
      return;
    }

    if (val && Array.isArray(filters[key])) {
      setFilters((prev) => ({
        ...prev,
        [key]: (prev[key] as string[]).filter((x) => x.toLowerCase() !== val.toLowerCase()),
      }));
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setFilters(BLANK_JOURNAL_FILTERS);
  };

  // Load a saved view
  const handleLoadView = (viewFilters: JournalFilterState) => {
    setSearchQuery('');
    setFilters(viewFilters);
  };

  // Active filter count and summary chips
  const activeCount = countActiveFilters(filters, searchQuery);
  const activeChips = useMemo(() => getActiveFilterChips(filters, searchQuery), [filters, searchQuery]);

  // Deterministic filtered and sorted trade list
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => tradeMatchesFilters(t, filters, searchQuery))
      .sort((a, b) => {
        const da = `${a.entryDate} ${a.entryTime || ''}`;
        const db = `${b.entryDate} ${b.entryTime || ''}`;
        const cmp = da.localeCompare(db);
        if (cmp !== 0) return sortAscending ? cmp : -cmp;
        return a.id.localeCompare(b.id);
      });
  }, [trades, filters, searchQuery, sortAscending]);

  const netPnlTotal = useMemo(
    () => filteredTrades.reduce((acc, t) => acc + (t.netPnl || 0), 0),
    [filteredTrades]
  );

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

      {/* Top Search & Actions Bar */}
      <View style={styles.topBar}>
        <Input
          placeholder="Search ticker, setup, tags, notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchBox}
        />
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setSavedViewsOpen(true)}
          style={[styles.viewsBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.filterBtnText, { color: theme.colors.text }]}>📌</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setFilterSheetOpen(true)}
          style={[
            styles.filterBtn,
            {
              backgroundColor: activeCount > 0 ? theme.colors.accentDim : theme.colors.card,
              borderColor: activeCount > 0 ? theme.colors.accent : theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.filterBtnText, { color: activeCount > 0 ? theme.colors.accent : theme.colors.text }]}>
            ⚙ Filters {activeCount > 0 ? `(${activeCount})` : ''}
          </Text>
        </TouchableOpacity>
        <Button
          title="+ Log"
          onPress={() => navigation.navigate('AddTrade')}
          variant="primary"
          size="sm"
          style={styles.addBtn}
        />
      </View>

      {/* Quick Date Presets Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickDateRow}
      >
        {(['All Time', 'Today', 'This Week', 'This Month', 'YTD'] as const).map((preset) => (
          <Chip
            key={preset}
            label={preset}
            selected={filters.datePreset === preset}
            onPress={() => handleSelectQuickDate(preset)}
          />
        ))}
      </ScrollView>

      {/* Result Tabs (All / Wins / Losses / Open) */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Active Filter Chips Summary (if any filters are active) */}
      {activeChips.length > 0 && (
        <View style={styles.activeSummaryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsScroll}
          >
            {activeChips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                activeOpacity={0.7}
                onPress={() => handleRemoveChip(chip.id, chip.key, chip.value)}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.accent },
                ]}
              >
                <Text style={[styles.activeChipLabel, { color: theme.colors.text }]}>{chip.label}</Text>
                <Text style={[styles.activeChipClose, { color: theme.colors.accent }]}>✕</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={handleClearAllFilters} style={styles.clearAllTouch}>
              <Text style={[styles.clearAllText, { color: theme.colors.semantic.danger }]}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Trade Count & Net PnL Bar */}
      <View style={styles.countBar}>
        <View style={styles.countLeft}>
          <Text style={[styles.countText, { color: theme.colors.textMuted }]}>
            Showing <Text style={{ fontWeight: '700', color: theme.colors.text }}>{filteredTrades.length}</Text> of{' '}
            {trades.length} trades
          </Text>
          <TouchableOpacity onPress={() => setSortAscending((prev) => !prev)}>
            <Text style={[styles.sortToggleText, { color: theme.colors.accent }]}>
              {sortAscending ? '↑ Oldest' : '↓ Newest'}
            </Text>
          </TouchableOpacity>
        </View>
        {filteredTrades.length > 0 && (
          <Text style={[styles.netTotal, { color: theme.colors.text }]}>
            Net:{' '}
            <Text
              style={{
                color: netPnlTotal >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger,
                fontWeight: '700',
              }}
            >
              {formatCurrency(netPnlTotal)}
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
              : 'No trades match the selected date range, session, or filters.'
          }
          actionTitle={trades.length === 0 ? 'Log Trade' : 'Reset Filters'}
          onAction={() => {
            if (trades.length === 0) {
              navigation.navigate('AddTrade');
            } else {
              handleClearAllFilters();
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

      {/* BottomSheet Filter Panel */}
      <JournalFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
        trades={trades}
      />

      {/* Saved Views Panel */}
      <SavedViewsBottomSheet
        visible={savedViewsOpen}
        onClose={() => setSavedViewsOpen(false)}
        currentFilters={filters}
        currentQuery={searchQuery}
        accountId={selectedAccount?.id || ''}
        onLoadView={handleLoadView}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  searchBox: {
    flex: 1,
    marginBottom: 0,
  },
  viewsBtn: {
    height: 44,
    width: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addBtn: {
    height: 44,
    paddingHorizontal: 14,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
  },
  activeSummaryContainer: {
    marginVertical: 6,
  },
  activeChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  activeChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeChipClose: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllTouch: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  countLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countText: {
    fontSize: 12,
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  netTotal: {
    fontSize: 12,
  },
});
