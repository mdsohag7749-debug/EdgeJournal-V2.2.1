import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { PsychologyOverviewResult } from '../../utils/psychologyEngine';

interface BehavioralPatternsGridProps {
  overview: PsychologyOverviewResult;
}

export function BehavioralPatternsGrid({ overview }: BehavioralPatternsGridProps) {
  const { theme } = useTheme();
  const { dominantPositive, recurringNegative, topSessionLeak } = overview;

  const hasPatterns = dominantPositive || recurringNegative || topSessionLeak;

  if (!hasPatterns) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text }]}>Common Behavioral Patterns</Text>
      <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
        Deterministic pattern recognition across trade execution and emotional recordings.
      </Text>

      <View style={styles.grid}>
        {/* Dominant Positive Pattern */}
        {dominantPositive && (
          <View
            style={[
              styles.card,
              styles.pillarSuccess,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.icon}>🎯</Text>
              <View style={[styles.tag, { backgroundColor: 'rgba(78, 222, 163, 0.15)' }]}>
                <Text style={[styles.tagText, { color: '#4edea3' }]}>{dominantPositive.freq}</Text>
              </View>
            </View>
            <Text style={[styles.patternTitle, { color: theme.colors.text }]}>{dominantPositive.title}</Text>
            <Text style={[styles.patternDesc, { color: theme.colors.textMuted }]}>{dominantPositive.desc}</Text>
          </View>
        )}

        {/* Top Session / Peak Window */}
        {topSessionLeak ? (
          <View
            style={[
              styles.card,
              styles.pillarWarning,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.icon}>⏱️</Text>
              <View style={[styles.tag, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={[styles.tagText, { color: '#f59e0b' }]}>{topSessionLeak.mistakeCount} occurrences</Text>
              </View>
            </View>
            <Text style={[styles.patternTitle, { color: theme.colors.text }]}>
              {topSessionLeak.session} Session Focus
            </Text>
            <Text style={[styles.patternDesc, { color: theme.colors.textMuted }]}>
              Highest concentration of recorded execution friction occurs during the {topSessionLeak.session} session.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.card,
              styles.pillarSuccess,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.icon}>⚡</Text>
              <View style={[styles.tag, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
                <Text style={[styles.tagText, { color: '#60a5fa' }]}>Consistent</Text>
              </View>
            </View>
            <Text style={[styles.patternTitle, { color: theme.colors.text }]}>Balanced Session Flow</Text>
            <Text style={[styles.patternDesc, { color: theme.colors.textMuted }]}>
              Zero session-isolated execution leaks recorded across active trading periods.
            </Text>
          </View>
        )}

        {/* Recurring Negative Pattern (Full width) */}
        {recurringNegative && (
          <View
            style={[
              styles.card,
              styles.cardFull,
              styles.pillarDanger,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.row}>
                <Text style={styles.icon}>⚠️</Text>
                <Text style={[styles.patternTitle, { color: theme.colors.text, marginLeft: 6 }]}>
                  {recurringNegative.title}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={[styles.tagText, { color: '#ef4444' }]}>{recurringNegative.impact}</Text>
              </View>
            </View>
            <Text style={[styles.patternDesc, { color: theme.colors.textMuted, marginTop: 4 }]}>
              {recurringNegative.desc} ({recurringNegative.freq})
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardFull: {
    flexBasis: '100%',
  },
  pillarSuccess: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#4edea3',
  },
  pillarWarning: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#f59e0b',
  },
  pillarDanger: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#ef4444',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 15,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  patternTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  patternDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
});
