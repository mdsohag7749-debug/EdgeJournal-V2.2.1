import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'neutral' | 'ai';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
  key?: React.Key;
}

export function Badge({ label, variant = 'neutral', size = 'sm', style, textStyle }: BadgeProps) {
  const { theme } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: theme.colors.semantic.successDim,
          text: theme.colors.semantic.success,
          border: 'rgba(16, 185, 129, 0.25)',
        };
      case 'danger':
        return {
          bg: theme.colors.semantic.dangerDim,
          text: theme.colors.semantic.danger,
          border: 'rgba(239, 68, 68, 0.25)',
        };
      case 'warning':
        return {
          bg: theme.colors.semantic.warningDim,
          text: theme.colors.semantic.warning,
          border: 'rgba(245, 158, 11, 0.25)',
        };
      case 'info':
        return {
          bg: theme.colors.semantic.infoDim,
          text: theme.colors.semantic.info,
          border: 'rgba(59, 130, 246, 0.25)',
        };
      case 'accent':
        return {
          bg: theme.colors.accentDim,
          text: theme.colors.accent,
          border: theme.colors.accentGlow,
        };
      case 'ai':
        return {
          bg: theme.colors.semantic.aiAccentDim,
          text: theme.colors.semantic.aiAccent,
          border: theme.colors.semantic.aiAccentGlow,
        };
      case 'neutral':
      default:
        return {
          bg: theme.colors.cardHover,
          text: theme.colors.textMuted,
          border: theme.colors.border,
        };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderRadius: theme.radii.full,
          paddingHorizontal: size === 'sm' ? 8 : 12,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: size === 'sm' ? theme.typography.sizes.xs : theme.typography.sizes.sm,
            fontWeight: theme.typography.weights.semibold,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    letterSpacing: 0.2,
  },
});
