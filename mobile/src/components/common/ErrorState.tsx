import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  style,
}: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: theme.colors.semantic.danger }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
      {onRetry && (
        <Button
          title="Retry"
          onPress={onRetry}
          variant="outline"
          size="sm"
          style={styles.retryBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    minWidth: 100,
  },
});
