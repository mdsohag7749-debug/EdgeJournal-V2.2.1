import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { MonthlyEmotionTrend } from '../../utils/psychologyEngine';

interface EmotionTimelineViewProps {
  monthlyTrend: MonthlyEmotionTrend[];
  avgConfidence: number | null;
  fearFreq: number | null;
}

export function EmotionTimelineView({ monthlyTrend, avgConfidence, fearFreq }: EmotionTimelineViewProps) {
  const { theme } = useTheme();

  if (!monthlyTrend || monthlyTrend.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Emotion Timeline & Trends</Text>
      <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
        Chronological emotional progression across active trading months.
      </Text>

      {/* Monthly Arc Cards */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
        ]}
      >
        <View style={styles.monthsContainer}>
          {monthlyTrend.map((m) => {
            const pos = m.positiveAvg !== null ? m.positiveAvg : null;
            const neg = m.disruptiveAvg !== null ? m.disruptiveAvg : null;

            return (
              <View
                key={m.key}
                style={[
                  styles.monthRow,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <View style={styles.monthCol}>
                  <Text style={[styles.monthLabel, { color: theme.colors.text }]}>{m.label}</Text>
                  <Text style={[styles.monthKey, { color: theme.colors.textFaint }]}>{m.key}</Text>
                </View>

                {/* Positive Health Pill */}
                <View style={styles.metricBlock}>
                  <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Composure</Text>
                  <View style={styles.scoreRow}>
                    <View style={[styles.dot, { backgroundColor: '#4edea3' }]} />
                    <Text style={[styles.scoreVal, { color: '#4edea3' }]}>
                      {pos !== null ? `${pos.toFixed(1)}/5` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Disruptive Friction Pill */}
                <View style={styles.metricBlock}>
                  <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Tension</Text>
                  <View style={styles.scoreRow}>
                    <View style={[styles.dot, { backgroundColor: '#f87171' }]} />
                    <Text style={[styles.scoreVal, { color: '#f87171' }]}>
                      {neg !== null ? `${neg.toFixed(1)}/5` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Specific Confidence vs Fear indicators */}
                <View style={[styles.metricBlock, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Conf / Fear</Text>
                  <Text style={[styles.scoreVal, { color: theme.colors.text }]}>
                    {m.Confidence != null ? m.Confidence.toFixed(1) : '—'} / {m.Fear != null ? m.Fear.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Fear vs Confidence Ratio Summary Card */}
        <View style={[styles.ratioBox, { backgroundColor: theme.colors.bgElevated }]}>
          <View style={styles.ratioHeader}>
            <Text style={[styles.ratioTitle, { color: theme.colors.text }]}>Fear vs Confidence Equilibrium</Text>
            <Text style={[styles.ratioSub, { color: theme.colors.textMuted }]}>
              {avgConfidence !== null && fearFreq !== null
                ? avgConfidence >= 3.5 && fearFreq <= 25
                  ? 'Optimal composure balance'
                  : 'Monitor emotional spikes'
                : 'Insufficient multi-month history'}
            </Text>
          </View>

          <View style={styles.ratioBar}>
            <View
              style={[
                styles.ratioFillPos,
                {
                  flex: avgConfidence ? avgConfidence : 1,
                  backgroundColor: '#4edea3',
                },
              ]}
            />
            <View
              style={[
                styles.ratioFillNeg,
                {
                  flex: fearFreq ? Math.max(0.5, fearFreq / 20) : 1,
                  backgroundColor: '#f87171',
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  card: {
    padding: 14,
    borderWidth: 1,
  },
  monthsContainer: {
    gap: 2,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  monthCol: {
    width: 65,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthKey: {
    fontSize: 10,
  },
  metricBlock: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoreVal: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ratioBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  ratioHeader: {
    marginBottom: 6,
  },
  ratioTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  ratioSub: {
    fontSize: 11,
  },
  ratioBar: {
    height: 6,
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
  },
  ratioFillPos: {
    borderRadius: 3,
  },
  ratioFillNeg: {
    borderRadius: 3,
  },
});
