import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Trade } from '../../types/models';
import { useTheme } from '../../hooks/useTheme';
import { Badge } from './Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';

export interface TradeCardProps {
  trade: Trade;
  onPress?: () => void;
  key?: React.Key;
}

export function TradeCard({ trade, onPress }: TradeCardProps) {
  const { theme } = useTheme();

  const isWin = trade.netPnl > 0;
  const isLoss = trade.netPnl < 0;
  const pnlColor = isWin
    ? theme.colors.semantic.success
    : isLoss
    ? theme.colors.semantic.danger
    : theme.colors.textMuted;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.base,
        },
        theme.shadows.subtle,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.symbolGroup}>
          <Text style={[styles.symbol, { color: theme.colors.text }]}>{trade.symbol}</Text>
          <Badge
            label={trade.direction}
            variant={trade.direction === 'Long' ? 'success' : 'danger'}
            size="sm"
          />
        </View>
        <Text style={[styles.pnl, { color: pnlColor }]}>
          {formatCurrency(trade.netPnl)}
        </Text>
      </View>

      <View style={styles.middleRow}>
        <Text style={[styles.date, { color: theme.colors.textMuted }]}>
          {formatDate(trade.entryDate)}
          {trade.entryTime ? ` • ${trade.entryTime}` : ''}
        </Text>
        {trade.riskRewardRatio ? (
          <Text style={[styles.rr, { color: theme.colors.textMuted }]}>
            {trade.riskRewardRatio.toFixed(1)}R
          </Text>
        ) : null}
      </View>

      {(trade.setup || (trade.tags && trade.tags.length > 0)) && (
        <View style={styles.bottomRow}>
          {trade.setup ? (
            <Badge label={trade.setup} variant="neutral" size="sm" style={styles.tag} />
          ) : null}
          {trade.tags?.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} label={`#${tag}`} variant="accent" size="sm" style={styles.tag} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  symbolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
  },
  pnl: {
    fontSize: 16,
    fontWeight: '700',
  },
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
  },
  rr: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  tag: {
    marginRight: 4,
  },
});
