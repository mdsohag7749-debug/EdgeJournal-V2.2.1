import React, { ReactNode } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, StatusBar, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface ScreenContainerProps {
  children?: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
}: ScreenContainerProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.bg}
      />
      {scrollable ? (
        <ScrollView
          style={[styles.container, style]}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.container, styles.fixedContent, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  fixedContent: {
    padding: 16,
  },
});
