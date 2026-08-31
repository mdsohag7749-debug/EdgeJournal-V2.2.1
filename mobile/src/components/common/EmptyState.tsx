import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  description,
  actionTitle,
  onAction,
  icon,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>
        {description}
      </Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.actionBtn}
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
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionBtn: {
    minWidth: 160,
  },
});
