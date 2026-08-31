import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, buildTheme, THEME_PRESETS, ACCENT_PRESETS } from '../theme';
import { storageService } from '../services/storageService';

interface ThemeContextType {
  theme: Theme;
  themeId: string;
  accentId: string;
  setThemeId: (id: string) => void;
  setAccentId: (id: string) => void;
  resetAppearance: () => void;
}

const THEME_STORAGE_KEY = 'edgejournal_mobile_theme';
const ACCENT_STORAGE_KEY = 'edgejournal_mobile_accent';

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>('midnight');
  const [accentId, setAccentIdState] = useState<string>('crimson');

  useEffect(() => {
    storageService.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved && THEME_PRESETS[saved]) setThemeIdState(saved);
    });
    storageService.getItem(ACCENT_STORAGE_KEY).then((saved) => {
      if (saved && ACCENT_PRESETS[saved]) setAccentIdState(saved);
    });
  }, []);

  const setThemeId = (id: string) => {
    if (THEME_PRESETS[id]) {
      setThemeIdState(id);
      storageService.setItem(THEME_STORAGE_KEY, id);
    }
  };

  const setAccentId = (id: string) => {
    if (ACCENT_PRESETS[id]) {
      setAccentIdState(id);
      storageService.setItem(ACCENT_STORAGE_KEY, id);
    }
  };

  const resetAppearance = () => {
    setThemeId('midnight');
    setAccentId('crimson');
  };

  const currentTheme = buildTheme(themeId, accentId);

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        themeId,
        accentId,
        setThemeId,
        setAccentId,
        resetAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
