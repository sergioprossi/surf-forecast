import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { HomeScreen } from '../screens/HomeScreen';
import { SpotDetailScreen } from '../screens/SpotDetailScreen';
import { colors } from '../theme';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SpotDetail"
        component={SpotDetailScreen}
        options={({ route }) => ({
          title: route.params.spotName,
          headerBackTitle: 'Back',
        })}
      />
    </Stack.Navigator>
  );
}
