import React from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import {
  ScreenContainer,
  Header,
  AccountSelector,
  MetricCard,
  TradeCard,
  Button,
  EmptyState,
  OfflineBanner,
} from '../../components/common';
import { EquityCurveChart } from '../../components/charts';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';
import { computeTradeMetrics } from '../../utils/calculations';
import { formatCurrency, formatPercent } from '../../utils/formatters';

export function HomeScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { selectedAccount, allAccounts, defaultAccount } = useAccounts();
  const { trades, refreshing, refetch, isOffline, pendingCount, syncOfflineQueue, lastSynced } = useData();

  const activeAccount = selectedAccount || defaultAccount;
  const startingBalance = activeAccount ? activeAccount.startingBalance : 10000;
  const metrics = computeTradeMetrics(trades, startingBalance);

  const currentBalance = startingBalance + metrics.totalNetPnl;
  const returnPercent = startingBalance > 0 ? (metrics.totalNetPnl / startingBalance) * 100 : 0;
  const recentTrades = trades.slice(0, 5);

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
        title="Dashboard"
        subtitle={allAccounts ? 'All Accounts Combined' : activeAccount?.name || 'Active Account'}
        rightAction={<AccountSelector />}
      />

      <OfflineBanner
        isOffline={isOffline}
        pendingCount={pendingCount}
        onSyncPress={syncOfflineQueue}
        lastSynced={lastSynced}
      />

      {/* Account Hero Summary */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
          theme.shadows.card,
        ]}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.colors.textMuted }]}>Net Account Balance</Text>
            <Text style={[styles.heroValue, { color: theme.colors.text }]}>
              {formatCurrency(currentBalance)}
            </Text>
          </View>
          <View style={styles.returnBadge}>
            <Text
              style={[
                styles.returnText,
                { color: returnPercent >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger },
              ]}
            >
              {formatPercent(returnPercent)}
            </Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroFooterItem}>
            <Text style={[styles.subLabel, { color: theme.colors.textFaint }]}>Total Realized P&L</Text>
            <Text
              style={[
                styles.subVal,
                { color: metrics.totalNetPnl >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger },
              ]}
            >
              {formatCurrency(metrics.totalNetPnl)}
            </Text>
          </View>
          <View style={styles.heroFooterItem}>
            <Text style={[styles.subLabel, { color: theme.colors.textFaint }]}>Max Drawdown</Text>
            <Text style={[styles.subVal, { color: theme.colors.semantic.danger }]}>
              {metrics.maxDrawdownPercent > 0 ? `-${metrics.maxDrawdownPercent}%` : '0.0%'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddTrade')}
          style={[styles.actionBtn, { backgroundColor: theme.colors.accentDim, borderColor: theme.colors.accent }]}
        >
          <Text style={[styles.actionIcon, { color: theme.colors.accent }]}>➕</Text>
          <Text style={[styles.actionTitle, { color: theme.colors.accent }]}>Log Trade</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('MoreTab', { screen: 'PreMarket' })}
          style={[styles.actionBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Pre-Market</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('EdgeAITab')}
          style={[styles.actionBtn, { backgroundColor: theme.colors.semantic.aiAccentDim, borderColor: theme.colors.semantic.aiAccent }]}
        >
          <Text style={styles.actionIcon}>✨</Text>
          <Text style={[styles.actionTitle, { color: theme.colors.semantic.aiAccent }]}>Edge AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('MoreTab', { screen: 'Reflections' })}
          style={[styles.actionBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Text style={styles.actionIcon}>💡</Text>
          <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Reflection</Text>
        </TouchableOpacity>
      </View>

      {/* Mini Equity Curve in Dashboard */}
      {trades.length > 0 && (
        <EquityCurveChart trades={trades} startingBalance={startingBalance} height={140} />
      )}

      {/* Key Metrics Grid */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Core Metrics</Text>
      </View>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Win Rate"
          value={`${metrics.winRate}%`}
          change={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
          changeType={metrics.winRate >= 50 ? 'positive' : 'negative'}
          subtitle={`${metrics.totalTrades} Total Trades`}
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : '0.00'}
          change={metrics.profitFactor >= 2 ? 'Optimal' : metrics.profitFactor >= 1 ? 'Moderate' : 'Under 1.0'}
          changeType={metrics.profitFactor >= 1.5 ? 'positive' : 'negative'}
          subtitle={`Gross ${formatCurrency(metrics.grossProfit)}`}
        />
      </View>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Expectancy"
          value={formatCurrency(metrics.expectancy)}
          change={`Avg Win ${formatCurrency(metrics.averageWin)}`}
          changeType={metrics.expectancy > 0 ? 'positive' : 'negative'}
          subtitle={`Avg Loss ${formatCurrency(metrics.averageLoss)}`}
        />
        <MetricCard
          label="Avg Trade P&L"
          value={formatCurrency(metrics.avgTradePnl)}
          change={`Best ${formatCurrency(metrics.maxWin)}`}
          changeType={metrics.avgTradePnl >= 0 ? 'positive' : 'negative'}
          subtitle={`Worst -${formatCurrency(metrics.maxLoss)}`}
        />
      </View>

      {/* Recent Trades List */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Trades</Text>
        {trades.length > 5 && (
          <TouchableOpacity onPress={() => navigation.navigate('JournalTab')}>
            <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>View All ›</Text>
          </TouchableOpacity>
        )}
      </View>

      {recentTrades.length === 0 ? (
        <EmptyState
          title="No Trades Recorded Yet"
          description="Log your first trade to activate live equity stats, win rate tracking, and AI insights."
          actionTitle="Log Trade Now"
          onAction={() => navigation.navigate('AddTrade')}
        />
      ) : (
        recentTrades.map((t) => (
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
  heroCard: {
    padding: 18,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  returnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  returnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroFooterItem: {
    gap: 2,
  },
  subLabel: {
    fontSize: 11,
  },
  subVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
});
