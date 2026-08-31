import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  ...props
}: InputProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.colors.card,
            borderColor: error ? theme.colors.semantic.danger : theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={theme.colors.textFaint}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontSize: theme.typography.sizes.base,
            },
            inputStyle,
          ]}
          {...props}
        />
        {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
      </View>
      {error ? (
        <Text style={[styles.error, { color: theme.colors.semantic.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: theme.colors.textFaint }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  leftIconContainer: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  rightIconContainer: {
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  helper: {
    fontSize: 12,
    marginTop: 4,
  },
});
