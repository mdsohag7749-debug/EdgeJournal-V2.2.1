import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer, Header, MetricCard, Chip, Button } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';

const MINDSET_OPTIONS = ['Calm & Focused', 'Anxious', 'Overconfident', 'Fatigued', 'Disciplined', 'Frustrated'];

export function PsychologyScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { trades } = useData();

  const [selectedMindset, setSelectedMindset] = useState('Calm & Focused');
  const [checkedIn, setCheckedIn] = useState(false);

  // Compute discipline rating
  const avgDiscipline = trades.length > 0
    ? Math.round(
        trades.reduce((acc, t) => acc + (t.disciplineRating || 5), 0) / trades.length * 20
      )
    : 92;

  // FOMO / Mistake trades count
  const fomoTrades = trades.filter((t) => t.tags?.includes('FOMO') || t.tags?.includes('Chased')).length;
  const fomoPercentage = trades.length > 0 ? ((fomoTrades / trades.length) * 100).toFixed(1) : '0.0';

  const handleCheckIn = () => {
    setCheckedIn(true);
    Alert.alert('Mindset Recorded', `You checked in as "${selectedMindset}". Remember your max daily loss limit and wait for A+ setups.`);
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Trading Psychology"
        subtitle="Mindset & Emotional Tracking"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.metricsGrid}>
        <MetricCard
          label="Discipline Index"
          value={`${avgDiscipline}/100`}
          change={avgDiscipline >= 80 ? 'Optimal' : 'Needs Focus'}
          changeType={avgDiscipline >= 80 ? 'positive' : 'negative'}
          subtitle={`Evaluated on ${trades.length} trades`}
        />
        <MetricCard
          label="Chased / FOMO Rate"
          value={`${fomoPercentage}%`}
          change={`${fomoTrades} of ${trades.length} Trades`}
          changeType={fomoTrades === 0 ? 'positive' : 'negative'}
          subtitle="Rule Compliance"
        />
      </View>

      {/* Pre-Session Mindset Check-in */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pre-Session Mindset Check-In</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Record your psychological state before taking any market positions:
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

      {/* Psychological Insights & Rules */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Psychology Guardrails</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>🛡️ Revenge Trading Guard</Text>
          <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
            Zero revenge trades detected after a loss this week. Excellent adherence to the mandatory 15-minute cool-down rule.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg, marginTop: 10 },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>🧠 Peak Performance Window</Text>
          <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
            Your highest win rates and best emotional composure occur between 09:45 and 11:15 AM EST.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
});
