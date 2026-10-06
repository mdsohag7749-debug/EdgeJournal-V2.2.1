import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { MistakePatternResult, MistakeRow, MistakeRankMode } from '../../utils/psychologyEngine';

interface MistakeIntelligenceSectionProps {
  mistakePattern: MistakePatternResult;
  selectedRank: MistakeRankMode;
  onRankChange: (rank: MistakeRankMode) => void;
}

export function MistakeIntelligenceSection({
  mistakePattern,
  selectedRank,
  onRankChange,
}: MistakeIntelligenceSectionProps) {
  const { theme } = useTheme();
  const [expandedMistake, setExpandedMistake] = useState<string | null>(null);

  const { hasMistakes, rows, affectedTradeCount, totalOccurrences, mistakeRate, mostExpensive, insights, totalTrades } =
    mistakePattern;

  const toggleExpand = (name: string) => {
    setExpandedMistake((prev) => (prev === name ? null : name));
  };

  const getStatusColor = (status: MistakeRow['status']) => {
    switch (status) {
      case 'Frequent':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'Recurring':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Occasional':
        return { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: theme.colors.textMuted, border: theme.colors.border };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trading Mistake Impact & Intelligence</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
            Ported from Web MistakePatternIntelligence — execution leaks evaluated on real review tags.
          </Text>
        </View>
      </View>

      {/* Summary KPI Row */}
      <View style={styles.kpiRow}>
        <View
          style={[
            styles.kpiCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Affected Trades</Text>
          <Text style={[styles.kpiValue, { color: theme.colors.text }]}>
            {affectedTradeCount} <Text style={[styles.kpiTotal, { color: theme.colors.textFaint }]}>/ {totalTrades}</Text>
          </Text>
          <Text style={[styles.kpiSub, { color: affectedTradeCount === 0 ? '#4edea3' : '#f59e0b' }]}>
            {mistakeRate}% of journal
          </Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Total Occurrences</Text>
          <Text style={[styles.kpiValue, { color: '#c0c1ff' }]}>{totalOccurrences}</Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>Logged tags</Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Primary Leak</Text>
          <Text
            style={[
              styles.kpiValue,
              { color: mostExpensive && mostExpensive.netPnl < 0 ? '#f87171' : '#4edea3' },
            ]}
            numberOfLines={1}
          >
            {mostExpensive ? (mostExpensive.netPnl < 0 ? `-$${Math.abs(mostExpensive.netPnl).toFixed(0)}` : '+$0') : 'None'}
          </Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {mostExpensive ? mostExpensive.name : 'Zero Leaks'}
          </Text>
        </View>
      </View>

      {/* Rank Selector */}
      {hasMistakes && (
        <View style={styles.rankSelectorRow}>
          <Text style={[styles.rankLabel, { color: theme.colors.textMuted }]}>Sort by:</Text>
          {(
            [
              { key: 'affectedTrades', label: 'Frequency' },
              { key: 'occurrences', label: 'Occurrences' },
              { key: 'netPnl', label: 'Net P&L' },
              { key: 'losses', label: 'Losses' },
            ] as const
          ).map((mode) => {
            const isSelected = selectedRank === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[
                  styles.rankBtn,
                  {
                    backgroundColor: isSelected ? theme.colors.accent : theme.colors.bgElevated,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  },
                ]}
                onPress={() => onRankChange(mode.key)}
              >
                <Text
                  style={[
                    styles.rankBtnText,
                    { color: isSelected ? '#FFFFFF' : theme.colors.textMuted, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Mistake Cards List */}
      {!hasMistakes ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}
        >
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Zero Trading Mistakes Logged</Text>
          <Text style={[styles.emptyDesc, { color: theme.colors.textMuted }]}>
            No execution mistakes recorded across your reviewed trades. Tag mistakes during trade reviews to track habits.
          </Text>
        </View>
      ) : (
        <View style={styles.mistakesList}>
          {rows.map((m) => {
            const isExpanded = expandedMistake === m.name;
            const statusStyle = getStatusColor(m.status);
            const isLossImpact = m.netPnl < 0;

            return (
              <View
                key={m.name}
                style={[
                  styles.mistakeCard,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
                ]}
              >
                <TouchableOpacity onPress={() => toggleExpand(m.name)} activeOpacity={0.7}>
                  <View style={styles.cardTop}>
                    <View style={styles.nameBlock}>
                      <Text style={[styles.mistakeName, { color: theme.colors.text }]}>{m.name}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>{m.status}</Text>
                      </View>
                    </View>

                    <View style={styles.impactBlock}>
                      <Text
                        style={[
                          styles.impactPnl,
                          { color: isLossImpact ? '#f87171' : m.netPnl > 0 ? '#4edea3' : theme.colors.textMuted },
                        ]}
                      >
                        {m.netPnl > 0 ? `+$${m.netPnl.toFixed(2)}` : m.netPnl < 0 ? `-$${Math.abs(m.netPnl).toFixed(2)}` : '$0.00'}
                      </Text>
                      <Text style={[styles.impactLabel, { color: theme.colors.textFaint }]}>Net P&L Impact</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statMini}>
                      <Text style={[styles.statMiniLabel, { color: theme.colors.textMuted }]}>Affected Trades</Text>
                      <Text style={[styles.statMiniVal, { color: theme.colors.text }]}>{m.affectedTrades}</Text>
                    </View>

                    <View style={styles.statMini}>
                      <Text style={[styles.statMiniLabel, { color: theme.colors.textMuted }]}>Occurrences</Text>
                      <Text style={[styles.statMiniVal, { color: theme.colors.text }]}>{m.occurrences}</Text>
                    </View>

                    <View style={styles.statMini}>
                      <Text style={[styles.statMiniLabel, { color: theme.colors.textMuted }]}>Win / Loss Rate</Text>
                      <Text style={[styles.statMiniVal, { color: theme.colors.text }]}>
                        {m.winRate}% / {m.lossRate}%
                      </Text>
                    </View>

                    <View style={[styles.statMini, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.statMiniLabel, { color: theme.colors.textMuted }]}>Details</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>
                        {isExpanded ? '▲ Less' : '▼ More'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Context Breakdown */}
                {isExpanded && (
                  <View style={[styles.expandedBox, { backgroundColor: theme.colors.bgElevated }]}>
                    <Text style={[styles.contextTitle, { color: theme.colors.text }]}>Context Breakdown</Text>

                    {/* Setups */}
                    {m.setups.length > 0 && (
                      <View style={styles.contextRow}>
                        <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>Setups:</Text>
                        <View style={styles.tagWrap}>
                          {m.setups.map((s) => (
                            <View key={s.label} style={[styles.contextPill, { backgroundColor: theme.colors.card }]}>
                              <Text style={[styles.contextPillText, { color: theme.colors.text }]}>
                                {s.label} ({s.count})
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Sessions */}
                    {m.sessions.length > 0 && (
                      <View style={styles.contextRow}>
                        <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>Sessions:</Text>
                        <View style={styles.tagWrap}>
                          {m.sessions.map((s) => (
                            <View key={s.label} style={[styles.contextPill, { backgroundColor: theme.colors.card }]}>
                              <Text style={[styles.contextPillText, { color: theme.colors.text }]}>
                                {s.label} ({s.count})
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Pairs */}
                    {m.pairs.length > 0 && (
                      <View style={styles.contextRow}>
                        <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>Pairs:</Text>
                        <View style={styles.tagWrap}>
                          {m.pairs.map((p) => (
                            <View key={p.label} style={[styles.contextPill, { backgroundColor: theme.colors.card }]}>
                              <Text style={[styles.contextPillText, { color: theme.colors.text }]}>
                                {p.label} ({p.count})
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Algorithmic Descriptive Insights */}
      {insights.length > 0 && (
        <View style={styles.insightsWrap}>
          {insights.map((ins, i) => (
            <View
              key={i}
              style={[
                styles.insightPill,
                {
                  backgroundColor:
                    ins.signal === 'warning'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : ins.signal === 'positive'
                      ? 'rgba(78, 222, 163, 0.1)'
                      : theme.colors.bgElevated,
                  borderColor:
                    ins.signal === 'warning'
                      ? 'rgba(239, 68, 68, 0.25)'
                      : ins.signal === 'positive'
                      ? 'rgba(78, 222, 163, 0.25)'
                      : theme.colors.border,
                },
              ]}
            >
              <Text style={styles.insightIcon}>{ins.signal === 'warning' ? '⚠️' : ins.signal === 'positive' ? '🛡️' : '💡'}</Text>
              <Text
                style={[
                  styles.insightText,
                  {
                    color:
                      ins.signal === 'warning'
                        ? '#f87171'
                        : ins.signal === 'positive'
                        ? '#4edea3'
                        : theme.colors.textMuted,
                  },
                ]}
              >
                {ins.claim}
              </Text>
            </View>
          ))}
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiTotal: {
    fontSize: 10,
    fontWeight: '500',
  },
  kpiSub: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  rankSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  rankLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  rankBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  rankBtnText: {
    fontSize: 10.5,
  },
  mistakesList: {
    gap: 10,
  },
  mistakeCard: {
    padding: 12,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  mistakeName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  impactBlock: {
    alignItems: 'flex-end',
  },
  impactPnl: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  impactLabel: {
    fontSize: 9.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  statMini: {
    alignItems: 'flex-start',
  },
  statMiniLabel: {
    fontSize: 9.5,
  },
  statMiniVal: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  expandedBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  contextTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  contextLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    width: 55,
    marginTop: 2,
  },
  tagWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  contextPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contextPillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  insightsWrap: {
    marginTop: 10,
    gap: 6,
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  insightIcon: {
    fontSize: 12,
    marginTop: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyIcon: {
    fontSize: 24,
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
