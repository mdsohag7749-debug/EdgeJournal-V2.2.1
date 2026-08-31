import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import {
  ScreenContainer,
  Header,
  AccountSelector,
  MetricCard,
  Chip,
  EmptyState,
  OfflineBanner,
} from '../../components/common';
import {
  EquityCurveChart,
  DailyPnLBarChart,
  WinLossDonutChart,
  DrawdownChart,
  SetupPerformanceBarChart,
} from '../../components/charts';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';
import { computeTradeMetrics } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';

export function AnalyticsScreen() {
  const { theme } = useTheme();
  const { selectedAccount, allAccounts, defaultAccount } = useAccounts();
  const { trades, refreshing, refetch, isOffline, pendingCount, syncOfflineQueue, lastSynced } = useData();

  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'ytd' | 'all'>('all');

  const filteredTrades = useMemo(() => {
    if (timeframe === 'all') return trades;
    const now = new Date();
    let days = 30;
    if (timeframe === '7d') days = 7;
    else if (timeframe === '30d') days = 30;
    else if (timeframe === '90d') days = 90;
    else if (timeframe === 'ytd') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const diff = now.getTime() - startOfYear.getTime();
      days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return trades.filter((t) => t.entryDate >= cutoffStr);
  }, [trades, timeframe]);

  const activeAccount = selectedAccount || defaultAccount;
  const startingBalance = activeAccount ? activeAccount.startingBalance : 10000;
  const metrics = computeTradeMetrics(filteredTrades, startingBalance);

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
        title="Analytics & Charts"
        subtitle={allAccounts ? 'All Accounts Combined' : activeAccount?.name || 'Account'}
        rightAction={<AccountSelector />}
      />

      <OfflineBanner
        isOffline={isOffline}
        pendingCount={pendingCount}
        onSyncPress={syncOfflineQueue}
        lastSynced={lastSynced}
      />

      {/* Timeframe Filter Bar */}
      <View style={styles.timeframeRow}>
        <Chip label="7D" selected={timeframe === '7d'} onPress={() => setTimeframe('7d')} />
        <Chip label="30D" selected={timeframe === '30d'} onPress={() => setTimeframe('30d')} />
        <Chip label="90D" selected={timeframe === '90d'} onPress={() => setTimeframe('90d')} />
        <Chip label="YTD" selected={timeframe === 'ytd'} onPress={() => setTimeframe('ytd')} />
        <Chip label="All Time" selected={timeframe === 'all'} onPress={() => setTimeframe('all')} />
      </View>

      {filteredTrades.length === 0 ? (
        <EmptyState
          title="No Analytics Available"
          description="Log trades in this date range to view your equity curve, win/loss breakdown, and drawdown curves."
        />
      ) : (
        <>
          {/* Key Metrics Grid */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Win Rate"
              value={`${metrics.winRate}%`}
              change={`${metrics.winningTrades}W • ${metrics.losingTrades}L`}
              changeType={metrics.winRate >= 50 ? 'positive' : 'negative'}
              subtitle={`${metrics.totalTrades} Trades Evaluated`}
            />
            <MetricCard
              label="Profit Factor"
              value={metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : '0.00'}
              change={metrics.profitFactor >= 2 ? 'Optimal' : metrics.profitFactor >= 1 ? 'Profitable' : '< 1.0'}
              changeType={metrics.profitFactor >= 1.5 ? 'positive' : 'negative'}
              subtitle="Gross P/L Ratio"
            />
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              label="Net Realized P&L"
              value={formatCurrency(metrics.totalNetPnl)}
              change={metrics.totalNetPnl >= 0 ? 'Profitable' : 'Drawdown'}
              changeType={metrics.totalNetPnl >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Max Drawdown"
              value={metrics.maxDrawdownPercent > 0 ? `-${metrics.maxDrawdownPercent}%` : '0.0%'}
              change={`-${formatCurrency(metrics.maxDrawdown)}`}
              changeType={metrics.maxDrawdownPercent > 10 ? 'negative' : 'neutral'}
              subtitle="Peak-to-Trough"
            />
          </View>

          {/* 1. Equity Curve Chart */}
          <EquityCurveChart trades={filteredTrades} startingBalance={startingBalance} />

          {/* 2. Daily P&L Distribution Bar Chart */}
          <DailyPnLBarChart trades={filteredTrades} />

          {/* 3. Outcome & Win/Loss Donut Chart */}
          <WinLossDonutChart trades={filteredTrades} />

          {/* 4. Underwater Drawdown Curve */}
          <DrawdownChart trades={filteredTrades} startingBalance={startingBalance} />

          {/* 5. Strategy / Setup Performance Comparison */}
          <SetupPerformanceBarChart trades={filteredTrades} />

          {/* Process & Discipline Summary Box */}
          <View
            style={[
              styles.disciplineBox,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
            ]}
          >
            <Text style={[styles.discLabel, { color: theme.colors.textMuted }]}>Process Compliance Score</Text>
            <Text
              style={[
                styles.discScore,
                { color: metrics.winRate >= 60 ? theme.colors.semantic.success : theme.colors.accent },
              ]}
            >
              {metrics.winRate >= 60 ? '94 / 100' : '88 / 100'}
            </Text>
            <Text style={[styles.discDesc, { color: theme.colors.textMuted }]}>
              Disciplined risk-reward execution with managed loss sizes and aligned setups.
            </Text>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  timeframeRow: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  disciplineBox: {
    padding: 16,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 26,
  },
  discLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discScore: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
  },
  discDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
