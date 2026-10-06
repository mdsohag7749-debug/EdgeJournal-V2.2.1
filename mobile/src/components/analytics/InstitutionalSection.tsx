import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { InstitutionalInsightsResult } from '../../utils/institutionalEngine';
import { formatCurrency } from '../../utils/formatters';

interface InstitutionalSectionProps {
  data: InstitutionalInsightsResult;
}

export function InstitutionalSection({ data }: InstitutionalSectionProps) {
  const { theme } = useTheme();

  if (!data.hasData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          Institutional intelligence unlocks once you log decided trades with sessions and models.
        </Text>
      </View>
    );
  }

  const { insights, trend } = data;

  return (
    <View style={styles.container}>
      {/* 2-Column Insight Cards */}
      <View style={styles.grid}>
        {/* Highest RR Session */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.textMuted }]}>
            Highest R:R Session
          </Text>
          <Text style={[styles.cardValue, { color: theme.colors.accent }]} numberOfLines={1}>
            {insights.rrEnvironment ? insights.rrEnvironment.label : '—'}
          </Text>
          <Text style={[styles.cardDetail, { color: theme.colors.textFaint }]}>
            {insights.rrEnvironment
              ? `${insights.rrEnvironment.avgRR.toFixed(2)} Avg R:R`
              : 'Insufficient data'}
          </Text>
        </View>

        {/* Most Profitable Model */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.textMuted }]}>
            Top Strategy Model
          </Text>
          <Text
            style={[
              styles.cardValue,
              {
                color:
                  insights.bestModel && insights.bestModel.netPnl >= 0
                    ? theme.colors.semantic.success
                    : theme.colors.text,
              },
            ]}
            numberOfLines={1}
          >
            {insights.bestModel ? insights.bestModel.label : '—'}
          </Text>
          <Text style={[styles.cardDetail, { color: theme.colors.textFaint }]}>
            {insights.bestModel
              ? `${formatCurrency(insights.bestModel.netPnl)} (${insights.bestModel.trades} trades)`
              : 'Insufficient data'}
          </Text>
        </View>

        {/* Most Consistent Session */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.textMuted }]}>
            Most Consistent Session
          </Text>
          <Text style={[styles.cardValue, { color: theme.colors.semantic.info }]} numberOfLines={1}>
            {insights.consistent ? insights.consistent.label : '—'}
          </Text>
          <Text style={[styles.cardDetail, { color: theme.colors.textFaint }]}>
            {insights.consistent
              ? `${insights.consistent.winRate.toFixed(1)}% win rate`
              : 'Need ≥ 2 trades in session'}
          </Text>
        </View>

        {/* Top Mistake Tag */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.textMuted }]}>
            Frequent Mistake
          </Text>
          <Text
            style={[
              styles.cardValue,
              { color: insights.topMistake ? theme.colors.semantic.danger : theme.colors.text },
            ]}
            numberOfLines={1}
          >
            {insights.topMistake ? insights.topMistake.name : 'None Tagged'}
          </Text>
          <Text style={[styles.cardDetail, { color: theme.colors.textFaint }]}>
            {insights.topMistake ? `${insights.topMistake.count} occurrences` : 'Clean execution'}
          </Text>
        </View>
      </View>

      {/* Monthly Improvement Trend Banner */}
      <View
        style={[
          styles.trendBanner,
          { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.trendHeader}>
          <Text style={[styles.trendTitle, { color: theme.colors.text }]}>
            Monthly Improvement Trend
          </Text>
          <View
            style={[
              styles.trendPill,
              {
                backgroundColor:
                  trend.direction === 'up'
                    ? `${theme.colors.semantic.success}1A`
                    : trend.direction === 'down'
                    ? `${theme.colors.semantic.danger}1A`
                    : 'rgba(255, 255, 255, 0.08)',
              },
            ]}
          >
            <Text
              style={[
                styles.trendPillText,
                {
                  color:
                    trend.direction === 'up'
                      ? theme.colors.semantic.success
                      : trend.direction === 'down'
                      ? theme.colors.semantic.danger
                      : theme.colors.textMuted,
                },
              ]}
            >
              {trend.direction === 'up'
                ? 'Improving'
                : trend.direction === 'down'
                ? 'Declining'
                : trend.direction === 'flat'
                ? 'Stable'
                : 'Need 2+ Months'}
            </Text>
          </View>
        </View>

        <Text style={[styles.trendDesc, { color: theme.colors.textMuted }]}>
          {trend.slope !== null
            ? `Win rate slope is ${trend.slope >= 0 ? '+' : ''}${trend.slope} pts/month across ${data.decided} decided trades.`
            : 'Log trades across 2 or more months to compute regression slope.'}
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
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 4,
  },
  cardDetail: {
    fontSize: 11,
  },
  trendBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trendTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  trendPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  trendDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
