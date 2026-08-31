import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

export interface NotificationSettings {
  masterEnabled: boolean;
  preMarketReminder: boolean;
  preMarketTime: string; // "08:30" (Local device time)
  eodReflectionReminder: boolean;
  eodReflectionTime: string; // "16:15" (Local device time)
  weeklyGoalReminder: boolean;
  weeklyGoalDay: string; // "Sunday" (Local device day)
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  masterEnabled: true,
  preMarketReminder: true,
  preMarketTime: '08:30',
  eodReflectionReminder: true,
  eodReflectionTime: '16:15',
  weeklyGoalReminder: true,
  weeklyGoalDay: 'Sunday',
};

const STORAGE_KEY = 'ej_mobile_notification_settings';

const DAYS_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const notificationsService = {
  /**
   * Loads current notification settings from local persistent storage.
   */
  async loadSettings(): Promise<NotificationSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
      logger.warn('SYSTEM', 'Failed to load notification settings from storage');
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  },

  /**
   * Saves updated notification settings to local persistent storage.
   */
  async saveSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      logger.info('SYSTEM', 'Notification settings successfully updated');
    } catch (e) {
      logger.warn('SYSTEM', 'Failed to save notification settings');
    }
  },

  /**
   * Calculates next trigger Date in the DEVICE'S LOCAL TIMEZONE.
   *
   * Timezone & Daylight Saving Behavior:
   * - Operates on local Date methods (`getHours()`, `getMinutes()`, `setHours()`, `setMinutes()`).
   * - No hardcoded UTC or fixed regional timezone offsets (e.g. BST/UTC+6).
   * - Automatically shifts alongside OS daylight saving transitions.
   */
  calculateNextTriggerDate(timeString: string, dayOfWeek?: string, referenceDate = new Date()): Date {
    const [hourStr, minuteStr] = timeString.split(':');
    const targetHour = parseInt(hourStr || '8', 10);
    const targetMinute = parseInt(minuteStr || '30', 10);

    const trigger = new Date(referenceDate.getTime());
    trigger.setHours(targetHour, targetMinute, 0, 0);

    if (dayOfWeek !== undefined && DAYS_MAP[dayOfWeek] !== undefined) {
      const targetDay = DAYS_MAP[dayOfWeek];
      const currentDay = trigger.getDay();
      let diff = targetDay - currentDay;
      if (diff < 0 || (diff === 0 && trigger.getTime() <= referenceDate.getTime())) {
        diff += 7;
      }
      trigger.setDate(trigger.getDate() + diff);
    } else {
      // Daily reminder: if target time is in the past for today, schedule for tomorrow
      if (trigger.getTime() <= referenceDate.getTime()) {
        trigger.setDate(trigger.getDate() + 1);
      }
    }

    return trigger;
  },

  /**
   * Returns human-readable summary of active schedules.
   */
  getScheduledRemindersSummary(settings: NotificationSettings): string[] {
    if (!settings.masterEnabled) return ['All reminders currently paused.'];
    const list: string[] = [];
    if (settings.preMarketReminder) {
      list.push(`Pre-Market Plan • Daily at ${settings.preMarketTime} (Local Time)`);
    }
    if (settings.eodReflectionReminder) {
      list.push(`EOD Reflection • Daily at ${settings.eodReflectionTime} (Local Time)`);
    }
    if (settings.weeklyGoalReminder) {
      list.push(`Goal Review • Weekly on ${settings.weeklyGoalDay} (Local Time)`);
    }
    return list.length > 0 ? list : ['No specific reminders enabled.'];
  },
};
