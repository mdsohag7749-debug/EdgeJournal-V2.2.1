// Theme & Accent presets matching Web & Stitch Mobile Visual Design System

export interface ThemeColors {
  id: string;
  name: string;
  description: string;
  bg: string;
  bgElevated: string;
  card: string;
  cardHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  previewBg: string;
  previewCard: string;
}

export interface AccentColor {
  id: string;
  name: string;
  color: string;
  strong: string;
  glow: string;
  dim: string;
}

export const THEME_PRESETS: Record<string, ThemeColors> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Black',
    description: 'Default dark mode with deep contrast',
    bg: '#0B0D11',
    bgElevated: '#10151D',
    card: '#141922',
    cardHover: '#1c2330',
    border: 'rgba(255, 255, 255, 0.08)',
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

export const ACCENT_PRESETS: Record<string, AccentColor> = {
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

export const SEMANTIC_COLORS = {
  success: '#10B981',
  successDim: 'rgba(16, 185, 129, 0.15)',
  danger: '#EF4444',
  dangerDim: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningDim: 'rgba(245, 158, 11, 0.15)',
  info: '#3B82F6',
  infoDim: 'rgba(59, 130, 246, 0.15)',
  aiAccent: '#8B5CF6',
  aiAccentGlow: 'rgba(139, 92, 246, 0.25)',
  aiAccentDim: 'rgba(139, 92, 246, 0.12)',
  chartGreen: '#10B981',
  chartRed: '#EF4444',
  chartBlue: '#3B82F6',
  chartPurple: '#8B5CF6',
  chartNeutral: '#64748B',
};
