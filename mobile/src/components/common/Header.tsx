import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function Header({ title, subtitle, leftAction, rightAction }: HeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.leftRow}>
        {leftAction && <View style={styles.actionLeft}>{leftAction}</View>}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightAction && <View style={styles.actionRight}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionLeft: {
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionRight: {
    marginLeft: 12,
  },
});
