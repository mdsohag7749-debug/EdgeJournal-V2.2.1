import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/navigation';
import { HomeScreen } from '../screens/main/HomeScreen';
import { JournalScreen } from '../screens/main/JournalScreen';
import { AnalyticsScreen } from '../screens/main/AnalyticsScreen';
import { EdgeAIScreen } from '../screens/main/EdgeAIScreen';
import { MoreStackNavigator } from './MoreStackNavigator';
import { useTheme } from '../hooks/useTheme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="JournalTab"
        component={JournalScreen}
        options={{
          tabBarLabel: 'Journal',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📖</Text>,
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="EdgeAITab"
        component={EdgeAIScreen}
        options={{
          tabBarLabel: 'Edge AI',
          tabBarActiveTintColor: theme.colors.semantic.aiAccent,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✨</Text>,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>•••</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
