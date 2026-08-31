import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface LoadingStateProps {
  message?: string;
  style?: ViewStyle;
}

export function LoadingState({ message = 'Loading...', style }: LoadingStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
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
  message: {
    marginTop: 12,
    fontSize: 14,
  },
});
