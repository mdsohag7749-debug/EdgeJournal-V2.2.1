import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer, Header, Chip, Button } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { useAccounts } from '../../hooks/useAccounts';
import {
  computeEmotionAnalytics,
  computeMistakePattern,
  computeRuleCompliance,
  computePsychologyOverview,
  MistakeRankMode,
} from '../../utils/psychologyEngine';
import {
  PsychologyOverviewHero,
  BehavioralPatternsGrid,
  EmotionDistributionView,
  EmotionTimelineView,
  MistakeIntelligenceSection,
  RuleComplianceSection,
  DisciplineScore20Section,
} from '../../components/psychology';

const MINDSET_OPTIONS = ['Calm & Focused', 'Anxious', 'Overconfident', 'Fatigued', 'Disciplined', 'Frustrated'];

export function PsychologyScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { trades, models, riskCriteria, checklistCriteria, reflections } = useData();
  const { selectedAccount, allAccounts } = useAccounts();

  const [selectedRank, setSelectedRank] = useState<MistakeRankMode>('affectedTrades');
  const [selectedMindset, setSelectedMindset] = useState('Calm & Focused');
  const [checkedIn, setCheckedIn] = useState(false);

  // Compute all deterministic analytics from account-scoped trades array
  const emotionAnalytics = useMemo(() => computeEmotionAnalytics(trades), [trades]);
  const mistakePattern = useMemo(
    () => computeMistakePattern(trades, { rank: selectedRank }),
    [trades, selectedRank]
  );
  const ruleCompliance = useMemo(() => computeRuleCompliance(trades), [trades]);
  const psychologyOverview = useMemo(() => computePsychologyOverview(trades), [trades]);

  const handleCheckIn = () => {
    setCheckedIn(true);
    Alert.alert(
      'Mindset Recorded',
      `You checked in as "${selectedMindset}". Remember your max daily loss limit and wait for A+ setups.`
    );
  };

  const isLowData = trades.length > 0 && trades.length < 5;

  return (
    <ScreenContainer scrollable>
      <Header
        title="Behavioral & Psychology"
        subtitle={
          selectedAccount
            ? `Tracking ${selectedAccount.name} · ${trades.length} trades`
            : allAccounts
            ? `All Accounts Combined · ${trades.length} trades`
            : `Execution discipline & mistake intelligence · ${trades.length} trades`
        }
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      {/* Low-data note banner if 1-4 trades */}
      {isLowData && (
        <View
          style={[
            styles.lowDataBanner,
            { backgroundColor: 'rgba(96, 165, 250, 0.1)', borderColor: 'rgba(96, 165, 250, 0.25)' },
          ]}
        >
          <Text style={styles.lowDataIcon}>ℹ️</Text>
          <Text style={[styles.lowDataText, { color: theme.colors.textMuted }]}>
            Low sample size ({trades.length} trade{trades.length === 1 ? '' : 's'}). Log 5+ reviewed trades for high-confidence pattern detection.
          </Text>
        </View>
      )}

      {/* 1. Discipline Score 2.0 (5 Pillars & Dynamic Weighting) */}
      <DisciplineScore20Section
        trades={trades}
        models={models}
        riskCriteria={riskCriteria}
        checklistCriteria={checklistCriteria}
        reflections={reflections}
        accountName={selectedAccount?.name}
      />

      {/* 2. Psychology Overview Hero */}
      <PsychologyOverviewHero overview={psychologyOverview} />

      {/* 2. Common Behavioral Patterns Bento Grid */}
      <BehavioralPatternsGrid overview={psychologyOverview} />

      {/* 3. Emotion Distribution & Averages */}
      <EmotionDistributionView analytics={emotionAnalytics} />

      {/* 4. Emotion Timeline & Fear vs Confidence */}
      <EmotionTimelineView
        monthlyTrend={emotionAnalytics.monthlyTrend}
        avgConfidence={emotionAnalytics.avgConfidence}
        fearFreq={emotionAnalytics.fearFreq}
      />

      {/* 5. Mistake Pattern Intelligence & P&L Impact */}
      <MistakeIntelligenceSection
        mistakePattern={mistakePattern}
        selectedRank={selectedRank}
        onRankChange={setSelectedRank}
      />

      {/* 6. Rule Compliance & Checklists */}
      <RuleComplianceSection rules={ruleCompliance} />

      {/* 7. Pre-Session Mindset Check-In & Guardrails */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pre-Session Mindset Check-In</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Record your psychological state before taking market positions:
        </Text>
        <View style={styles.chipRow}>
          {MINDSET_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={selectedMindset === m}
              onPress={() => {
                setSelectedMindset(m);
                setCheckedIn(false);
              }}
            />
          ))}
        </View>
        <Button
          title={checkedIn ? "✓ Mindset Checked In" : "Record Session Check-In"}
          onPress={handleCheckIn}
          variant={checkedIn ? "secondary" : "primary"}
          size="md"
          style={{ marginTop: 8 }}
        />
      </View>

      {/* 8. Psychology Guardrails */}
      <View style={[styles.section, { marginBottom: 30 }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Execution Guardrails</Text>
        <View
          style={[
            styles.guardCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}
        >
          <Text style={[styles.guardTitle, { color: theme.colors.text }]}>🛡️ Mandatory Cool-Down Guard</Text>
          <Text style={[styles.guardDesc, { color: theme.colors.textMuted }]}>
            Maintain a 15-minute mandatory cool-down period following any stop-loss hit to prevent emotional impulse entries.
          </Text>
        </View>

        <View
          style={[
            styles.guardCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg, marginTop: 10 },
          ]}
        >
          <Text style={[styles.guardTitle, { color: theme.colors.text }]}>🧠 Trade Review Discipline</Text>
          <Text style={[styles.guardDesc, { color: theme.colors.textMuted }]}>
            Review closed trades with honest mistake tagging and 1–5 emotion scores to sustain institutional self-awareness.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lowDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  lowDataIcon: {
    fontSize: 14,
  },
  lowDataText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12.5,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  guardCard: {
    padding: 14,
    borderWidth: 1,
  },
  guardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  guardDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
});
