import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  ScreenContainer,
  Header,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
} from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { formatCurrency } from '../../utils/formatters';

const CHALLENGE_TYPES = [
  { label: 'Prop Firm Evaluation (2-Step)', value: '2-Step' },
  { label: 'Prop Firm 1-Step Challenge', value: '1-Step' },
  { label: 'Personal Discipline Sprint (21 Days)', value: 'Discipline' },
  { label: 'Custom Target Sprint', value: 'Custom' },
];

export function ChallengesScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { challenges, addChallenge, deleteChallenge } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [propFirm, setPropFirm] = useState('');
  const [challengeType, setChallengeType] = useState('2-Step');
  const [startingBalance, setStartingBalance] = useState('100000');
  const [profitTarget, setProfitTarget] = useState('10000');
  const [dailyDrawdown, setDailyDrawdown] = useState('5000');
  const [maximumDrawdown, setMaximumDrawdown] = useState('10000');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a challenge name.');
      return;
    }
    setSaving(true);
    await addChallenge({
      name: name.trim(),
      propFirm: propFirm.trim(),
      challengeType,
      startingBalance: Number(startingBalance) || 100000,
      profitTarget: Number(profitTarget) || 10000,
      dailyDrawdown: Number(dailyDrawdown) || 5000,
      maximumDrawdown: Number(maximumDrawdown) || 10000,
      status: 'active',
    });
    setSaving(false);
    setModalOpen(false);
    setName('');
    setPropFirm('');
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Discipline Challenges"
        subtitle="Consistency Sprints & Prop Evals"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.topAction}>
        <Button
          title="+ Add Challenge"
          onPress={() => setModalOpen(true)}
          variant="primary"
          size="sm"
        />
      </View>

      {challenges.length === 0 ? (
        <EmptyState
          title="No Active Challenges"
          description="Track your prop firm evaluations, funded account drawdown limits, and consistency challenges."
          actionTitle="Create Challenge"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        challenges.map((c) => (
          <View
            key={c.id}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.title, { color: theme.colors.text }]}>{c.name || c.title}</Text>
                {c.propFirm ? (
                  <Text style={[styles.firm, { color: theme.colors.textMuted }]}>
                    {c.propFirm} • {c.challengeType}
                  </Text>
                ) : null}
              </View>
              <Badge label="Active" variant="success" size="sm" />
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statKey, { color: theme.colors.textFaint }]}>Account Size</Text>
                <Text style={[styles.statVal, { color: theme.colors.text }]}>
                  {formatCurrency(c.startingBalance || 100000)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statKey, { color: theme.colors.textFaint }]}>Profit Target</Text>
                <Text style={[styles.statVal, { color: theme.colors.semantic.success }]}>
                  +{formatCurrency(c.profitTarget || 10000)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statKey, { color: theme.colors.textFaint }]}>Max Drawdown</Text>
                <Text style={[styles.statVal, { color: theme.colors.semantic.danger }]}>
                  -{formatCurrency(c.maximumDrawdown || 10000)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => deleteChallenge(c.id)}
              style={styles.deleteLink}
            >
              <Text style={{ color: theme.colors.semantic.danger, fontSize: 12 }}>Delete Challenge</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add Challenge Modal */}
      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="New Discipline / Prop Challenge">
        <Input
          label="Challenge Name"
          placeholder="e.g. 100K Funded Evaluation Phase 1"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Prop Firm / Platform (Optional)"
          placeholder="e.g. FTMO, Apex, Topstep"
          value={propFirm}
          onChangeText={setPropFirm}
        />
        <Select
          label="Challenge Type"
          options={CHALLENGE_TYPES}
          selectedValue={challengeType}
          onValueChange={setChallengeType}
        />
        <Input
          label="Starting Balance ($)"
          keyboardType="numeric"
          value={startingBalance}
          onChangeText={setStartingBalance}
        />
        <Input
          label="Profit Target ($)"
          keyboardType="numeric"
          value={profitTarget}
          onChangeText={setProfitTarget}
        />
        <Input
          label="Max Daily Drawdown ($)"
          keyboardType="numeric"
          value={dailyDrawdown}
          onChangeText={setDailyDrawdown}
        />
        <Input
          label="Overall Max Drawdown ($)"
          keyboardType="numeric"
          value={maximumDrawdown}
          onChangeText={setMaximumDrawdown}
        />
        <Button
          title="Save Challenge"
          onPress={handleSave}
          loading={saving}
          variant="primary"
          size="md"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topAction: {
    marginVertical: 12,
    alignItems: 'flex-end',
  },
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  firm: {
    fontSize: 12,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statKey: {
    fontSize: 11,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteLink: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
});
