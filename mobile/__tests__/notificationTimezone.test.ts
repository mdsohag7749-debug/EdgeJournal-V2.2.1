// Test: Notification Timezone & Local Scheduling
// Verifies that reminders are scheduled using local device time (wall-clock),
// not hardcoded UTC or any fixed timezone offset.

import { notificationsService, DEFAULT_NOTIFICATION_SETTINGS } from '../../mobile/src/services/notificationsService';

describe('Notification Timezone Behavior', () => {
  it('calculateNextTriggerDate returns a Date in the future for a daily reminder', () => {
    const now = new Date();
    // Use a time 1 minute ago to force scheduling tomorrow
    const pastTime = new Date(now.getTime() - 60 * 1000);
    const pastHH = String(pastTime.getHours()).padStart(2, '0');
    const pastMM = String(pastTime.getMinutes()).padStart(2, '0');

    const trigger = notificationsService.calculateNextTriggerDate(`${pastHH}:${pastMM}`, undefined, now);
    // Should be tomorrow (next day)
    expect(trigger.getTime()).toBeGreaterThan(now.getTime());
  });

  it('calculateNextTriggerDate returns same-day trigger if time is in the future', () => {
    const now = new Date();
    // Use a time 1 hour from now
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    const futureHH = String(future.getHours()).padStart(2, '0');
    const futureMM = String(future.getMinutes()).padStart(2, '0');

    const trigger = notificationsService.calculateNextTriggerDate(`${futureHH}:${futureMM}`, undefined, now);
    expect(trigger.getTime()).toBeGreaterThan(now.getTime());
    // Should be today (same date)
    expect(trigger.getDate()).toBe(future.getDate());
  });

  it('uses local getHours/getMinutes — no hardcoded UTC offset', () => {
    const now = new Date();
    const trigger = notificationsService.calculateNextTriggerDate('08:30', undefined, now);
    // The trigger's LOCAL hours and minutes must match the requested time
    // (or be tomorrow at 08:30 if past for today)
    expect(trigger.getHours()).toBe(8);
    expect(trigger.getMinutes()).toBe(30);
  });

  it('calculateNextTriggerDate with weekday schedules correct day of week', () => {
    // Reference date: use a Monday (day 1)
    const monday = new Date('2026-09-07T10:00:00'); // Monday
    const sundayTrigger = notificationsService.calculateNextTriggerDate('08:00', 'Sunday', monday);
    // Next Sunday from Monday
    expect(sundayTrigger.getDay()).toBe(0); // 0 = Sunday
    expect(sundayTrigger.getTime()).toBeGreaterThan(monday.getTime());
  });

  it('weekly goal reminder summary shows local time annotation', () => {
    const summary = notificationsService.getScheduledRemindersSummary(DEFAULT_NOTIFICATION_SETTINGS);
    const weeklyLine = summary.find((s) => s.includes('Goal Review'));
    expect(weeklyLine).toBeDefined();
    expect(weeklyLine).toContain('Local Time');
  });

  it('daily pre-market reminder summary shows local time annotation', () => {
    const summary = notificationsService.getScheduledRemindersSummary(DEFAULT_NOTIFICATION_SETTINGS);
    const preMarketLine = summary.find((s) => s.includes('Pre-Market'));
    expect(preMarketLine).toBeDefined();
    expect(preMarketLine).toContain('08:30');
    expect(preMarketLine).toContain('Local Time');
  });
});
