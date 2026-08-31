import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Header, AccountSelector } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';

interface MenuItem {
  title: string;
  subtitle: string;
  route: string;
  icon: string;
}

const MENU_ITEMS: MenuItem[] = [
  { title: 'Pre-Market Plan', subtitle: 'Daily bias, watchlist & key levels', route: 'PreMarket', icon: '📝' },
  { title: 'Psychology', subtitle: 'Emotional tracking & mindset check-ins', route: 'Psychology', icon: '🧠' },
  { title: 'Reflections', subtitle: 'End-of-day reviews and daily grades', route: 'Reflections', icon: '💡' },
  { title: 'Study', subtitle: 'Playbook, mistakes & chart library', route: 'Study', icon: '📚' },
  { title: 'Goals', subtitle: 'Milestones and consistency targets', route: 'Goals', icon: '🎯' },
  { title: 'Challenges', subtitle: 'Trader discipline and consistency sprints', route: 'Challenges', icon: '🏆' },
  { title: 'Accounts', subtitle: 'Multi-account management & balances', route: 'Accounts', icon: '💳' },
  { title: 'Profile', subtitle: 'Trader info and account credentials', route: 'Profile', icon: '👤' },
  { title: 'Settings', subtitle: 'Themes, appearance & preferences', route: 'Settings', icon: '⚙️' },
  { title: 'Backup / Restore', subtitle: 'Data export, JSON & snapshots', route: 'BackupRestore', icon: '💾' },
];

export function MoreMenuScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { logout } = useAuth();

  return (
    <ScreenContainer scrollable>
      <Header title="More Features" rightAction={<AccountSelector />} />

      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(item.route)}
            style={[
              styles.menuCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.base,
              },
            ]}
          >
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.menuTitle, { color: theme.colors.text }]}>{item.title}</Text>
              <Text style={[styles.menuSubtitle, { color: theme.colors.textMuted }]}>{item.subtitle}</Text>
            </View>
            <Text style={[styles.chevron, { color: theme.colors.textFaint }]}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => logout()}
          style={[
            styles.menuCard,
            styles.logoutCard,
            {
              backgroundColor: theme.colors.semantic.dangerDim,
              borderColor: 'rgba(239, 68, 68, 0.25)',
              borderRadius: theme.radii.base,
            },
          ]}
        >
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🚪</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.menuTitle, { color: theme.colors.semantic.danger }]}>Sign Out</Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.textMuted }]}>End your active session</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  menuList: {
    marginTop: 12,
    gap: 8,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
  },
  logoutCard: {
    marginTop: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
  },
});
