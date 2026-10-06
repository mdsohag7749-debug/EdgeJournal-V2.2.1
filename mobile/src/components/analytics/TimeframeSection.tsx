import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { GroupMetricRow } from '../../utils/analyticsEngine';
import { formatCurrency } from '../../utils/formatters';

interface TimeframeSectionProps {
  byTimeframe: GroupMetricRow[];
}

export function TimeframeSection({ byTimeframe }: TimeframeSectionProps) {
  const { theme } = useTheme();

  const activeTimeframes = byTimeframe.filter((t) => t.trades > 0);

  if (activeTimeframes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          No timeframe data logged yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
        {activeTimeframes.map((tf) => {
          const isProfitable = tf.netPnl >= 0;
          return (
            <View
              key={tf.key}
              style={[
                styles.tfCard,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: isProfitable
                    ? `${theme.colors.semantic.success}30`
                    : theme.colors.border,
                },
              ]}
            >
              {/* Header: TF Pill + Net P&L */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.tfPill,
                    { backgroundColor: `${theme.colors.accent}1A`, borderColor: `${theme.colors.accent}40` },
                  ]}
                >
                  <Text style={[styles.tfPillText, { color: theme.colors.accent }]}>{tf.label}</Text>
                </View>
                <Text
                  style={[
                    styles.netPnlText,
                    {
                      color: isProfitable
                        ? theme.colors.semantic.success
                        : theme.colors.semantic.danger,
                    },
                  ]}
                >
                  {formatCurrency(tf.netPnl)}
                </Text>
              </View>

              {/* Mini Win Rate Bar */}
              <View style={styles.winRateRow}>
                <Text style={[styles.winRateLabel, { color: theme.colors.textMuted }]}>
                  Win Rate: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{tf.winRate.toFixed(1)}%</Text>
                </Text>
                <View style={styles.miniBarTrack}>
                  <View
                    style={[
                      styles.miniBarFill,
                      {
                        width: `${tf.winRate}%`,
                        backgroundColor:
                          tf.winRate >= 50
                            ? theme.colors.semantic.success
                            : theme.colors.semantic.danger,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Stats Footer */}
              <View style={styles.cardFooter}>
                <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                  {tf.trades} {tf.trades === 1 ? 'trade' : 'trades'} ({tf.wins}W • {tf.losses}L)
                </Text>
                <Text style={[styles.footerText, { color: theme.colors.text }]}>
                  {tf.avgRR > 0 ? `${tf.avgRR.toFixed(2)}R` : '—'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollList: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 10,
  },
  tfCard: {
    width: 170,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tfPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tfPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  netPnlText: {
    fontSize: 13,
    fontWeight: '800',
  },
  winRateRow: {
    marginBottom: 10,
  },
  winRateLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  miniBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
