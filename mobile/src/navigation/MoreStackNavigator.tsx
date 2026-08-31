import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../types/navigation';
import { MoreMenuScreen } from '../screens/more/MoreMenuScreen';
import { PreMarketScreen } from '../screens/more/PreMarketScreen';
import { PsychologyScreen } from '../screens/more/PsychologyScreen';
import { ReflectionsScreen } from '../screens/more/ReflectionsScreen';
import { StudyScreen } from '../screens/more/StudyScreen';
import { GoalsScreen } from '../screens/more/GoalsScreen';
import { ChallengesScreen } from '../screens/more/ChallengesScreen';
import { ProfileScreen } from '../screens/more/ProfileScreen';
import { SettingsScreen } from '../screens/more/SettingsScreen';
import { BackupRestoreScreen } from '../screens/more/BackupRestoreScreen';
import { AccountsScreen } from '../screens/more/AccountsScreen';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="PreMarket" component={PreMarketScreen} />
      <Stack.Screen name="Psychology" component={PsychologyScreen} />
      <Stack.Screen name="Reflections" component={ReflectionsScreen} />
      <Stack.Screen name="Study" component={StudyScreen} />
      <Stack.Screen name="Goals" component={GoalsScreen} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
    </Stack.Navigator>
  );
}
