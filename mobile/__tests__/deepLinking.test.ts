// Test: Deep Linking Configuration
// Verifies that the linking config covers all required routes.

import { linking } from '../../mobile/src/navigation/linking';

describe('Deep Linking Configuration', () => {
  it('has edgejournal:// prefix defined', () => {
    expect(linking.prefixes).toContain('edgejournal://');
  });

  it('includes https://edgejournal.app as a web prefix', () => {
    expect(linking.prefixes).toContain('https://edgejournal.app');
  });

  it('maps home route to HomeTab', () => {
    const mainScreens = (linking.config?.screens as any)?.Main?.screens;
    expect(mainScreens).toBeDefined();
    expect(mainScreens.HomeTab).toBe('home');
  });

  it('maps journal route to JournalTab', () => {
    const mainScreens = (linking.config?.screens as any)?.Main?.screens;
    expect(mainScreens.JournalTab).toBe('journal');
  });

  it('maps analytics route to AnalyticsTab', () => {
    const mainScreens = (linking.config?.screens as any)?.Main?.screens;
    expect(mainScreens.AnalyticsTab).toBe('analytics');
  });

  it('maps ai route to EdgeAITab', () => {
    const mainScreens = (linking.config?.screens as any)?.Main?.screens;
    expect(mainScreens.EdgeAITab).toBe('ai');
  });

  it('maps trade/:tradeId route to TradeDetails', () => {
    const rootScreens = linking.config?.screens as any;
    expect(rootScreens.TradeDetails).toBe('trade/:tradeId');
  });

  it('has config object defined', () => {
    expect(linking.config).toBeDefined();
    expect(linking.config?.screens).toBeDefined();
  });

  it('covers auth screens', () => {
    const authScreens = (linking.config?.screens as any)?.Auth?.screens;
    expect(authScreens).toBeDefined();
    expect(authScreens.Login).toBe('login');
    expect(authScreens.Register).toBe('register');
  });

  it('covers more menu routes', () => {
    const moreScreens = (linking.config?.screens as any)?.Main?.screens?.MoreTab?.screens;
    expect(moreScreens).toBeDefined();
    expect(moreScreens.Settings).toBe('settings');
    expect(moreScreens.Goals).toBe('goals');
    expect(moreScreens.BackupRestore).toBe('backup');
    expect(moreScreens.Accounts).toBe('accounts');
  });
});
