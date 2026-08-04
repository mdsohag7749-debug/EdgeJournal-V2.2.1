import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const THEME_PRESETS = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Black',
    description: 'Default dark mode with deep contrast',
    bg: '#0B0D11',
    bgElevated: '#10151D',
    card: '#141922',
    cardHover: '#1c2330',
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    text: '#FFFFFF',
    textMuted: '#A6B0C3',
    textFaint: '#626d82',
    previewBg: '#0B0D11',
    previewCard: '#141922',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic White',
    description: 'Clean, crisp light theme with soft slate shadows',
    bg: '#F8F9FA',
    bgElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#F1F5F9',
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.18)',
    text: '#0F172A',
    textMuted: '#475569',
    textFaint: '#94A3B8',
    previewBg: '#F8F9FA',
    previewCard: '#FFFFFF',
  },
  ocean: {
    id: 'ocean',
    name: 'Deep Ocean',
    description: 'Dark navy theme designed for financial analytical focus',
    bg: '#0A111E',
    bgElevated: '#111B2D',
    card: '#16243B',
    cardHover: '#1E304D',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    previewBg: '#0A111E',
    previewCard: '#16243B',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Terminal',
    description: 'Dark Bloomberg terminal inspired aesthetic',
    bg: '#080F0C',
    bgElevated: '#0E1A15',
    card: '#13241D',
    cardHover: '#1A3027',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    text: '#ECFDF5',
    textMuted: '#A7F3D0',
    textFaint: '#059669',
    previewBg: '#080F0C',
    previewCard: '#13241D',
  },
};

export const ACCENT_PRESETS = {
  crimson: {
    id: 'crimson',
    name: 'Crimson Red',
    color: '#C1121F',
    strong: '#780000',
    glow: 'rgba(193, 18, 31, 0.25)',
    dim: 'rgba(193, 18, 31, 0.15)',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    color: '#10B981',
    strong: '#047857',
    glow: 'rgba(16, 185, 129, 0.25)',
    dim: 'rgba(16, 185, 129, 0.15)',
  },
  blue: {
    id: 'blue',
    name: 'Royal Blue',
    color: '#3B82F6',
    strong: '#1D4ED8',
    glow: 'rgba(59, 130, 246, 0.25)',
    dim: 'rgba(59, 130, 246, 0.15)',
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    color: '#8B5CF6',
    strong: '#6D28D9',
    glow: 'rgba(139, 92, 246, 0.25)',
    dim: 'rgba(139, 92, 246, 0.15)',
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    color: '#F97316',
    strong: '#C2410C',
    glow: 'rgba(249, 115, 22, 0.25)',
    dim: 'rgba(249, 115, 22, 0.15)',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    color: '#F59E0B',
    strong: '#B45309',
    glow: 'rgba(245, 158, 11, 0.25)',
    dim: 'rgba(245, 158, 11, 0.15)',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('edgejournal_theme') || 'midnight';
  });

  const [accent, setAccentState] = useState(() => {
    return localStorage.getItem('edgejournal_accent') || 'crimson';
  });

  // Apply CSS root variables whenever theme or accent changes
  useEffect(() => {
    const root = document.documentElement;
    const t = THEME_PRESETS[theme] || THEME_PRESETS.midnight;
    const a = ACCENT_PRESETS[accent] || ACCENT_PRESETS.crimson;

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);

    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--bg-elevated', t.bgElevated);
    root.style.setProperty('--card', t.card);
    root.style.setProperty('--card-hover', t.cardHover);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--border-strong', t.borderStrong);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--text-muted', t.textMuted);
    root.style.setProperty('--text-faint', t.textFaint);

    root.style.setProperty('--red', a.color);
    root.style.setProperty('--red-strong', a.strong);
    root.style.setProperty('--red-glow', a.glow);
    root.style.setProperty('--red-dim', a.dim);

    localStorage.setItem('edgejournal_theme', theme);
    localStorage.setItem('edgejournal_accent', accent);
  }, [theme, accent]);

  function setTheme(tId) {
    if (THEME_PRESETS[tId]) setThemeState(tId);
  }

  function setAccent(aId) {
    if (ACCENT_PRESETS[aId]) setAccentState(aId);
  }

  function resetAppearance() {
    setThemeState('midnight');
    setAccentState('crimson');
  }

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent, resetAppearance, THEME_PRESETS, ACCENT_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
