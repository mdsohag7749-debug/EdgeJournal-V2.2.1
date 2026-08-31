import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'ai';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.card;
    switch (variant) {
      case 'primary':
        return theme.colors.accent;
      case 'secondary':
        return theme.colors.card;
      case 'outline':
      case 'ghost':
        return 'transparent';
      case 'danger':
        return theme.colors.semantic.danger;
      case 'ai':
        return theme.colors.semantic.aiAccent;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textFaint;
    switch (variant) {
      case 'primary':
      case 'danger':
      case 'ai':
        return '#FFFFFF';
      case 'secondary':
        return theme.colors.text;
      case 'outline':
        return theme.colors.accent;
      case 'ghost':
        return theme.colors.textMuted;
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') {
      return disabled ? theme.colors.border : theme.colors.accent;
    }
    if (variant === 'secondary') {
      return theme.colors.border;
    }
    return 'transparent';
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return 34;
      case 'md':
        return 44;
      case 'lg':
        return 52;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return theme.typography.sizes.sm;
      case 'md':
        return theme.typography.sizes.base;
      case 'lg':
        return theme.typography.sizes.md;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
          height: getHeight(),
          borderRadius: theme.radii.md,
          paddingHorizontal: size === 'sm' ? 12 : 18,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
                fontWeight: theme.typography.weights.semibold,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    textAlign: 'center',
  },
});
