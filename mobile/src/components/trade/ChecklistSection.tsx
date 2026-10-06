import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { DEFAULT_RISK_CRITERIA, DEFAULT_CHECKLIST_CRITERIA } from '../../utils/psychologyUtils';

export { DEFAULT_RISK_CRITERIA, DEFAULT_CHECKLIST_CRITERIA } from '../../utils/psychologyUtils';

interface ChecklistSectionProps {
  title: string;
  criteria: string[];
  values: Record<string, boolean>;
  onChange: (values: Record<string, boolean>) => void;
}

export function ChecklistSection({
  title,
  criteria,
  values = {},
  onChange,
}: ChecklistSectionProps) {
  const { theme } = useTheme();

  const checkedCount = criteria.filter((c) => !!values[c]).length;
  const isAllChecked = criteria.length > 0 && checkedCount === criteria.length;

  const toggleItem = (item: string) => {
    const updated = { ...values, [item]: !values[item] };
    onChange(updated);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isAllChecked
                ? 'rgba(46, 213, 115, 0.18)'
                : 'rgba(255, 255, 255, 0.06)',
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: isAllChecked
                  ? theme.colors.semantic.success
                  : theme.colors.textMuted,
              },
            ]}
          >
            {checkedCount}/{criteria.length}
          </Text>
        </View>
      </View>

      {/* Criteria Items List */}
      <View style={styles.list}>
        {criteria.map((item) => {
          const checked = !!values[item];

          return (
            <TouchableOpacity
              key={item}
              activeOpacity={0.7}
              onPress={() => toggleItem(item)}
              style={[
                styles.itemRow,
                {
                  backgroundColor: checked
                    ? 'rgba(46, 213, 115, 0.07)'
                    : theme.colors.bgElevated,
                  borderColor: checked
                    ? 'rgba(46, 213, 115, 0.3)'
                    : theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: checked
                      ? theme.colors.semantic.success
                      : 'transparent',
                    borderColor: checked
                      ? theme.colors.semantic.success
                      : theme.colors.borderStrong,
                  },
                ]}
              >
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text
                style={[
                  styles.itemText,
                  {
                    color: checked ? theme.colors.text : theme.colors.textMuted,
                    fontWeight: checked ? '600' : '400',
                  },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
