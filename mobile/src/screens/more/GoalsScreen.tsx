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

const PERIOD_OPTIONS = [
  { label: 'Weekly Goal', value: 'Weekly' },
  { label: 'Monthly Goal', value: 'Monthly' },
  { label: 'Quarterly Goal', value: 'Quarterly' },
  { label: 'Annual Goal', value: 'Yearly' },
];

export function GoalsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { goals, addGoal, updateGoal, deleteGoal } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [description, setDescription] = useState('');
  const [successMetrics, setSuccessMetrics] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a goal title.');
      return;
    }
    setSaving(true);
    await addGoal({
      title: title.trim(),
      period,
      description: description.trim(),
      successMetrics: successMetrics.trim(),
      completed: false,
    });
    setSaving(false);
    setModalOpen(false);
    setTitle('');
    setDescription('');
    setSuccessMetrics('');
  };

  const handleToggleComplete = async (goalId: string, current: boolean) => {
    await updateGoal(goalId, { completed: !current });
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Trading Goals"
        subtitle="Process & Outcome Milestones"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.topAction}>
        <Button
          title="+ Set New Goal"
          onPress={() => setModalOpen(true)}
          variant="primary"
          size="sm"
        />
      </View>

      {goals.length === 0 ? (
        <EmptyState
          title="No Goals Defined"
          description="Establish specific trading consistency milestones, profit targets, and execution habits."
          actionTitle="Set Goal"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        goals.map((g) => {
          const isDone = !!g.completed;
          return (
            <View
              key={g.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: isDone ? theme.colors.semantic.success : theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.text,
                      textDecorationLine: isDone ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {g.title}
                </Text>
                <Badge
                  label={isDone ? 'Completed' : g.period || 'Monthly'}
                  variant={isDone ? 'success' : 'accent'}
                  size="sm"
                />
              </View>

              {g.description ? (
                <Text style={[styles.desc, { color: theme.colors.textMuted }]}>{g.description}</Text>
              ) : null}

              {g.successMetrics ? (
                <Text style={[styles.metric, { color: theme.colors.accent }]}>
                  🎯 Target: {g.successMetrics}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  onPress={() => handleToggleComplete(g.id, isDone)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: isDone ? theme.colors.semantic.successDim : theme.colors.cardHover,
                      borderColor: isDone ? theme.colors.semantic.success : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isDone ? theme.colors.semantic.success : theme.colors.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {isDone ? '✓ Completed' : '○ Mark as Completed'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => deleteGoal(g.id)}>
                  <Text style={{ color: theme.colors.semantic.danger, fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Add Goal Modal */}
      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="Set Trading Goal">
        <Input
          label="Goal Title"
          placeholder="e.g. Maintain >2.0 Profit Factor"
          value={title}
          onChangeText={setTitle}
        />
        <Select
          label="Time Horizon"
          options={PERIOD_OPTIONS}
          selectedValue={period}
          onValueChange={(v: any) => setPeriod(v)}
        />
        <Input
          label="Target Success Metric"
          placeholder="e.g. 2.0 Profit Factor, 100% screenshots"
          value={successMetrics}
          onChangeText={setSuccessMetrics}
        />
        <Input
          label="Description / Process Strategy"
          placeholder="How will you achieve this milestone?"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
        />
        <Button
          title="Save Goal"
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
    borderWidth: 1.5,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  metric: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
});
