import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { DetailedAnalytics } from '../../utils/analyticsEngine';
import { formatCurrency } from '../../utils/formatters';

interface DeepPerformanceSectionProps {
  analytics: DetailedAnalytics;
}

export function DeepPerformanceSection({ analytics }: DeepPerformanceSectionProps) {
  const { theme } = useTheme();

  const isPositiveExp = analytics.expectancy >= 0;
  const isDecided = analytics.decided > 0;

  return (
    <View style={styles.container}>
      {/* 2-column metrics grid */}
      <View style={styles.grid}>
        {/* Expectancy */}
        <View style={[styles.card, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Expectancy</Text>
          <Text
            style={[
              styles.value,
              { color: isPositiveExp ? theme.colors.semantic.success : theme.colors.semantic.danger },
            ]}
          >
            {isDecided ? `${analytics.expectancy >= 0 ? '+' : ''}${formatCurrency(analytics.expectancy)}` : '—'}
          </Text>
          <Text style={[styles.subtext, { color: theme.colors.textFaint }]}>Per trade edge</Text>
        </View>

        {/* Payoff Ratio */}
        <View style={[styles.card, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Payoff Ratio</Text>
          <Text style={[styles.value, { color: theme.colors.accent }]}>
            {isDecided && analytics.avgRR > 0 ? `${analytics.avgRR.toFixed(2)} : 1` : '—'}
          </Text>
          <Text style={[styles.subtext, { color: theme.colors.textFaint }]}>Avg Win / Avg Loss</Text>
        </View>

        {/* Best Trade */}
        <View style={[styles.card, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Best Trade</Text>
          <Text style={[styles.value, { color: theme.colors.semantic.success }]}>
            {analytics.total > 0 ? `+${formatCurrency(analytics.bestTrade)}` : '—'}
          </Text>
          <Text style={[styles.subtext, { color: theme.colors.textFaint }]}>Largest winner</Text>
        </View>

        {/* Worst Trade */}
        <View style={[styles.card, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Worst Trade</Text>
          <Text
            style={[
              styles.value,
              { color: analytics.worstTrade < 0 ? theme.colors.semantic.danger : theme.colors.text },
            ]}
          >
            {analytics.total > 0 ? formatCurrency(analytics.worstTrade) : '—'}
          </Text>
          <Text style={[styles.subtext, { color: theme.colors.textFaint }]}>Largest drawdown</Text>
        </View>

        {/* Current Streak */}
        <View style={[styles.card, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Current Streak</Text>
          <Text
            style={[
              styles.value,
              {
                color:
                  analytics.currentWinStreak > 0
                    ? theme.colors.semantic.success
                    : analytics.currentLossStreak > 0
                    ? theme.colors.semantic.danger
                    : theme.colors.text,
              },
            ]}
          >
            {analytics.currentWinStreak > 0
              ? `${analytics.currentWinStreak}W`
              : analytics.currentLossStreak > 0
              ? `${analytics.currentLossStreak}L`
              : 'Flat'}
          </Text>
          <Text style={[styles.subtext, { color: theme.colors.textFaint }]}>
            {analytics.currentWinStreak > 0 ? 'Active winning run' : 'Latest sequence'}
          </Text>
        </View>

        {/* Longest Win Streak */}
        <View style={[styles.card, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max Win Streak</Text>
          <Text style={[styles.value, { color: theme.colors.semantic.success }]}>
            {analytics.longestWinStreak > 0 ? `${analytics.longestWinStreak} Wins` : '—'}
          </Text>
          <Text style={[styles.subtext, { color: theme.colors.textFaint }]}>Historical best run</Text>
        </View>
      </View>

      {/* Full width duration spotlight banner */}
      <View
        style={[
          styles.spotlightBanner,
          { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
        ]}
      >
        <View>
          <Text style={[styles.spotlightLabel, { color: theme.colors.textMuted }]}>Avg Trade Duration</Text>
          <Text style={[styles.spotlightValue, { color: theme.colors.text }]}>
            {analytics.avgDurationLabel}
          </Text>
        </View>
        <Text style={[styles.spotlightFootnote, { color: theme.colors.textFaint }]}>
          {analytics.avgDurationMin > 0 ? 'Across logged entry/exit times' : 'Log entry & exit times'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
  },
  subtext: {
    fontSize: 11,
  },
  spotlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  spotlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  spotlightValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  spotlightFootnote: {
    fontSize: 11,
    maxWidth: 140,
    textAlign: 'right',
  },
});
