import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Tabs are browsable signed-out; Auth is presented as a modal on top so
 * Login/Register can dismiss themselves with `getParent()?.goBack()`.
 */
export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Auth" component={AuthStack} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
