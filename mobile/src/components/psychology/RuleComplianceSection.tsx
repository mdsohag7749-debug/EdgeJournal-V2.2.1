import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { RuleComplianceResult } from '../../utils/psychologyEngine';

interface RuleComplianceSectionProps {
  rules: RuleComplianceResult;
}

export function RuleComplianceSection({ rules }: RuleComplianceSectionProps) {
  const { theme } = useTheme();
  const { compliancePct, breakPct, perfectCount, perfectPct, byRule, mostBrokenRule, engagedTrades, total } = rules;

  if (total === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Rule Compliance & Checklists</Text>
      <Text style={[styles.sectionSubtitle, { color: theme.colors.textMuted }]}>
        Deterministic adherence measured across Risk Management and Pre-Trade Checklists.
      </Text>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        <View
          style={[
            styles.kpiCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Rule Compliance</Text>
          <Text style={[styles.kpiValue, { color: compliancePct >= 80 ? '#4edea3' : '#f59e0b' }]}>
            {compliancePct}%
          </Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
            {engagedTrades} engaged trades
          </Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Rule Break Rate</Text>
          <Text style={[styles.kpiValue, { color: breakPct === 0 ? '#4edea3' : '#f87171' }]}>
            {breakPct}%
          </Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
            Mistake-affected
          </Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: theme.colors.textMuted }]}>Perfect Trades</Text>
          <Text style={[styles.kpiValue, { color: '#60a5fa' }]}>{perfectCount}</Text>
          <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
            {perfectPct}% flawless
          </Text>
        </View>
      </View>

      {/* Most Broken Rule Callout (if any broken rules exist) */}
      {mostBrokenRule && mostBrokenRule.broken > 0 && (
        <View
          style={[
            styles.alertBox,
            { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)' },
          ]}
        >
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={styles.alertBody}>
            <Text style={[styles.alertTitle, { color: '#f87171' }]}>Most Frequent Rule Break</Text>
            <Text style={[styles.alertDesc, { color: theme.colors.textMuted }]}>
              "{mostBrokenRule.name}" was violated {mostBrokenRule.broken} time{mostBrokenRule.broken === 1 ? '' : 's'} ({mostBrokenRule.compliancePct}% adherence).
            </Text>
          </View>
        </View>
      )}

      {/* Per-Rule Adherence List */}
      {byRule.length > 0 && (
        <View
          style={[
            styles.rulesListCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}
        >
          <Text style={[styles.listHeader, { color: theme.colors.text }]}>Individual Rule Adherence</Text>
          {byRule.map((rule) => {
            const pct = rule.compliancePct;
            const barColor = pct >= 85 ? '#4edea3' : pct >= 65 ? '#60a5fa' : '#f59e0b';

            return (
              <View key={rule.name} style={styles.ruleItem}>
                <View style={styles.ruleRowTop}>
                  <Text style={[styles.ruleName, { color: theme.colors.text }]} numberOfLines={1}>
                    {rule.name}
                  </Text>
                  <Text style={[styles.ruleScore, { color: barColor }]}>{pct}%</Text>
                </View>

                {/* Progress bar */}
                <View style={[styles.ruleTrack, { backgroundColor: theme.colors.bgElevated }]}>
                  <View style={[styles.ruleFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                </View>

                <View style={styles.ruleMetaRow}>
                  <Text style={[styles.ruleMeta, { color: theme.colors.textFaint }]}>
                    Followed: {rule.followed} · Broken: {rule.broken}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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
  kpiSub: {
    fontSize: 10,
    marginTop: 2,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  alertIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  alertDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  rulesListCard: {
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  ruleItem: {
    gap: 4,
  },
  ruleRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleName: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  ruleScore: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ruleTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  ruleFill: {
    height: '100%',
    borderRadius: 3,
  },
  ruleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  ruleMeta: {
    fontSize: 10,
  },
});
