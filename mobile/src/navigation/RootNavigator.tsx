import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { linking } from './linking';
import { AuthStackNavigator } from './AuthStackNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { TradeDetailsScreen } from '../screens/journal/TradeDetailsScreen';
import { AddTradeScreen } from '../screens/journal/AddTradeScreen';
import { EditTradeScreen } from '../screens/journal/EditTradeScreen';
import { useAuth } from '../hooks/useAuth';
import { LoadingState } from '../components/common';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState message="Restoring session..." />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="TradeDetails"
              component={TradeDetailsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="AddTrade"
              component={AddTradeScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen
              name="EditTrade"
              component={EditTradeScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStackNavigator} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
