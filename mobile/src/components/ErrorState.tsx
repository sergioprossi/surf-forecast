import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface Props {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>!</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  icon: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.error,
    width: 48,
    height: 48,
    textAlign: 'center',
    lineHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.error + '22',
    overflow: 'hidden',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
