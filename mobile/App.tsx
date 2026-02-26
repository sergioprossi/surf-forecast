import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { AuthProvider } from './src/auth/AuthContext';
import { MainTabs } from './src/navigation/MainTabs';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.surfaceBorder,
    primary: colors.accent,
  },
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <MainTabs />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
