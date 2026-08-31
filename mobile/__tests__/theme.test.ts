import { buildTheme, THEME_PRESETS, ACCENT_PRESETS, SEMANTIC_COLORS } from '../src/theme';

describe('Mobile Theme Engine', () => {
  it('builds midnight theme with default crimson accent', () => {
    const theme = buildTheme('midnight', 'crimson');
    expect(theme.colors.id).toBe('midnight');
    expect(theme.colors.bg).toBe(THEME_PRESETS.midnight.bg);
    expect(theme.colors.accent).toBe(ACCENT_PRESETS.crimson.color);
    expect(theme.isDark).toBe(true);
  });

  it('builds arctic theme as light mode', () => {
    const theme = buildTheme('arctic', 'blue');
    expect(theme.colors.id).toBe('arctic');
    expect(theme.colors.bg).toBe(THEME_PRESETS.arctic.bg);
    expect(theme.colors.accent).toBe(ACCENT_PRESETS.blue.color);
    expect(theme.isDark).toBe(false);
  });

  it('contains consistent semantic and AI accent tokens', () => {
    const theme = buildTheme('ocean', 'emerald');
    expect(theme.colors.semantic.aiAccent).toBe(SEMANTIC_COLORS.aiAccent);
    expect(theme.colors.semantic.success).toBe(SEMANTIC_COLORS.success);
    expect(theme.colors.semantic.danger).toBe(SEMANTIC_COLORS.danger);
    expect(theme.typography.sizes.base).toBe(15);
    expect(theme.spacing.base).toBe(16);
    expect(theme.radii.base).toBe(12);
  });
});
