import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';

import { Icon } from '../components/Icon';
import { AlertsScreen } from '../screens/AlertsScreen';
import { CompareScreen } from '../screens/CompareScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme';
import { HomeStack } from './HomeStack';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof Icon>['name'];

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Icon name={name} color={color} />;
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
          tabBarIcon: ({ color }) => <TabIcon name="waves" color={color} />,
        }}
      />
      <Tab.Screen
        name="CompareTab"
        component={CompareScreen}
        options={{
          tabBarLabel: 'Compare',
          tabBarIcon: ({ color }) => <TabIcon name="scale" color={color} />,
        }}
      />
      <Tab.Screen
        name="AlertsTab"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
