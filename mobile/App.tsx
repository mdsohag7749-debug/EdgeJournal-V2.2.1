import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { AccountProvider } from './src/context/AccountContext';
import { DataProvider } from './src/context/DataContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/common';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AccountProvider>
            <DataProvider>
              <StatusBar style="auto" />
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
            </DataProvider>
          </AccountProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
