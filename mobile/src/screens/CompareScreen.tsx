import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function CompareScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>&#x2696;</Text>
      <Text style={styles.title}>Compare Spots</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
      <Text style={styles.description}>
        Side-by-side comparison of conditions across Matosinhos, Leca, and Espinho
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
