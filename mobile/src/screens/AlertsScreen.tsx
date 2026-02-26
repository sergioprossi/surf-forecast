import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function AlertsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>&#x1F514;</Text>
      <Text style={styles.title}>Surf Alerts</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
      <Text style={styles.description}>
        Get notified when conditions hit your target score. Set custom thresholds per spot.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.accent,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
