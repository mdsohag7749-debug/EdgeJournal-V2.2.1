import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { EmotionAnalyticsResult, POSITIVE_EMOTIONS } from '../../utils/psychologyEngine';

interface EmotionDistributionViewProps {
  analytics: EmotionAnalyticsResult;
}

export function EmotionDistributionView({ analytics }: EmotionDistributionViewProps) {
  const { theme } = useTheme();
  const [filterMode, setFilterMode] = useState<'all' | 'pos' | 'neg'>('all');

  const { perEmotion, total, mostCommonEmotion, stateDistribution } = analytics;

  const filtered = perEmotion.filter((e) => {
    if (filterMode === 'pos') return e.tone === 'pos';
    if (filterMode === 'neg') return e.tone === 'neg';
    return true;
  });

  const getToneColor = (tone: 'pos' | 'neg') => (tone === 'pos' ? '#4edea3' : '#f87171');

  if (total === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
        ]}
      >
        <Text style={[styles.emptyIcon]}>🧠</Text>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Emotion Ratings Recorded</Text>
        <Text style={[styles.emptyDesc, { color: theme.colors.textMuted }]}>
          Log 1–5 emotion scores in the Trading Psychology section of your trades to visualize mental distribution.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Emotion Distribution & Averages</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
            Evaluation across {total} rated trade{total === 1 ? '' : 's'} (1 to 5 scale).
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {(['all', 'pos', 'neg'] as const).map((tab) => {
          const isSelected = filterMode === tab;
          const label = tab === 'all' ? 'All (8)' : tab === 'pos' ? 'Positive (3)' : 'Disruptive (5)';
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: isSelected ? theme.colors.accent : theme.colors.bgElevated,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                },
              ]}
              onPress={() => setFilterMode(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isSelected ? '#FFFFFF' : theme.colors.textMuted, fontWeight: isSelected ? '700' : '500' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Emotion Bars List */}
      <View
        style={[
          styles.barsCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
        ]}
      >
        {filtered.map((item) => {
          const score = item.avg !== null ? item.avg : 0;
          const percent = Math.min(100, Math.max(0, (score / 5) * 100));
          const color = getToneColor(item.tone);
          const isMostCommon = mostCommonEmotion?.key === item.key;

          return (
            <View key={item.key} style={styles.barItem}>
              <View style={styles.barHeader}>
                <View style={styles.row}>
                  <Text style={[styles.barLabel, { color: theme.colors.text }]}>{item.label}</Text>
                  {isMostCommon && (
                    <View style={[styles.topTag, { backgroundColor: 'rgba(192, 193, 255, 0.15)' }]}>
                      <Text style={[styles.topTagText, { color: '#c0c1ff' }]}>Dominant</Text>
                    </View>
                  )}
                </View>

                <View style={styles.row}>
                  {item.frequency !== null && item.tone === 'neg' && item.frequency > 0 && (
                    <Text style={[styles.freqText, { color: '#f59e0b', marginRight: 8 }]}>
                      {item.frequency.toFixed(0)}% freq
                    </Text>
                  )}
                  <Text style={[styles.barScore, { color: item.avg !== null ? theme.colors.text : theme.colors.textFaint }]}>
                    {item.avg !== null ? `${item.avg.toFixed(1)}/5` : '—'}
                  </Text>
                </View>
              </View>

              {/* Progress Track */}
              <View style={[styles.track, { backgroundColor: theme.colors.bgElevated }]}>
                <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Before / During / After States (if present) */}
      {stateDistribution && (stateDistribution.before.length > 0 || stateDistribution.after.length > 0) && (
        <View
          style={[
            styles.statesCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}
        >
          <Text style={[styles.statesTitle, { color: theme.colors.text }]}>Pre/Post Market Recorded Mindsets</Text>
          <View style={styles.statePillsRow}>
            {stateDistribution.before.slice(0, 4).map((s) => (
              <View key={`b-${s.name}`} style={[styles.statePill, { backgroundColor: theme.colors.bgElevated }]}>
                <Text style={[styles.statePillLabel, { color: theme.colors.textMuted }]}>Pre: {s.name}</Text>
                <Text style={[styles.statePillCount, { color: theme.colors.accent }]}>({s.count})</Text>
              </View>
            ))}
            {stateDistribution.after.slice(0, 4).map((s) => (
              <View key={`a-${s.name}`} style={[styles.statePill, { backgroundColor: theme.colors.bgElevated }]}>
                <Text style={[styles.statePillLabel, { color: theme.colors.textMuted }]}>Post: {s.name}</Text>
                <Text style={[styles.statePillCount, { color: '#4edea3' }]}>({s.count})</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
  },
  barsCard: {
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  barItem: {
    gap: 4,
  },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  topTag: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  topTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  freqText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  barScore: {
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  statesCard: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
  },
  statesTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  statePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statePillLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statePillCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
