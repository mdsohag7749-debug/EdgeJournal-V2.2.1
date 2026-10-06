import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { ScreenContainer, Header, Button, Input, Modal } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useData';
import { THEME_PRESETS, ACCENT_PRESETS } from '../../theme';
import {
  notificationsService,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../../services/notificationsService';

type EditTarget = {
  type: 'model' | 'risk' | 'checklist';
  mode: 'add' | 'edit';
  oldValue?: string;
};

export function SettingsScreen({ navigation }: { navigation: any }) {
  const { theme, themeId, accentId, setThemeId, setAccentId, resetAppearance } = useTheme();
  const { user, requestPasswordReset } = useAuth();
  const {
    models,
    riskCriteria,
    checklistCriteria,
    addModel,
    updateModel,
    deleteModel,
    addRiskCriterion,
    updateRiskCriterion,
    deleteRiskCriterion,
    addChecklistCriterion,
    updateChecklistCriterion,
    deleteChecklistCriterion,
    resetSystemSettings,
  } = useData();

  // Notification state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Security password reset state
  const [resetSending, setResetSending] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Sheet edit state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [draftError, setDraftError] = useState('');

  // Delete confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'model' | 'risk' | 'checklist'; value: string } | null>(null);

  useEffect(() => {
    notificationsService.loadSettings().then(setNotifSettings);
  }, []);

  const updateNotifSetting = (key: keyof NotificationSettings, val: any) => {
    const updated = { ...notifSettings, [key]: val };
    setNotifSettings(updated);
    notificationsService.saveSettings(updated);
  };

  const remindersSummary = notificationsService.getScheduledRemindersSummary(notifSettings);

  // Security Password Reset
  const handlePasswordReset = async () => {
    if (!user?.email) {
      setResetMessage({ type: 'error', text: 'No authenticated user email found.' });
      return;
    }
    setResetSending(true);
    setResetMessage(null);
    try {
      await requestPasswordReset(user.email);
      setResetMessage({
        type: 'success',
        text: `Password reset email sent to ${user.email}. Check your inbox!`,
      });
    } catch (err: any) {
      setResetMessage({
        type: 'error',
        text: err?.message || 'Could not send reset email. Please try again.',
      });
    } finally {
      setResetSending(false);
    }
  };

  // Open Add/Edit Modal
  const openAdd = (type: 'model' | 'risk' | 'checklist') => {
    setEditTarget({ type, mode: 'add' });
    setDraftValue('');
    setDraftError('');
    setEditModalVisible(true);
  };

  const openEdit = (type: 'model' | 'risk' | 'checklist', oldValue: string) => {
    setEditTarget({ type, mode: 'edit', oldValue });
    setDraftValue(oldValue);
    setDraftError('');
    setEditModalVisible(true);
  };

  // Submit Add/Edit Modal
  const handleSaveDraft = async () => {
    const trimmed = draftValue.trim();
    if (!trimmed) {
      setDraftError('Name cannot be empty.');
      return;
    }
    if (trimmed.length > 100) {
      setDraftError('Text cannot exceed 100 characters.');
      return;
    }

    if (!editTarget) return;

    let success = false;
    if (editTarget.type === 'model') {
      if (editTarget.mode === 'add') {
        success = await addModel(trimmed);
        if (!success) setDraftError('A trading model with this name already exists.');
      } else if (editTarget.mode === 'edit' && editTarget.oldValue) {
        success = await updateModel(editTarget.oldValue, trimmed);
        if (!success) setDraftError('A trading model with this name already exists.');
      }
    } else if (editTarget.type === 'risk') {
      if (editTarget.mode === 'add') {
        success = await addRiskCriterion(trimmed);
        if (!success) setDraftError('This risk criterion already exists.');
      } else if (editTarget.mode === 'edit' && editTarget.oldValue) {
        success = await updateRiskCriterion(editTarget.oldValue, trimmed);
        if (!success) setDraftError('This risk criterion already exists.');
      }
    } else if (editTarget.type === 'checklist') {
      if (editTarget.mode === 'add') {
        success = await addChecklistCriterion(trimmed);
        if (!success) setDraftError('This checklist criterion already exists.');
      } else if (editTarget.mode === 'edit' && editTarget.oldValue) {
        success = await updateChecklistCriterion(editTarget.oldValue, trimmed);
        if (!success) setDraftError('This checklist criterion already exists.');
      }
    }

    if (success) {
      setEditModalVisible(false);
      setEditTarget(null);
      setDraftValue('');
      setDraftError('');
    }
  };

  // Delete Item Confirmation
  const confirmDelete = (type: 'model' | 'risk' | 'checklist', value: string) => {
    setDeleteTarget({ type, value });
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'model') {
      await deleteModel(deleteTarget.value);
    } else if (deleteTarget.type === 'risk') {
      await deleteRiskCriterion(deleteTarget.value);
    } else if (deleteTarget.type === 'checklist') {
      await deleteChecklistCriterion(deleteTarget.value);
    }
    setDeleteModalVisible(false);
    setDeleteTarget(null);
  };

  // Reset all system settings
  const handleResetSystem = () => {
    Alert.alert(
      'Reset System Settings',
      'This will reset your Trading Models and Checklists back to default settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Defaults',
          style: 'destructive',
          onPress: async () => {
            await resetSystemSettings();
          },
        },
      ]
    );
  };

  const modalTitle = editTarget
    ? `${editTarget.mode === 'add' ? 'Add' : 'Edit'} ${
        editTarget.type === 'model'
          ? 'Trading Model'
          : editTarget.type === 'risk'
          ? 'Risk Criterion'
          : 'Trade Criterion'
      }`
    : '';

  return (
    <ScreenContainer scrollable>
      <Header
        title="Settings"
        subtitle="Terminal Appearance, System & Rules"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      {/* 1. Appearance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Terminal Theme</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Select your primary terminal background & contrast style:
        </Text>
        <View style={styles.grid}>
          {Object.values(THEME_PRESETS).map((t) => {
            const isSelected = t.id === themeId;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.8}
                onPress={() => setThemeId(t.id)}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: t.card,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  },
                ]}
              >
                <View style={[styles.previewCircle, { backgroundColor: t.bg }]} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.themeName, { color: t.text }]}>{t.name}</Text>
                  <Text style={[styles.themeDesc, { color: t.textMuted }]}>{t.description}</Text>
                </View>
                {isSelected && (
                  <View style={[styles.activeIndicator, { backgroundColor: theme.colors.accentDim }]}>
                    <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Accent Colors */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Accent Palette</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Buttons, highlights, metrics, and active states:
        </Text>
        <View style={styles.accentRow}>
          {Object.values(ACCENT_PRESETS).map((a) => {
            const isSelected = a.id === accentId;
            return (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.8}
                onPress={() => setAccentId(a.id)}
                style={[
                  styles.accentCircle,
                  {
                    backgroundColor: a.color,
                    borderColor: isSelected ? '#FFFFFF' : 'transparent',
                    borderWidth: isSelected ? 3.5 : 0,
                  },
                ]}
              >
                {isSelected && <Text style={styles.accentCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Notification Preferences */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Discipline Reminders</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Scheduled local reminders for preparation and routine:
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Master Reminders</Text>
              <Text style={[styles.switchDesc, { color: theme.colors.textMuted }]}>
                Enable all local schedule notifications
              </Text>
            </View>
            <Switch
              value={notifSettings.masterEnabled}
              onValueChange={(v: boolean) => updateNotifSetting('masterEnabled', v)}
            />
          </View>

          {notifSettings.masterEnabled && (
            <>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Pre-Market Plan Reminder</Text>
                  <Text style={[styles.switchDesc, { color: theme.colors.textMuted }]}>
                    Daily at {notifSettings.preMarketTime} EST before open
                  </Text>
                </View>
                <Switch
                  value={notifSettings.preMarketReminder}
                  onValueChange={(v: boolean) => updateNotifSetting('preMarketReminder', v)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Daily Reflection Reminder</Text>
                  <Text style={[styles.switchDesc, { color: theme.colors.textMuted }]}>
                    Daily at {notifSettings.eodReflectionTime} EST after close
                  </Text>
                </View>
                <Switch
                  value={notifSettings.eodReflectionReminder}
                  onValueChange={(v: boolean) => updateNotifSetting('eodReflectionReminder', v)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Weekly Goal Checkpoint</Text>
                  <Text style={[styles.switchDesc, { color: theme.colors.textMuted }]}>
                    Weekly on {notifSettings.weeklyGoalDay} evening
                  </Text>
                </View>
                <Switch
                  value={notifSettings.weeklyGoalReminder}
                  onValueChange={(v: boolean) => updateNotifSetting('weeklyGoalReminder', v)}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.summaryList}>
          {remindersSummary.map((item, idx) => (
            <Text key={idx} style={[styles.summaryItemText, { color: theme.colors.accent }]}>
              • {item}
            </Text>
          ))}
        </View>
      </View>

      {/* 3. Trading Models */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trading Models</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
              Used in the Trade Log setup dropdown & model performance analytics:
            </Text>
          </View>
          <Button
            title="+ Add Model"
            onPress={() => openAdd('model')}
            variant="primary"
            size="sm"
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          {models.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No trading models added yet.</Text>
          ) : (
            models.map((model, idx) => (
              <View
                key={`${model}-${idx}`}
                style={[
                  styles.itemRow,
                  idx < models.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{model}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => openEdit('model', model)}
                    style={[styles.actionBtn, { backgroundColor: theme.colors.bgElevated }]}
                  >
                    <Text style={{ color: theme.colors.accent, fontSize: 12.5, fontWeight: '600' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete('model', model)}
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                  >
                    <Text style={{ color: theme.colors.semantic.danger, fontSize: 12.5, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 4. Risk Management Checklist */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Risk Management Checklist</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
              Criteria evaluated in your pre-trade risk checklist & discipline score:
            </Text>
          </View>
          <Button
            title="+ Add Rule"
            onPress={() => openAdd('risk')}
            variant="primary"
            size="sm"
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          {riskCriteria.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No risk criteria configured.</Text>
          ) : (
            riskCriteria.map((crit, idx) => (
              <View
                key={`${crit}-${idx}`}
                style={[
                  styles.itemRow,
                  idx < riskCriteria.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{crit}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => openEdit('risk', crit)}
                    style={[styles.actionBtn, { backgroundColor: theme.colors.bgElevated }]}
                  >
                    <Text style={{ color: theme.colors.accent, fontSize: 12.5, fontWeight: '600' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete('risk', crit)}
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                  >
                    <Text style={{ color: theme.colors.semantic.danger, fontSize: 12.5, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 5. Trade Execution Checklist */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trade Execution Checklist</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
              Criteria verified during trade execution & rule compliance analytics:
            </Text>
          </View>
          <Button
            title="+ Add Rule"
            onPress={() => openAdd('checklist')}
            variant="primary"
            size="sm"
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          {checklistCriteria.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No execution criteria configured.</Text>
          ) : (
            checklistCriteria.map((crit, idx) => (
              <View
                key={`${crit}-${idx}`}
                style={[
                  styles.itemRow,
                  idx < checklistCriteria.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{crit}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => openEdit('checklist', crit)}
                    style={[styles.actionBtn, { backgroundColor: theme.colors.bgElevated }]}
                  >
                    <Text style={{ color: theme.colors.accent, fontSize: 12.5, fontWeight: '600' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete('checklist', crit)}
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                  >
                    <Text style={{ color: theme.colors.semantic.danger, fontSize: 12.5, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 6. Security (Password Reset) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Security & Account</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Authentication is securely managed by Supabase Auth:
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          <View style={styles.securityRow}>
            <Text style={[styles.securityLabel, { color: theme.colors.textMuted }]}>Signed in as:</Text>
            <Text style={[styles.securityValue, { color: theme.colors.text }]}>{user?.email || 'Active Trader'}</Text>
          </View>

          {resetMessage && (
            <View
              style={[
                styles.messageBanner,
                {
                  backgroundColor:
                    resetMessage.type === 'success' ? 'rgba(46, 213, 115, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  borderColor:
                    resetMessage.type === 'success' ? theme.colors.semantic.success : theme.colors.semantic.danger,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    resetMessage.type === 'success' ? theme.colors.semantic.success : theme.colors.semantic.danger,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {resetMessage.text}
              </Text>
            </View>
          )}

          <Button
            title={resetSending ? 'Sending Reset Email...' : 'Send Password Reset Email'}
            onPress={handlePasswordReset}
            loading={resetSending}
            variant="outline"
            size="md"
            style={{ marginTop: 6 }}
          />
        </View>
      </View>

      {/* 7. Data & System Maintenance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data & Maintenance</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Reset configuration or manage JSON backup files:
        </Text>

        <View style={{ gap: 10 }}>
          <Button
            title="Reset Models & Checklists to Defaults"
            onPress={handleResetSystem}
            variant="outline"
            size="md"
          />

          <Button
            title="Go to Backup / Restore"
            onPress={() => navigation.navigate('BackupRestore')}
            variant="ghost"
            size="md"
          />

          <Button
            title="Reset Appearance to Default"
            onPress={resetAppearance}
            variant="ghost"
            size="md"
          />
        </View>
      </View>

      {/* 8. About Section */}
      <View style={[styles.section, { marginBottom: 36 }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About EdgeJournal</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          <Text style={[styles.aboutTitle, { color: theme.colors.text }]}>EdgeJournal Mobile</Text>
          <Text style={[styles.aboutVersion, { color: theme.colors.accent }]}>v2.3.0 Stable Parity</Text>
          <Text style={[styles.aboutDesc, { color: theme.colors.textMuted }]}>
            Professional trading journal with rule compliance, psychology matrix, mistake intelligence, and canonical Edge AI context.
          </Text>
        </View>
      </View>

      {/* Add / Edit Modal */}
      <Modal visible={editModalVisible} onClose={() => setEditModalVisible(false)} title={modalTitle}>
        <Input
          label={
            editTarget?.type === 'model'
              ? 'Model Name'
              : 'Criterion Description'
          }
          placeholder={
            editTarget?.type === 'model'
              ? 'e.g. Range Breakout, Fair Value Gap...'
              : 'e.g. Stop loss set at invalidation point...'
          }
          value={draftValue}
          onChangeText={(t) => {
            setDraftValue(t);
            setDraftError('');
          }}
          autoFocus
        />

        {draftError ? (
          <Text style={[styles.errorText, { color: theme.colors.semantic.danger }]}>{draftError}</Text>
        ) : null}

        <View style={styles.modalActionRow}>
          <Button
            title="Cancel"
            onPress={() => setEditModalVisible(false)}
            variant="ghost"
            size="md"
            style={{ flex: 1 }}
          />
          <Button
            title="Save"
            onPress={handleSaveDraft}
            variant="primary"
            size="md"
            style={{ flex: 1 }}
          />
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} onClose={() => setDeleteModalVisible(false)} title="Confirm Removal">
        <Text style={[styles.deleteConfirmText, { color: theme.colors.text }]}>
          Are you sure you want to remove &quot;{deleteTarget?.value}&quot;?
        </Text>
        <Text style={[styles.deleteConfirmSub, { color: theme.colors.textMuted }]}>
          Existing saved trades will preserve their history, but this option will no longer appear in new trade selections.
        </Text>

        <View style={styles.modalActionRow}>
          <Button
            title="Cancel"
            onPress={() => setDeleteModalVisible(false)}
            variant="ghost"
            size="md"
            style={{ flex: 1 }}
          />
          <Button
            title="Delete"
            onPress={executeDelete}
            variant="danger"
            size="md"
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  grid: {
    gap: 10,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  previewCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  themeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  themeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  activeIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 6,
  },
  accentCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentCheck: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  card: {
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryList: {
    marginTop: 8,
    gap: 4,
  },
  summaryItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    paddingRight: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityLabel: {
    fontSize: 13.5,
  },
  securityValue: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  messageBanner: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  aboutVersion: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  aboutDesc: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 12.5,
    marginBottom: 8,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  deleteConfirmSub: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
});
