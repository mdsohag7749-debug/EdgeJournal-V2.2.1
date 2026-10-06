import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { PsychologyOverviewResult } from '../../utils/psychologyEngine';

interface PsychologyOverviewHeroProps {
  overview: PsychologyOverviewResult;
}

export function PsychologyOverviewHero({ overview }: PsychologyOverviewHeroProps) {
  const { theme } = useTheme();
  const { score, statusLabel, emotionalHealth, compliancePct, mistakeFreeRate, totalTrades, ratedTradeCount } = overview;

  const validScore = score !== null ? score : null;
  const radius = 32;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = validScore !== null ? circumference * (1 - validScore / 100) : circumference;

  const getStatusBadgeColor = () => {
    switch (statusLabel) {
      case 'Excellent':
        return { bg: 'rgba(78, 222, 163, 0.15)', text: '#4edea3', border: 'rgba(78, 222, 163, 0.3)' };
      case 'Strong':
        return { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)' };
      case 'Moderate':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Needs Improvement':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' };
      case 'High Improvement Priority':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: theme.colors.textMuted, border: theme.colors.border };
    }
  };

  const badgeStyle = getStatusBadgeColor();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.xl,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Psychology & Discipline Index</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border },
          ]}
        >
          <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        Deterministic composite of emotional composure, checklist adherence, and mistake control.
      </Text>

      <View style={styles.mainRow}>
        {/* SVG Circular Ring Gauge */}
        <View style={styles.gaugeWrapper}>
          <Svg width={100} height={100} viewBox="0 0 80 80">
            <Defs>
              <LinearGradient id="heroScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#c0c1ff" />
                <Stop offset="100%" stopColor="#4edea3" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={40}
              cy={40}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
            />
            {validScore !== null && (
              <Circle
                cx={40}
                cy={40}
                r={radius}
                fill="none"
                stroke="url(#heroScoreGrad)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            )}
          </Svg>
          <View style={styles.gaugeCenter}>
            <Text style={[styles.gaugeScore, { color: theme.colors.text }]}>
              {validScore !== null ? validScore : '—'}
            </Text>
            <Text style={[styles.gaugeMax, { color: theme.colors.textFaint }]}>/ 100</Text>
          </View>
        </View>

        {/* Pillar Stat Pills */}
        <View style={styles.pillarsGrid}>
          <View
            style={[
              styles.pillarCard,
              { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.pillarLabel, { color: theme.colors.textMuted }]}>Rule Adherence</Text>
            <Text style={[styles.pillarValue, { color: '#4edea3' }]}>
              {compliancePct !== null ? `${compliancePct}%` : '—'}
            </Text>
          </View>

          <View
            style={[
              styles.pillarCard,
              { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.pillarLabel, { color: theme.colors.textMuted }]}>Emotional Health</Text>
            <Text style={[styles.pillarValue, { color: '#60a5fa' }]}>
              {emotionalHealth !== null ? `${emotionalHealth}/100` : '—'}
            </Text>
          </View>

          <View
            style={[
              styles.pillarCard,
              { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.pillarLabel, { color: theme.colors.textMuted }]}>Mistake-Free Rate</Text>
            <Text style={[styles.pillarValue, { color: '#c0c1ff' }]}>
              {mistakeFreeRate !== null ? `${mistakeFreeRate}%` : '—'}
            </Text>
          </View>

          <View
            style={[
              styles.pillarCard,
              { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.pillarLabel, { color: theme.colors.textMuted }]}>Sample Size</Text>
            <Text style={[styles.pillarValue, { color: theme.colors.text }]}>
              {ratedTradeCount > 0 ? `${ratedTradeCount} rated` : `${totalTrades} trades`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  gaugeWrapper: {
    width: 100,
    height: 100,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  gaugeMax: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
    letterSpacing: 0.5,
  },
  pillarsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillarCard: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillarLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    marginBottom: 2,
  },
  pillarValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
