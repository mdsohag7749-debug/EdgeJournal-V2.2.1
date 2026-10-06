import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { Trade, Reflection } from '../../types/models';
import {
  computeDisciplineScore20,
  DisciplineScore20Result,
  DisciplineComponentResult,
} from '../../utils/disciplineScoreEngine';

interface DisciplineScore20SectionProps {
  trades: Trade[];
  models?: string[];
  riskCriteria?: string[];
  checklistCriteria?: string[];
  reflections?: Reflection[];
  accountName?: string;
}

const PERIOD_OPTIONS = [
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: 'week', label: 'This Week' },
  { key: '30', label: 'Last 30 Days' },
];

const COMPONENT_ICONS: Record<string, string> = {
  risk: '🛡️',
  plan: '📋',
  execution: '⚡',
  mistake: '⚠️',
  review: '📝',
};

export function DisciplineScore20Section({
  trades,
  models = [],
  riskCriteria = [],
  checklistCriteria = [],
  reflections = [],
  accountName,
}: DisciplineScore20SectionProps) {
  const { theme } = useTheme();

  const [period, setPeriod] = useState<string>('all');
  const [selectedPair, setSelectedPair] = useState<string>('All');
  const [selectedSession, setSelectedSession] = useState<string>('All');
  const [selectedSetup, setSelectedSetup] = useState<string>('All');
  const [trendView, setTrendView] = useState<'weekly' | 'monthly'>('weekly');

  const result: DisciplineScore20Result = useMemo(() => {
    return computeDisciplineScore20(trades, {
      models,
      riskCriteria,
      checklistCriteria,
      reflections,
      period,
      pair: selectedPair,
      session: selectedSession,
      setup: selectedSetup,
    });
  }, [trades, models, riskCriteria, checklistCriteria, reflections, period, selectedPair, selectedSession, selectedSetup]);

  const { score, band, coveragePct, components, improvements, weekly, monthly, hasTrend, total } = result;

  const radius = 42;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const scoreValue = score !== null ? score : 0;
  const strokeDashoffset = score !== null ? circumference * (1 - scoreValue / 100) : circumference;
  const bandColor = band?.color || theme.colors.accent;

  const trendData = trendView === 'weekly' ? weekly : monthly;

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
      {/* 1. Header with Technical Eyebrow & Status Badge */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>DISCIPLINE SCORE 2.0</Text>
            {accountName ? (
              <Text style={[styles.accountBadge, { color: theme.colors.textMuted }]}>· {accountName}</Text>
            ) : null}
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Institutional Execution Quality</Text>
        </View>

        {band && (
          <View
            style={[
              styles.bandBadge,
              { backgroundColor: `${band.color}22`, borderColor: `${band.color}55` },
            ]}
          >
            <Text style={[styles.bandBadgeText, { color: band.color }]}>{band.label}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        Weighted 5-pillar composite: Risk (30%), Plan (25%), Execution (20%), Mistake Control (15%), Review (10%).
      </Text>

      {/* 2. Interactive Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
          {PERIOD_OPTIONS.map((p) => {
            const isActive = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: isActive ? theme.colors.accentDim : theme.colors.bgElevated,
                    borderColor: isActive ? theme.colors.accent : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    { color: isActive ? theme.colors.accent : theme.colors.textMuted },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Hero Gauge & Overview Breakdown */}
      <View style={styles.heroRow}>
        {/* SVG Circular Ring Gauge */}
        <View style={styles.gaugeWrapper}>
          <Svg width={120} height={120} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id="ds20Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={bandColor} />
                <Stop offset="100%" stopColor={`${bandColor}aa`} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
            />
            {score !== null && (
              <Circle
                cx={50}
                cy={50}
                r={radius}
                fill="none"
                stroke="url(#ds20Grad)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            )}
          </Svg>
          <View style={styles.gaugeCenter}>
            <Text style={[styles.gaugeScore, { color: score !== null ? theme.colors.text : theme.colors.textMuted }]}>
              {score !== null ? score : '—'}
            </Text>
            <Text style={[styles.gaugeMax, { color: theme.colors.textFaint }]}>/ 100</Text>
          </View>
        </View>

        {/* Hero Context Summary */}
        <View style={styles.heroSummary}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Active Trades</Text>
            <Text style={[styles.summaryVal, { color: theme.colors.text }]}>{total}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Data Coverage</Text>
            <Text style={[styles.summaryVal, { color: coveragePct >= 80 ? '#4edea3' : '#f59e0b' }]}>
              {coveragePct}%
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Status</Text>
            <Text style={[styles.summaryVal, { color: bandColor }]}>{band ? band.label : 'Insufficient Data'}</Text>
          </View>
        </View>
      </View>

      {band && (
        <View
          style={[
            styles.bandMessageCard,
            { backgroundColor: `${band.color}14`, borderColor: `${band.color}33` },
          ]}
        >
          <Text style={[styles.bandMessageText, { color: theme.colors.text }]}>{band.message}</Text>
        </View>
      )}

      {/* 4. Five Discipline Pillar Cards */}
      <Text style={[styles.pillarsHeading, { color: theme.colors.text }]}>Discipline Pillars</Text>
      <View style={styles.pillarsGrid}>
        {components.map((c) => (
          <ComponentPillarCard key={c.key} component={c} theme={theme} />
        ))}
      </View>

      {/* 5. Discipline Trend Series (if available) */}
      <View style={styles.trendSection}>
        <View style={styles.trendHeader}>
          <Text style={[styles.trendHeading, { color: theme.colors.text }]}>Discipline Trend</Text>
          <View style={styles.trendToggleRow}>
            <TouchableOpacity
              onPress={() => setTrendView('weekly')}
              style={[
                styles.trendToggleBtn,
                trendView === 'weekly' && { backgroundColor: theme.colors.accentDim, borderColor: theme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.trendToggleText,
                  { color: trendView === 'weekly' ? theme.colors.accent : theme.colors.textMuted },
                ]}
              >
                Weekly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTrendView('monthly')}
              style={[
                styles.trendToggleBtn,
                trendView === 'monthly' && { backgroundColor: theme.colors.accentDim, borderColor: theme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.trendToggleText,
                  { color: trendView === 'monthly' ? theme.colors.accent : theme.colors.textMuted },
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasTrend && trendData.length > 0 ? (
          <View
            style={[
              styles.trendCard,
              { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.trendPointsList}>
              {trendData.map((tp, idx) => (
                <View key={`${tp.label}-${idx}`} style={styles.trendPointRow}>
                  <Text style={[styles.trendPointLabel, { color: theme.colors.textMuted }]}>{tp.label}</Text>
                  <View style={styles.trendBarContainer}>
                    <View
                      style={[
                        styles.trendBarFill,
                        {
                          width: `${Math.max(4, Math.min(100, tp.score))}%`,
                          backgroundColor:
                            tp.score >= 80 ? '#4edea3' : tp.score >= 65 ? '#60a5fa' : '#f59e0b',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.trendPointScore, { color: theme.colors.text }]}>{tp.score}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.noTrendBox,
              { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.noTrendText, { color: theme.colors.textMuted }]}>
              Log trades across 2+ weeks or months to unlock historical discipline trend tracking.
            </Text>
          </View>
        )}
      </View>

      {/* 6. Actionable Improvement Guidance */}
      {improvements.length > 0 && (
        <View style={styles.improvementsSection}>
          <Text style={[styles.improvementsHeading, { color: theme.colors.text }]}>Discipline Action Areas</Text>
          {improvements.map((imp, idx) => (
            <View
              key={`${imp.key}-${idx}`}
              style={[
                styles.improvementCard,
                {
                  backgroundColor:
                    imp.signal === 'warning'
                      ? 'rgba(239, 68, 68, 0.08)'
                      : imp.signal === 'positive'
                      ? 'rgba(78, 222, 163, 0.08)'
                      : 'rgba(96, 165, 250, 0.08)',
                  borderColor:
                    imp.signal === 'warning'
                      ? 'rgba(239, 68, 68, 0.25)'
                      : imp.signal === 'positive'
                      ? 'rgba(78, 222, 163, 0.25)'
                      : 'rgba(96, 165, 250, 0.25)',
                },
              ]}
            >
              <Text style={styles.improvementIcon}>
                {imp.signal === 'warning' ? '⚠️' : imp.signal === 'positive' ? '🎯' : '💡'}
              </Text>
              <Text style={[styles.improvementClaim, { color: theme.colors.text }]}>{imp.claim}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ComponentPillarCard({
  component,
  theme,
}: {
  component: DisciplineComponentResult;
  theme: any;
}) {
  const icon = COMPONENT_ICONS[component.key] || '📊';
  const hasData = component.available && component.score !== null;

  return (
    <View
      style={[
        styles.pillarCard,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.base,
        },
      ]}
    >
      <View style={styles.pillarTopRow}>
        <View style={styles.pillarTitleBox}>
          <Text style={styles.pillarIcon}>{icon}</Text>
          <View>
            <Text style={[styles.pillarLabel, { color: theme.colors.text }]}>{component.label}</Text>
            <Text style={[styles.pillarWeight, { color: theme.colors.textMuted }]}>{component.weight}% Weight</Text>
          </View>
        </View>

        {hasData ? (
          <View style={styles.pillarScoreBox}>
            <Text style={[styles.pillarScore, { color: component.score! >= 75 ? '#4edea3' : '#f59e0b' }]}>
              {component.score}
            </Text>
            <Text style={[styles.pillarPoints, { color: theme.colors.textMuted }]}>
              {component.points}/{component.weight} pts
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.noDataBadge,
              { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.noDataText, { color: theme.colors.textFaint }]}>NO DATA</Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      {hasData && (
        <View style={[styles.progressTrack, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(3, Math.min(100, component.score!))}%`,
                backgroundColor: component.score! >= 75 ? '#4edea3' : '#f59e0b',
              },
            ]}
          />
        </View>
      )}

      {component.note ? (
        <Text style={[styles.pillarNote, { color: theme.colors.textMuted }]}>{component.note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    borderWidth: 1,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  accountBadge: {
    fontSize: 11.5,
    fontWeight: '600',
    marginLeft: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  bandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  bandBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    marginBottom: 14,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  gaugeWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  gaugeMax: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heroSummary: {
    flex: 1,
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryLabel: {
    fontSize: 12.5,
  },
  summaryVal: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bandMessageCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  bandMessageText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  pillarsHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 10,
  },
  pillarsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  pillarCard: {
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  pillarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillarTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillarIcon: {
    fontSize: 18,
  },
  pillarLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillarWeight: {
    fontSize: 11.5,
    marginTop: 1,
  },
  pillarScoreBox: {
    alignItems: 'flex-end',
  },
  pillarScore: {
    fontSize: 16,
    fontWeight: '800',
  },
  pillarPoints: {
    fontSize: 11,
  },
  noDataBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  noDataText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  pillarNote: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  trendSection: {
    marginBottom: 16,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendHeading: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  trendToggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  trendToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trendToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  trendCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  trendPointsList: {
    gap: 8,
  },
  trendPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendPointLabel: {
    width: 90,
    fontSize: 12,
  },
  trendBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trendBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  trendPointScore: {
    width: 28,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  noTrendBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  noTrendText: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  improvementsSection: {
    gap: 8,
  },
  improvementsHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  improvementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  improvementIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  improvementClaim: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
