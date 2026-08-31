import { notificationsService, NotificationSettings } from '../src/services/notificationsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Notifications & Reminders Service', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads default settings when no preferences are saved', async () => {
    const settings = await notificationsService.loadSettings();
    expect(settings.masterEnabled).toBe(true);
    expect(settings.preMarketReminder).toBe(true);
    expect(settings.preMarketTime).toBe('08:30');
  });

  it('saves and restores custom user notification schedules', async () => {
    const custom: NotificationSettings = {
      masterEnabled: true,
      preMarketReminder: true,
      preMarketTime: '09:00',
      eodReflectionReminder: false,
      eodReflectionTime: '17:00',
      weeklyGoalReminder: true,
      weeklyGoalDay: 'Monday',
    };

    await notificationsService.saveSettings(custom);
    const loaded = await notificationsService.loadSettings();
    expect(loaded.preMarketTime).toBe('09:00');
    expect(loaded.eodReflectionReminder).toBe(false);
  });

  it('generates accurate human-readable reminders summary', () => {
    const custom: NotificationSettings = {
      masterEnabled: true,
      preMarketReminder: true,
      preMarketTime: '08:45',
      eodReflectionReminder: true,
      eodReflectionTime: '16:30',
      weeklyGoalReminder: false,
      weeklyGoalDay: 'Sunday',
    };

    const summary = notificationsService.getScheduledRemindersSummary(custom);
    expect(summary.length).toBe(2);
    expect(summary[0]).toContain('08:45');
    expect(summary[1]).toContain('16:30');
  });
});
