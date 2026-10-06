import React, { useState, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactElement;
  defaultExpanded?: boolean;
  badge?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  defaultExpanded = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`${title} section, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <View style={styles.titleRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <View style={styles.titleTextWrapper}>
            <View style={styles.mainTitleRow}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
              {badge && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: theme.colors.accent }]}>{badge}</Text>
                </View>
              )}
            </View>
            {subtitle && (
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
            )}
          </View>
        </View>

        <View
          style={[
            styles.chevronWrapper,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.chevronIcon, { color: theme.colors.textMuted }]}>
            {expanded ? '▲' : '▼'}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconContainer: {
    marginRight: 10,
  },
  titleTextWrapper: {
    flex: 1,
  },
  mainTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronIcon: {
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
