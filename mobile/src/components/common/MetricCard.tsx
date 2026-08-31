import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  subtitle?: string;
  style?: ViewStyle;
}

export function MetricCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  subtitle,
  style,
}: MetricCardProps) {
  const { theme } = useTheme();

  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return theme.colors.semantic.success;
      case 'negative':
        return theme.colors.semantic.danger;
      default:
        return theme.colors.textMuted;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
        theme.shadows.subtle,
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
        {icon && <View style={styles.iconWrapper}>{icon}</View>}
      </View>
      <Text style={[styles.value, { color: theme.colors.text }]}>{value}</Text>
      {(change || subtitle) && (
        <View style={styles.footerRow}>
          {change ? (
            <Text style={[styles.change, { color: getChangeColor() }]}>{change}</Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.textFaint }]}>{subtitle}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    flex: 1,
    minWidth: 140,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrapper: {
    opacity: 0.8,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  change: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  subtitle: {
    fontSize: 11,
  },
});
