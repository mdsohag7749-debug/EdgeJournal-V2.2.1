import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { ScreenContainer, Header, Button } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { THEME_PRESETS, ACCENT_PRESETS } from '../../theme';
import {
  notificationsService,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../../services/notificationsService';

export function SettingsScreen({ navigation }: { navigation: any }) {
  const { theme, themeId, accentId, setThemeId, setAccentId, resetAppearance } = useTheme();

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    notificationsService.loadSettings().then(setNotifSettings);
  }, []);

  const updateNotifSetting = (key: keyof NotificationSettings, val: any) => {
    const updated = { ...notifSettings, [key]: val };
    setNotifSettings(updated);
    notificationsService.saveSettings(updated);
  };

  const remindersSummary = notificationsService.getScheduledRemindersSummary(notifSettings);

  return (
    <ScreenContainer scrollable>
      <Header
        title="Settings"
        subtitle="Themes, Accents & Notifications"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      {/* Theme Presets */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Color Theme</Text>
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

      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Discipline Reminders</Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textMuted }]}>
          Scheduled local reminders for preparation and routine:
        </Text>

        <View
          style={[
            styles.notifCard,
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

      {/* Reset appearance */}
      <Button
        title="Reset Appearance to Default"
        onPress={resetAppearance}
        variant="outline"
        size="md"
        style={styles.resetBtn}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 12,
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
  notifCard: {
    padding: 14,
    borderWidth: 1,
    gap: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  resetBtn: {
    marginTop: 30,
    marginBottom: 30,
  },
});
