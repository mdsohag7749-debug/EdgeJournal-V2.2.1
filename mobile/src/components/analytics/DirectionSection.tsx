import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { GroupMetricRow } from '../../utils/analyticsEngine';
import { formatCurrency } from '../../utils/formatters';

interface DirectionSectionProps {
  byDirection: GroupMetricRow[];
}

export function DirectionSection({ byDirection }: DirectionSectionProps) {
  const { theme } = useTheme();

  const longData = byDirection.find((d) => d.key === 'Long') || {
    key: 'Long',
    label: 'Long (Buy)',
    trades: 0,
    wins: 0,
    losses: 0,
    netPnl: 0,
    winRate: 0,
    avgRR: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
  };

  const shortData = byDirection.find((d) => d.key === 'Short') || {
    key: 'Short',
    label: 'Short (Sell)',
    trades: 0,
    wins: 0,
    losses: 0,
    netPnl: 0,
    winRate: 0,
    avgRR: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
  };

  const totalTrades = longData.trades + shortData.trades;
  const longPct = totalTrades > 0 ? (longData.trades / totalTrades) * 100 : 50;
  const shortPct = totalTrades > 0 ? (shortData.trades / totalTrades) * 100 : 50;

  return (
    <View style={styles.container}>
      {/* Visual Direction Distribution Bar */}
      {totalTrades > 0 && (
        <View style={styles.barContainer}>
          <View style={styles.barLabelsRow}>
            <Text style={[styles.barLabel, { color: theme.colors.semantic.success }]}>
              Long: {longData.trades} ({longPct.toFixed(0)}%)
            </Text>
            <Text style={[styles.barLabel, { color: theme.colors.semantic.danger }]}>
              Short: {shortData.trades} ({shortPct.toFixed(0)}%)
            </Text>
          </View>
          <View style={styles.distributionBar}>
            <View
              style={[
                styles.barFill,
                { width: `${longPct}%`, backgroundColor: theme.colors.semantic.success },
              ]}
            />
            <View
              style={[
                styles.barFill,
                { width: `${shortPct}%`, backgroundColor: theme.colors.semantic.danger },
              ]}
            />
          </View>
        </View>
      )}

      {/* Side-by-side comparison cards */}
      <View style={styles.comparisonGrid}>
        {/* Long Box */}
        <View
          style={[
            styles.directionBox,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: longData.netPnl >= 0 ? `${theme.colors.semantic.success}40` : theme.colors.border,
            },
          ]}
        >
          <View style={styles.badgeHeader}>
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: `${theme.colors.semantic.success}18` },
              ]}
            >
              <Text style={[styles.badgeTitle, { color: theme.colors.semantic.success }]}>LONG / BUY</Text>
            </View>
            <Text style={[styles.tradesCount, { color: theme.colors.textMuted }]}>
              {longData.trades} Trades
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Net P&L</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    longData.netPnl >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger,
                },
              ]}
            >
              {formatCurrency(longData.netPnl)}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Win Rate</Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {longData.trades > 0 ? `${longData.winRate.toFixed(1)}%` : '—'}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Wins / Losses</Text>
            <Text style={[styles.metricSub, { color: theme.colors.textMuted }]}>
              {longData.wins}W • {longData.losses}L
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Avg R:R</Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {longData.avgRR > 0 ? `${longData.avgRR.toFixed(2)}R` : '—'}
            </Text>
          </View>
        </View>

        {/* Short Box */}
        <View
          style={[
            styles.directionBox,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: shortData.netPnl >= 0 ? `${theme.colors.semantic.success}40` : theme.colors.border,
            },
          ]}
        >
          <View style={styles.badgeHeader}>
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: `${theme.colors.semantic.danger}18` },
              ]}
            >
              <Text style={[styles.badgeTitle, { color: theme.colors.semantic.danger }]}>SHORT / SELL</Text>
            </View>
            <Text style={[styles.tradesCount, { color: theme.colors.textMuted }]}>
              {shortData.trades} Trades
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Net P&L</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    shortData.netPnl >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger,
                },
              ]}
            >
              {formatCurrency(shortData.netPnl)}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Win Rate</Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {shortData.trades > 0 ? `${shortData.winRate.toFixed(1)}%` : '—'}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Wins / Losses</Text>
            <Text style={[styles.metricSub, { color: theme.colors.textMuted }]}>
              {shortData.wins}W • {shortData.losses}L
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Avg R:R</Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {shortData.avgRR > 0 ? `${shortData.avgRR.toFixed(2)}R` : '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  barContainer: {
    marginBottom: 4,
  },
  barLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  distributionBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  barFill: {
    height: '100%',
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  directionBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  directionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tradesCount: {
    fontSize: 11,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricSub: {
    fontSize: 12,
    fontWeight: '600',
  },
});
