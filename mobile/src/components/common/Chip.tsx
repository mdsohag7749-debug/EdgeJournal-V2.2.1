import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  key?: React.Key;
}

export function Chip({ label, selected = false, onPress, style, textStyle }: ChipProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.accentDim : theme.colors.card,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radii.full,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? theme.colors.accent : theme.colors.textMuted,
            fontSize: theme.typography.sizes.sm,
            fontWeight: selected ? theme.typography.weights.semibold : theme.typography.weights.regular,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    textAlign: 'center',
  },
});
