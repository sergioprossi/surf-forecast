import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';

import { AlertsScreen } from '../screens/AlertsScreen';
import { CompareScreen } from '../screens/CompareScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme';
import { HomeStack } from './HomeStack';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ color: focused ? colors.accent : colors.textTertiary, fontSize: 20 }}>
      {label}
    </Text>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="🏄" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CompareTab"
        component={CompareScreen}
        options={{
          tabBarLabel: 'Compare',
          tabBarIcon: ({ focused }) => <TabIcon label="⚖️" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AlertsTab"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon label="🔔" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
