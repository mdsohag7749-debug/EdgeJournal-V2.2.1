import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  style?: ViewStyle;
}

export function Tabs({ tabs, activeTab, onTabChange, style }: TabsProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.base,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.75}
            onPress={() => onTabChange(tab.key)}
            style={[
              styles.tab,
              {
                borderRadius: theme.radii.md,
                backgroundColor: isActive ? theme.colors.accentDim : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: isActive ? theme.colors.accent : theme.colors.textMuted,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
              {tab.count !== undefined ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13,
  },
});
