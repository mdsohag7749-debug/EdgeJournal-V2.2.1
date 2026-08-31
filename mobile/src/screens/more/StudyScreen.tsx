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

const SESSION_TYPE_OPTIONS = [
  { label: 'Playbook Strategy', value: 'Playbook' },
  { label: 'Mistake Analysis', value: 'Mistake' },
  { label: 'Market Concept', value: 'Concept' },
  { label: 'Daily Review', value: 'Daily' },
];

export function StudyScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { study, addStudyNote, deleteStudyNote } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [sessionType, setSessionType] = useState<'Playbook' | 'Mistake' | 'Concept' | 'Daily'>('Playbook');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the study note.');
      return;
    }
    setSaving(true);
    await addStudyNote({
      title: title.trim(),
      sessionType,
      description: description.trim(),
      date: new Date().toISOString().split('T')[0],
    });
    setSaving(false);
    setModalOpen(false);
    setTitle('');
    setDescription('');
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Study & Playbook"
        subtitle="Chart Patterns & Mistake Library"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.topAction}>
        <Button
          title="+ Add Note"
          onPress={() => setModalOpen(true)}
          variant="primary"
          size="sm"
        />
      </View>

      {study.length === 0 ? (
        <EmptyState
          title="No Study Notes"
          description="Document your playbook setups, chart patterns, and mistake post-mortems."
          actionTitle="Add Study Note"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        study.map((item) => (
          <View
            key={item.id}
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
              <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
              <Badge
                label={item.sessionType || 'Playbook'}
                variant={
                  item.sessionType === 'Playbook'
                    ? 'accent'
                    : item.sessionType === 'Mistake'
                    ? 'danger'
                    : 'neutral'
                }
                size="sm"
              />
            </View>
            <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
              {item.description || item.notes}
            </Text>
            <TouchableOpacity
              onPress={() => deleteStudyNote(item.id)}
              style={styles.deleteLink}
            >
              <Text style={{ color: theme.colors.semantic.danger, fontSize: 12 }}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add Study Note Modal */}
      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="New Study Note">
        <Select
          label="Category / Type"
          options={SESSION_TYPE_OPTIONS}
          selectedValue={sessionType}
          onValueChange={(v: any) => setSessionType(v)}
        />
        <Input
          label="Title / Setup Name"
          placeholder="e.g. 15M Opening Range Breakout"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Detailed Description & Rules"
          placeholder="Criteria, indicators, entry triggers, invalidation levels..."
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          inputStyle={{ minHeight: 80 }}
        />
        <Button
          title="Save Note"
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
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteLink: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
});
