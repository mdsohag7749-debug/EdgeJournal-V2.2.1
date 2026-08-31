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
import { formatDate } from '../../utils/formatters';

const PERIOD_OPTIONS = [
  { label: 'Daily Reflection', value: 'Daily' },
  { label: 'Weekly Reflection', value: 'Weekly' },
  { label: 'Monthly Reflection', value: 'Monthly' },
];

const RATING_OPTIONS = [
  { label: '★★★★★ (Grade A - Perfect Discipline)', value: '5' },
  { label: '★★★★☆ (Grade B - Good Execution)', value: '4' },
  { label: '★★★☆☆ (Grade C - Minor Mistakes)', value: '3' },
  { label: '★★☆☆☆ (Grade D - Broke Rules)', value: '2' },
  { label: '★☆☆☆☆ (Grade F - Emotional Chaos)', value: '1' },
];

export function ReflectionsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { reflections, addReflection, deleteReflection } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rating, setRating] = useState('5');
  const [title, setTitle] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [improvements, setImprovements] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() && !wentWell.trim()) {
      Alert.alert('Required', 'Please write a brief summary of what went well.');
      return;
    }
    setSaving(true);
    await addReflection({
      period,
      date,
      rating: Number(rating),
      title: title || `${period} Reflection`,
      wentWell,
      lessonsLearned,
      improvements,
    });
    setSaving(false);
    setModalOpen(false);
    setTitle('');
    setWentWell('');
    setLessonsLearned('');
    setImprovements('');
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Daily Reflections"
        subtitle="End-of-Day Performance Reviews"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.topAction}>
        <Button
          title="+ Add Reflection"
          onPress={() => setModalOpen(true)}
          variant="primary"
          size="sm"
        />
      </View>

      {reflections.length === 0 ? (
        <EmptyState
          title="No Reflections Recorded"
          description="Log daily reviews of your trading execution, discipline rating, and key lessons learned."
          actionTitle="Add Reflection"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        reflections.map((r) => (
          <View
            key={r.id}
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
              <Text style={[styles.date, { color: theme.colors.text }]}>
                {formatDate(r.date)} • {r.period || 'Daily'}
              </Text>
              <Badge
                label={`Grade: ${r.dailyGrade || (r.rating && r.rating >= 4 ? 'A' : 'B')}`}
                variant={(r.rating || 5) >= 4 ? 'success' : (r.rating || 5) === 3 ? 'warning' : 'danger'}
                size="sm"
              />
            </View>

            {r.title ? (
              <Text style={[styles.title, { color: theme.colors.text }]}>{r.title}</Text>
            ) : null}

            {r.wentWell ? (
              <>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>What went well?</Text>
                <Text style={[styles.val, { color: theme.colors.text }]}>{r.wentWell}</Text>
              </>
            ) : null}

            {r.lessonsLearned ? (
              <>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Key Lessons</Text>
                <Text style={[styles.val, { color: theme.colors.text }]}>{r.lessonsLearned}</Text>
              </>
            ) : null}

            {r.improvements ? (
              <>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Improvements for Tomorrow</Text>
                <Text style={[styles.val, { color: theme.colors.text }]}>{r.improvements}</Text>
              </>
            ) : null}

            <TouchableOpacity
              onPress={() => deleteReflection(r.id)}
              style={styles.deleteLink}
            >
              <Text style={{ color: theme.colors.semantic.danger, fontSize: 12 }}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add Reflection Modal */}
      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="New Trade Reflection">
        <Select
          label="Reflection Period"
          options={PERIOD_OPTIONS}
          selectedValue={period}
          onValueChange={(v: any) => setPeriod(v)}
        />
        <Select
          label="Execution Discipline Grade"
          options={RATING_OPTIONS}
          selectedValue={rating}
          onValueChange={setRating}
        />
        <Input label="Date" value={date} onChangeText={setDate} />
        <Input
          label="Reflection Title"
          placeholder="e.g. Great patience during morning chop"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="What went well today?"
          placeholder="Followed risk plan, respected stop losses..."
          multiline
          numberOfLines={2}
          value={wentWell}
          onChangeText={setWentWell}
        />
        <Input
          label="Key Lessons Learned"
          placeholder="Wait for 15M candle close before breakout entry..."
          multiline
          numberOfLines={2}
          value={lessonsLearned}
          onChangeText={setLessonsLearned}
        />
        <Input
          label="What to improve next session?"
          placeholder="Avoid taking positions after 14:00 on Fridays..."
          multiline
          numberOfLines={2}
          value={improvements}
          onChangeText={setImprovements}
        />
        <Button
          title="Save Reflection"
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
    alignItems: 'center',
    marginBottom: 6,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  val: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteLink: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
});
