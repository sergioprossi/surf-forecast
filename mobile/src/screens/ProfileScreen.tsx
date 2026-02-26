import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { colors, radius, spacing } from '../theme';

export function ProfileScreen() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>&#x1F3C4;</Text>
      <Text style={styles.title}>Profile</Text>

      {isAuthenticated ? (
        <>
          <Text style={styles.status}>Signed in</Text>
          <Pressable
            onPress={() => {
              Alert.alert('Sign out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: logout },
              ]);
            }}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Sign Out</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.status}>
          Sign in to rate sessions and customize alerts
        </Text>
      )}

      <Text style={styles.version}>Porto Surf v1.0.0</Text>
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
    gap: 16,
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
  status: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    color: colors.textTertiary,
    position: 'absolute',
    bottom: 32,
  },
});
